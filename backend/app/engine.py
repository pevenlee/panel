import pandas as pd
import os

# 路径配置
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "hcmdata.xlsx")

# 逻辑列名 -> 可能出现的实际列名（英文或中文）
DIMENSION_CANDIDATES = {
    "Province": ["Province", "省份", "省"],
    "City": ["City", "城市", "市"],
    "Product": ["Product", "药品名称", "药品", "产品", "药", "Medicine", "medicineName"],
    "YearQuarter": ["YearQuarter", "年季", "季度", "时间", "yearQuarter"],
    "Channel": ["Channel", "渠道", "channelCategory", "渠道类别"],
    "Manufacturer": ["Manufacturer", "厂家", "企业", "manufacturer"],
    "DosageForm": ["DosageForm", "剂型", "dosageForm"],
    "Market": ["Market", "市场", "definedMarket"],
}
METRIC_CANDIDATES = {
    "SalesAmount": ["SalesAmount", "销售额", "销售金额", "金额", "销量额", "销售金额(万元)"],
    "SalesVolume": ["SalesVolume", "销售量", "销量", "盒数", "数量", "销售量(盒)"],
}


def _find_column(df, candidates_list):
    """在 df 的列名中查找第一个匹配的列（支持部分包含）。"""
    cols = [str(c).strip() for c in df.columns]
    for cand in candidates_list:
        c = str(cand).strip()
        for col in cols:
            if c in col or col in c:
                return col
    return None


def _fallback_dimension_col(df):
    """兜底：取第一个非数值列作为维度列。"""
    for c in df.columns:
        try:
            if df[c].dtype == "object" or pd.api.types.is_string_dtype(df[c]) or df[c].nunique() < len(df) * 0.9:
                return str(c)
        except Exception:
            pass
    return df.columns[0] if len(df.columns) > 0 else None


def _fallback_metric_col(df):
    """兜底：取第一个数值列作为指标列。"""
    for c in df.columns:
        try:
            if pd.api.types.is_numeric_dtype(df[c]):
                return str(c)
        except Exception:
            pass
    return None


class DataEngine:
    def __init__(self):
        print(f"正在加载数据: {DATA_PATH} ...")
        try:
            self.df = pd.read_excel(DATA_PATH)
            self.df.columns = self.df.columns.astype(str).str.strip()
            print("数据加载成功！")
        except Exception as e:
            print(f"数据加载失败，将使用模拟数据。错误: {e}")
            self.df = self._generate_mock_data()

    def _generate_mock_data(self):
        return pd.DataFrame()

    def process_query(self, query_text: str):
        """
        简单规则引擎：根据用户输入解析维度/指标，并与实际 Excel 列名匹配后聚合。
        支持中英文列名。
        """
        df = self.df.copy()
        if df.empty:
            return {"error": "数据为空，请检查 data/hcmdata.xlsx 是否存在且有效。"}

        query_lower = query_text.lower().strip()
        query_cn = query_text.strip()

        # 1. 确定逻辑维度 (Dimension)
        dimension_key = "Product"
        dim_map = {
            "省": "Province", "市": "City", "城市": "City",
            "产品": "Product", "药": "Product", "药品": "Product",
            "季度": "YearQuarter", "时间": "YearQuarter", "年季": "YearQuarter",
            "渠道": "Channel", "厂家": "Manufacturer", "企业": "Manufacturer",
            "剂型": "DosageForm", "市场": "Market",
        }
        for key, col in dim_map.items():
            if key in query_cn or key in query_lower:
                dimension_key = col
                break

        # 2. 确定逻辑指标 (Metric)
        metric_key = "SalesAmount"
        metric_map = {"量": "SalesVolume", "盒数": "SalesVolume", "额": "SalesAmount", "金额": "SalesAmount"}
        for key, col in metric_map.items():
            if key in query_cn or key in query_lower:
                metric_key = col
                break

        # 3. 解析出实际数据表中的列名（含兜底：用第一列非数值/第一列数值）
        dim_candidates = DIMENSION_CANDIDATES.get(dimension_key, [dimension_key])
        metric_candidates = METRIC_CANDIDATES.get(metric_key, [metric_key])
        dimension_col = _find_column(df, dim_candidates) or _fallback_dimension_col(df)
        metric_col = _find_column(df, metric_candidates) or _fallback_metric_col(df)

        if not dimension_col:
            return {"error": f"数据中找不到维度列。表头列为: {list(df.columns)}"}
        if not metric_col:
            return {"error": f"数据中找不到数值列作为指标。表头列为: {list(df.columns)}"}

        # 4. 简单过滤
        time_col = _find_column(df, ["YearQuarter", "年季", "季度", "时间"])
        if time_col and "2024" in query_text:
            df[time_col] = df[time_col].astype(str)
            df = df[df[time_col].str.contains("2024", na=False)]
        province_col = _find_column(df, ["Province", "省份", "省"])
        if province_col and "江苏" in query_text:
            df = df[df[province_col].astype(str).str.contains("江苏", na=False)]

        # 5. 聚合
        try:
            grouped = df.groupby(dimension_col)[metric_col].sum().reset_index()
        except Exception as e:
            return {"error": f"聚合失败: {e}"}

        if dimension_key == "YearQuarter" or (time_col and dimension_col == time_col):
            grouped = grouped.sort_values(dimension_col)
        else:
            grouped = grouped.sort_values(metric_col, ascending=False)

        chart_data = []
        for _, row in grouped.iterrows():
            try:
                val = float(row[metric_col]) if pd.notna(row[metric_col]) else 0
            except (TypeError, ValueError):
                val = 0
            chart_data.append({
                "name": str(row[dimension_col]) if pd.notna(row[dimension_col]) else "",
                "value": val
            })

        title_dim_name = {v: k for k, v in dim_map.items()}.get(dimension_key, dimension_key)
        title_metric_name = "销售额" if metric_key == "SalesAmount" else "销售量"
        return {
            "data": chart_data,
            "title": f"{title_dim_name}{title_metric_name}统计",
            "logicDescription": f"筛选: {query_text} | 按 [{dimension_col}] 统计 [{metric_col}]",
            "config": {"dimension": dimension_col, "metric": metric_col}
        }


# 单例模式
data_engine = DataEngine()
