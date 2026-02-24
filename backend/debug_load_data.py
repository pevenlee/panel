
import sys
import os

# Add backend directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from app import gemini_engine

print(f"Data directory: {gemini_engine.DATA_DIR}")
print(f"Fact path: {os.path.join(gemini_engine.DATA_DIR, 'fact.csv')}")
print(f"Fact exists: {os.path.exists(os.path.join(gemini_engine.DATA_DIR, 'fact.csv'))}")
print(f"IPM path: {os.path.join(gemini_engine.DATA_DIR, 'ipmdata.xlsx')}")
print(f"IPM exists: {os.path.exists(os.path.join(gemini_engine.DATA_DIR, 'ipmdata.xlsx'))}")

print("\n--- Testing load_data(load_heavy=True) ---")
try:
    df, dfs_map, msg = gemini_engine.load_data(load_heavy=True)
    print(f"Return message: {msg}")
    print(f"Main DF: {df is not None}")
    print(f"DFS Map Keys: {list(dfs_map.keys())}")
    
    if "fact" in dfs_map:
        print(f"Fact shape: {dfs_map['fact'].shape}")
    else:
        print("Fact NOT in dfs_map")
        
    if "ipm" in dfs_map:
        print(f"IPM shape: {dfs_map['ipm'].shape}")
    else:
        print("IPM NOT in dfs_map")

except Exception as e:
    print(f"Error calling load_data: {e}")
    import traceback
    traceback.print_exc()
