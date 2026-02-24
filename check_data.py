import pandas as pd
import os

file_path = r"backend/data/hcmdata.xlsx"
if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit()

try:
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    
    time_col = None
    for col in df.columns:
        if "年季" in col:
            time_col = col
            break
            
    if time_col:
        print(f"Unique values in {time_col}:", df[time_col].unique())
    else:
        print("No '年季' column found.")
        
    if "生产企业" in df.columns:
        print("Unique values in 生产企业 (first 10):", df["生产企业"].unique()[:10])
        kangyuan_rows = df[df["生产企业"].astype(str).str.contains("康缘", na=False)]
        print(f"Rows with '康缘' in 生产企业: {len(kangyuan_rows)}")
        if not kangyuan_rows.empty:
            print("Sample '生产企业' values with '康缘':", kangyuan_rows["生产企业"].unique()[:5])
    else:
        print("No '生产企业' column found.")
        
    print("Total rows:", len(df))
    
except Exception as e:
    print(f"Error reading file: {e}")
