# -*- coding: utf-8 -*-
"""
快速验证增强的元数据系统
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import gemini_engine

print("=" * 70)
print("市场调研数据提取增强方案 - 验证报告")
print("=" * 70)

# 1. 加载数据
print("\n[1] 数据加载")
df, dfs_map, time_context, base_metadata = gemini_engine.get_cached_data()

if 'fact' in dfs_map:
    fact_df = dfs_map['fact']
    print(f"  Fact 表: {len(fact_df):,} 行 x {len(fact_df.columns)} 列")
    print(f"  列名: {fact_df.columns.tolist()}")
    print(f"  销售额类型: {fact_df['销售额'].dtype}")
    print(f"  销售量类型: {fact_df['销售量'].dtype}")
    print(f"  样本销售额: {fact_df['销售额'].head(3).tolist()}")
else:
    print("  [错误] Fact 表未加载")

if 'ipm' in dfs_map:
    ipm_df = dfs_map['ipm']
    print(f"\n  IPM 表: {len(ipm_df):,} 行 x {len(ipm_df.columns)} 列")
    print(f"  企业类型: {ipm_df['企业类型'].unique().tolist()}")
    print(f"  ATC1分类数: {ipm_df['ATC1Des'].nunique()}")
else:
    print("  [错误] IPM 表未加载")

# 2. 生成研究元数据
print("\n[2] 元数据生成")
research_metadata = gemini_engine.build_research_metadata(dfs_map)
print(f"  元数据长度: {len(research_metadata):,} 字符")

# 保存到文件
output_file = "data/research_metadata_preview.txt"
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(research_metadata)
print(f"  已保存到: {output_file}")

# 3. 验证关键内容
print("\n[3] 关键内容验证")
checks = {
    "df_fact 表说明": "df_fact" in research_metadata,
    "df_ipm 表说明": "df_ipm" in research_metadata,
    "字段详情": "字段详情" in research_metadata,
    "表关联关系": "表关联关系" in research_metadata,
    "查询模式": "常见查询模式" in research_metadata,
    "注意事项": "重要注意事项" in research_metadata,
}

for name, result in checks.items():
    status = "[OK]" if result else "[FAIL]"
    print(f"  {status} {name}")

all_passed = all(checks.values())

# 4. 显示元数据预览
print("\n[4] 元数据内容预览 (前1500字符)")
print("-" * 70)
print(research_metadata[:1500])
print("-" * 70)
print(f"... (省略 {len(research_metadata) - 1500} 字符)")

# 总结
print("\n" + "=" * 70)
if all_passed:
    print("状态: 所有验证通过 - 系统已就绪")
    print("\n可以开始使用市场调研功能：")
    print("  1. 在前端选择'市场调研'模块")
    print("  2. 输入查询，如: '分析某企业在心血管领域的市场表现'")
    print("  3. 系统将使用增强的元数据准确提取数据")
else:
    print("状态: 部分验证失败 - 请检查配置")
print("=" * 70)
