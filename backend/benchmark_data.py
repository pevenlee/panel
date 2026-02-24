import time
import pandas as pd
import os

DATA_DIR = r"c:\Users\heiyu\Documents\GitHub\panel\backend\data"

def benchmark_load():
    start = time.time()
    
    print("Loading hcmdata.xlsx...")
    t1 = time.time()
    try:
        pd.read_excel(os.path.join(DATA_DIR, "hcmdata.xlsx"))
    except Exception as e:
        print(f"Failed to load hcmdata.xlsx: {e}")
    print(f"hcmdata.xlsx loaded in {time.time() - t1:.2f}s")
    
    print("Loading ipmdata.xlsx...")
    t2 = time.time()
    try:
        pd.read_excel(os.path.join(DATA_DIR, "ipmdata.xlsx"))
    except Exception as e:
        print(f"Failed to load ipmdata.xlsx: {e}")
    print(f"ipmdata.xlsx loaded in {time.time() - t2:.2f}s")
    
    print("Loading fact.csv...")
    t3 = time.time()
    try:
        pd.read_csv(os.path.join(DATA_DIR, "fact.csv"))
    except Exception as e:
        print(f"Failed to load fact.csv: {e}")
    print(f"fact.csv loaded in {time.time() - t3:.2f}s")
    
    print(f"Total time: {time.time() - start:.2f}s")

if __name__ == "__main__":
    benchmark_load()
