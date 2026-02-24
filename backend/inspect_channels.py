import os
import sys

# Ensure backend path is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app import gemini_engine

def inspect_channels():
    print(">>> Loading Data...")
    _, dfs_map, _, _ = gemini_engine.get_cached_data()
    
    if 'fact' in dfs_map:
        df = dfs_map['fact']
        # Check for Channel/Source columns
        channel_cols = [c for c in df.columns if '渠道' in c or '来源' in c or 'source' in c.lower()]
        for col in channel_cols:
            print(f">>> Column '{col}' Unique Values: {df[col].unique().tolist()}")

if __name__ == "__main__":
    inspect_channels()
