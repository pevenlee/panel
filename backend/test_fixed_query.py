"""
测试修复后的查询功能
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import gemini_engine
from app.query_executor import execute_data_query

# 清除缓存，强制重新加载数据
print("清除缓存...")
gemini_engine.clear_cache()

# 重新加载数据
print("重新加载数据...")
df, dfs_map, time_context, meta_data = gemini_engine.get_cached_data()

print("\n" + "=" * 60)
print("时间上下文 (修复后):")
print("=" * 60)
print(f"MAT: {time_context.get('mat_list')}")
print(f"MAT Prior: {time_context.get('mat_list_prior')}")
print(f"YTD: {time_context.get('ytd_list')}")
print(f"YTD Prior: {time_context.get('ytd_list_prior')}")

# 测试查询
print("\n" + "=" * 60)
print("测试查询: 查询 前5产品")
print("=" * 60)

result = execute_data_query(
    query_text="查询 前5产品",
    data_tables=["fact", "ipm"],
    history_context="无历史对话。",
    model="deep"
)

if "error" in result:
    print(f"\n错误: {result['error']}")
elif "fullData" in result:
    data = result["fullData"]
    print(f"\n返回数据行数: {len(data)}")
    if data:
        print(f"\n前5行数据:")
        for i, row in enumerate(data[:5]):
            print(f"  {i+1}. {row}")
    else:
        print("数据为空！")

    # 打印摘要
    if "summary" in result:
        print(f"\n摘要信息:")
        for key, value in result["summary"].items():
            print(f"  {key}: {value}")
