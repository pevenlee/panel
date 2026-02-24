import pandas as pd
import os

# Mock setup from gemini_engine
BASE_DIR = os.getcwd() # Assuming running from backend
DATA_DIR = os.path.join(BASE_DIR, "data")
FIXED_FILE_NAME = "hcmdata.xlsx"
main_path = os.path.join(DATA_DIR, FIXED_FILE_NAME)

print(f"Loading data from {main_path}...")
try:
    df = pd.read_excel(main_path)
    print(f"Data loaded. Shape: {df.shape}")
except Exception as e:
    print(f"Error loading data: {e}")
    exit(1)

# Exact User Snippet
try:
    # 1. 筛选 MAT 时间范围
    mat_quarters = ['2024Q4', '2025Q1', '2025Q2', '2025Q3']
    print(f"Filtering for quarters: {mat_quarters}")
    df_mat = df[df['年季'].isin(mat_quarters)].copy()
    print(f"Filtered df_mat shape: {df_mat.shape}")

    if df_mat.empty:
        print("df_mat is empty! Checking available quarters...")
        print(df['年季'].unique())

    # 2. 计算每个定义市场的总销售额 (分母)
    market_total = df_mat.groupby('定义市场')['销售额'].sum().reset_index(name='市场总销售额')
    print(f"Market total calculated. Shape: {market_total.shape}")

    # 3. 计算康缘在每个定义市场的销售额 (分子)
    # 模糊匹配生产企业含'康缘'
    ky_sales = df_mat[df_mat['生产企业'].str.contains('康缘', na=False)].groupby('定义市场')['销售额'].sum().reset_index(name='康缘销售额')
    print(f"Kangyuan sales calculated. Shape: {ky_sales.shape}")

    # 4. 合并数据并计算份额
    result = pd.merge(market_total, ky_sales, on='定义市场', how='left')
    result['康缘销售额'] = result['康缘销售额'].fillna(0)
    result['康缘份额(%)'] = (result['康缘销售额'] / result['市场总销售额'] * 100).round(1)

    # 5. 格式化和排序
    result['市场总销售额'] = result['市场总销售额'].astype('int64')
    result['康缘销售额'] = result['康缘销售额'].astype('int64')
    result = result.sort_values('康缘份额(%)', ascending=False).reset_index(drop=True)

    # 6. 选择展示列
    result = result[['定义市场', '康缘销售额', '市场总销售额', '康缘份额(%)']]
    
    print("Final Result:")
    print(result)

except Exception as e:
    print(f"Error executing user snippet: {e}")
