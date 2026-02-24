import pandas as pd
import os

DATA_DIR = r"c:\Users\heiyu\Documents\GitHub\panel\backend\data"
STRUCTURE_PATH = os.path.join(DATA_DIR, "structure.xlsx")
HCM_PATH = os.path.join(DATA_DIR, "hcmdata.xlsx")

def check_structure():
    if not os.path.exists(STRUCTURE_PATH):
        print(f"{STRUCTURE_PATH} does not exist.")
        return

    print(f"Loading {STRUCTURE_PATH}...")
    df_struct = pd.read_excel(STRUCTURE_PATH)
    print(f"Structure Columns: {list(df_struct.columns)}")
    
    if '厂家' in df_struct.columns:
        print("'厂家' column FOUND in structure file.")
        print("Sample values:", df_struct['厂家'].unique()[:10])
    else:
        print("'厂家' column NOT FOUND in structure file.")

    # Check join
    print(f"Loading {HCM_PATH} (headers only)...")
    df_hcm = pd.read_excel(HCM_PATH, nrows=5)
    print(f"HCM Columns: {list(df_hcm.columns)}")
    
    common = list(set(df_struct.columns) & set(df_hcm.columns))
    print(f"Common join keys: {common}")

if __name__ == "__main__":
    check_structure()
