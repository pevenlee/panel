"""
统一的数据查询执行器
借鉴 Streamlit ChatBI 的 iqury 逻辑，实现严格的查询规则
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from . import gemini_engine



def execute_data_query(
    query_text: str,
    data_tables: Optional[List[str]] = None,
    history_context: str = "无历史对话。",
    model: str = "deep"
) -> Dict[str, Any]:
    """
    执行数据查询的统一入口（增强版，借鉴 Streamlit ChatBI 规则）

    Args:
        query_text: 用户查询文本
        data_tables: 数据表列表 (如 ["fact", "ipm"])
        history_context: 历史对话上下文
        model: 使用的模型 (fast/deep/image)

    Returns:
        包含 data, fullData, title, logicDescription 等字段的字典
    """
    print(f"[query_executor] 开始执行查询: {query_text}")
    print(f"[query_executor] 数据表: {data_tables}")
    print(f"[query_executor] 模型: {model}")

    # 如果没有指定数据表，使用默认的数据看板逻辑
    if not data_tables:
        print(f"[query_executor] 未指定数据表，使用默认数据看板逻辑")
        result = gemini_engine.process_query_with_gemini(
            query_text=query_text,
            history_context=history_context,
            model=model
        )
        return result

    # 1. 加载数据 (需要 heavy data)
    df, dfs_map, time_context, _ = gemini_engine.get_cached_data(need_heavy=True)
    if df is None:
        return {"error": "数据加载失败"}

    # 1.5 数据表名映射（统一别名）
    # 强制将 ipmdata/hospital/retail 等映射到 ipm 和 fact
    # 用户请求通常包含 'ipm' 或 'fact'，或者两者都有
    use_new_logic = False
    target_tables = set()
    
    table_name_mapping = {
        "ipmdata": "ipm",
        "hospital_sales": "ipm", # 兼容旧逻辑
        "retail_sales": "fact",  # 兼容旧逻辑
        "fact": "fact",
        "ipm": "ipm"
    }

    if data_tables:
        for t in data_tables:
            mapped_name = table_name_mapping.get(t, t)
            if mapped_name in ["fact", "ipm"]:
                use_new_logic = True
                target_tables.add("fact")
                target_tables.add("ipm")
            else:
                target_tables.add(mapped_name)
    
    # 2. 构建可用表格列表和执行环境
    available_tables = []
    exec_ctx = {"pd": pd, "np": np, "results": {}}
    specific_dfs = {}

    if use_new_logic:
        print(f"[query_executor] 使用新版 Market Research 逻辑 (Fact + IPM)")
        
        if "fact" in dfs_map:
            exec_ctx["df_fact"] = dfs_map["fact"].copy()
            specific_dfs["df_fact"] = dfs_map["fact"]
            available_tables.append("df_fact (销售事实表, 包含 '渠道'='医院'/'零售')")
        
        if "ipm" in dfs_map:
            exec_ctx["df_ipm"] = dfs_map["ipm"].copy()
            specific_dfs["df_ipm"] = dfs_map["ipm"]
            available_tables.append("df_ipm (产品主数据表, 包含详细属性)")
            
    else:
        # 旧逻辑 / 其他模块逻辑
        for table_name in target_tables:
            if table_name in dfs_map:
                df_var_name = f"df_{table_name}"
                exec_ctx[df_var_name] = dfs_map[table_name].copy()
                specific_dfs[df_var_name] = dfs_map[table_name]
                available_tables.append(f"{df_var_name} ({table_name}表)")

    if not available_tables:
        return {"error": f"未找到指定的数据表: {list(target_tables)}"}

    available_tables_str = ", ".join(available_tables)
    
    # 构建特定的 Metadata
    meta_data = gemini_engine.build_table_metadata(specific_dfs, time_context)

    # 3. 获取时间上下文
    mat_list = time_context.get("mat_list", [])
    mat_list_prior = time_context.get("mat_list_prior", [])
    ytd_list = time_context.get("ytd_list", [])
    ytd_list_prior = time_context.get("ytd_list_prior", [])

    # 转换时间格式：如果 Fact 表使用2位年份，转换时间上下文
    if 'fact' in dfs_map and '年季' in dfs_map['fact'].columns:
        sample_period = str(dfs_map['fact']['年季'].iloc[0])
        if len(sample_period) == 4 and 'Q' in sample_period:
            # 2位年份修复逻辑
            mat_list = [p[2:] if p.startswith('20') else p for p in mat_list]
            mat_list_prior = [p[2:] if p.startswith('20') else p for p in mat_list_prior]
            ytd_list = [p[2:] if p.startswith('20') else p for p in ytd_list]
            ytd_list_prior = [p[2:] if p.startswith('20') else p for p in ytd_list_prior]

    # 注入时间上下文到执行环境
    exec_ctx.update({
        "mat_list": mat_list,
        "mat_list_prior": mat_list_prior,
        "ytd_list": ytd_list,
        "ytd_list_prior": ytd_list_prior,
    })

    # 4. 构建增强的 Prompt
    prompt = _build_enhanced_query_prompt(
        query_text,
        available_tables_str,
        mat_list,
        mat_list_prior,
        ytd_list,
        ytd_list_prior,
        history_context,
        meta_data
    )

    # 5. 调用 Gemini 生成代码
    result_json = _call_gemini_for_code(prompt, model)
    if "error" in result_json:
        return result_json

    # 6. 执行代码
    exec_result = _execute_pandas_code(result_json["code"], exec_ctx)
    if "error" in exec_result:
        return exec_result

    # 7. 格式化并返回结果
    return _format_query_result(exec_result["results"], result_json.get("summary", {}), query_text, result_json.get("code", ""))





def _build_enhanced_query_prompt(
    query_text: str,
    available_tables_str: str,
    mat_list: list,
    mat_list_prior: list,
    ytd_list: list,
    ytd_list_prior: list,
    history_context: str,
    meta_data: str
) -> str:
    """构建增强的查询 Prompt（借鉴 Streamlit ChatBI 规则）"""
    return f"""
