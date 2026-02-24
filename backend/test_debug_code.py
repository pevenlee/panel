"""
调试生成的代码
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import gemini_engine
from app.query_executor import _build_enhanced_query_prompt, _call_gemini_for_code
import pandas as pd

# 清除缓存
gemini_engine.clear_cache()

# 加载数据
df, dfs_map, time_context, meta_data = gemini_engine.get_cached_data()

# 准备数据
mat_list = ['24Q4', '25Q1', '25Q2', '25Q3']
mat_list_prior = ['24Q1', '24Q2', '24Q3']
ytd_list = ['25Q1', '25Q2', '25Q3']
ytd_list_prior = ['24Q1', '24Q2', '24Q3']

available_tables_str = "df_fact (fact表), df_ipm (ipm表)"

# 构建 Prompt
prompt = _build_enhanced_query_prompt(
    query_text="查询 前5产品",
    available_tables_str=available_tables_str,
    mat_list=mat_list,
    mat_list_prior=mat_list_prior,
    ytd_list=ytd_list,
    ytd_list_prior=ytd_list_prior,
    history_context="无历史对话。",
    meta_data=meta_data[:5000]  # 截断元数据
)

# 调用 Gemini
result_json = _call_gemini_for_code(prompt, "deep")

if "error" in result_json:
    print(f"错误: {result_json['error']}")
else:
    print("=" * 60)
    print("生成的代码:")
    print("=" * 60)
    print(result_json.get("code", ""))
    print("\n" + "=" * 60)
    print("摘要:")
    print("=" * 60)
    for key, value in result_json.get("summary", {}).items():
        print(f"{key}: {value}")

    # 手动执行代码
    print("\n" + "=" * 60)
    print("手动执行代码:")
    print("=" * 60)

    exec_ctx = {
        "pd": pd,
        "np": __import__("numpy"),
        "df_fact": dfs_map['fact'].copy(),
        "df_ipm": dfs_map['ipm'].copy(),
        "mat_list": mat_list,
        "mat_list_prior": mat_list_prior,
        "ytd_list": ytd_list,
        "ytd_list_prior": ytd_list_prior,
        "results": {}
    }

    try:
        exec(result_json["code"], exec_ctx)
        results = exec_ctx.get("results", {})

        if results:
            for name, df_result in results.items():
                print(f"\n结果表: {name}")
                print(f"Shape: {df_result.shape}")
                print(f"Columns: {list(df_result.columns)}")
                print(f"\n数据预览:")
                print(df_result.head(10))
        else:
            print("未生成结果")
    except Exception as e:
        print(f"执行错误: {e}")
        import traceback
        traceback.print_exc()
