
import pandas as pd
import os

data_dir = r"c:\Users\heiyu\Documents\GitHub\panel\backend\data"
fact_path = os.path.join(data_dir, "fact.csv")
ipm_path = os.path.join(data_dir, "ipmdata.xlsx")

try:
    if os.path.exists(fact_path) and os.path.exists(ipm_path):
        df_fact = pd.read_csv(fact_path)
        df_ipm = pd.read_excel(ipm_path)
        
        print(f"Fact '药品索引' range: {df_fact['药品索引'].min()} - {df_fact['药品索引'].max()}")
        print(f"IPM len: {len(df_ipm)}")
        
        # Check if 药品索引 matches index (1-based or 0-based)
        # Check if 1.0 in fact maps to index 0 in ipm?
        print("Checking first few IDs in fact vs IPM names:")
        for idx in sorted(df_fact['药品索引'].unique())[:3]:
            # assuming 1-based index
            ipm_idx = int(idx) - 1
            if 0 <= ipm_idx < len(df_ipm):
                print(f"Fact Index {idx} -> IPM row {ipm_idx}: {df_ipm.iloc[ipm_idx]['药品名称']}")
            else:
                print(f"Fact Index {idx} -> Out of bounds")

except Exception as e:
    print(f"Error: {e}")
