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

# 路径配置
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
FIXED_FILE_NAME = "hcmdata.xlsx"
CLIENT_FILE_NAME = "structure.xlsx"

# 可选：Gemini 客户端（未配置 API Key 时不使用）
_client = None
# 缓存主数据与元数据，避免每次请求重读文件
_cached_df = None
_cached_time_context = None
_cached_meta_data = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    api_key = os.environ.get("GENAI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
        return _client
    except ImportError:
        return None
    except Exception:
        return None


def load_data() -> Tuple[Optional[pd.DataFrame], str]:
    """加载主数据并可选关联架构表。返回 (df, status_message)。"""
    main_path = os.path.join(DATA_DIR, FIXED_FILE_NAME)
    if not os.path.exists(main_path):
        return None, f"❌ 找不到主数据文件: {FIXED_FILE_NAME}"

    try:
        if FIXED_FILE_NAME.endswith(".csv"):
            df_main = pd.read_csv(main_path)
        else:
            df_main = pd.read_excel(main_path)
        df_main.columns = df_main.columns.str.strip()

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

        client_path = os.path.join(DATA_DIR, CLIENT_FILE_NAME)
        if not os.path.exists(client_path):
            return df_main, "ℹ️ 无架构表文件"

        try:
            if CLIENT_FILE_NAME.endswith(".csv"):
                df_client = pd.read_csv(client_path)
            else:
                df_client = pd.read_excel(client_path)
            df_client.columns = df_client.columns.str.strip()
            common_cols = list(set(df_main.columns) & set(df_client.columns))
            if not common_cols:
                return df_main, "⚠️ 未关联：两表无相同列名"
            join_key = common_cols[0]
            msg_suffix = ""
            if df_client[join_key].duplicated().any():
                df_client = df_client.drop_duplicates(subset=[join_key])
                msg_suffix = " (已自动去重)"
            df_merged = pd.merge(df_main, df_client, on=join_key, how="left")
            return df_merged, f"✅ 已关联架构表 (Key: {join_key}){msg_suffix}"
        except Exception as e:
            return df_main, f"❌ 架构表读取失败: {str(e)}"
    except Exception as e:
        return None, f"文件读取错误: {e}"


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
    """构建元数据描述字符串供 Prompt 使用。"""
    info = []
    info.append(f"【时间列名】: {time_context.get('col_name')}")
    info.append(f"【当前MAT】: {time_context.get('mat_list')}")
    info.append(f"【当前YTD】: {time_context.get('ytd_list')}")
    for col in df.columns:
        dtype = str(df[col].dtype)
        uniques = df[col].dropna().unique()
        desc = f"- `{col}` ({dtype})"
        if dtype == "object" or len(uniques) < 2000:
            vals = list(uniques[:20]) if len(uniques) > 20 else list(uniques)
            desc += f" | 示例: {vals}"
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
    """将 DataFrame 转为前端图表格式 [{ name, value }]。取第一列为 name，第一个数值列为 value。"""
    if df is None or df.empty or len(df.columns) < 2:
        return []
    name_col = df.columns[0]
    value_col = None
    for c in df.columns[1:]:
        if pd.api.types.is_numeric_dtype(df[c]):
            value_col = c
            break
    if value_col is None:
        value_col = df.columns[1]
    out = []
    for _, row in df.iterrows():
        try:
            val = float(row[value_col]) if pd.notna(row[value_col]) else 0
        except (TypeError, ValueError):
            val = 0
        out.append({"name": str(row[name_col]) if pd.notna(row[name_col]) else "", "value": val})
    return out


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


def get_cached_data() -> Tuple[Optional[pd.DataFrame], Optional[Dict], Optional[str]]:
    """获取或构建缓存的 df、time_context、meta_data。"""
    global _cached_df, _cached_time_context, _cached_meta_data
    if _cached_df is not None:
        return _cached_df, _cached_time_context, _cached_meta_data
    df, _ = load_data()
    if df is None:
        return None, None, None
    _cached_df = df
    _cached_time_context = analyze_time_structure(df)
    _cached_meta_data = build_metadata(df, _cached_time_context)
    return _cached_df, _cached_time_context, _cached_meta_data


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
        df, time_context, meta_data = get_cached_data()
        if df is None:
            return {"error": "数据加载失败，请检查 data 目录下主数据文件。"}

    mat_list = time_context.get("mat_list", [])
    mat_list_prior = time_context.get("mat_list_prior", [])
    ytd_list = time_context.get("ytd_list", [])
    ytd_list_prior = time_context.get("ytd_list_prior", [])

    # 1. 意图路由
    router_prompt = f"""
基于用户当前问题："{query_text}" 以及历史上下文判断用户意图。
【历史上下文】: {history_context}
请将其分类为以下三类之一：
1. "simple": 简单取数、排序、排名、计算基础指标。
2. "analysis": 开放式问题，寻求洞察、原因分析、市场格局。
3. "irrelevant": 与数据完全无关的闲聊。
仅输出 JSON: {{"type": "simple" 或 "analysis" 或 "irrelevant"}}
"""
    try:
        router_resp = _safe_generate_content(
            client,
            "gemini-2.0-flash",
            router_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        intent_type = json.loads(router_resp.text).get("type", "analysis")
    except Exception as e:
        intent_type = "analysis"

    if intent_type == "irrelevant":
        return {
            "data": [],
            "title": "无法处理",
            "logicDescription": "当前提问与数据内容无关。",
            "config": {},
            "mode": "irrelevant",
        }

    # 2. Simple 模式
    if intent_type == "simple":
        simple_prompt = f"""
你是一位医药行业的 Pandas 数据处理专家。用户需求："{query_text}"
【元数据】{meta_data}
【历史记录】{history_context}
【时间上下文】MAT: {mat_list}, YTD: {ytd_list}

【关键指令 - 必须遵守】
1. 唯一数据源：环境中只有 `df`。不要假设存在 df_sales, df_hainan 等变量。
2. 必须自行筛选：如需特定维度（如海南、2023年），必须在代码中显式筛选。
3. 禁止臆造 Key：不要假设数据中存在不存在的具体值。请先检查 unique 或使用模糊匹配。
4. 结果赋值：将最终结果字典赋值给 `results`，例如 results = {{'查询结果': df_sub}}。
5. 严禁绘图。
6. 提到市场表现时，尽可能给份额、同比、份额变化、EI 等对比指标。

输出 JSON: {{
    "summary": {{ "intent": "意图描述", "scope": "数据范围", "metrics": "指标", "logic": "计算逻辑" }},
    "code": "df_sub = df[...]\\nresults = {{'标题': df_sub}}"
}}
"""
        try:
            simple_resp = _safe_generate_content(
                client,
                "gemini-2.0-flash",
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
            "title": title,
            "logicDescription": logic,
            "config": {"dimension": first_df.columns[0] if len(first_df.columns) > 0 else "", "metric": first_df.columns[1] if len(first_df.columns) > 1 else ""},
            "mode": "simple",
            "summary": summary,
            "tables": tables_for_api,
        }

    # 3. Analysis 模式
    prompt_plan = f"""
你是一位医药行业 BI 专家。请将问题："{query_text}" 拆解为 2-5 个分析角度。
结合时间动态（MAT/YTD）和竞争视角进行分析。

【元数据】{meta_data}
【历史记录】{history_context}
【时间上下文】MAT: {mat_list}, YTD: {ytd_list}

【关键指令】
0. 数据源唯一入口：环境中只有名为 `df` 的 DataFrame。
1. 严禁使用未定义变量；如需筛选请先定义 df_sub 等。
2. 严禁臆造 Key；用 unique() 或模糊匹配确认名称。
3. 严禁绘图。
4. 每个角度的代码最终结果必须赋值给变量 `result`。
5. 语言：中文。
6. 市场表现尽量给份额、同比、EI 等对比指标。

输出 JSON: {{ "intent_analysis": "意图深度解析(Markdown)", "angles": [ {{"title": "分析角度标题", "description": "描述", "code": "df_sub = df[...]\\nresult = df_sub..."}} ] }}
"""
    try:
        response_plan = _safe_generate_content(client, "gemini-2.0-flash", prompt_plan)
        _, plan_json = parse_response(response_plan.text)
    except Exception as e:
        return {"error": f"Gemini 分析计划调用失败: {e}"}

    if not plan_json or "angles" not in plan_json:
        return {"error": "无法生成分析方案。"}

    intent_analysis = plan_json.get("intent_analysis", "自动分析")
    angles_data = []

    for angle in plan_json["angles"]:
        exec_ctx = {
            "df": df,
            "pd": pd,
            "np": np,
            "result": None,
            "mat_list": mat_list,
            "mat_list_prior": mat_list_prior,
            "ytd_list": ytd_list,
            "ytd_list_prior": ytd_list_prior,
        }
        try:
            exec(angle["code"], exec_ctx)
        except Exception as e:
            angles_data.append({
                "title": angle["title"],
                "desc": angle.get("description", ""),
                "data": [],
                "explanation": f"执行错误: {e}",
            })
            continue

        if exec_ctx.get("result") is None:
            for k, v in list(exec_ctx.items()):
                if isinstance(v, pd.DataFrame) and k != "df":
                    exec_ctx["result"] = v
                    break

        res_df = normalize_result(exec_ctx["result"]) if exec_ctx.get("result") is not None else pd.DataFrame()
        explanation = ""
        if not res_df.empty:
            try:
                mini_prompt = f"""
对以下数据做深度解读（200字内）。
数据预览：\n{res_df.head(20).to_string()}
要求：提炼趋势/异常，结合业务含义，语言专业。
"""
                mini_resp = _safe_generate_content(client, "gemini-2.0-flash", mini_prompt)
                explanation = mini_resp.text
            except Exception:
                explanation = "（解读生成失败）"

        angles_data.append({
            "title": angle["title"],
            "desc": angle.get("description", ""),
            "data": res_df.replace({np.nan: None}).to_dict(orient="records") if not res_df.empty else [],
            "explanation": explanation,
        })

    # 综合洞察
    insight_text = ""
    if angles_data:
        try:
            all_findings = "\n".join([f"[{a['title']}]: {a['explanation']}" for a in angles_data])
            final_prompt = f"""
问题: "{query_text}"
各角度发现: {all_findings}
生成最终洞察 (Markdown)。严禁建议，仅陈述事实。
"""
            resp_final = _safe_generate_content(client, "gemini-2.0-flash", final_prompt)
            insight_text = resp_final.text
        except Exception:
            insight_text = "（综述生成失败）"

    # 取第一个角度的数据作为主图表数据
    first_angle = angles_data[0] if angles_data else {}
    first_data = first_angle.get("data", [])
    if isinstance(first_data, list) and first_data and isinstance(first_data[0], dict):
        # 若已是 [{name, value}] 格式可直接用；否则从 records 转
        if "name" in first_data[0] and "value" in first_data[0]:
            chart_data = first_data
        else:
            first_df = pd.DataFrame(first_data)
            chart_data = _df_to_chart_data(first_df)
    else:
        chart_data = []

    return {
        "data": chart_data,
        "title": first_angle.get("title", "分析结果"),
        "logicDescription": intent_analysis[:200] + "..." if len(intent_analysis) > 200 else intent_analysis,
        "config": {},
        "mode": "analysis",
        "intent_analysis": intent_analysis,
        "angles": angles_data,
        "insight": insight_text,
    }
