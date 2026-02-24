
import os
import sys

# Add project root to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

from app import gemini_engine
import pandas as pd

QUERIES = [
    "查询2024年销售额",  # Original test
    "康缘的每个定义市场的份额是多少?",
    "康缘各省份销售情况",
    "省份 定义市场 渠道 销售额 同步 份额 （康缘"
]

def test_refresh_logic():
    print("Testing Refresh Dashboard Item Logic")
    
    # 1. Initialize Engine (Data Loading)
    print("Loading data...")
    # gemini_engine.load_data() is called lazy
    
    for q in QUERIES:
        print(f"\n--- Testing Query: {q} ---")
        try:
            result = gemini_engine.process_query_with_gemini(q)
            
            if "error" in result:
                print(f"FAILED: {result['error']}")
            else:
                data = result.get("data") or result.get("fullData")
                if data is not None:
                     # Convert to list if it's a dataframe
                    if hasattr(data, 'shape'):
                         print(f"REFRESH SUCCESS. Data shape: {data.shape}")
                    elif isinstance(data, list):
                         print(f"REFRESH SUCCESS. Data length: {len(data)}")
                    else:
                         print(f"REFRESH SUCCESS. Data type: {type(data)}")
                else:
                    print("REFRESH WARNING: No data returned but no error.")
        except Exception as e:
            print(f"CRASHED: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_refresh_logic()