你是一位医药行业的 Python 专家。现在需要编写 Pandas 代码来回答用户关于市场销售数据的查询。

【核心数据模型】
1. **Fact 表 (df_fact)**: 销售事实表。
   - 包含列: '药品索引', '渠道', '年季', '销售额', '销售量'。
   - **关键**: '渠道'列区分市场，值为 '医院' (核心医院) 或 '零售' (实体零售)。
   - **连接键**: '药品索引' (float/int)。

2. **IPM 表 (df_ipm)**: 产品主数据表。
   - 包含药品详细属性，如 '药品名称', '通用名', '生产企业' 等。
   - **连接键**: 这是一个 DataFrame 的 Index (索引) 或者具体的 ID 列。根据 EDA 发现，`df_fact['药品索引']` 的值对应 `df_ipm` 的行索引 (Row Index)。
   - **注意**: `df_fact['药品索引']` 是 1-based (从1开始)，而 Pandas Index 是 0-based。**需要确认是否需要 -1 修正，或者直接 merge。** (根据数据探查，Fact ID 1.0 对应 IPM Index 0，所以 `IPM Index = Fact ID - 1`)。
   - **更稳妥的方式**: `df_merge = pd.merge(df_fact, df_ipm, left_on=df_fact['药品索引']-1, right_index=True, how='left')`。

【历史对话】
{history_context}

【当前用户问题】
"{query_text}"

【数据上下文 (Metadata)】
{meta_data}

【时间上下文】
- mat_list = {mat_list}
- ytd_list = {ytd_list}
- mat_list_prior = {mat_list_prior} (同期)
- ytd_list_prior = {ytd_list_prior} (同期)

【编程指令】
1. **数据准备 (必做)**:
   - 首先，根据用户意图筛选 `df_fact` 的渠道。
     - 查"医院"/"核心市场": `df_sales = df_fact[df_fact['渠道'] == '医院'].copy()`
     - 查"零售"/"药店": `df_sales = df_fact[df_fact['渠道'] == '零售'].copy()`
     - 查"全渠道": `df_sales = df_fact.copy()`
   - 然后，**关联主数据**。
     - 必须将 `df_sales` 与 `df_ipm` 关联，才能获取药名、企业等信息。
     - **关联逻辑**: `df_sales['join_key'] = df_sales['药品索引'] - 1` (注意类型匹配) -> `df_merge = pd.merge(df_sales, df_ipm, left_on='join_key', right_index=True, how='left')`。
   
2. **指标计算**:
   - 销售额: sum('销售额')
   - 销售量: sum('销售量')
   - 份额 (%): 某产品销售额 / 整体市场销售额 * 100。**必须乘以100**，保留1位小数。

3. **时间筛选**:
   - 使用 `mat_list` (滚动年) 或 `ytd_list` (年初至今) 筛选 `年季` 列。
   - `df_res = df_merge[df_merge['年季'].isin(mat_list)]`

4. **输出要求**:
   - 结果必须赋值给 `results` 字典: `results = {{'查询结果': df_final}}`
   - 显示列名友好的中文名。
   - **严禁**使用 `inplace=True`。

5. **代码安全**:
   - 不要假设任何非标准列存在，以上述 Metadata 为准。
   - 确保所有变量已定义。

