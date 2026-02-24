"""
Gemini 驱动的 BI 查询引擎：意图路由、取数/分析、代码执行。
适配自 Streamlit ChatBI 后端逻辑，无 Streamlit 依赖。
"""
import os
import re
import json
import time
import logging
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List, Tuple

# 配置文件日志
_log_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "debug.log")
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(_log_file, encoding='utf-8', mode='a'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

# 路径配置
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 从 backend/.env 加载环境变量（含 GENAI_API_KEY），不依赖 python-dotenv
_env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(_env_path):
    try:
        with open(_env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        pass
DATA_DIR = os.path.join(BASE_DIR, "data")
FIXED_FILE_NAME = "hcmdata.xlsx"
CLIENT_FILE_NAME = "structure.xlsx"

# 可选：Gemini 客户端（未配置 API Key 时不使用）
_client = None
# 缓存主数据与元数据，避免每次请求重读文件
_cached_df = None
_cached_dfs: Dict[str, pd.DataFrame] = {}  # 缓存所有已加载的 DataFrame
_cached_time_context = None
_cached_meta_data = None
_cached_heavy_loaded = False  # 标记是否已加载重型数据 (fact, ipm)


# 模型配置
FAST_MODEL = "gemini-3-flash-preview"
DEEP_MODEL = "gemini-3-pro-preview"
IMAGE_MODEL = "gemini-3-pro-image-preview"

MODEL_CHART = IMAGE_MODEL  # 6. Chart Recommendation (image_model)


def _get_client():
    global _client
    if _client is not None:
        return _client
    api_key = os.environ.get("GENAI_API_KEY", "").strip()
    if not api_key:
        print("[gemini_engine] GENAI_API_KEY 未配置或为空，将使用规则引擎。")
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
        print("[gemini_engine] Gemini 客户端初始化成功。")
        return _client
    except ImportError as e:
        print(f"[gemini_engine] google-genai 库未安装: {e}，请运行 pip install google-genai")
        return None
    except Exception as e:
        print(f"[gemini_engine] Gemini 客户端初始化失败: {e}")
        return None


def load_data(load_heavy: bool = False) -> Tuple[Optional[pd.DataFrame], Dict[str, pd.DataFrame], str]:
    """
    加载主数据及其他关联表。返回 (df_main, dfs_map, status_message)。
    load_heavy: 是否加载重型数据 (fact, ipm)，默认为 False 以加快启动速度。
    """
    dfs_map = {}
    
    # 1. 加载主表 (HCM Data)
    main_path = os.path.join(DATA_DIR, FIXED_FILE_NAME)
    if not os.path.exists(main_path):
        return None, {}, f"❌ 找不到主数据文件: {FIXED_FILE_NAME}"

    try:
        # Load Main DF
        print(f"[load_data] 开始加载主表 {FIXED_FILE_NAME}...")
        t_start = time.time()
        if FIXED_FILE_NAME.endswith(".csv"):
            df_main = pd.read_csv(main_path)
        else:
            df_main = pd.read_excel(main_path)
        print(f"[load_data] 主表加载完成，耗时 {time.time() - t_start:.2f}s")
        
        df_main.columns = df_main.columns.str.strip()
        
        # Numeric cleanup for Main DF
        for col in df_main.columns:
            if any(k in str(col) for k in ["额", "量", "Sales", "Qty", "金额"]):
                try:
                    df_main[col] = (
                        pd.to_numeric(
                            df_main[col].astype(str).str.replace(",", "", regex=False),
                            errors="coerce",
                        ).fillna(0)
                    )
                except Exception:
                    pass
        
        # Load Structure (Client) and Merge
        client_path = os.path.join(DATA_DIR, CLIENT_FILE_NAME)
        status_msg = ""
        if os.path.exists(client_path):
            try:
                if CLIENT_FILE_NAME.endswith(".csv"):
                    df_client = pd.read_csv(client_path)
                else:
                    df_client = pd.read_excel(client_path)
                df_client.columns = df_client.columns.str.strip()
                common_cols = list(set(df_main.columns) & set(df_client.columns))
                if common_cols:
                    join_key = common_cols[0]
                    if df_client[join_key].duplicated().any():
                        df_client = df_client.drop_duplicates(subset=[join_key])
                    df_main = pd.merge(df_main, df_client, on=join_key, how="left")
                    status_msg = f"✅ 已关联架构表 (Key: {join_key})"
            except Exception as e:
                status_msg = f"⚠️ 架构表读取失败: {str(e)}"
        
        dfs_map["hcm"] = df_main

        # 2. 加载其他数据表 (Fact, IPM, etc.) - 仅当 load_heavy=True 时
        if load_heavy:
            print("[load_data] 开始加载重型数据 (Fact, IPM)...")
            extra_files = {
                "fact": "fact.csv",
                "ipm": "ipmdata.xlsx"
            }

            for key, fname in extra_files.items():
                fpath = os.path.join(DATA_DIR, fname)
                if os.path.exists(fpath):
                    try:
                        t_sub = time.time()
                        if fname.endswith(".csv"):
                            df_tmp = pd.read_csv(fpath)
                        else:
                            df_tmp = pd.read_excel(fpath)
                        print(f"[load_data] 加载 {fname} 耗时 {time.time() - t_sub:.2f}s")
                        
                        df_tmp.columns = df_tmp.columns.str.strip()

                        # 特殊处理：Fact 表的销售额和销售量需要去除千分位逗号并转换为数值
                        if key == "fact":
                            for col in ['销售额', '销售量']:
                                if col in df_tmp.columns:
                                    df_tmp[col] = pd.to_numeric(
                                        df_tmp[col].astype(str).str.replace(',', '', regex=False),
                                        errors='coerce'
                                    ).fillna(0)
                            print(f"[load_data] Fact 表数值列已转换: 销售额, 销售量")

                        # 通用数值清理（其他表）
                        else:
                            for col in df_tmp.columns:
                                if any(k in str(col) for k in ["额", "量", "Sales", "Qty", "金额", "Renminbi"]):
                                    try:
                                        df_tmp[col] = pd.to_numeric(
                                            df_tmp[col].astype(str).str.replace(",", "", regex=False),
                                            errors="coerce"
                                        ).fillna(0)
                                    except:
                                        pass

                        dfs_map[key] = df_tmp
                        print(f"[load_data] 成功加载 {fname}: {len(df_tmp)} 行 x {len(df_tmp.columns)} 列")
                    except Exception as e:
                        print(f"[load_data] Failed to load {fname}: {e}")
        else:
            print("[load_data] 跳过加载重型数据 (load_heavy=False)")

        return df_main, dfs_map, status_msg
    except Exception as e:
        return None, {}, f"文件读取错误: {e}"


def analyze_time_structure(df: pd.DataFrame) -> Dict[str, Any]:
    """分析时间列结构，返回 MAT/YTD 等上下文。"""
    time_col = None
    for col in df.columns:
        if "年季" in col or "Quarter" in col or "Date" in col or "YearQuarter" in col:
            sample = str(df[col].iloc[0]) if len(df) > 0 else ""
            if "Q" in sample and len(sample) <= 8:
                time_col = col
                break
    if time_col is None:
        return {"error": "未找到标准年季列"}

    sorted_periods = sorted(df[time_col].dropna().unique().astype(str))
    max_q = sorted_periods[-1] if sorted_periods else ""
    min_q = sorted_periods[0] if sorted_periods else ""
    mat_list = sorted_periods[-4:] if len(sorted_periods) >= 4 else sorted_periods
    mat_list_prior = []
    if len(sorted_periods) >= 8:
        mat_list_prior = sorted_periods[-8:-4]
    elif len(sorted_periods) >= 4:
        mat_list_prior = sorted_periods[:-4]
    is_mat_complete = len(mat_list_prior) >= 4
    ytd_list, ytd_list_prior = [], []

    # 支持2位和4位年份格式
    year_match = re.search(r"(\d{2,4})Q", str(max_q))
    if year_match:
        curr_year = year_match.group(1)
        try:
            # 如果是2位年份，转换为2位的前一年；如果是4位，转换为4位的前一年
            if len(curr_year) == 2:
                prev_year = str(int(curr_year) - 1).zfill(2)
            else:
                prev_year = str(int(curr_year) - 1)

            ytd_list = [p for p in sorted_periods if curr_year in str(p)]
            expected_priors = [str(p).replace(curr_year, prev_year) for p in ytd_list]
            ytd_list_prior = [p for p in sorted_periods if p in expected_priors]
        except Exception:
            pass
    return {
        "col_name": time_col,
        "all_periods": sorted_periods,
        "max_q": max_q,
        "min_q": min_q,
        "mat_list": mat_list,
        "mat_list_prior": mat_list_prior,
        "is_mat_complete": is_mat_complete,
        "ytd_list": ytd_list,
        "ytd_list_prior": ytd_list_prior,
    }


def build_metadata(df: pd.DataFrame, time_context: Dict[str, Any]) -> str:
    """
    构建元数据描述字符串供 Prompt 使用。
    - 传递所有列名和数据类型
    - 非重复项 < 100 的列：全量传递所有唯一值
    - 非重复项 >= 100 的列：传递前 100 个唯一值
    """
    info = []
    info.append(f"【数据行数】: {len(df)}")
    info.append(f"【时间列名】: {time_context.get('col_name')}")
    info.append(f"【当前MAT】: {time_context.get('mat_list')}")
    info.append(f"【当前YTD】: {time_context.get('ytd_list')}")
    info.append(f"【所有列名】: {list(df.columns)}")
    info.append("")
    info.append("【各列详情】:")
    
    for col in df.columns:
        dtype = str(df[col].dtype)
        uniques = df[col].dropna().unique()
        unique_count = len(uniques)
        
        # 判断是否为数值列
        is_numeric = pd.api.types.is_numeric_dtype(df[col])
        
        if is_numeric:
            # 数值列：显示统计信息
            min_val = df[col].min()
            max_val = df[col].max()
            desc = f"- `{col}` ({dtype}) | 唯一值数: {unique_count} | 范围: [{min_val}, {max_val}]"
        else:
            # 非数值列：传递唯一值
            if unique_count < 100:
                # 少于100个，全量传递
                vals = list(uniques)
                desc = f"- `{col}` ({dtype}) | 唯一值数: {unique_count} | 全部值: {vals}"
            else:
                # 100个及以上，取前100个
                vals = list(uniques[:100])
                desc = f"- `{col}` ({dtype}) | 唯一值数: {unique_count} | 前100个值: {vals}"
        
        info.append(desc)
    
    return "\n".join(info)

def build_table_metadata(dfs: Dict[str, pd.DataFrame], time_context: Dict[str, Any]) -> str:
    """
    为指定的一组表格构建元数据描述。
    """
    info = []
    
    # 通用时间上下文
    info.append("【时间上下文详情】:")
    info.append(f"  - 时间列名: {time_context.get('col_name')}")
    info.append(f"  - 当前MAT周期 (mat_list): {time_context.get('mat_list')}")
    info.append(f"  - 当前YTD周期 (ytd_list): {time_context.get('ytd_list')}")
    info.append("")

    for name, df in dfs.items():
        info.append(f"【表格: {name}】")
        info.append(f"  - 行数: {len(df)}")
        info.append(f"  - 列名: {list(df.columns)}")
        
        for col in df.columns:
            dtype = str(df[col].dtype)
            uniques = df[col].dropna().unique()
            unique_count = len(uniques)
            
            # 判断是否为数值列
            is_numeric = pd.api.types.is_numeric_dtype(df[col])
            
            if is_numeric:
                # 数值列：显示统计信息
                min_val = df[col].min()
                max_val = df[col].max()
                desc = f"  - `{col}` ({dtype}) | 唯一值数: {unique_count} | 范围: [{min_val}, {max_val}]"
            else:
                # 非数值列：传递唯一值
                if unique_count < 50:
                    vals = list(uniques)
                    desc = f"  - `{col}` ({dtype}) | 唯一值数: {unique_count} | 值: {vals}"
                else:
                    vals = list(uniques[:20])
                    desc = f"  - `{col}` ({dtype}) | 唯一值数: {unique_count} | 示例: {vals}..."
            
            info.append(desc)
        info.append("")
    
    return "\n".join(info)


def get_history_context(messages: List[Dict], turn_limit: int = 3) -> str:
    """从消息列表生成历史上下文字符串。messages 格式 [{role, type, content}]。"""
    if not messages or len(messages) <= 1:
        return "无历史对话。"
    recent = [m for m in messages[:-1] if m.get("type") in ("text", "report_block")]
    slice_start = max(0, len(recent) - turn_limit * 2)
    target = recent[slice_start:]
    parts = []
    for msg in target:
        role = "User" if msg.get("role") == "user" else "AI"
        content_str = ""
        if msg.get("type") == "text":
            content_str = msg.get("content", "")
        elif msg.get("type") == "report_block":
            data = msg.get("content") or {}
            mode = data.get("mode", "analysis")
            if mode == "simple":
                s = data.get("summary", {})
                content_str = f"[历史取数] 意图: {s.get('intent')}, 逻辑: {s.get('logic')}"
            else:
                content_str = f"[历史分析] 意图: {data.get('intent', '')} | 洞察: {data.get('insight', '')}"
        parts.append(f"{role}: {content_str}")
    return "\n".join(parts)


def parse_response(text: str) -> Tuple[str, Optional[Dict]]:
    """从模型回复中解析 JSON，返回 (reasoning, json_data)。"""
    reasoning = text
    json_data = None
    try:
        start_idx = text.find("{")
        end_idx = text.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            potential = text[start_idx : end_idx + 1]
            try:
                json_data = json.loads(potential)
                reasoning = text[:start_idx].strip()
            except json.JSONDecodeError:
                pass
    except Exception:
        pass
    return reasoning, json_data


def normalize_result(res: Any) -> pd.DataFrame:
    """将执行结果统一转为 DataFrame。"""
    if res is None:
        return pd.DataFrame()
    if isinstance(res, pd.DataFrame):
        return res
    if isinstance(res, pd.Series):
        return res.to_frame()
    if isinstance(res, dict):
        try:
            return pd.DataFrame([res]) # Dict treated as single row
        except Exception:
            return pd.DataFrame(list(res.items()), columns=["指标", "数值"])
    if isinstance(res, list):
         try:
             return pd.DataFrame(res)
         except Exception:
             pass
    try:
        return pd.DataFrame([{"Result": str(res)}])
    except Exception:
        return pd.DataFrame({"Result": [str(res)]})


def _df_to_chart_data(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """将 DataFrame 转为前端图表格式 [{ name, value }]。智能识别维度列（文本）和指标列（数值）。"""
    if df is None:
        print(f"[_df_to_chart_data] DataFrame 为 None")
        return []
    if df.empty:
        print(f"[_df_to_chart_data] DataFrame 为空 (0行)")
        return []
    if len(df.columns) < 2:
        print(f"[_df_to_chart_data] DataFrame 列数不足: {len(df.columns)} 列, 列名: {list(df.columns)}")
        return []
    print(f"[_df_to_chart_data] DataFrame shape: {df.shape}, 列名: {list(df.columns)}")
    
    # 智能识别：找第一个非数值列作为 name（维度），第一个数值列作为 value（指标）
    name_col = None
    value_col = None
    
    for c in df.columns:
        if pd.api.types.is_numeric_dtype(df[c]):
            if value_col is None:
                value_col = c
        else:
            if name_col is None:
                name_col = c
    
    # 如果没有找到非数值列，用第一列作为 name
    if name_col is None:
        name_col = df.columns[0]
    # 如果没有找到数值列，用第二列作为 value
    if value_col is None:
        value_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]
    
    out = []
    for _, row in df.iterrows():
        try:
            val = float(row[value_col]) if pd.notna(row[value_col]) else 0
        except (TypeError, ValueError):
            val = 0
        out.append({"name": str(row[name_col]) if pd.notna(row[name_col]) else "", "value": val})
    return out


def _df_to_full_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """将 DataFrame 转为完整的 records 列表，保留所有列。"""
    if df is None:
        print(f"[_df_to_full_records] DataFrame 为 None")
        return []
    if df.empty:
        print(f"[_df_to_full_records] DataFrame 为空 (0行)")
        return []
    print(f"[_df_to_full_records] DataFrame shape: {df.shape}")
    return df.replace({np.nan: None}).to_dict(orient="records")


def _safe_generate_content(client, model_name: str, contents: str, config: Optional[Dict] = None, retries: int = 3) -> Any:
    """带重试的 generate_content。"""
    from google.genai import types
    cfg = config or types.GenerateContentConfig()
    for i in range(retries):
        try:
            return client.models.generate_content(
                model=model_name,
                contents=contents,
                config=cfg,
            )
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                if i < retries - 1:
                    time.sleep(5 * (2**i))
                    continue
            raise e
    return None


def query_gemini(prompt: str, model: str = "deep") -> str:
    """
    简单的 Gemini 查询接口
    
    Args:
        prompt: 查询提示词
        model: 模型选择，"fast" 使用 flash 模型，"deep" 使用 pro 模型
    
    Returns:
        模型返回的文本
    """
    client = _get_client()
    if not client:
        raise ValueError("Gemini 客户端未初始化，请检查 GENAI_API_KEY")
    
    model_name = DEEP_MODEL if model == "deep" else FAST_MODEL
    
    try:
        response = _safe_generate_content(client, model_name, prompt)
        if response and hasattr(response, 'text'):
            return response.text
        return ""
    except Exception as e:
        print(f"[query_gemini] 调用失败: {e}")
        raise e



def get_cached_data(need_heavy: bool = False) -> Tuple[Optional[pd.DataFrame], Optional[Dict[str, pd.DataFrame]], Optional[Dict], Optional[str]]:
    """
    获取或构建缓存的 df, dfs_map, time_context, meta_data。
    need_heavy: 是否需要重型数据 (fact, ipm)。如果需要但未加载，会触发加载。
    """
    global _cached_df, _cached_dfs, _cached_time_context, _cached_meta_data, _cached_heavy_loaded
    
    # 检查缓存是否满足需求
    if _cached_df is not None:
        # 如果不需要 heavy，只需 hcm 存在即可
        if not need_heavy:
            return _cached_df, _cached_dfs, _cached_time_context, _cached_meta_data
            
        # 如果需要 heavy
        if _cached_heavy_loaded:
            # 进一步检查 key 是否真的存在 (防止标记为 True 但实际加载失败的情况)
            has_fact = 'fact' in _cached_dfs
            has_ipm = 'ipm' in _cached_dfs
            if has_fact or has_ipm:
                return _cached_df, _cached_dfs, _cached_time_context, _cached_meta_data
            else:
                print(f"[gemini_engine] 缓存标记为 heavy_loaded 但缺少 fact/ipm key，强制重载。Current keys: {list(_cached_dfs.keys())}")
    
    # 需要加载或升级加载
    print(f"[gemini_engine] 缓存未命中或需要升级 (need_heavy={need_heavy}, loaded={_cached_heavy_loaded})，开始加载数据...")
    
    # 重新加载 (包含 hcm 和可能的 heavy data)
    df, dfs_map, status_msg = load_data(load_heavy=need_heavy)
    
    if df is None:
        print(f"[gemini_engine] 数据加载完全失败: {status_msg}")
        return None, {}, None, None
        
    _cached_df = df
    _cached_dfs = dfs_map
    _cached_time_context = analyze_time_structure(df)
    
    # 只有当确实加载了 heavy data 时才标记
    if need_heavy:
        has_heavy_data = 'fact' in dfs_map or 'ipm' in dfs_map
        _cached_heavy_loaded = has_heavy_data
        print(f"[gemini_engine] Heavy data loaded: {has_heavy_data} (Keys: {list(dfs_map.keys())})")
    else:
        _cached_heavy_loaded = False
    
    # 增强 Metadata 构建，包含所有表格信息
    meta_lines = []
    meta_lines.append(f"### 主表 (df): {len(df)} 行, 列: {list(df.columns)}")
    for k, v in dfs_map.items():
        if k != 'hcm': # hcm is main
             meta_lines.append(f"### 附表 ({k} -> df_{k}): {len(v)} 行, 列: {list(v.columns)}")
             
    # 保留原有的详细 Metadata 构建逻辑，主要针对主表
    base_meta = build_metadata(df, _cached_time_context)
    _cached_meta_data = "\n".join(meta_lines) + "\n\n" + base_meta
    
    print(f"[gemini_engine] 元数据已构建。主表 {len(df)} 行。附表 keys: {list(dfs_map.keys())}")
    return _cached_df, _cached_dfs, _cached_time_context, _cached_meta_data


def clear_cache():
    """清除缓存，下次请求时会重新加载数据和构建元数据。"""
    global _cached_df, _cached_time_context, _cached_meta_data, _client, _cached_heavy_loaded, _cached_dfs
    _cached_df = None
    _cached_dfs = {}
    _cached_time_context = None
    _cached_meta_data = None
    _cached_heavy_loaded = False
    _client = None
    print("[gemini_engine] 缓存已清除")


def get_metadata_preview() -> Dict[str, Any]:
    """获取当前元数据预览，用于调试。"""
    df, dfs_map, time_context, meta_data = get_cached_data()
    if df is None:
        return {"error": "数据未加载"}
    return {
        "rows": len(df),
        "columns": list(df.columns),
        "meta_data_length": len(meta_data) if meta_data else 0,
        "meta_data_preview": meta_data[:3000] if meta_data else "",
    }


def identify_intent(query_text: str, history_context: str = "") -> str:
    """
    识别用户意图：single_query, multi_table, irrelevant
    独立函数，供前端分步调用优化体验。
    """
    client = _get_client()
    if not client:
        return "single_query"  # 无 API Key 默认走简单模式

    meta_data = get_metadata_preview()
    router_prompt = f"""
你是一个意图分类器。根据用户问题和历史上下文，判断用户意图。

【元数据】{meta_data}
【历史记录】{history_context}

【用户问题】{query_text}

类别：
1. "single_query": 简单问题，一个表格/图表即可回答。例如"2024年销售额排名"、"各省份份额"。
2. "multi_table": 复杂问题，需要从多个角度或生产多个表格才能完整回答。例如"分析Top3产品的区域分布及增长趋势"（需要先算Top3，再分别算3个产品的区域详情，或产出多个表）。
3. "irrelevant": 与医药数据完全无关的闲聊、通用知识问答（如天气、历史）、情感问题或敏感话题。

仅输出 JSON: {{"type": "single_query" 或 "multi_table" 或 "irrelevant"}}
"""
    try:
        from google.genai import types
        router_resp = _safe_generate_content(
            client,
            FAST_MODEL,  # 1. Intent Identification (fast_model)
            router_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        if router_resp is None or not hasattr(router_resp, 'text') or not router_resp.text:
            return "single_query"
        return json.loads(router_resp.text).get("type", "single_query")
    except Exception:
        return "single_query"


def process_query_with_gemini(
    query_text: str,
    df: Optional[pd.DataFrame] = None,
    time_context: Optional[Dict[str, Any]] = None,
    meta_data: Optional[str] = None,
    history_context: str = "无历史对话。",
    model: str = "deep"
) -> Dict[str, Any]:
    """
    使用 Gemini 执行意图路由 + 取数/分析，返回统一结构：
    - 始终包含 data, title, logicDescription, config（供前端图表/表格和「保存到看板」）
    - 可选 mode, summary, tables, intent_analysis, angles, insight

    Args:
        query_text: 查询文本
        df: 数据DataFrame
        time_context: 时间上下文
        meta_data: 元数据
        history_context: 历史对话上下文
        model: 用户选择的模型 (fast/deep/image)
    """
    from google.genai import types

    print(f"[gemini_engine] 使用模型: {model}")
    print(f"[gemini_engine] 查询文本: {query_text}")

    # 根据用户选择的模型，映射到实际的 Gemini 3 系列模型
    model_mapping = {
        "fast": FAST_MODEL,
        "deep": DEEP_MODEL,
        "image": IMAGE_MODEL
    }

    actual_model = model_mapping.get(model, DEEP_MODEL)
    print(f"[gemini_engine] 实际使用的 Gemini 模型: {actual_model}")

    client = _get_client()
    if client is None:
        return {"error": "未配置 GENAI_API_KEY，无法使用 Gemini 引擎。"}

    if df is None or time_context is None or meta_data is None:
        print(f"[gemini_engine] 开始加载数据...")
        df, dfs_map, time_context, meta_data = get_cached_data()
        if df is None:
            print(f"[gemini_engine] 数据加载失败！")
            return {"error": "数据加载失败，请检查 data 目录下主数据文件。"}
        print(f"[gemini_engine] 数据加载成功，dfs_map keys: {list(dfs_map.keys())}")
    else:
        # Fallback if arguments provided but not dfs_map (this path technically won't be hit if we always use get_cached_data internally or pass explicit dict, but good safety)
        _, dfs_map, _, _ = get_cached_data()

    mat_list = time_context.get("mat_list", [])
    mat_list_prior = time_context.get("mat_list_prior", [])
    ytd_list = time_context.get("ytd_list", [])
    ytd_list_prior = time_context.get("ytd_list_prior", [])

    # 直接进入单表查询模式（已移除意图路由）
    print(f"[gemini_engine] 进入单表查询模式")

    # 数据看板只使用 HCM 和 structure 数据，不使用 fact/ipm
    # 过滤 dfs_map，只保留 hcm 表
    dashboard_dfs_map = {k: v for k, v in dfs_map.items() if k == 'hcm'}

    # 动态构建可用表格提示 - 数据看板只使用主表(HCM + structure)
    available_tables = ["df (主表，包含HCM数据和架构信息)"]
    available_tables_str = ", ".join(available_tables)
    print(f"[gemini_engine] 可用表格: {available_tables_str}")
    
    # --- [Updated] Robust Inquiry Prompt based on Reference Code ---
    simple_prompt = f"""
你是一位医药行业的 Python 专家。

【历史对话】(用于理解指代)
{history_context}

【当前用户问题】
"{query_text}"

【数据上下文】
{meta_data}

【时间上下文】MAT: {mat_list}, YTD: {ytd_list}

【可用表格】{available_tables_str}

【指令】 
1. 严格按用户要求提取字段。
2. 使用 `pd.merge` 关联两表 (除非用户只查单表)。数据源: `df` (主表), 以及 {available_tables_str}。
3. **重要**: 确保所有使用的变量（如 market_share）都在代码中明确定义。不要使用未定义的变量。
4. **绝对禁止**导入 IPython 或使用 display() 函数。
5. 禁止使用 df.columns = [...] 强行改名，请使用 df.rename()。
6. **避免 'ambiguous' 错误**：如果 index name 与 column name 冲突，请在 reset_index() 前先使用 `df.index.name = None` 或重命名索引。
7. **结果变量**：最终表格必须赋值给变量 `result`（不要用 result_df、res 等其它名字），否则系统无法提取数据。
8. **企业/产品匹配**：用户问某企业（如「康缘」）时，用主表中的「集团名称」或「生产企业」列，写法示例：`df[df['集团名称'].str.contains('康缘', na=False)]` 或 `df[df['生产企业'].str.contains('康缘', na=False)]`。
9. **份额计算强制规则**: 
   - 计算市场份额时，结果**必须乘以 100**，转换为百分数格式 (Percentage)。
   - 例如：销售额/总额 = 0.1234，应存储为 12.34，而不是 0.1234。
   - 列名必须包含 "(%)" 以提示用户，例如 "2024份额(%)"。
10. **数据类型与精度**:
   - 份额列、变化率列：必须强制转换为 `float` 类型，保留 1 位小数 (`round(1)`)。
   - 销售额列：必须使用 `astype('int64')` 转换为64位整数，避免溢出。**严禁使用 astype(int)**。
   - **严禁**对份额列使用 `astype(int)`，否则小于 1% 的份额会变成 0
11. **市场份额计算标准范式**:
    - **Step 1 (分母)**: 先计算整个定义市场的总销售额 `market_total = df_filtered.groupby('定义市场')['销售额'].sum()`
    - **Step 2 (分子)**: 再筛选特定企业/产品，计算其销售额 `target_sales = df_target.groupby('定义市场')['销售额'].sum()`
    - **Step 3 (合并)**: 使用 `pd.merge(market_total, target_sales, on='定义市场', how='left')`
    - **Step 4**: 填充 NaN 为 0，然后计算份额时**必须避免除零**：仅当分母>0时做除法，否则份额设为0。示例：`result['份额(%)'] = 0.0`；`mask = result['市场总销售额'] > 0`；`result.loc[mask, '份额(%)'] = (result.loc[mask, '目标销售额'] / result.loc[mask, '市场总销售额'] * 100).round(1)`。
12. **代码安全 - 严禁 inplace=True 后赋值**: 
    - 错误写法: `df = df.rename(..., inplace=True)` (这会导致 df 变成 None)
    - 正确写法: `df = df.rename(...)` 或 `df.rename(..., inplace=True)` (不赋值)

【关键指令】
1. **数据范围检查**: 查看上下文中的日期范围。最新的日期决定了“当前周期”。
2. **同口径对比 (Like-for-Like)**: 当分析跨年增长或趋势时，**必须**筛选前一年的数据以匹配当前年份的月份/季度范围 (YTD逻辑)。
   - 例如: 如果最大日期是 2025-09-30，那么“2024年数据”用于对比时，只能取 2024-01-01 到 2024-09-30，而不是2024全年的数据。
3. 返回时间范围时，需要说明用的原始表中的哪个时间段 如问最近两年的同比，如果为了对齐数据，则返回格式为 2024Q1~Q3 & 2025Q1~Q3

【摘要生成规则 (Summary)】
- scope (范围): 数据的筛选范围。
- metrics (指标): 用户查询的核心指标。
- key_match (关键匹配): **必须说明**提取了用户什么词，去匹配了哪个列。例如："提取用户词 'K药' -> 模糊匹配 '商品名' 列"。
- logic (加工逻辑): 简述筛选和计算步骤，严禁提及“表关联”、“Merge”等技术术语。

输出 JSON: {{ "summary": {{ "intent": "简单取数", "scope": "...", "metrics": "...", "key_match": "...", "logic": "..." }}, "code": "..." }}
"""
    print(f"[gemini_engine] 开始调用 Gemini API...")
    try:
        simple_resp = _safe_generate_content(
            client,
            actual_model,  # 使用用户选择的模型
            simple_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        print(f"[gemini_engine] Gemini API 调用成功，开始解析响应...")
        _, simple_json = parse_response(simple_resp.text)
        print(f"[gemini_engine] 响应解析成功，code 字段存在: {'code' in simple_json}")
    except Exception as e:
        print(f"[gemini_engine] Gemini 调用失败: {e}")
        return {"error": f"Gemini 调用失败: {e}"}

    if not simple_json or "code" not in simple_json:
        print(f"[gemini_engine] 无法解析生成的代码格式")
        return {"error": "无法解析生成的代码格式，请重试。"}

    def _blocked_func(*args, **kwargs):
        raise RuntimeError("Safety: This function is disabled.")

    exec_ctx = {
        "df": df, # Use reference to save memory. 
        "pd": pd,
        "np": np,
        "results": {},
        "result": None,
        "current_mat": mat_list,
        "mat_list": mat_list,
        "mat_quarters": mat_list,  # Alias for user code compatibility
        "market_quarters": mat_list, # Alias for user code compatibility
        "prior_mat": mat_list_prior,
        "mat_list_prior": mat_list_prior,
        "ytd_list": ytd_list,
        "ytd_list_prior": ytd_list_prior,
        "input": _blocked_func,
        "exit": _blocked_func,
        "quit": _blocked_func,
    }
    logger.info(f"[gemini_engine] 准备执行代码...")
    if df is not None:
         logger.info(f"[gemini_engine] df columns: {df.columns.tolist()}")

    # DEBUG: Internal Check
    try:
        debug_check = """
print("DEBUG_INTERNAL: df shape:", df.shape)
print("DEBUG_INTERNAL: mat_quarters:", mat_quarters)
try:
    print("DEBUG_INTERNAL: unique periods:", df['年季'].unique()[:5])
    print("DEBUG_INTERNAL: matched rows:", len(df[df['年季'].isin(mat_quarters)]))
except Exception as e:
    print("DEBUG_INTERNAL: check failed:", e)
"""
        exec(debug_check, exec_ctx)
    except Exception as e:
        logger.error(f"Debug check failed: {e}")
    
    try:
        # 数据看板只注入 HCM 表，不注入 fact/ipm 表
        # 这样可以避免 Gemini 生成使用这些表的代码导致错误
        if dashboard_dfs_map:
             for k, v in dashboard_dfs_map.items():
                 exec_ctx[f"df_{k}"] = v
                 logger.info(f"[gemini_engine] 注入数据表: df_{k}, shape={v.shape}")
        logger.info(f"[gemini_engine] 开始执行 Pandas 代码:\n{simple_json['code']}")
        exec(simple_json["code"], exec_ctx)
        logger.info(f"[gemini_engine] 代码执行成功")
    except Exception as e:
        logger.error(f"[gemini_engine] 代码执行错误: {e}")
        return {"error": f"代码执行错误: {e}"}

    # 调试：打印执行后上下文中的所有变量
    print(f"[gemini_engine] 执行后上下文变量: {[k for k in exec_ctx.keys() if not k.startswith('_') and k not in ['pd', 'np', 'df', 'df_fact', 'df_ipm', 'df_hcm']]}")

    final_results = exec_ctx.get("results")
    result_var = exec_ctx.get("result")

    # 调试：打印 results 和 result 的状态
    print(f"[gemini_engine] results 变量: 类型={type(final_results)}, 值={final_results is not None}")
    print(f"[gemini_engine] result 变量: 类型={type(result_var)}, 值={result_var is not None}")

    if result_var is not None:
        if hasattr(result_var, 'shape'):
            print(f"[gemini_engine] result DataFrame shape: {result_var.shape}")
        elif hasattr(result_var, '__len__'):
            print(f"[gemini_engine] result 长度: {len(result_var)}")

    # 改进的结果提取逻辑
    # 注意：results 初始化为 {}（空字典），不是 None。需要同时检查 None 和空字典。
    if (final_results is None or final_results == {}) and result_var is not None:
        final_results = {"查询结果": result_var}
    elif (final_results is None or final_results == {}) and result_var is None:
        # 尝试查找其他可能的结果变量（Gemini 有时会用 result_df、res 等）
        for var_name in ['result_df', 'df_result', 'df_output', 'output', 'data', 'res', 'table_result', 'share_result', 'df_res']:
            if var_name in exec_ctx and exec_ctx[var_name] is not None:
                val = exec_ctx[var_name]
                if isinstance(val, pd.DataFrame):
                    print(f"[gemini_engine] 找到备选结果变量: {var_name}")
                    final_results = {"查询结果": val}
                    break
                if isinstance(val, pd.Series):
                    print(f"[gemini_engine] 找到备选结果变量(Series): {var_name}")
                    final_results = {"查询结果": val.to_frame()}
                    break
                if hasattr(val, '__len__') and not isinstance(val, str):
                    print(f"[gemini_engine] 找到备选结果变量: {var_name}")
                    try:
                        final_results = {"查询结果": pd.DataFrame(val) if hasattr(val, '__iter__') and not isinstance(val, dict) else pd.DataFrame([val])}
                        break
                    except Exception:
                        pass
    
    # 再次检查: 如果 final_results 仍然为空(None or empty dict)，但代码看似执行成功，尝试返回一个错误提示
    if not final_results:
        print(f"[gemini_engine] 未提取到数据！执行的代码:\n{simple_json['code']}")
        # 不要直接返回 Error，尝试构建一个默认的空 DataFrame 以避免格式错误
        print("[gemini_engine] 尝试构建空结果以避免 crash")
        final_results = {"查询结果": pd.DataFrame({"提示": ["未能提取到有效数据，请检查查询逻辑"]})}

    print(f"[gemini_engine] 提取结果: final_results 类型={type(final_results)}, 是否为空={final_results is None}")
    if final_results:
        print(f"[gemini_engine] final_results keys: {list(final_results.keys())}")
        for k, v in final_results.items():
            if hasattr(v, 'shape'):
                print(f"[gemini_engine] {k} shape: {v.shape}")
            elif hasattr(v, '__len__'):
                print(f"[gemini_engine] {k} 长度: {len(v)}")

    formatted = {k: normalize_result(v) for k, v in final_results.items()}

    # 检查 formatted 是否为空
    if not formatted:
        print(f"[gemini_engine] formatted 为空！final_results: {final_results}")
        return {"error": "数据格式化失败，未能提取有效结果。"}

    first_name = next(iter(formatted))
    first_df = formatted[first_name]
    # 若执行结果为 0 行，补充说明行，避免前端“有代码无数据”
    if first_df.empty or len(first_df) == 0:
        first_df = pd.DataFrame({
            "说明": [f"未匹配到数据。请检查：1) 企业/产品名是否用「集团名称」或「生产企业」列并 str.contains 模糊匹配；2) 时间范围是否在数据内；3) 列名是否与元数据一致。原问题：「{query_text}」"]
        })
        print(f"[gemini_engine] 结果为空，已填充说明行")
    chart_data = _df_to_chart_data(first_df)
    print(f"[gemini_engine] chart_data 长度: {len(chart_data)}")

    summary = simple_json.get("summary", {})
    title = first_name
    logic = summary.get("logic", "") or f"按用户问题「{query_text}」取数。"

    # 表格转成前端可用的列表 of dict
    tables_for_api = {}
    for k, v in formatted.items():
        tables_for_api[k] = v.replace({np.nan: None}).to_dict(orient="records")

    # 提取表头信息
    columns = list(first_df.columns) if len(first_df.columns) > 0 else []

    # 提取执行的代码
    executed_code = simple_json.get("code", "")

    return {
        "data": chart_data,
        "fullData": _df_to_full_records(first_df),  # 完整多列数据
        "title": title,
        "logicDescription": logic,
        "config": {"dimension": first_df.columns[0] if len(first_df.columns) > 0 else "", "metric": first_df.columns[1] if len(first_df.columns) > 1 else ""},
        "mode": "simple",
        "summary": summary,
        "tables": tables_for_api,
        "columns": columns,  # 表头
        "code": executed_code,  # 执行的代码
    }


def execute_query_plan(plan_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    执行表格生产计划。
    plan_items: [{ "title": "...", "logic": "..." }, ...]
    返回: List[ResultDict] (每个都包含 data, fullData, title, etc.)
    """
    client = _get_client()
    if not client:
        return []
        
    df, dfs_map, time_context, meta_data = get_cached_data()
    if df is None:
        return []
    
    mat_list = time_context.get("mat_list", [])
    mat_list_prior = time_context.get("mat_list_prior", [])
    ytd_list = time_context.get("ytd_list", [])
    ytd_list_prior = time_context.get("ytd_list_prior", [])

    # 动态构建可用表格提示
    available_tables = ["df (主表)"]
    if dfs_map:
        for k in dfs_map:
            if k != 'hcm':
                available_tables.append(f"df_{k} ({k}表)")
    available_tables_str = ", ".join(available_tables)

    results = []
    
    for item in plan_items:
        title = item.get("title", "未命名表格")
        logic = item.get("logic", "")
        
        # 复用 Single Query 的 Prompt 逻辑，但针对该特定 Item
        item_prompt = f"""
你是一位医药行业的 Pandas 数据处理专家。请根据以下具体指令生成表格数据。
【可用表格】{available_tables_str}

【任务】生成表格："{title}"
【逻辑描述】{logic}

【元数据】{meta_data}
【时间上下文】MAT: {mat_list}, YTD: {ytd_list}

【关键指令】
1. 数据源：环境中存在 {available_tables_str}。
   - `df`: 主表 (HCM Data)，包含医院销售细分数据。
   - `df_fact`: (如果存在) Fact数据。
   - `df_ipm`: (如果存在) IPM数据。
   - 请根据问题选择正确的 DataFrame。如果涉及跨表，请自行 merge（注意 Key）。
2. 只要返回 DataFrame。
3. 必须包含维度列。
4. 【Categorical 处理】若使用 pd.qcut/pd.cut，请务必使用 astype(str) 转为字符串，避免 Categorical 类型导致的 setitem 报错。

输出 JSON: {{ "code": "df_sub = df[...]\\nresults = {{'{title}': df_sub}}" }}
"""
        try:
            # 这里的 Prompt 很简单，用 Fast Model 也许够用，或者 Deep
            resp = _safe_generate_content(
                client,
                DEEP_MODEL, 
                item_prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            _, json_res = parse_response(resp.text)
            
            if json_res and "code" in json_res:
                exec_ctx = {
                    "df": df, "pd": pd, "np": np, "results": {},
                    "mat_list": mat_list, "mat_list_prior": mat_list_prior,
                    "ytd_list": ytd_list, "ytd_list_prior": ytd_list_prior,
                }
                # Inject additional DFs
                if dfs_map:
                     for k, v in dfs_map.items():
                         exec_ctx[f"df_{k}"] = v

                exec(json_res["code"], exec_ctx)
                
                final_res = exec_ctx.get("results")
                if final_res:
                    # 取第一个结果
                    k = next(iter(final_res))
                    v = normalize_result(final_res[k])
                    
                    results.append({
                        "id": item.get("id"), # Pass through ID
                        "data": _df_to_chart_data(v),
                        "fullData": _df_to_full_records(v),
                        "title": k,
                        "logicDescription": logic,
                        "mode": "simple",
                        "config": {"dimension": v.columns[0] if len(v.columns)>0 else "", "metric": v.columns[1] if len(v.columns)>1 else ""}
                    })
        except Exception as e:
            print(f"Error executing plan item {title}: {e}")
            continue
            
    return results


def execute_research_step(
    step: Dict[str, Any],
    accumulated_context: str,
    meta_data: str,
) -> Dict[str, Any]:
    """
    执行单个调研步骤，根据阶段类型返回不同格式的输出。
    只使用 IPM, fact 数据（不使用 HCM）。

    step: { id, phase, source, action, rationale, expected_output }
    accumulated_context: 前面步骤累积的上下文
    meta_data: 元数据摘要 (现在会被增强的研究元数据替代)

    返回: { step_id, phase, output_type, content, data? }
    """
    client = _get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}

    df, dfs_map, time_context, _ = get_cached_data()

    phase = step.get("phase", "")
    source = step.get("source", "database")
    action = step.get("action", "")
    expected_output = step.get("expected_output", "")

    # 使用增强的研究元数据（替代通用元数据）
    research_metadata = build_research_metadata(dfs_map)

    # 检查可用表
    available_research_tables = []
    if dfs_map:
        if 'fact' in dfs_map:
            available_research_tables.append("df_fact")
        if 'ipm' in dfs_map:
            available_research_tables.append("df_ipm")

    if not available_research_tables:
        return {
            "step_id": step.get("id"),
            "phase": phase,
            "output_type": "error",
            "content": "市场调研数据表（fact/ipm）未加载，无法执行查询。",
        }

    # 根据阶段类型构建不同的 Prompt
    if phase == "数据准备" and source == "database":
        # 阶段1: 数据准备 - 使用三步骤流程
        # 步骤1.1: 识别实体
        entity_result = identify_entities(action, dfs_map)

        if "error" in entity_result:
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "error",
                "content": f"实体识别失败: {entity_result['error']}",
            }

        entities = entity_result.get("entities", {})
        query_intent = entity_result.get("query_intent", "未知")

        # 步骤1.2: 构建查询
        query_result = construct_query(entities, query_intent, dfs_map)

        if "error" in query_result:
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "error",
                "content": f"查询构建失败: {query_result['error']}",
            }

        code = query_result.get("code", "")
        explanation = query_result.get("explanation", "")
        validation_checks = query_result.get("validation_checks", [])

        # 步骤1.3: 执行查询
        exec_result = execute_query(code, dfs_map, validation_checks)

        if not exec_result.get("success"):
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "error",
                "content": f"查询执行失败: {exec_result.get('error', '未知错误')}",
                "error_detail": exec_result.get("error_detail", ""),
            }

        # 返回三步骤的完整结果
        return {
            "step_id": step.get("id"),
            "phase": phase,
            "output_type": "data_table_with_steps",
            "title": exec_result.get("result_name", "查询结果"),
            "content": f"已完成数据准备 (共 {exec_result.get('rows', 0)} 行)",
            "data": exec_result.get("data", []),
            "steps": {
                "step1_entities": {
                    "name": "识别实体",
                    "entities": entities,
                    "query_intent": query_intent,
                    "confidence": entity_result.get("confidence", 0),
                },
                "step2_query": {
                    "name": "构建查询",
                    "code": code,
                    "explanation": explanation,
                },
                "step3_execution": {
                    "name": "执行查询",
                    "rows": exec_result.get("rows", 0),
                    "columns": exec_result.get("columns", []),
                    "execution_time_ms": exec_result.get("execution_time_ms", 0),
                }
            }
        }
    
    elif phase == "数据分析设计":
        # 阶段2: 数据分析设计 - 生成结构化分析框架
        # 从 accumulated_context 中提取实体信息
        try:
            # 尝试从上下文中提取企业名称
            import re
            enterprise_match = re.search(r"企业[：:]\s*\[?['\"]?([^'\"\]]+)['\"]?\]?", accumulated_context)

            if enterprise_match:
                enterprise_name = enterprise_match.group(1)
                # 生成企业分析框架
                framework = generate_enterprise_analysis_framework(enterprise_name, {})

                # 格式化为 Markdown 展示
                markdown_content = f"""# {enterprise_name} 企业分析框架

## 分析概述
本框架将从以下 {len(framework['analysis_modules'])} 个维度对 {enterprise_name} 进行全面分析：

"""
                for idx, module in enumerate(framework['analysis_modules'], 1):
                    markdown_content += f"""### {idx}. {module['module_name']} ({module['chart_type'].upper()})
**描述**: {module['description']}

**数据需求**:
- 维度: {', '.join(module['data_requirements']['dimensions'])}
- 指标: {', '.join(module['data_requirements']['metrics'])}
- 筛选条件: {', '.join(module['data_requirements']['filters'])}

**预期输出**: {module['expected_output']}

---

"""

                return {
                    "step_id": step.get("id"),
                    "phase": phase,
                    "output_type": "structured_analysis_framework",
                    "content": markdown_content,
                    "framework": framework,  # 返回结构化数据供后续使用
                }
            else:
                # 如果没有识别到企业，使用通用分析框架
                step_prompt = f"""
你是一位医药行业数据分析专家。请根据任务要求和已有数据，设计详细的数据分析框架。

【任务描述】
- 任务: {action}
- 预期产出: {expected_output}

【已完成的数据准备】
{accumulated_context}

请设计一个结构化的分析框架，输出 JSON 格式。
"""
                resp = _safe_generate_content(client, DEEP_MODEL, step_prompt)
                return {
                    "step_id": step.get("id"),
                    "phase": phase,
                    "output_type": "analysis_framework",
                    "content": resp.text,
                }
        except Exception as e:
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "error",
                "content": f"分析设计失败: {e}",
            }
    
    elif phase == "信息源梳理" and source == "internet":
        # 阶段3: 信息源梳理 - 识别需要搜索的网页类型
        step_prompt = f"""
你是一位医药行业研究专家。请根据以下任务梳理可能获取相关信息的网页类型。

【任务】{action}
【预期产出】{expected_output}
【已有上下文】
{accumulated_context}

请输出一个清晰的信息源清单，包括：
1. 网页类型（如行业新闻、企业官网、研究报告、政策文件等）
2. 每种类型可能获取的信息
3. 推荐的具体网站或平台

输出格式: 使用 Markdown 格式，列表清晰。
"""
        try:
            resp = _safe_generate_content(client, DEEP_MODEL, step_prompt)
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "source_list",
                "content": resp.text,
            }
        except Exception as e:
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "error",
                "content": f"信息源梳理失败: {e}",
            }
    
    elif phase == "信息采集" and source == "internet":
        # 阶段4: 信息采集 - 模拟网络搜索结果
        step_prompt = f"""
你是一位医药行业研究专家，拥有丰富的行业知识。请根据以下任务，基于你的知识库模拟采集相关信息。

【任务】{action}
【预期产出】{expected_output}
【已有上下文】
{accumulated_context}

请基于你对医药行业的了解，提供相关的信息摘要。包括：
1. 行业趋势和动态
2. 竞争格局分析
3. 政策影响分析
4. 关键信息点

注意：请明确标注这是基于模型知识库的分析，实际调研时建议验证。

输出格式: 使用 Markdown 格式，信息详实。
"""
        try:
            resp = _safe_generate_content(client, DEEP_MODEL, step_prompt)
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "collected_info",
                "content": resp.text,
            }
        except Exception as e:
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "error",
                "content": f"信息采集失败: {e}",
            }
    
    elif phase == "综合分析":
        # 阶段5: 综合分析 - 生成最终报告
        step_prompt = f"""
你是一位资深医药市场分析专家。请基于前面所有步骤的产出，生成一份完整的市场调研分析报告。

【任务】{action}
【预期产出】{expected_output}

【前序步骤产出汇总】
{accumulated_context}

请生成一份 Markdown 格式的综合分析报告，包括：
1. **执行摘要** - 核心发现和结论
2. **数据分析** - 基于内部数据的定量分析
3. **市场洞察** - 基于外部信息的定性分析
4. **综合结论** - 将定量和定性分析相结合的综合判断
5. **建议与展望** - 基于分析的行动建议

要求：
- 报告结构清晰，逻辑严密
- 数据与洞察相互印证
- 结论有理有据
"""
        try:
            resp = _safe_generate_content(client, DEEP_MODEL, step_prompt)
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "final_report",
                "content": resp.text,
            }
        except Exception as e:
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "error",
                "content": f"综合分析失败: {e}",
            }
    
    else:
        # 默认: 通用处理
        step_prompt = f"""
你是一位医药行业分析专家。请执行以下任务：

【阶段】{phase}
【任务】{action}
【预期产出】{expected_output}
【已有上下文】
{accumulated_context}

请生成该步骤的输出，使用 Markdown 格式。
"""
        try:
            resp = _safe_generate_content(client, DEEP_MODEL, step_prompt)
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "text",
                "content": resp.text,
            }
        except Exception as e:
            return {
                "step_id": step.get("id"),
                "phase": phase,
                "output_type": "error",
                "content": f"步骤执行失败: {e}",
            }


def generate_research_html_report(
    query: str,
    accumulated_context: str,
) -> Dict[str, Any]:
    """
    基于所有步骤的累积产出，生成完整的 HTML 调研报告。
    使用 Gemini 3 Pro Preview 模型。
    
    返回: { html_content, filename }
    """
    client = _get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}
    
    report_prompt = f"""
你是一位资深医药市场分析专家和报告撰写专家。
请基于以下调研问题和所有步骤的产出，生成一份完整、专业的 HTML 格式调研报告。

【调研问题】
{query}

【各步骤产出汇总】
{accumulated_context}

【要求】
生成一份完整的 HTML 文档，包括：
1. 完整的 HTML 结构 (<!DOCTYPE html>, <html>, <head>, <body>)
2. 内联 CSS 样式，使报告美观专业
3. 报告结构：
   - 标题和摘要
   - 数据分析部分（包含表格展示关键数据）
   - 市场洞察部分
   - 综合结论
   - 建议与展望
4. 使用现代、专业的配色方案（推荐蓝色系）
5. 响应式设计，适配打印

请输出完整的 HTML 代码，不要使用 markdown 代码块包裹。
"""

    try:
        resp = _safe_generate_content(client, DEEP_MODEL, report_prompt)
        html_content = resp.text
        
        # Clean up if wrapped in markdown code block
        if html_content.startswith("```html"):
            html_content = html_content[7:]
        if html_content.startswith("```"):
            html_content = html_content[3:]
        if html_content.endswith("```"):
            html_content = html_content[:-3]
        html_content = html_content.strip()
        
        # Generate filename with timestamp
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"research_report_{timestamp}.html"
        
        return {
            "html_content": html_content,
            "filename": filename,
        }
    except Exception as e:
        return {"error": f"HTML 报告生成失败: {e}"}

def generate_market_research_plan(
    query_text: str,
    history_context: str,
    meta_data: str,
) -> Dict[str, Any]:
    """
    专门用于市场调研模块的 Planner。
    强制使用 DEEP_MODEL (gemini-3-pro-preview)。
    关注多源数据整合 (Fact, IPM)。
    """
    client = _get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}

    df, dfs_map, _, _ = get_cached_data()

    # 使用增强的研究元数据
    research_metadata = build_research_metadata(dfs_map)

    research_prompt = f"""
你是一位资深医药市场分析专家，拥有丰富的行业经验和数据分析能力。
用户正在进行市场调研，问题是："{query_text}"

【可用数据源详细说明】
{research_metadata}

【历史上下文】
{history_context}

【调研方案设计要求】
你的任务是设计一个【完整的调研方案】，必须包含以下5个阶段：

**阶段一：数据准备**
- 从 df_fact 和 df_ipm 表中提取相关数据
- 明确需要查询哪些企业/产品/ATC分类等
- 说明如何关联两表（通过'药品索引'字段）

**阶段二：数据分析设计**
- 设计数据分析的维度（时间、渠道、地区等）
- 设计需要计算的指标（销售额、增长率、市场份额等）
- 说明数据聚合和计算逻辑

**阶段三：信息源梳理**
- 梳理可能存在调研结果的网页类型（如新闻网站、专业报告、企业官网、行业论坛等）
- 说明每种网页类型可能提供的信息

**阶段四：信息采集**
- 基于所有相关网页类型，整理需要采集的具体信息
- 说明如何组织和结构化采集到的信息

**阶段五：综合分析**
- 将网页信息与内部销售数据关联
- 形成完整的分析报告

【输出要求】
- 返回 JSON 格式
- 在描述中使用专业但易懂的语言，避免过于技术化
- 每个步骤必须明确属于哪个阶段
- 对于数据准备阶段，要基于上述元数据中的实际字段设计查询

{{
  "research_strategy": "整体调研策略的简要描述（2-3句话）",
  "plan": [
    {{
      "id": 1,
      "phase": "数据准备",
      "source": "database",
      "action": "从 df_ipm 表筛选出相关企业/产品，并关联 df_fact 表获取销售数据",
      "rationale": "为后续分析提供数据基础",
      "expected_output": "包含销售额、销售量的时间序列数据"
    }},
    {{
      "id": 2,
      "phase": "数据分析设计",
      "source": "database",
      "action": "设计多维度分析框架：按时间/渠道/ATC分类等维度分析销售趋势",
      "rationale": "明确分析逻辑和指标体系",
      "expected_output": "详细的分析框架文档"
    }},
    {{
      "id": 3,
      "phase": "信息源梳理",
      "source": "internet",
      "action": "确定需要搜索的网页类型：行业新闻、企业公告、研究报告、政策文件等",
      "rationale": "为外部信息采集做准备",
      "expected_output": "网页类型清单及其信息价值说明"
    }},
    {{
      "id": 4,
      "phase": "信息采集",
      "source": "internet",
      "action": "搜索并采集相关网页信息，整理关键发现",
      "rationale": "获取定性信息补充定量分析",
      "expected_output": "采集到的网页内容摘要和关键信息点"
    }},
    {{
      "id": 5,
      "phase": "综合分析",
      "source": "database",
      "action": "将外部信息与内部销售数据关联，形成完整的市场分析报告",
      "rationale": "整合定量和定性分析，得出综合结论",
      "expected_output": "Markdown格式的综合分析报告"
    }}
  ]
}}
"""
    try:
        response = _safe_generate_content(
            client,
            DEEP_MODEL,
            research_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        _, json_res = parse_response(response.text)
        
        research_strategy = json_res.get("research_strategy", "根据询问设计如下调研操作")
        plan_items = json_res.get("plan", [])

        # 为每个步骤添加工具ID映射
        for item in plan_items:
            phase = item.get("phase", "")
            # 根据阶段映射到工具ID
            if phase == "数据准备":
                item["tool_id"] = "data_query"
            elif phase == "数据分析设计":
                item["tool_id"] = "enterprise_analysis"
            elif phase == "信息源梳理":
                item["tool_id"] = "source_mapping"
            elif phase == "信息采集":
                item["tool_id"] = "web_search"
            elif phase == "综合分析":
                item["tool_id"] = "report_generation"

        return {
            "mode": "plan_editable",
            "plan": plan_items,
            "title": "调研方案",
            "logicDescription": research_strategy,
            "editable": True,
            "config": {}
        }
    except Exception as e:
        return {"error": f"市场调研规划失败: {e}"}


def suggest_chart(data: List[Dict[str, Any]], title: str = "", custom_prompt: str = "") -> Dict[str, Any]:
    """
    调用 Gemini 分析数据并推荐最佳图表类型。
    
    参数:
        data: 前端传来的图表数据，格式为 [{ name, value }, ...] 或任意 records
        title: 数据标题/描述
        custom_prompt: 用户自定义提示词（为空则使用智能推荐）
    
    返回:
        { chartType, reason, config? }
    """
    client = _get_client()
    if client is None:
        return {"error": "未配置 GENAI_API_KEY，无法使用图表推荐功能。"}
    
    if not data or len(data) == 0:
        return {"error": "数据为空，无法推荐图表。"}
    
    # 构建数据预览
    df_preview = pd.DataFrame(data)
    data_preview = df_preview.head(20).to_string()
    data_stats = f"行数: {len(data)}, 列: {list(df_preview.columns)}"
    
    if custom_prompt:
        # 用户自定义模式
        prompt = f"""
你是一位数据可视化专家。用户提供了以下数据和自定义要求，请根据要求推荐图表类型并提供详细的图表配置。

【数据标题】{title}
【数据统计】{data_stats}
【数据预览】
{data_preview}

【用户要求】
{custom_prompt}

请分析数据特征，结合用户要求，推荐最合适的图表类型并提供完整的可视化配置。
你可以自由选择任何图表类型，包括但不限于：bar, line, pie, area, scatter, bubble, waterfall, radar, funnel, treemap, heatmap, sankey, gauge, map, image 等。

输出 JSON 格式:
{{
    "chartType": "你认为最合适的图表类型（英文小写）",
    "reason": "推荐理由（简洁，50字内）",
    "config": {{
        "title": "图表标题",
        "xAxisLabel": "X轴标签名称",
        "yAxisLabel": "Y轴标签名称", 
        "colors": ["#颜色1", "#颜色2", "#颜色3"],
        "showLegend": true,
        "showGrid": true,
        "dataKey": "数值列名（如value）",
        "nameKey": "维度列名（如name）",
        "unit": "数值单位（如万、%等）",
        "sortOrder": "asc或desc或none",
        "topN": null,
        "xDataKey": "散点/气泡图X轴对应的数据列名（如同比）",
        "yDataKey": "散点/气泡图Y轴对应的数据列名（如份额）",
        "sizeDataKey": "气泡图气泡大小对应的数据列名（如金额）"
    }}
}}
"""
    else:
        # 智能推荐模式
        prompt = f"""
你是一位数据可视化专家。请分析以下数据，推荐最合适的图表类型并提供详细的图表配置。

【数据标题】{title}
【数据统计】{data_stats}
【数据预览】
{data_preview}

请根据数据特征（维度数量、数值分布、是否有时间序列、占比关系、层级结构等）推荐最佳图表类型。
你可以自由选择任何图表类型，包括但不限于：
- bar (柱状图): 分类对比
- line (折线图): 时间序列、趋势
- pie (饼图): 占比/份额，维度 ≤ 8
- area (面积图): 趋势+累积
- scatter (散点图): 两个数值变量的关系
- bubble (气泡图): 三个变量（x, y, size）
- waterfall (瀑布图): 增减变化过程
- radar (雷达图): 多维度对比
- funnel (漏斗图): 转化率/阶段
- treemap (树图): 层级占比
- heatmap (热力图): 矩阵数据
- map (地图): 地理分布 (省份/城市数据)
- gauge (仪表盘): 单一指标完成度
- image (图片): 展示相关图片 (config需包含 imageUrl)

请根据数据特征选择最能表达数据含义的图表类型，并提供完整的可视化配置。

输出 JSON 格式:
{{
    "chartType": "你认为最合适的图表类型（英文小写）",
    "reason": "推荐理由（简洁，50字内）",
    "config": {{
        "title": "图表标题",
        "xAxisLabel": "X轴标签名称",
        "yAxisLabel": "Y轴标签名称",
        "colors": ["#颜色1", "#颜色2", "#颜色3"],
        "showLegend": true,
        "showGrid": true,
        "dataKey": "数值列名（如value）",
        "nameKey": "维度列名（如name）",
        "unit": "数值单位（如万、%等）",
        "sortOrder": "asc或desc或none",
        "topN": null,
        "xDataKey": "散点/气泡图X轴对应的数据列名（如同比）",
        "yDataKey": "散点/气泡图Y轴对应的数据列名（如份额）",
        "sizeDataKey": "气泡图气泡大小对应的数据列名（如金额）",
        "imageUrl": "图片类型(image)的图片URL"
    }}
}}
"""
    
    # 添加重试机制
    import time
    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        try:
            from google.genai import types
            response = _safe_generate_content(
                client,
                MODEL_CHART,
                prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            _, result_json = parse_response(response.text)
            if result_json and "chartType" in result_json:
                config = result_json.get("config", {})
                # 添加前端兼容的字段映射
                if "nameKey" in config:
                    config["x_axis"] = config["nameKey"]
                if "dataKey" in config:
                    config["y_axis"] = config["dataKey"]
                # 添加图表类型到config中
                config["chart_type"] = result_json.get("chartType", "bar")
                config["recommendation_reason"] = result_json.get("reason", "")
                return {
                    "chartType": result_json.get("chartType", "bar"),
                    "reason": result_json.get("reason", ""),
                    "config": config,
                }
            else:
                return {"chartType": "bar", "reason": "默认推荐柱状图", "config": {"chart_type": "bar"}}
        except Exception as e:
            last_error = e
            print(f"[suggest_chart] 第 {attempt + 1} 次尝试失败: {e}")
            if attempt < max_retries - 1:
                time.sleep(1)  # 等待1秒后重试
                continue

    return {"error": f"图表推荐调用失败(重试{max_retries}次): {last_error}"}


def identify_entities(
    query_text: str,
    dfs_map: Dict[str, pd.DataFrame],
) -> Dict[str, Any]:
    """
    步骤1.1：从用户问题中识别关键实体（企业、产品、ATC分类等）

    返回: {
        "entities": {"企业": [...], "产品": [...], "ATC分类": [...]},
        "query_intent": "企业分析" | "产品分析" | "市场分析",
        "confidence": 0.95
    }
    """
    client = _get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}

    # 构建实体识别提示
    entity_prompt = f"""
你是一位医药行业数据分析专家。请从用户问题中识别关键实体和分析意图。

【用户问题】
{query_text}

【可用的实体类型】
1. 企业名称：如"辉瑞"、"阿斯利康"、"恒瑞医药"等
2. 产品名称：药品名称、通用名、商品名
3. ATC分类：如"XA-消化道和代谢方面的药物"
4. 时间范围：如"2021年"、"最近4个季度"、"MAT"
5. 渠道：如"零售"、"医院"
6. 地区：省份、城市

【分析意图类型】
- "企业分析"：分析某个或多个企业的市场表现
- "产品分析"：分析某个或多个产品的销售情况
- "市场分析"：分析整体市场或某个细分市场
- "竞争分析"：对比分析多个企业或产品

请识别问题中的实体，并判断分析意图。

输出 JSON 格式：
{{
    "entities": {{
        "企业": ["企业名称列表"],
        "产品": ["产品名称列表"],
        "ATC分类": ["ATC分类列表"],
        "时间范围": ["时间描述"],
        "渠道": ["渠道列表"],
        "地区": ["地区列表"]
    }},
    "query_intent": "企业分析",
    "confidence": 0.95,
    "reasoning": "识别依据的简要说明"
}}
"""

    try:
        from google.genai import types
        response = _safe_generate_content(
            client,
            FAST_MODEL,
            entity_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        _, result_json = parse_response(response.text)

        if result_json:
            return {
                "success": True,
                "entities": result_json.get("entities", {}),
                "query_intent": result_json.get("query_intent", "未知"),
                "confidence": result_json.get("confidence", 0.0),
                "reasoning": result_json.get("reasoning", ""),
            }
        else:
            return {"error": "实体识别失败：无法解析返回结果"}
    except Exception as e:
        return {"error": f"实体识别失败: {e}"}


def construct_query(
    entities: Dict[str, Any],
    query_intent: str,
    dfs_map: Dict[str, pd.DataFrame],
) -> Dict[str, Any]:
    """
    步骤1.2：基于识别的实体构建精确的 Pandas 查询代码

    返回: {
        "code": "Pandas代码",
        "explanation": "查询说明",
        "expected_columns": ["列名"],
        "validation_checks": ["检查项"]
    }
    """
    client = _get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}

    research_metadata = build_research_metadata(dfs_map)

    query_prompt = f"""
你是一位医药行业数据分析专家。请基于识别的实体生成精确的 Pandas 查询代码。

【识别的实体】
{json.dumps(entities, ensure_ascii=False, indent=2)}

【分析意图】
{query_intent}

【数据表详细结构】
{research_metadata}

【代码生成要求】
1. **严格使用元数据中的字段名**，不要臆造
2. **企业/产品名称使用模糊匹配**：.str.contains('关键词', na=False)
3. **表关联**：通过 '药品索引' 字段关联 df_fact 和 df_ipm
4. **结果格式**：最终 DataFrame 必须 reset_index()
5. **变量命名**：使用有意义的中文变量名
6. **最终结果**：存入 results 字典

【输出格式】
返回 JSON:
{{
    "code": "# 你的Pandas代码\\nresults = {{'结果名称': df_result}}",
    "explanation": "查询逻辑的简要说明",
    "expected_columns": ["预期的列名"],
    "validation_checks": [
        "企业药品数量 > 0",
        "销售数据行数 > 0"
    ]
}}

请生成代码：
"""

    try:
        from google.genai import types
        response = _safe_generate_content(
            client,
            DEEP_MODEL,
            query_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        _, result_json = parse_response(response.text)

        if result_json and "code" in result_json:
            return {
                "success": True,
                "code": result_json.get("code", ""),
                "explanation": result_json.get("explanation", ""),
                "expected_columns": result_json.get("expected_columns", []),
                "validation_checks": result_json.get("validation_checks", []),
            }
        else:
            return {"error": "查询构建失败：无法解析返回结果"}
    except Exception as e:
        return {"error": f"查询构建失败: {e}"}


def execute_query(
    code: str,
    dfs_map: Dict[str, pd.DataFrame],
    validation_checks: List[str] = None,
) -> Dict[str, Any]:
    """
    步骤1.3：执行查询代码并返回结构化数据

    返回: {
        "success": True,
        "data": [...],
        "rows": 100,
        "columns": ["列名"],
        "validation_passed": True
    }
    """
    import time
    start_time = time.time()

    exec_ctx = {"pd": pd, "np": np, "results": {}}

    # 注入数据表
    if 'fact' in dfs_map:
        exec_ctx["df_fact"] = dfs_map['fact'].copy()
    if 'ipm' in dfs_map:
        exec_ctx["df_ipm"] = dfs_map['ipm'].copy()

    try:
        # 执行代码
        exec(code, exec_ctx)
        final_res = exec_ctx.get("results")

        if not final_res:
            return {
                "success": False,
                "error": "代码执行成功但未生成结果数据",
            }

        # 获取第一个结果
        result_name = next(iter(final_res))
        result_df = normalize_result(final_res[result_name])

        # 数据验证
        validation_passed = True
        validation_messages = []

        if validation_checks:
            for check in validation_checks:
                # 简单的验证逻辑
                if "行数 > 0" in check or "数据行数 > 0" in check:
                    if len(result_df) == 0:
                        validation_passed = False
                        validation_messages.append(f"验证失败: {check}")

        execution_time = (time.time() - start_time) * 1000

        return {
            "success": True,
            "data": _df_to_full_records(result_df)[:100],
            "rows": len(result_df),
            "columns": list(result_df.columns),
            "validation_passed": validation_passed,
            "validation_messages": validation_messages,
            "execution_time_ms": round(execution_time, 2),
            "result_name": result_name,
        }

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        return {
            "success": False,
            "error": f"代码执行失败: {e}",
            "error_detail": error_detail,
        }


def generate_enterprise_analysis_framework(
    enterprise_name: str,
    entities: Dict[str, Any],
) -> Dict[str, Any]:
    """
    生成企业分析的标准化框架

    返回包含5个分析模块的结构化框架：
    1. ATC1分类分布（饼图）
    2. 核心产品分析（表格）
    3. 增长指标（KPI）
    4. 市场地位（KPI）
    5. 渠道分布（柱状图）
    """

    framework = {
        "analysis_type": "企业分析",
        "target_entity": enterprise_name,
        "analysis_modules": [
            {
                "module_id": "atc_distribution",
                "module_name": "ATC1分类分布",
                "chart_type": "pie",
                "description": f"{enterprise_name}不同ATC1分类的销售额占比",
                "data_requirements": {
                    "dimensions": ["ATC1Des"],
                    "metrics": ["销售额", "占比"],
                    "filters": [f"企业='{enterprise_name}'", "时间=最近4个季度"],
                    "aggregation": "按ATC1Des汇总销售额"
                },
                "expected_output": "饼图：各ATC1分类占比"
            },
            {
                "module_id": "top_products",
                "module_name": "核心产品分析",
                "chart_type": "table",
                "description": f"前10%销售额的产品及其市场份额",
                "data_requirements": {
                    "dimensions": ["药品名称", "通用名"],
                    "metrics": ["销售额", "市场份额", "企业内占比"],
                    "filters": [f"企业='{enterprise_name}'", "排名=Top 10%"],
                    "calculations": [
                        "市场份额 = 该产品销售额 / 该通用名全市场销售额 * 100%",
                        "企业内占比 = 该产品销售额 / 企业总销售额 * 100%"
                    ]
                },
                "expected_output": "表格：产品名称 | 通用名 | 销售额 | 市场份额 | 企业内占比"
            },
            {
                "module_id": "growth_metrics",
                "module_name": "增长指标",
                "chart_type": "kpi",
                "description": f"{enterprise_name}整体同比增长率",
                "data_requirements": {
                    "metrics": ["当期销售额", "同期销售额", "同比增长率"],
                    "time_comparison": "最近4季度 vs 去年同期4季度",
                    "calculations": [
                        "同比增长率 = (当期销售额 - 同期销售额) / 同期销售额 * 100%"
                    ]
                },
                "expected_output": "KPI卡片：+15.3% 同比增长"
            },
            {
                "module_id": "market_share",
                "module_name": "市场地位",
                "chart_type": "kpi",
                "description": f"{enterprise_name}占行业整体份额",
                "data_requirements": {
                    "metrics": ["企业销售额", "行业总销售额", "市场份额"],
                    "calculations": [
                        "市场份额 = 企业销售额 / 行业总销售额 * 100%"
                    ]
                },
                "expected_output": "KPI卡片：8.5% 市场份额"
            },
            {
                "module_id": "channel_distribution",
                "module_name": "渠道分布",
                "chart_type": "bar",
                "description": f"{enterprise_name}不同渠道的销售额分布",
                "data_requirements": {
                    "dimensions": ["渠道"],
                    "metrics": ["销售额", "占比"],
                    "filters": [f"企业='{enterprise_name}'", "时间=最近4个季度"],
                    "aggregation": "按渠道汇总销售额"
                },
                "expected_output": "柱状图：各渠道销售额"
            }
        ],
        "execution_order": [
            "atc_distribution",
            "top_products",
            "growth_metrics",
            "market_share",
            "channel_distribution"
        ]
    }

    return framework


def build_research_metadata(dfs_map: Dict[str, pd.DataFrame]) -> str:
    """
    为市场调研模块构建增强的元数据，专门针对 fact 和 ipm 表。
    提供详细的表结构、字段说明、关联关系和查询示例。
    """
    metadata_parts = []

    # 1. Fact 表元数据
    if 'fact' in dfs_map:
        df_fact = dfs_map['fact']
        metadata_parts.append("=" * 60)
        metadata_parts.append("表1: df_fact (销售事实表)")
        metadata_parts.append("=" * 60)
        metadata_parts.append(f"行数: {len(df_fact):,}")
        metadata_parts.append(f"用途: 存储各药品在不同渠道、不同时间的销售数据\n")

        metadata_parts.append("【字段详情】")
        metadata_parts.append("1. 药品索引 (float64)")
        metadata_parts.append("   - 说明: 药品唯一标识，用于关联 df_ipm 表")
        metadata_parts.append(f"   - 唯一值数: {df_fact['药品索引'].nunique():,}")
        metadata_parts.append(f"   - 示例值: {df_fact['药品索引'].dropna().unique()[:5].tolist()}")

        metadata_parts.append("\n2. 渠道 (object)")
        metadata_parts.append("   - 说明: 销售渠道")
        metadata_parts.append(f"   - 可选值: {df_fact['渠道'].unique().tolist()}")

        metadata_parts.append("\n3. 年季 (object)")
        metadata_parts.append("   - 说明: 时间维度，格式为 YYQ# (如 21Q1 表示2021年第1季度)")
        metadata_parts.append(f"   - 时间范围: {sorted(df_fact['年季'].unique())}")

        metadata_parts.append("\n4. 销售额 (float64)")
        metadata_parts.append("   - 说明: 销售金额（单位：人民币）")
        metadata_parts.append("   - 注意: 已预处理为数值类型，可直接使用")

        metadata_parts.append("\n5. 销售量 (float64)")
        metadata_parts.append("   - 说明: 销售数量")
        metadata_parts.append("   - 注意: 已预处理为数值类型，可直接使用\n")

    # 2. IPM 表元数据
    if 'ipm' in dfs_map:
        df_ipm = dfs_map['ipm']
        metadata_parts.append("\n" + "=" * 60)
        metadata_parts.append("表2: df_ipm (药品主数据表)")
        metadata_parts.append("=" * 60)
        metadata_parts.append(f"行数: {len(df_ipm):,}")
        metadata_parts.append(f"用途: 存储药品的详细属性信息（每个药品一行）\n")

        metadata_parts.append("【核心字段】")
        metadata_parts.append("1. 药品索引 (int64) - 关联键")
        metadata_parts.append(f"   - 用于与 df_fact 表关联")
        metadata_parts.append(f"   - 唯一值数: {df_ipm['药品索引'].nunique():,}")

        # 分类展示字段
        field_groups = {
            "基本信息": ["药品名称", "通用名", "成分名", "商品名", "规格", "剂型"],
            "企业信息": ["生产企业", "企业类型", "集团名称"],
            "分类信息": ["ATC1Des", "ATC2Des", "ATC3Des", "ATC4Des", "零售分类1 描述", "零售分类2 描述", "零售分类3 描述"],
            "政策相关": ["集采批次", "集采结果", "OTC", "一致性评价", "最早医保纳入年份"],
            "研发信息": ["研究类型", "药品分类", "药品分类二", "首次上市年代"]
        }

        for group_name, fields in field_groups.items():
            metadata_parts.append(f"\n【{group_name}】")
            for field in fields:
                if field in df_ipm.columns:
                    unique_count = df_ipm[field].nunique()
                    dtype = df_ipm[field].dtype
                    metadata_parts.append(f"- {field} ({dtype}) | 唯一值: {unique_count}")

                    # 对于类别较少的字段，显示所有可能值
                    if unique_count <= 20 and unique_count > 0:
                        values = df_ipm[field].dropna().unique()[:20].tolist()
                        metadata_parts.append(f"  可选值: {values}")

    # 3. 表关联说明
    metadata_parts.append("\n\n" + "=" * 60)
    metadata_parts.append("表关联关系")
    metadata_parts.append("=" * 60)
    metadata_parts.append("通过 '药品索引' 字段关联两表：")
    metadata_parts.append("  df_fact['药品索引'] <---> df_ipm['药品索引']")
    metadata_parts.append("\n关联示例：")
    metadata_parts.append("  # 获取某个企业的销售数据")
    metadata_parts.append("  企业药品 = df_ipm[df_ipm['生产企业'].str.contains('某企业', na=False)]['药品索引'].unique()")
    metadata_parts.append("  销售数据 = df_fact[df_fact['药品索引'].isin(企业药品)]")

    # 4. 常见查询模式
    metadata_parts.append("\n\n" + "=" * 60)
    metadata_parts.append("常见查询模式")
    metadata_parts.append("=" * 60)

    metadata_parts.append("\n【模式1: 单表查询 - Fact表时间序列】")
    metadata_parts.append("""
# 查询某个药品索引的销售趋势
drug_id = 1.0
df_sub = df_fact[df_fact['药品索引'] == drug_id].copy()
result = df_sub.groupby('年季')['销售额'].sum().reset_index()
result = result.sort_values('年季')
results = {'销售趋势': result}
""")

    metadata_parts.append("\n【模式2: 关联查询 - 企业销售分析】")
    metadata_parts.append("""
# 查询某企业所有药品的销售额
企业名 = '某制药公司'
# Step1: 从IPM表找到该企业的所有药品索引
企业药品 = df_ipm[df_ipm['生产企业'].str.contains(企业名, na=False)]['药品索引'].unique()
# Step2: 从Fact表筛选这些药品的销售数据
df_sub = df_fact[df_fact['药品索引'].isin(企业药品)].copy()
result = df_sub.groupby('年季')['销售额'].sum().reset_index()
results = {'企业销售趋势': result}
""")

    metadata_parts.append("\n【模式3: 复杂关联 - 按ATC分类统计】")
    metadata_parts.append("""
# 统计某个ATC类别的市场规模
atc_category = 'XA-消化道和代谢方面的药物'
# Step1: 找到该类别的所有药品
药品列表 = df_ipm[df_ipm['ATC1Des'] == atc_category]['药品索引'].unique()
# Step2: 统计销售
df_sub = df_fact[df_fact['药品索引'].isin(药品列表)].copy()
# 按时间汇总
result = df_sub.groupby('年季')['销售额'].sum().reset_index()
results = {'ATC类别销售': result}
""")

    metadata_parts.append("\n【模式4: 多维度关联 - 企业+产品分析】")
    metadata_parts.append("""
# 分析某企业旗下各通用名的销售情况
企业名 = '某药企'
# Step1: 获取企业药品及其通用名
企业药品表 = df_ipm[df_ipm['生产企业'].str.contains(企业名, na=False)][['药品索引', '通用名']].copy()
# Step2: 关联销售数据
merged = pd.merge(df_fact, 企业药品表, on='药品索引', how='inner')
# 按通用名汇总
result = merged.groupby('通用名')['销售额'].sum().reset_index()
result = result.sort_values('销售额', ascending=False)
results = {'产品销售排名': result}
""")

    # 5. 重要注意事项
    metadata_parts.append("\n\n" + "=" * 60)
    metadata_parts.append("重要注意事项")
    metadata_parts.append("=" * 60)
    metadata_parts.append("1. 数值字段: df_fact 的 '销售额' 和 '销售量' 已预处理为 float64 类型，可直接使用")
    metadata_parts.append("\n2. 字段关联: 两表通过 '药品索引' 关联")
    metadata_parts.append("   df_fact['药品索引'] 是 float64")
    metadata_parts.append("   df_ipm['药品索引'] 是 int64")
    metadata_parts.append("   注意: pandas 会自动处理类型匹配，但建议保持一致")
    metadata_parts.append("\n3. 模糊匹配: 企业名、药品名可能需要模糊匹配")
    metadata_parts.append("   使用: df[df['企业名'].str.contains('关键词', na=False)]")
    metadata_parts.append("\n4. 时间排序: 年季字段是字符串，可以直接排序（'21Q1' < '21Q2' < '22Q1'）")
    metadata_parts.append("\n5. 结果格式: 必须 reset_index() 确保维度列是普通列，不是索引")

    return "\n".join(metadata_parts)


def generate_dashboard_insight(dashboard_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    基于看板内所有图表数据生成综合洞察。
    """
    client = _get_client()
    if client is None:
        return {"insight": "未配置 GENAI_API_KEY，无法生成洞察。"}

    if not dashboard_items:
        return {"insight": "看板暂无内容，无法生成洞察。"}

    # 构建数据摘要
    data_summary = []
    for item in dashboard_items:
        title = item.get("title", "未命名图表")
        data = item.get("renderData") or item.get("config", {}).get("data") or []

        # 截断数据以防 Prompt 过长
        preview_data = data[:10] if isinstance(data, list) else str(data)[:500]
        data_summary.append(f"【图表: {title}】\n数据预览: {preview_data}\n")

    combined_data_text = "\n".join(data_summary)

    prompt = f"""
你是一位高级商业分析师。请基于以下看板中的多个图表数据，生成一份综合性的深度商业洞察报告。

【看板数据摘要】
{combined_data_text}

【要求】
1. **综合分析**：不要孤立地描述每个图表，尝试寻找图表之间的关联、冲突或共同趋势。
2. **深度洞察**：挖掘数据背后的业务含义，指出关键增长点、风险点或异常。
3. **结构清晰**：使用 Markdown 格式，包含 3-5 个关键发现点。每个点要有标题和简短论述。
4. **简洁有力**：总字数控制在 300-500 字之间。语言专业、客观。

请输出 Markdown 格式的通过文本。
"""

    try:
        from google.genai import types
        # 使用 Deep Model 进行深度分析
        print(f"[dashboard_insight] 开始生成洞察，看板项数: {len(dashboard_items)}")
        response = _safe_generate_content(
            client,
            DEEP_MODEL,
            prompt,
        )
        if response is None:
            print("[dashboard_insight] Gemini 返回 None")
            return {"insight": "洞察生成失败: 模型未返回有效响应，请稍后重试。"}
        if not hasattr(response, 'text') or not response.text:
            print(f"[dashboard_insight] Gemini 返回无效响应: {response}")
            return {"insight": "洞察生成失败: 模型返回了空响应。"}
        print(f"[dashboard_insight] 洞察生成成功，长度: {len(response.text)}")
        return {"insight": response.text}
    except Exception as e:
        print(f"[dashboard_insight] 异常: {e}")
        import traceback
        traceback.print_exc()
        return {"insight": f"洞察生成失败: {e}"}


# ==================== 报告生产模块 (复刻自 Streamlit ChatBI) ====================

def report_identify_intent(
    query_text: str,
    history_context: str = "无历史对话。"
) -> str:
    """
    报告生产模块的意图识别。
    返回: "inquiry" | "analysis" | "irrelevant"
    """
    client = _get_client()
    if not client:
        return "inquiry"  # 无 API Key 默认走简单模式

    prompt_router = f"""
    请根据以下上下文判断用户的意图。

    历史记录: {history_context}
    当前提问: "{query_text}"

    规则:
    1. 询问具体数值/数据/报表 -> "inquiry"
    2. 询问趋势/原因/细分市场分析 -> "analysis"
    3. 与医药数据无关 -> "irrelevant"

    严格输出 JSON: {{ "type": "result_value" }} (必须是 "inquiry", "analysis", "irrelevant" 之一)
    """

    try:
        from google.genai import types
        response = _safe_generate_content(
            client,
            FAST_MODEL,
            prompt_router,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        if response and hasattr(response, 'text'):
            _, result_json = parse_response(response.text)
            if result_json:
                return str(result_json.get('type', 'inquiry')).lower().strip()
        return "inquiry"
    except Exception as e:
        print(f"[report_identify_intent] 意图识别失败: {e}")
        return "inquiry"


def report_simple_query(
    query_text: str,
    history_context: str = "无历史对话。",
    model: str = "deep"
) -> Dict[str, Any]:
    """
    报告生产模块的简单查询模式。
    调用 fact.csv 和 ipmdata.xlsx 生成 Pandas 代码执行取数。

    返回: {
        "mode": "simple",
        "summary": { "intent", "scope", "metrics", "key_match", "logic" },
        "code": "...",
        "data": [...],
        "fullData": [...],
        "title": "...",
        "columns": [...]
    }
    """
    client = _get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}

    # 加载重型数据 (fact, ipm)
    df, dfs_map, time_context, _ = get_cached_data(need_heavy=True)
    if df is None:
        return {"error": "数据加载失败"}

    # 构建研究元数据
    research_metadata = build_research_metadata(dfs_map)

    # 获取时间上下文
    mat_list = time_context.get("mat_list", [])
    mat_list_prior = time_context.get("mat_list_prior", [])
    ytd_list = time_context.get("ytd_list", [])
    ytd_list_prior = time_context.get("ytd_list_prior", [])

    # 构建简单查询 Prompt
    simple_prompt = f"""
你是一位医药行业的 Python 专家。

【历史对话】(用于理解指代)
{history_context}

【当前用户问题】
"{query_text}"

【数据上下文】
{research_metadata}

【时间上下文 - 已注入到执行环境，直接使用变量名】
- mat_list = {mat_list}
- mat_list_prior = {mat_list_prior}
- ytd_list = {ytd_list}
- ytd_list_prior = {ytd_list_prior}

【可用表格】df_fact (销售事实表), df_ipm (药品主数据表)

【重要：数据表字段值说明】
- df_fact 表的"渠道"列只有两个值: "零售" 和 "医院"
- df_ipm 表包含详细的药品属性信息
- 两表通过 '药品索引' 字段关联

【指令】
1. 严格按用户要求提取字段。
2. 使用 `pd.merge` 关联两表 (除非用户只查单表)。
3. 确保所有使用的变量都在代码中明确定义。
4. 绝对禁止导入 IPython 或使用 display() 函数。
5. 禁止使用 df.columns = [...] 强行改名，请使用 df.rename()。
6. 结果必须赋值给变量 `results` 字典。
7. 份额计算时结果必须乘以 100，转换为百分数格式。
8. 份额列保留 1 位小数，销售额列使用 astype('int64')。
9. 严禁 inplace=True 后赋值。

【摘要生成规则 (Summary)】
- intent: 用户查询的核心意图
- scope: 数据的筛选范围
- metrics: 用户查询的核心指标
- key_match: 提取了用户什么词，去匹配了哪个列
- logic: 简述筛选和计算步骤

输出 JSON: {{ "summary": {{ "intent": "...", "scope": "...", "metrics": "...", "key_match": "...", "logic": "..." }}, "code": "..." }}
"""

    # 调用 Gemini 生成代码
    model_mapping = {"fast": FAST_MODEL, "deep": DEEP_MODEL, "image": IMAGE_MODEL}
    actual_model = model_mapping.get(model, DEEP_MODEL)

    try:
        from google.genai import types
        response = _safe_generate_content(
            client,
            actual_model,
            simple_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        _, result_json = parse_response(response.text)
    except Exception as e:
        return {"error": f"Gemini 调用失败: {e}"}

    if not result_json or "code" not in result_json:
        return {"error": "无法解析生成的代码格式"}

    # 执行代码
    exec_ctx = {
        "pd": pd, "np": np, "results": {},
        "df_fact": dfs_map.get('fact', pd.DataFrame()).copy(),
        "df_ipm": dfs_map.get('ipm', pd.DataFrame()).copy(),
        "mat_list": mat_list,
        "mat_list_prior": mat_list_prior,
        "ytd_list": ytd_list,
        "ytd_list_prior": ytd_list_prior,
    }

    try:
        exec(result_json["code"], exec_ctx)
    except Exception as e:
        return {"error": f"代码执行错误: {e}", "code": result_json.get("code", "")}

    # 提取结果
    final_results = exec_ctx.get("results")
    if not final_results or (isinstance(final_results, dict) and len(final_results) == 0):
        return {"error": "未提取到数据", "code": result_json.get("code", "")}

    # 格式化结果
    formatted = {k: normalize_result(v) for k, v in final_results.items()}
    first_name = next(iter(formatted))
    first_df = formatted[first_name]

    return {
        "mode": "simple",
        "summary": result_json.get("summary", {}),
        "code": result_json.get("code", ""),
        "data": _df_to_chart_data(first_df),
        "fullData": _df_to_full_records(first_df),
        "title": first_name,
        "columns": list(first_df.columns),
        "logicDescription": result_json.get("summary", {}).get("logic", ""),
    }


def report_deep_analysis(
    query_text: str,
    history_context: str = "无历史对话。",
    model: str = "deep"
) -> Dict[str, Any]:
    """
    报告生产模块的深度分析模式。
    多角度分析生成多个表格。
    """
    client = _get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}

    # 加载重型数据
    df, dfs_map, time_context, _ = get_cached_data(need_heavy=True)
    if df is None:
        return {"error": "数据加载失败"}

    research_metadata = build_research_metadata(dfs_map)
    mat_list = time_context.get("mat_list", [])
    ytd_list = time_context.get("ytd_list", [])

    # 构建深度分析 Prompt
    analysis_prompt = f"""
角色: 资深医药数据分析师。
历史记录: {history_context}
当前提问: "{query_text}"
数据上下文: {research_metadata}
时间上下文: MAT={mat_list}, YTD={ytd_list}

【可用表格】df_fact (销售事实表), df_ipm (药品主数据表)

【指令】
1. 设计 2-5 个不同的分析维度。
2. 每个维度生成独立的 Pandas 代码。
3. 代码安全: 禁止 inplace=True 后赋值。
4. 所有标题和描述使用简体中文。

输出 JSON:
{{
    "summary": {{
        "intent": "深度市场分析",
        "scope": "产品/时间范围",
        "metrics": "趋势/结构/增长驱动力",
        "logic": "分析步骤描述"
    }},
    "intent_analysis": "分析思路描述",
    "angles": [
        {{ "title": "分析维度标题", "desc": "描述", "code": "Python代码" }}
    ]
}}
"""

    # 调用 Gemini
    model_mapping = {"fast": FAST_MODEL, "deep": DEEP_MODEL, "image": IMAGE_MODEL}
    actual_model = model_mapping.get(model, DEEP_MODEL)

    try:
        from google.genai import types
        response = _safe_generate_content(
            client,
            actual_model,
            analysis_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        _, plan_json = parse_response(response.text)
    except Exception as e:
        return {"error": f"Gemini 调用失败: {e}"}

    if not plan_json:
        return {"error": "无法解析分析计划"}

    # 执行各个分析角度
    angles_results = []
    shared_ctx = {
        "df_fact": dfs_map.get('fact', pd.DataFrame()).copy(),
        "df_ipm": dfs_map.get('ipm', pd.DataFrame()).copy(),
        "pd": pd, "np": np,
        "mat_list": mat_list,
        "ytd_list": ytd_list,
    }

    for angle in plan_json.get('angles', []):
        try:
            exec_ctx = shared_ctx.copy()
            exec_ctx["results"] = {}
            exec(angle['code'], exec_ctx)

            final_res = exec_ctx.get("results", {})
            if final_res:
                k = next(iter(final_res))
                v = normalize_result(final_res[k])
                angles_results.append({
                    "title": angle['title'],
                    "desc": angle.get('desc', ''),
                    "data": _df_to_full_records(v),
                    "columns": list(v.columns),
                })
        except Exception as e:
            angles_results.append({
                "title": angle['title'],
                "error": str(e),
            })

    return {
        "mode": "analysis",
        "summary": plan_json.get("summary", {}),
        "intent_analysis": plan_json.get("intent_analysis", ""),
        "angles": angles_results,
    }


def report_generate_followup(
    query_text: str,
    result_data: List[Dict[str, Any]]
) -> List[str]:
    """
    报告生产模块的追问生成。
    基于查询结果生成 2 个后续问题。
    """
    client = _get_client()
    if not client:
        return []

    # 获取可用字段
    _, dfs_map, _, _ = get_cached_data(need_heavy=True)
    all_columns = []
    if 'fact' in dfs_map:
        all_columns.extend(dfs_map['fact'].columns.tolist())
    if 'ipm' in dfs_map:
        all_columns.extend(dfs_map['ipm'].columns.tolist())
    cols_str = ", ".join(list(set(all_columns))[:50])

    prompt = f"""
基于用户问题 "{query_text}" 和查询结果。

【可用字段】: {cols_str}

生成 2 个后续分析问题。
输出 JSON 字符串列表: ["问题1", "问题2"]
"""

    try:
        from google.genai import types
        response = _safe_generate_content(
            client,
            FAST_MODEL,
            prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        _, result = parse_response(response.text)
        if isinstance(result, list):
            return result[:2]
        return []
    except Exception:
        return []


def process_report_query(
    query_text: str,
    history_context: str = "无历史对话。",
    model: str = "deep"
) -> Dict[str, Any]:
    """
    报告生产模块的主入口函数。
    复刻自 Streamlit ChatBI 的核心逻辑。
    """
    # 1. 意图识别
    intent = report_identify_intent(query_text, history_context)
    print(f"[report] 意图识别: {intent}")

    # 2. 根据意图分流
    if intent == "irrelevant":
        return {
            "mode": "irrelevant",
            "message": "该问题与医药数据无关。"
        }

    if intent == "analysis":
        result = report_deep_analysis(query_text, history_context, model)
    else:
        result = report_simple_query(query_text, history_context, model)

    # 3. 生成追问
    if "error" not in result:
        followup = report_generate_followup(query_text, result.get("fullData", []))
        result["followup_questions"] = followup

    return result


# ============================================================
# 市场分析模块 (Market Analysis) - 使用 fact.csv 和 ipmdata.xlsx
# ============================================================

def _load_market_analysis_data() -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame], str]:
    """
    加载市场分析所需的数据：fact.csv 和 ipmdata.xlsx
    返回 (df_fact, df_ipm, status_message)
    """
    df_fact = None
    df_ipm = None
    status_parts = []

    # 加载 fact.csv
    fact_path = os.path.join(DATA_DIR, "fact.csv")
    if os.path.exists(fact_path):
        try:
            df_fact = pd.read_csv(fact_path)
            df_fact.columns = df_fact.columns.str.strip()
            # 数值列处理
            for col in ['销售额', '销售量']:
                if col in df_fact.columns:
                    df_fact[col] = pd.to_numeric(
                        df_fact[col].astype(str).str.replace(',', '', regex=False),
                        errors='coerce'
                    ).fillna(0)
            status_parts.append(f"fact: {len(df_fact)}行")
        except Exception as e:
            status_parts.append(f"fact加载失败: {e}")
    else:
        status_parts.append("fact.csv不存在")

    # 加载 ipmdata.xlsx
    ipm_path = os.path.join(DATA_DIR, "ipmdata.xlsx")
    if os.path.exists(ipm_path):
        try:
            df_ipm = pd.read_excel(ipm_path)
            df_ipm.columns = df_ipm.columns.str.strip()
            status_parts.append(f"ipm: {len(df_ipm)}行")
        except Exception as e:
            status_parts.append(f"ipm加载失败: {e}")
    else:
        status_parts.append("ipmdata.xlsx不存在")

    return df_fact, df_ipm, " | ".join(status_parts)


def _build_market_analysis_metadata(df_fact, df_ipm) -> str:
    """构建市场分析的元数据描述，包含列名和枚举值"""
    info = []

    if df_fact is not None:
        info.append("【df_sales (销售数据表)】")
        info.append(f"行数: {len(df_fact)}")
        info.append(f"列名: {list(df_fact.columns)}")

        # 各列枚举值
        for col in df_fact.columns:
            uniques = df_fact[col].dropna().unique()
            if len(uniques) <= 50:
                info.append(f"  - {col}: {list(uniques)}")
            else:
                info.append(f"  - {col}: {list(uniques[:20])} ... (共{len(uniques)}个)")

    if df_ipm is not None:
        info.append("")
        info.append("【df_product (产品维度表)】")
        info.append(f"行数: {len(df_ipm)}")
        info.append(f"列名: {list(df_ipm.columns)}")

        # 关键列枚举值
        key_cols = ['商品名', '通用名', 'ATC1Des', 'ATC2Des', '剂型', '集采批次']
        for col in key_cols:
            if col in df_ipm.columns:
                uniques = df_ipm[col].dropna().unique()
                if len(uniques) <= 50:
                    info.append(f"  - {col}: {list(uniques)}")
                else:
                    info.append(f"  - {col}: {list(uniques[:20])} ... (共{len(uniques)}个)")

    info.append("")
    info.append("【关联键】: 药品索引")

    return "\n".join(info)


def market_analysis_identify_intent(query: str, history: str) -> str:
    """市场分析意图识别"""
    client = _get_client()
    if not client:
        return "inquiry"

    prompt = f"""
请判断用户意图。
历史记录: {history}
当前提问: "{query}"

规则:
1. 询问具体数值/数据/报表 -> "inquiry"
2. 询问趋势/原因/细分市场分析 -> "analysis"
3. 与医药数据无关 -> "irrelevant"

严格输出 JSON: {{ "type": "result_value" }}
"""
    try:
        from google.genai import types
        resp = _safe_generate_content(
            client, FAST_MODEL, prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        _, data = parse_response(resp.text)
        if data and "type" in data:
            return str(data["type"]).lower().strip()
    except Exception as e:
        print(f"[market_analysis] 意图识别失败: {e}")
    return "inquiry"


def market_analysis_simple_query(
    query: str,
    history: str,
    df_fact: pd.DataFrame,
    df_ipm: pd.DataFrame,
    meta_data: str
) -> Dict[str, Any]:
    """市场分析简单查询"""
    client = _get_client()
    if not client:
        return {"error": "未配置API"}

    prompt = f"""
你是医药行业Python专家。

【历史对话】
{history}

【当前问题】
"{query}"

【数据上下文 - 包含列名和枚举值】
{meta_data}

【关键指令】
1. **必须先关联两表**: df = pd.merge(df_sales, df_product, on='药品索引', how='left')
2. 产品筛选用 商品名/通用名/成分名 的 str.contains 模糊匹配
3. 年季格式参考上方枚举值，提取年份用 df['年季'].str[:2]
4. 结果赋值给 `result`
5. 份额计算必须乘100转为百分数
6. 销售额用 astype('int64')
7. 禁止 inplace=True 后赋值
8. **严格使用数据库已有字段名称**：代码中引用的列名必须与上方【数据上下文】中的列名完全一致，不得使用不存在的列名（如"定义市场"等），除非是执行过程中新增的计算字段

【药品别名参考】
- K药 = 帕博利珠单抗 = 可瑞达
- O药 = 纳武利尤单抗 = 欧狄沃
- 拓益 = 特瑞普利单抗
- 艾瑞卡 = 卡瑞利珠单抗
- 达伯舒 = 信迪利单抗
- 百泽安 = 替雷利珠单抗

输出JSON:
{{
  "summary": {{
    "intent": "简单取数",
    "scope": "...",
    "metrics": "...",
    "logic": "..."
  }},
  "code": "..."
}}
"""

    # 打印并保存完整的API请求内容到文件
    print("=" * 80)
    print("[market_analysis] 完整API请求内容已保存到 data/api_request_log.txt")
    print("=" * 80)

    log_path = os.path.join(DATA_DIR, "api_request_log.txt")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(prompt)

    try:
        from google.genai import types
        resp = _safe_generate_content(
            client, DEEP_MODEL, prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        _, plan = parse_response(resp.text)

        if not plan or "code" not in plan:
            return {"error": "代码生成失败"}

        # 执行代码
        exec_ctx = {
            "df_sales": df_fact.copy(),
            "df_product": df_ipm.copy(),
            "pd": pd,
            "np": np,
            "result": None
        }
        exec(plan["code"], exec_ctx)

        res = exec_ctx.get("result")
        print(f"[market_analysis] 代码执行完成，result类型: {type(res)}")

        if res is None:
            return {"error": "未生成结果，请检查代码是否将结果赋值给result变量"}

        res_df = normalize_result(res)
        print(f"[market_analysis] 结果DataFrame: {res_df.shape}, 列名: {list(res_df.columns)}")

        if res_df.empty:
            return {"error": "查询结果为空，未匹配到数据"}

        summary = plan.get("summary", {})

        return {
            "mode": "simple",
            "summary": summary,
            "thought": summary.get("logic", ""),
            "code": plan.get("code", ""),
            "data": _df_to_chart_data(res_df),
            "fullData": _df_to_full_records(res_df),
            "title": summary.get("intent", "查询结果")
        }

    except Exception as e:
        print(f"[market_analysis] 简单查询失败: {e}")
        return {"error": str(e)}


def market_analysis_generate_followup(query: str, data: list, meta_data: str = "") -> list:
    """生成3个追问建议，基于现有字段和之前的问题"""
    client = _get_client()
    if not client:
        return []

    prompt = f"""
基于用户问题 "{query}" 和数据结果，生成3个后续分析问题。

【可用字段参考】
{meta_data[:1000] if meta_data else "销售额、销售量、渠道、通用名、商品名、生产企业、ATC分类、医保、集采批次"}

【要求】
1. 问题要基于现有数据字段
2. 问题要与用户原问题相关，可以是深入分析或换个维度
3. 问题要具体、可执行

输出JSON列表: ["问题1", "问题2", "问题3"]
"""
    try:
        from google.genai import types
        resp = _safe_generate_content(
            client, FAST_MODEL, prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        _, result = parse_response(resp.text)
        if isinstance(result, list):
            return result[:3]
    except Exception as e:
        print(f"[market_analysis] 追问生成失败: {e}")
    return []


def process_market_analysis_query(
    query_text: str,
    history_context: str = "无历史对话。"
) -> Dict[str, Any]:
    """
    市场分析模块主入口函数。
    使用 fact.csv 和 ipmdata.xlsx 数据。
    """
    print(f"[market_analysis] 开始处理: {query_text}")

    # 1. 加载数据
    df_fact, df_ipm, status = _load_market_analysis_data()
    print(f"[market_analysis] 数据加载: {status}")

    if df_fact is None or df_ipm is None:
        return {"error": f"数据加载失败: {status}"}

    # 2. 构建元数据
    meta_data = _build_market_analysis_metadata(df_fact, df_ipm)

    # 3. 意图识别
    print(f"[market_analysis] Step 3: 正在识别意图...")
    intent = market_analysis_identify_intent(query_text, history_context)
    print(f"[market_analysis] Step 3 完成: 意图={intent}")

    # 4. 根据意图分流
    print(f"[market_analysis] Step 4: 根据意图分流...")
    if intent == "irrelevant":
        print(f"[market_analysis] Step 4: 识别为无关问题，返回提示")
        return {
            "mode": "irrelevant",
            "message": "该问题与医药数据无关。"
        }

    # 5. 执行查询
    print(f"[market_analysis] Step 5: 正在执行查询...")
    result = market_analysis_simple_query(
        query_text, history_context,
        df_fact, df_ipm, meta_data
    )
    print(f"[market_analysis] Step 5 完成: {'成功' if 'error' not in result else '失败'}")

    # 6. 生成追问
    if "error" not in result:
        print(f"[market_analysis] Step 6: 正在生成追问建议...")
        followup = market_analysis_generate_followup(
            query_text,
            result.get("fullData", []),
            meta_data
        )
        result["followUpQuestions"] = followup
        print(f"[market_analysis] Step 6 完成: 生成{len(followup)}个追问")

    return result
