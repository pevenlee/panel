
import pandas as pd
import os

data_dir = r"c:\Users\heiyu\Documents\GitHub\panel\backend\data"
fact_path = os.path.join(data_dir, "fact.csv")
ipm_path = os.path.join(data_dir, "ipmdata.xlsx")

try:
    if os.path.exists(fact_path) and os.path.exists(ipm_path):
        df_fact = pd.read_csv(fact_path) # Read full to get sample IDs
        df_ipm = pd.read_excel(ipm_path)
        
        sample_ids = df_fact['药品索引'].dropna().unique()[:5]
        print(f"Sample Fact IDs: {sample_ids}")
        
        # Check if any column in IPM contains these IDs
        potential_keys = []
        for col in df_ipm.columns:
            # Check if intersection is non-empty
            if df_ipm[col].dtype == 'object':
                 # try converting to string
                 common = set(df_ipm[col].astype(str)).intersection(set(sample_ids.astype(str)))
            else:
                 common = set(df_ipm[col]).intersection(set(sample_ids))
            
            if len(common) > 0:
                print(f"Column '{col}' has {len(common)} common values with sample IDs.")
                potential_keys.append(col)
        
        if not potential_keys:
            # Check index
            # Fact ID 1.0 -> Index 0?
            # Fact ID 20268704 -> Index ?
            print(f"Checking Index match...")
            # If 1.0 is in fact, is 0 in index? yes.
            # But max is 2M. IPM len is 0.2M.
            pass

except Exception as e:
    print(f"Error: {e}")