输出 JSON: {{ "summary": {{ "intent": "...", "logic": "..." }}, "code": "..." }}
"""



def _call_gemini_for_code(prompt: str, model: str) -> Dict[str, Any]:
    """调用 Gemini 生成代码"""
    client = gemini_engine._get_client()
    if not client:
        return {"error": "未配置 GENAI_API_KEY"}

    model_mapping = {
        "fast": gemini_engine.FAST_MODEL,
        "deep": gemini_engine.DEEP_MODEL,
        "image": gemini_engine.IMAGE_MODEL
    }
    actual_model = model_mapping.get(model, gemini_engine.DEEP_MODEL)

    print(f"[query_executor] 调用 Gemini 模型: {actual_model}")

    try:
        from google.genai import types
        response = gemini_engine._safe_generate_content(
            client,
            actual_model,
            prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )

        _, result_json = gemini_engine.parse_response(response.text)

        if not result_json or "code" not in result_json:
            return {"error": "无法解析生成的代码格式"}

        print(f"[query_executor] 代码生成成功")
        return result_json

    except Exception as e:
        print(f"[query_executor] Gemini 调用失败: {e}")
        return {"error": f"Gemini 调用失败: {e}"}


def _execute_pandas_code(code: str, exec_ctx: dict) -> Dict[str, Any]:
    """执行 Pandas 代码"""
    print(f"[query_executor] 开始执行代码...")

    # 自动修复时间格式问题：将4位年份替换为2位年份
    mat_list = exec_ctx.get("mat_list", [])
    if mat_list and len(mat_list) > 0:
        # 检查 mat_list 是否是2位年份格式
        sample = str(mat_list[0])
        if len(sample) == 4 and 'Q' in sample:  # 如 '24Q4'
            # 替换代码中的4位年份为2位年份
            import re
            # 匹配 '2024Q1', '2025Q2' 等格式
            code = re.sub(r"'20(\d{2}Q\d)'", r"'\1'", code)
            code = re.sub(r'"20(\d{2}Q\d)"', r'"\1"', code)
            print(f"[query_executor] 已自动修复代码中的时间格式")

    print(f"[query_executor] 生成的代码:\n{code}")
    try:
        exec(code, exec_ctx)
        print(f"[query_executor] 代码执行成功")

        # 打印执行后的上下文变量
        ctx_vars = [k for k in exec_ctx.keys() if not k.startswith('_') and k not in ['pd', 'np']]
        print(f"[query_executor] 执行后上下文变量: {ctx_vars}")

        final_results = exec_ctx.get("results")
        print(f"[query_executor] results 类型: {type(final_results)}, 内容: {final_results}")

        # 如果 results 是空字典，尝试查找其他结果变量
        if not final_results or (isinstance(final_results, dict) and len(final_results) == 0):
            print(f"[query_executor] results 为空，尝试查找备选变量...")
            # 尝试 result 变量
            result_var = exec_ctx.get("result")
            if result_var is not None:
                print(f"[query_executor] 找到 result 变量")
                final_results = {"查询结果": result_var}
            else:
                # 尝试其他常见变量名
                for var_name in ['df_result', 'df_output', 'output', 'data', 'df_final']:
                    if var_name in exec_ctx and exec_ctx[var_name] is not None:
                        print(f"[query_executor] 找到备选变量: {var_name}")
                        final_results = {"查询结果": exec_ctx[var_name]}
                        break

        if not final_results or (isinstance(final_results, dict) and len(final_results) == 0):
            print(f"[query_executor] 未提取到数据")
            return {"error": "未提取到数据"}

        print(f"[query_executor] 提取到结果: {list(final_results.keys())}")
        return {"results": final_results}

    except Exception as e:
        print(f"[query_executor] 代码执行错误: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"代码执行错误: {e}"}


def _format_query_result(
    final_results: dict,
    summary: dict,
    query_text: str,
    generated_code: str = ""
) -> Dict[str, Any]:
    """格式化查询结果"""
    formatted = {k: gemini_engine.normalize_result(v) for k, v in final_results.items()}
    first_name = next(iter(formatted))
    first_df = formatted[first_name]

    print(f"[query_executor] 结果 DataFrame shape: {first_df.shape}")
    print(f"[query_executor] 结果 DataFrame columns: {list(first_df.columns)}")

    # 转换为前端格式
    chart_data = gemini_engine._df_to_chart_data(first_df)
    full_data = gemini_engine._df_to_full_records(first_df)

    print(f"[query_executor] chart_data 长度: {len(chart_data)}")
    print(f"[query_executor] full_data 长度: {len(full_data)}")

    return {
        "data": chart_data,
        "fullData": full_data,
        "title": first_name,
        "logicDescription": summary.get("logic", f"按用户问题「{query_text}」取数。"),
        "config": {
            "dimension": first_df.columns[0] if len(first_df.columns) > 0 else "",
            "metric": first_df.columns[1] if len(first_df.columns) > 1 else ""
        },
        "mode": "simple",
        "mode": "simple",
        "summary": summary,
        "generated_code": generated_code
    }


def execute_chart_generation(
    data: List[Dict[str, Any]],
    title: str = "",
    custom_prompt: str = ""
) -> Dict[str, Any]:
    """
    执行图表生成（复用数据看板的图表推荐逻辑）

    Args:
        data: 数据列表
        title: 数据标题
        custom_prompt: 自定义提示词

    Returns:
        图表配置结果
    """
    print(f"[query_executor] 开始图表生成: title={title}")

    result = gemini_engine.suggest_chart(
        data=data,
        title=title,
        custom_prompt=custom_prompt
    )

    if "error" in result:
        return result

    return {
        "chartType": result.get("chartType", "bar"),
        "config": result.get("config", {}),
        "description": result.get("reason", "图表生成完成"),
        "data": data  # 返回原始数据
    }
