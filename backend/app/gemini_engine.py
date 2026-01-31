"""
Gemini 驱动的 BI 查询引擎：意图路由、取数/分析、代码执行。
适配自 Streamlit ChatBI 后端逻辑，无 Streamlit 依赖。
"""
import os
import re
import json
import time
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List, Tuple
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
# 缓存主数据与元数据，避免每次请求重读文件
_cached_df = None
_cached_dfs: Dict[str, pd.DataFrame] = {}  # 缓存所有已加载的 DataFrame
_cached_time_context = None
_cached_meta_data = None


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


def load_data() -> Tuple[Optional[pd.DataFrame], Dict[str, pd.DataFrame], str]:
    """加载主数据及其他关联表。返回 (df_main, dfs_map, status_message)。"""
    dfs_map = {}
    
    # 1. 加载主表 (HCM Data)
    main_path = os.path.join(DATA_DIR, FIXED_FILE_NAME)
    if not os.path.exists(main_path):
        return None, {}, f"❌ 找不到主数据文件: {FIXED_FILE_NAME}"

    try:
        # Load Main DF
        if FIXED_FILE_NAME.endswith(".csv"):
            df_main = pd.read_csv(main_path)
        else:
            df_main = pd.read_excel(main_path)
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

        # 2. 加载其他数据表 (Fact, IPM, etc.)
        extra_files = {
            "fact": "fact.csv",
            "ipm": "ipmdata.xlsx"
        }
        
        for key, fname in extra_files.items():
            fpath = os.path.join(DATA_DIR, fname)
            if os.path.exists(fpath):
                try:
                    if fname.endswith(".csv"):
                        df_tmp = pd.read_csv(fpath)
                    else:
                        df_tmp = pd.read_excel(fpath)
                    df_tmp.columns = df_tmp.columns.str.strip()
                    # Numeric cleanup
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
                except Exception as e:
                    print(f"[load_data] Failed to load {fname}: {e}")

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
    year_match = re.search(r"(\d{4})", str(max_q))
    if year_match:
        curr_year = year_match.group(1)
        try:
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
    if isinstance(res, pd.DataFrame):
        return res
    if isinstance(res, pd.Series):
        return res.to_frame()
    if isinstance(res, dict):
        try:
            return pd.DataFrame(list(res.items()), columns=["指标", "数值"])
        except Exception:
            pass
    try:
        return pd.DataFrame([res])
    except Exception:
        return pd.DataFrame({"Result": [str(res)]})


