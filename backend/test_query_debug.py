"""
测试数据查询功能 - 调试版本
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.query_executor import execute_data_query
from app import gemini_engine

# 测试查询
query_text = "查询 前5产品"
data_tables = ["fact", "ipm"]
model = "deep"

print(f"测试查询: {query_text}")
print(f"数据表: {data_tables}")
print(f"模型: {model}")
print("\n开始执行查询...\n")

# 临时修改 _call_gemini_for_code 以打印生成的代码
original_call = gemini_engine._safe_generate_content

def debug_generate_content(client, model_name, prompt, config=None, retries=3):
    response = original_call(client, model_name, prompt, config, retries)
    if response and hasattr(response, 'text'):
        print("\n" + "="*60)
        print("Gemini 生成的响应:")
        print("="*60)
        print(response.text[:2000])  # 打印前2000字符
        print("="*60 + "\n")
    return response

gemini_engine._safe_generate_content = debug_generate_content

try:
    result = execute_data_query(
        query_text=query_text,
        data_tables=data_tables,
        history_context="无历史对话。",
        model=model
    )

    print(f"\n查询结果类型: {type(result)}")
    print(f"查询结果键: {result.keys() if isinstance(result, dict) else 'N/A'}")

    if "error" in result:
        print(f"\n错误: {result['error']}")
    elif "fullData" in result:
        data = result["fullData"]
        print(f"\n返回数据行数: {len(data)}")
        if data:
            print(f"前3行数据:")
            for i, row in enumerate(data[:3]):
                print(f"  行{i+1}: {row}")
        else:
            print("数据为空！")

        # 打印摘要信息
        if "summary" in result:
            print(f"\n摘要信息:")
            for key, value in result["summary"].items():
                print(f"  {key}: {value}")
    else:
        print(f"\n完整结果: {result}")

except Exception as e:
    print(f"\n异常: {e}")
    import traceback
    traceback.print_exc()

# 恢复原始函数
gemini_engine._safe_generate_content = original_call
