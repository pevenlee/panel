import pandas as pd
import os

# 路径配置
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "hcmdata.xlsx")

class DataEngine:
    def __init__(self):
        print(f"正在加载数据: {DATA_PATH} ...")
        # 假设 hcmdata.xlsx 包含: YearQuarter, Province, City, Product, SalesAmount, SalesVolume 等列
        try:
            self.df = pd.read_excel(DATA_PATH)
            print("数据加载成功！")
        except Exception as e:
            print(f"数据加载失败，将使用模拟数据。错误: {e}")
            self.df = self._generate_mock_data()

    def _generate_mock_data(self):
        # 如果找不到文件，生成之前的 Mock 数据作为兜底
        data = []
        # ... (此处省略之前的生成逻辑，实际运行时建议放你的真实 Excel)
        return pd.DataFrame(data)

    def process_query(self, query_text: str):
        """
        简单规则引擎：解析查询文本并聚合数据
        未来这里可以接入 LLM (OpenAI/DeepSeek) 将自然语言转为 Pandas 代码
        """
        df = self.df.copy()
        query_text = query_text.lower()
        
        # 1. 确定维度 (Dimension)
        dimension = "Product" # 默认
        dim_map = {
            "省": "Province", "市": "City", "城市": "City",
            "产品": "Product", "药": "Product",
            "季度": "YearQuarter", "时间": "YearQuarter",
            "渠道": "Channel"
        }
        for key, col in dim_map.items():
            if key in query_text:
                dimension = col
                break

        # 2. 确定指标 (Metric)
        metric = "SalesAmount" # 默认
        metric_map = {"量": "SalesVolume", "盒数": "SalesVolume", "额": "SalesAmount"}
        for key, col in metric_map.items():
            if key in query_text:
                metric = col
                break

        # 3. 简单的过滤逻辑 (例如：包含 "2024Q1")
        # 这里只是示例，可以扩展更复杂的 Pandas 过滤
        if "2024" in query_text:
            df = df[df['YearQuarter'].astype(str).str.contains("2024")]
        if "江苏" in query_text and "Province" in df.columns:
             df = df[df['Province'] == "江苏"]

        # 4. 聚合数据
        if dimension not in df.columns:
            return {"error": f"数据中找不到维度列: {dimension}"}
            
        grouped = df.groupby(dimension)[metric].sum().reset_index()
        
        # 排序
        if dimension == "YearQuarter":
            grouped = grouped.sort_values(dimension)
        else:
            grouped = grouped.sort_values(metric, ascending=False)

        # 格式化为前端需要的格式
        chart_data = []
        for _, row in grouped.iterrows():
            chart_data.append({
                "name": row[dimension],
                "value": float(row[metric])
            })

        title_dim_name = {v: k for k, v in dim_map.items()}.get(dimension, dimension)
        title_metric_name = "销售额" if metric == "SalesAmount" else "销售量"
        
        return {
            "data": chart_data,
            "title": f"{title_dim_name}{title_metric_name}统计",
            "logicDescription": f"筛选条件: {query_text} | 聚合: 按 {dimension} 统计 {metric}",
            "config": {"dimension": dimension, "metric": metric}
        }

# 单例模式
data_engine = DataEngine()
