"""
检查主表的时间格式
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import gemini_engine

# 清除缓存
gemini_engine.clear_cache()

# 加载数据
df, dfs_map, time_context, meta_data = gemini_engine.get_cached_data()

print("主表 (HCM) 的年季列:")
if '年季' in df.columns:
    print(f"唯一值: {sorted(df['年季'].unique())[:20]}")
else:
    print("主表没有年季列")

print("\nFact 表的年季列:")
if 'fact' in dfs_map and '年季' in dfs_map['fact'].columns:
    print(f"唯一值: {sorted(dfs_map['fact']['年季'].unique())[:20]}")

print(f"\n时间上下文基于的列: {time_context.get('col_name')}")
print(f"MAT: {time_context.get('mat_list')}")
