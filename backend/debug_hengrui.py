import os
import sys

# Ensure backend path is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app.query_executor import execute_data_query
from app import gemini_engine

def test_hengrui_query():
    print(">>> Testing Hengrui Query...")
    
    # Simulate Query
    # Note: query_executor expects a simple string if called directly, 
    # but in the toolbox flow it might be constructed.
    # Based on previous context, let's try the direct query first.
    query_text = "恒瑞销售额"
    
    print(f">>> Query: {query_text}")
    
    # Force load data
    print(">>> Loading Data...")
    gemini_engine.get_cached_data()
    
    # Execute
    result = execute_data_query(
        query_text=query_text,
        data_tables=["fact", "ipm"],
        model="deep"
    )

    # Inspect Data
    _, dfs_map, _, _ = gemini_engine.get_cached_data()
    if 'ipm' in dfs_map:
        df = dfs_map['ipm']
        print("\n>>> Inspecting IPM Table:")
        print(f"Columns: {df.columns.tolist()}")
        # Check for potential manufacturer columns
        for col in df.columns:
            if '企业' in col or '厂家' in col or 'Manufacturer' in col:
                print(f"Unique values in '{col}': {df[col].unique()[:20]}")
    
    if "error" in result:
        print(f"!!! Error: {result['error']}")
    else:
        print(f">>> Success!")
        print(f">>> Logic: {result.get('logicDescription')}")
        print(f">>> Data: {result.get('data')}")
        print(f">>> Full Data: {result.get('fullData')}")
        
        # We also want to see the generated code. 
        # Since execute_data_query doesn't return the raw code by default unless we modify it or print it inside.
        # But wait, query_executor.py prints "[query_executor] 提取到结果: ..."
        # I might need to rely on the backend logs printed to stdout to see what happened.
        pass

if __name__ == "__main__":
    test_hengrui_query()
