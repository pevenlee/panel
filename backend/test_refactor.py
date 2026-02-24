"""
测试市场调研模块重构后的功能
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import gemini_engine
import json

def test_identify_entities():
    """测试实体识别功能"""
    print("=" * 60)
    print("测试 1: 实体识别")
    print("=" * 60)

    # 加载数据
    _, dfs_map, _, _ = gemini_engine.get_cached_data()

    # 测试查询
    query = "分析辉瑞在消化道领域的市场表现"

    result = gemini_engine.identify_entities(query, dfs_map)

    print(f"\n用户问题: {query}")
    print(f"\n识别结果:")
    print(json.dumps(result, ensure_ascii=False, indent=2))

    return result

def test_construct_query():
    """测试查询构建功能"""
    print("\n" + "=" * 60)
    print("测试 2: 查询构建")
    print("=" * 60)

    # 加载数据
    _, dfs_map, _, _ = gemini_engine.get_cached_data()

    # 模拟实体识别结果
    entities = {
        "企业": ["辉瑞"],
        "ATC分类": ["XA-消化道和代谢方面的药物"],
        "产品": [],
        "时间范围": ["最近4个季度"],
        "渠道": [],
        "地区": []
    }
    query_intent = "企业分析"

    result = gemini_engine.construct_query(entities, query_intent, dfs_map)

    print(f"\n实体: {entities}")
    print(f"意图: {query_intent}")
    print(f"\n构建结果:")
    if "code" in result:
        print(f"代码:\n{result['code']}")
        print(f"\n说明: {result.get('explanation', '')}")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))

    return result

def test_execute_query():
    """测试查询执行功能"""
    print("\n" + "=" * 60)
    print("测试 3: 查询执行")
    print("=" * 60)

    # 加载数据
    _, dfs_map, _, _ = gemini_engine.get_cached_data()

    # 简单的测试代码
    test_code = """
# 查询辉瑞的销售数据
企业药品 = df_ipm[df_ipm['生产企业'].str.contains('辉瑞', na=False)]['药品索引'].unique()
df_sub = df_fact[df_fact['药品索引'].isin(企业药品)].copy()
result = df_sub.groupby('年季')['销售额'].sum().reset_index()
results = {'辉瑞销售趋势': result}
"""

    result = gemini_engine.execute_query(test_code, dfs_map)

    print(f"\n执行结果:")
    print(f"成功: {result.get('success')}")
    print(f"行数: {result.get('rows')}")
    print(f"列名: {result.get('columns')}")
    print(f"执行时间: {result.get('execution_time_ms')} ms")

    if result.get('data'):
        print(f"\n前5行数据:")
        for row in result['data'][:5]:
            print(row)

    return result

def test_enterprise_framework():
    """测试企业分析框架生成"""
    print("\n" + "=" * 60)
    print("测试 4: 企业分析框架生成")
    print("=" * 60)

    framework = gemini_engine.generate_enterprise_analysis_framework("辉瑞", {})

    print(f"\n分析类型: {framework['analysis_type']}")
    print(f"目标企业: {framework['target_entity']}")
    print(f"\n分析模块 ({len(framework['analysis_modules'])} 个):")

    for idx, module in enumerate(framework['analysis_modules'], 1):
        print(f"\n{idx}. {module['module_name']} ({module['chart_type']})")
        print(f"   描述: {module['description']}")
        print(f"   预期输出: {module['expected_output']}")

    return framework

if __name__ == "__main__":
    print("开始测试市场调研模块重构功能...\n")

    try:
        # 测试1: 实体识别
        # test_identify_entities()

        # 测试2: 查询构建
        # test_construct_query()

        # 测试3: 查询执行
        test_execute_query()

        # 测试4: 企业分析框架
        test_enterprise_framework()

        print("\n" + "=" * 60)
        print("所有测试完成！")
        print("=" * 60)

    except Exception as e:
        print(f"\n测试失败: {e}")
        import traceback
        traceback.print_exc()
