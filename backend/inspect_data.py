import os
import sys

# Ensure backend path is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app import gemini_engine

def inspect_data():
    print(">>> Loading Data...")
    _, dfs_map, _, meta_data = gemini_engine.get_cached_data()
    
    if 'ipm' in dfs_map:
        df = dfs_map['ipm']
        print("\n>>> Inspecting IPM Table:")
        print(f"Columns: {df.columns.tolist()}")
        
        # Check for potential manufacturer columns
        target_cols = [c for c in df.columns if '企业' in c or '厂家' in c or 'Manufacturer' in c]
        for col in target_cols:
            print(f"\n--- Column: {col} ---")
            unique_vals = df[col].astype(str).unique()
            print(f"Top 10 values: {unique_vals[:10]}")
            
            # Check for '恒瑞'
            hengrui_match = [v for v in unique_vals if '恒瑞' in v]
            print(f"Values containing '恒瑞': {hengrui_match[:10]}")

    if 'fact' in dfs_map:
        df = dfs_map['fact']
        print("\n>>> Inspecting FACT Table:")
        print(f"Columns: {df.columns.tolist()}")

if __name__ == "__main__":
    inspect_data()
