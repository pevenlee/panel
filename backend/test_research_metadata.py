# -*- coding: utf-8 -*-
"""
测试增强的市场调研元数据生成功能
"""
import sys
import os
import io

# Windows 控制台编码修复
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import gemini_engine

def test_metadata_generation():
    """测试元数据生成"""
    print("=" * 80)
    print("测试：增强的市场调研元数据生成")
    print("=" * 80)

    # 1. 加载数据
    print("\n1. 加载数据...")
    df, dfs_map, time_context, base_metadata = gemini_engine.get_cached_data()

    if not dfs_map:
        print("错误：未能加载数据")
        return

    print(f"✓ 成功加载数据")
    print(f"  - 主表 (df): {len(df)} 行")
    if 'fact' in dfs_map:
        print(f"  - Fact 表: {len(dfs_map['fact'])} 行 x {len(dfs_map['fact'].columns)} 列")
        print(f"    列名: {dfs_map['fact'].columns.tolist()}")
        print(f"    销售额类型: {dfs_map['fact']['销售额'].dtype}")
        print(f"    销售量类型: {dfs_map['fact']['销售量'].dtype}")
    if 'ipm' in dfs_map:
        print(f"  - IPM 表: {len(dfs_map['ipm'])} 行 x {len(dfs_map['ipm'].columns)} 列")

    # 2. 生成增强的研究元数据
    print("\n2. 生成增强的研究元数据...")
    research_metadata = gemini_engine.build_research_metadata(dfs_map)

    print(f"✓ 元数据生成成功")
    print(f"  - 元数据长度: {len(research_metadata)} 字符")

    # 3. 保存元数据到文件供查看
    output_file = "data/research_metadata_preview.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(research_metadata)
    print(f"  - 元数据已保存到: {output_file}")

    # 4. 显示元数据预览
    print("\n3. 元数据内容预览（前2000字符）:")
    print("-" * 80)
    print(research_metadata[:2000])
    print("-" * 80)
    print(f"... (省略 {len(research_metadata) - 2000} 字符)")

    # 5. 验证关键内容
    print("\n4. 验证关键内容:")
    checks = [
        ("包含 df_fact 表说明", "df_fact" in research_metadata),
        ("包含 df_ipm 表说明", "df_ipm" in research_metadata),
        ("包含字段详情", "字段详情" in research_metadata),
        ("包含关联关系说明", "表关联关系" in research_metadata),
        ("包含查询模式示例", "常见查询模式" in research_metadata),
        ("包含重要注意事项", "重要注意事项" in research_metadata),
    ]

    for check_name, result in checks:
        status = "✓" if result else "✗"
        print(f"  {status} {check_name}")

    all_passed = all(r for _, r in checks)

    print("\n" + "=" * 80)
    if all_passed:
        print("✓ 所有测试通过！增强的元数据系统已准备就绪。")
    else:
        print("✗ 部分测试失败，请检查元数据生成逻辑。")
    print("=" * 80)

    return all_passed

if __name__ == "__main__":
    test_metadata_generation()
