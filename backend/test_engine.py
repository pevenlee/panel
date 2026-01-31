from app import gemini_engine
import sys

try:
    print("Testing gemini_engine...")
    # 1. Test Load Data
    print("Loading data...")
    df, dfs_map, time_ctx, meta = gemini_engine.get_cached_data()
    if df is None:
        print("ERROR: df is None")
        print(meta) 
        sys.exit(1)
    print(f"Data loaded. Main DF shape: {df.shape}")
    print(f"Extra DFs: {list(dfs_map.keys())}")

    # 2. Test Process Query (Mock API)
    print("Testing process_query_with_gemini...")
    res = gemini_engine.process_query_with_gemini("查一下目前的销售情况")
    if "error" in res:
        print(f"ERROR in process_query: {res['error']}")
    else:
        print("Success! Result keys:", res.keys())
        if "data" in res:
            print("Data found:", len(res["data"]))

except Exception as e:
    print(f"CRITICAL EXCEPTION: {e}")
    import traceback
    traceback.print_exc()
