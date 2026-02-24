
import sys
import os
import asyncio
from datetime import datetime

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from app import gemini_engine
    print("Successfully imported gemini_engine")
except ImportError as e:
    print(f"Failed to import gemini_engine: {e}")
    sys.exit(1)

def test_query():
    print("-" * 50)
    print("Testing 'process_query_with_gemini' with '查询2024年销售额'")
    
    # Check if API Key is present
    api_key = os.environ.get("GENAI_API_KEY")
    if not api_key:
        print("WARNING: GENAI_API_KEY not found in environment variables.")
        # Try to load from .env manually just in case
        env_path = os.path.join(os.getcwd(), ".env")
        if os.path.exists(env_path):
             with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if "GENAI_API_KEY" in line:
                         print("Found GENAI_API_KEY below in .env")
                         # Don't print the key security
    else:
        print("GENAI_API_KEY is set.")

    try:
        # 1. Load data first to be sure
        print("Loading data...")
        df, dfs_map, time_context, meta_data = gemini_engine.get_cached_data()
        if df is None:
            print("ERROR: Data evaluation returned None")
            return
        
        print("Data loaded. Main df shape:", df.shape)

        # 2. Run Query
        result = gemini_engine.process_query_with_gemini(
            query_text="查询2024年销售额",
            df=df,
            time_context=time_context,
            meta_data=meta_data,
            history_context="无历史对话",
            model="deep" 
        )
        
        print("Query Result:")
        # Print keys, not full lists to avoid spam
        for k, v in result.items():
            print(f"Key: {k}, Value Type: {type(v)}")
            if k == 'error':
                 print(f"ERROR DETAILS: {v}")
            if k == 'logicDescription':
                 print(f"Logic: {v}")
            if k == 'data':
                 print(f"Data length: {len(v)}")

    except Exception as e:
        print(f"EXCEPTION during test_query: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_query()
