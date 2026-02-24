"""
检查数据表结构
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import gemini_engine
import pandas as pd

# 加载数据
df, dfs_map, time_context, meta_data = gemini_engine.get_cached_data()

print("=" * 60)
print("Fact 表结构:")
print("=" * 60)
if 'fact' in dfs_map:
    df_fact = dfs_map['fact']
    print(f"列名: {list(df_fact.columns)}")
    print(f"行数: {len(df_fact)}")
    print(f"\n前5行数据:")
    print(df_fact.head())
    print(f"\n年季唯一值 (前20个): {sorted(df_fact['年季'].unique())[:20]}")
    print(f"\n药品索引数据类型: {df_fact['药品索引'].dtype}")
    print(f"药品索引示例: {df_fact['药品索引'].dropna().unique()[:10]}")

print("\n" + "=" * 60)
print("IPM 表结构:")
print("=" * 60)
if 'ipm' in dfs_map:
    df_ipm = dfs_map['ipm']
    print(f"列名: {list(df_ipm.columns)}")
    print(f"行数: {len(df_ipm)}")
    print(f"\n前5行数据 (部分列):")
    print(df_ipm[['药品索引', '药品名称', '通用名', '生产企业']].head())
    print(f"\n药品索引数据类型: {df_ipm['药品索引'].dtype}")
    print(f"药品索引示例: {df_ipm['药品索引'].dropna().unique()[:10]}")

print("\n" + "=" * 60)
print("时间上下文:")
print("=" * 60)
print(f"MAT: {time_context.get('mat_list')}")
print(f"MAT Prior: {time_context.get('mat_list_prior')}")
print(f"YTD: {time_context.get('ytd_list')}")
print(f"YTD Prior: {time_context.get('ytd_list_prior')}")

print("\n" + "=" * 60)
print("测试关联:")
print("=" * 60)
if 'fact' in dfs_map and 'ipm' in dfs_map:
    df_fact = dfs_map['fact']
    df_ipm = dfs_map['ipm']

    # 测试关联
    df_merge = pd.merge(df_fact, df_ipm, on='药品索引', how='inner')
    print(f"关联后行数: {len(df_merge)}")
    print(f"关联后列名: {list(df_merge.columns)}")

    # 测试时间筛选
    mat_list = time_context.get('mat_list', [])
    if mat_list:
        df_filtered = df_merge[df_merge['年季'].isin(mat_list)]
        print(f"\n使用 MAT {mat_list} 筛选后行数: {len(df_filtered)}")

        if len(df_filtered) > 0:
            # 测试分组
            df_rank = df_filtered.groupby('药品名称')['销售额'].sum().reset_index()
            df_rank = df_rank.sort_values('销售额', ascending=False).head(5)
            print(f"\n前5产品:")
            print(df_rank)
