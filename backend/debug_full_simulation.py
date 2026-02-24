import os
import sys

# Ensure backend path is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app import gemini_engine
from app.query_executor import execute_data_query
import pandas as pd

def debug_simulation():
    print(">>> Loading Data...")
    _, dfs_map, _, _ = gemini_engine.get_cached_data()
    
    # Check Fact Table Columns
    if 'fact' in dfs_map:
        df_fact = dfs_map['fact']
        print(f"\n>>> Fact Table Columns: {df_fact.columns.tolist()}")
        if '年季' in df_fact.columns:
             print(f">>> Fact Time Format Sample: {df_fact['年季'].unique()[:5]}")
        
        # Check for Channel/Source columns
        channel_cols = [c for c in df_fact.columns if '渠道' in c or '来源' in c or 'source' in c.lower()]
        for col in channel_cols:
            print(f"\n>>> Column '{col}' Unique Values: {df_fact[col].unique()[:20]}")

    # Check IPM Table Columns
    if 'ipm' in dfs_map:
        print(f"\n>>> IPM Table Columns: {dfs_map['ipm'].columns.tolist()}")

    # Query Text based on screenshot
    # Screenshot implies: Filter Hengrui, Filter Channels, Time is default MAT?
    query_text = """
    查询目标: 恒瑞 总和
    数据源: 核心医院渠道, 实体零售渠道
    """
    
    print(f"\n>>> Executing Query: {query_text}")
    
    # We need to hook into _call_gemini_for_code or inspect logs to see the generated code.
    # Since we can't easily hook, we run it and look at stdout, or result['code'] if we returned it?
    # execute_data_query DOES return result['code'] if we modify it to... no, it calls _format_query_result.
    # _format_query_result doesn't include code.
    
    # Let's call execute_data_query and trust the print statements in query_executor 
    # (which prints "[query_executor] 代码生成成功: ...")
    
    result = execute_data_query(
        query_text=query_text,
        data_tables=["fact", "ipm"],
        model="deep"
    )
    
    print("\n>>> Execution Result:")
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print(f"Logic: {result.get('logicDescription')}")
        print(f"Data: {result.get('data')}")

if __name__ == "__main__":
    debug_simulation()
