"""
测试数据查询功能
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.query_executor import execute_data_query

# 测试查询
query_text = "查询 前5产品"
data_tables = ["fact", "ipm"]
model = "deep"

print(f"测试查询: {query_text}")
print(f"数据表: {data_tables}")
print(f"模型: {model}")
print("\n开始执行查询...\n")

try:
    result = execute_data_query(
        query_text=query_text,
        data_tables=data_tables,
        history_context="无历史对话。",
        model=model
    )

    print(f"查询结果类型: {type(result)}")
    print(f"查询结果键: {result.keys() if isinstance(result, dict) else 'N/A'}")

    if "error" in result:
        print(f"\n错误: {result['error']}")
    elif "fullData" in result:
        data = result["fullData"]
        print(f"\n返回数据行数: {len(data)}")
        if data:
            print(f"第一行数据: {data[0]}")
    elif "data" in result:
        data = result["data"]
        print(f"\n返回数据行数: {len(data)}")
        if data:
            print(f"第一行数据: {data[0]}")
    else:
        print(f"\n完整结果: {result}")

except Exception as e:
    print(f"\n异常: {e}")
    import traceback
    traceback.print_exc()
