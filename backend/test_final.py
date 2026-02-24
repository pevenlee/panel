"""
最终测试：验证所有改进
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import gemini_engine
from app.query_executor import execute_data_query

# 清除缓存
print("清除缓存...")
gemini_engine.clear_cache()

# 测试查询
print("\n" + "="*60)
print("测试查询: 查询 前5产品")
print("="*60)

result = execute_data_query(
    query_text="查询 前5产品",
    data_tables=["fact", "ipm"],
    history_context="无历史对话。",
    model="deep"
)

print(f"\n查询结果:")
print(f"- 状态: {'成功' if 'error' not in result else '失败'}")

if "error" in result:
    print(f"- 错误: {result['error']}")
else:
    data = result.get("fullData", [])
    print(f"- 返回行数: {len(data)}")
    print(f"- 标题: {result.get('title', 'N/A')}")

    if data:
        print(f"\n前5行数据:")
        for i, row in enumerate(data[:5], 1):
            print(f"  {i}. {row}")

    # 打印摘要
    summary = result.get("summary", {})
    if summary:
        print(f"\n摘要信息:")
        print(f"  - intent: {summary.get('intent', 'N/A')}")
        print(f"  - scope: {summary.get('scope', 'N/A')}")
        print(f"  - metrics: {summary.get('metrics', 'N/A')}")
        print(f"  - key_match: {summary.get('key_match', 'N/A')}")
        print(f"  - logic: {summary.get('logic', 'N/A')}")

print("\n" + "="*60)
print("测试完成")
print("="*60)