def _df_to_chart_data(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """将 DataFrame 转为前端图表格式 [{ name, value }]。智能识别维度列（文本）和指标列（数值）。"""
    if df is None or df.empty or len(df.columns) < 2:
        return []
    
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
    if df is None or df.empty:
        return []
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


def get_cached_data() -> Tuple[Optional[pd.DataFrame], Optional[Dict[str, pd.DataFrame]], Optional[Dict], Optional[str]]:
    """获取或构建缓存的 df, dfs_map, time_context, meta_data。"""
    global _cached_df, _cached_dfs, _cached_time_context, _cached_meta_data
    if _cached_df is not None:
        return _cached_df, _cached_dfs, _cached_time_context, _cached_meta_data
    
    df, dfs_map, _ = load_data()
    if df is None:
        return None, {}, None, None
        
    _cached_df = df
    _cached_dfs = dfs_map
    _cached_time_context = analyze_time_structure(df)
    
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
    global _cached_df, _cached_time_context, _cached_meta_data, _client
    _cached_df = None
    _cached_time_context = None
    _cached_meta_data = None
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
        return json.loads(router_resp.text).get("type", "single_query")
    except Exception:
        return "single_query"


def process_query_with_gemini(
    query_text: str,
    df: Optional[pd.DataFrame] = None,
    time_context: Optional[Dict[str, Any]] = None,
    meta_data: Optional[str] = None,
    history_context: str = "无历史对话。",
) -> Dict[str, Any]:
    """
    使用 Gemini 执行意图路由 + 取数/分析，返回统一结构：
    - 始终包含 data, title, logicDescription, config（供前端图表/表格和「保存到看板」）
    - 可选 mode, summary, tables, intent_analysis, angles, insight
    """
    from google.genai import types

    client = _get_client()
    if client is None:
        return {"error": "未配置 GENAI_API_KEY，无法使用 Gemini 引擎。"}

    if df is None or time_context is None or meta_data is None:
        df, dfs_map, time_context, meta_data = get_cached_data()
        if df is None:
            return {"error": "数据加载失败，请检查 data 目录下主数据文件。"}
    else:
        # Fallback if arguments provided but not dfs_map (this path technically won't be hit if we always use get_cached_data internally or pass explicit dict, but good safety)
        _, dfs_map, _, _ = get_cached_data()

    mat_list = time_context.get("mat_list", [])
    mat_list_prior = time_context.get("mat_list_prior", [])
    ytd_list = time_context.get("ytd_list", [])
    ytd_list_prior = time_context.get("ytd_list_prior", [])

    # 1. 意图路由
    intent_type = identify_intent(query_text, history_context)

    if intent_type == "irrelevant":
        return {
            "data": [],
            "title": "无法处理",
            "logicDescription": "当前提问与数据内容无关。",
            "config": {},
            "mode": "irrelevant",
        }

    # 2. Multi-Table Plan 模式 (新)
    if intent_type == "multi_table":
        plan_prompt = f"""
你是一位医药行业 BI 专家。用户问题："{query_text}"
需要通过多个数据表格来完整回答。请规划需要生产哪些表格。

【元数据】{meta_data}
【历史记录】{history_context}
【时间上下文】MAT: {mat_list}, YTD: {ytd_list}

请列出需要生成的表格清单。每个表格需要包含：
- id: 序号 (1, 2, 3...)
- title: 表格标题
- description: 描述该表格的内容和用途
- logic: 简要计算/筛选逻辑描述

输出 JSON: {{ "plan": [ {{ "id": 1, "title": "...", "description": "...", "logic": "..." }} ] }}
"""
        try:
            response_plan = _safe_generate_content(
                client, 
                DEEP_MODEL,
                plan_prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            _, plan_json = parse_response(response_plan.text)
            return {
                "mode": "plan_confirmation",
                "plan": plan_json.get("plan", []),
                "title": "生产计划确认",
                "logicDescription": f"即将在看板中生成 {len(plan_json.get('plan', []))} 个表格，请确认。",
                "config": {}
            }
        except Exception as e:
            return {"error": f"生成计划失败: {e}"}

    # 3. Single Query 模式 (相当于原来的 Simple，但去除了分析部分，仅保留 "auto" 逻辑)
    # 只要不是多表，就默认单表直接出
    
    # 动态构建可用表格提示
    available_tables = ["df (主表)"]
    if dfs_map:
        for k in dfs_map:
            if k != 'hcm':
                available_tables.append(f"df_{k} ({k}表)")
    available_tables_str = ", ".join(available_tables)
    
    simple_prompt = f"""
你是一位医药行业的 Pandas 数据处理专家。用户需求："{query_text}"
【元数据】{meta_data}
【历史记录】{history_context}
【时间上下文】MAT: {mat_list}, YTD: {ytd_list}
【可用表格】{available_tables_str}

【关键指令 - 必须遵守】
1. 数据源：环境中存在 {available_tables_str}。
   - `df`: 主表 (HCM Data)，包含医院销售细分数据。
   - `df_fact`: (如果存在) 财务状况/Fact数据。
   - `df_ipm`: (如果存在) 市场/IPM数据。
   - 请根据问题选择正确的 DataFrame。如果涉及跨表，请自行 merge（注意 Key）。
2. 必须自行筛选：如需特定维度（如海南、2023年），必须在代码中显式筛选。
3. 禁止臆造 Key：不要假设数据中存在不存在的具体值。请先检查 unique 或使用模糊匹配。
4. 结果赋值：将最终结果字典赋值给 `results`，例如 results = {{'查询结果': df_sub}}。
5. 严禁绘图。
6. 提到市场表现时，必须给份额、同比、份额变化、EI 等对比指标，并包含在 DataFrame 中。
7. 【重要】返回的 DataFrame 必须包含维度列（如省份、城市、药品名称等）作为第一列，不能只返回数值列。用 reset_index() 确保索引变成普通列。
8. 【Categorical 处理】使用 pd.qcut/pd.cut 时，请务必使用 astype(str) 转为字符串，避免 Categorical 类型导致的 setitem 报错。

输出 JSON: {{
    "summary": {{ "intent": "意图描述", "scope": "数据范围", "metrics": "指标", "logic": "计算逻辑" }},
    "code": "df_sub = df[...]\\nresults = {{'标题': df_sub}}"
}}
"""
    try:
        simple_resp = _safe_generate_content(
            client,
            DEEP_MODEL,  # Single Query (deep_model)
            simple_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        _, simple_json = parse_response(simple_resp.text)
    except Exception as e:
        return {"error": f"Gemini 调用失败: {e}"}

    if not simple_json or "code" not in simple_json:
        return {"error": "无法解析生成的代码格式，请重试。"}

    exec_ctx = {
        "df": df,
        "pd": pd,
        "np": np,
        "pd": pd,
        "np": np,
        "results": {},
        "result": None,
        "current_mat": mat_list,
        "mat_list": mat_list,
        "prior_mat": mat_list_prior,
        "mat_list_prior": mat_list_prior,
        "ytd_list": ytd_list,
        "ytd_list_prior": ytd_list_prior,
    }
    try:
        # Inject additional DFs
        if dfs_map:
             for k, v in dfs_map.items():
                 exec_ctx[f"df_{k}"] = v
        exec(simple_json["code"], exec_ctx)
    except Exception as e:
        return {"error": f"代码执行错误: {e}"}

    final_results = exec_ctx.get("results")
    if not final_results and exec_ctx.get("result") is not None:
        final_results = {"查询结果": exec_ctx["result"]}

    if not final_results:
        return {"error": "未提取到数据。"}

    formatted = {k: normalize_result(v) for k, v in final_results.items()}
    first_name = next(iter(formatted))
    first_df = formatted[first_name]
    chart_data = _df_to_chart_data(first_df)
    summary = simple_json.get("summary", {})
    title = first_name
    logic = summary.get("logic", "") or f"按用户问题「{query_text}」取数。"

    # 表格转成前端可用的列表 of dict
    tables_for_api = {}
    for k, v in formatted.items():
        tables_for_api[k] = v.replace({np.nan: None}).to_dict(orient="records")

    return {
        "data": chart_data,
        "fullData": _df_to_full_records(first_df),  # 完整多列数据
        "title": title,
        "logicDescription": logic,
        "config": {"dimension": first_df.columns[0] if len(first_df.columns) > 0 else "", "metric": first_df.columns[1] if len(first_df.columns) > 1 else ""},
        "mode": "simple",
        "summary": summary,
        "tables": tables_for_api,
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

def generate_market_research_plan(
    query_text: str,
    history_context: str,
    meta_data: str,
) -> Dict[str, Any]:
    """
    专门用于市场调研模块的 Planner。
    强制使用 DEEP_MODEL (gemini-3-pro-preview)。
    关注多源数据整合 (Fact, IPM, HCM)。
    """
    client = _get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}

    df, dfs_map, _, _ = get_cached_data()
    
    # 构建可用表格描述
    available_tables = ["df (HCM 主表)"]
    if dfs_map:
        for k in dfs_map:
            available_tables.append(f"df_{k} ({k} 表)")
    available_tables_str = ", ".join(available_tables)

    research_prompt = f"""
你是一位资深医药市场分析专家，拥有丰富的行业经验和数据分析能力。
用户正在进行市场调研，问题是："{query_text}"

【可用数据源】
1. **互联网 (Internet)**: 获取最新的定性信息、新闻、政策、竞品动态、非结构化数据。
2. **内部数据库 (Database)**: 
   - `df` (HCM): 医院终端销售细分数据（省份、城市、医院、产品、规格）。
   - `df_fact` (如有): 厂家实际销售/财务数据。
   - `df_ipm` (如有): 行业宏观/IPM市场数据。

【元数据摘要】
{meta_data}

【历史上下文】
{history_context}

你的任务是设计一个【完整的调研方案】，包括：
1. 整体调研策略和思路
2. 具体的执行步骤，每步明确从哪里获取什么信息

【输出要求】
返回 JSON，格式如下：
{{
  "research_strategy": "整体调研策略的简要描述，解释为什么这样设计步骤...",
  "plan": [
    {{
      "id": 1,
      "source": "internet",  // 或 "database"
      "action": "具体动作描述...",
      "rationale": "为什么要这么做...",
      "expected_output": "预期获取的信息..."
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
        
        return {
            "mode": "plan_confirmation",
            "plan": plan_items,
            "title": "调研方案",
            "logicDescription": research_strategy,
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
            return {
                "chartType": result_json.get("chartType", "bar"),
                "reason": result_json.get("reason", ""),
                "config": result_json.get("config", {}),
            }
        else:
            return {"chartType": "bar", "reason": "默认推荐柱状图", "config": {}}
    except Exception as e:
        return {"error": f"图表推荐调用失败: {e}"}


def generate_dashboard_insight(dashboard_items: List[Dict[str, Any]]) -> str:
    """
    基于看板内所有图表数据生成综合洞察。
    """
    client = _get_client()
    if client is None:
        return "未配置 GENAI_API_KEY，无法生成洞察。"

    if not dashboard_items:
        return "看板暂无内容，无法生成洞察。"

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
        response = _safe_generate_content(
            client,
            DEEP_MODEL,
            prompt,
        )
        return response.text
    except Exception as e:
        return f"洞察生成失败: {e}"
