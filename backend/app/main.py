from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .engine import data_engine

app = FastAPI(title="PharmCube BI Backend")

# 允许跨域 (前端 React 在 3000/5173，后端在 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 数据模型 ---
class QueryRequest(BaseModel):
    text: str

class DashboardItem(BaseModel):
    id: str
    dashboardId: str
    config: Dict[str, Any]
    title: str
    gridSpan: int = 1

# --- 模拟数据库 (内存存储) ---
# 在真实场景中，这里应该读写 JSON 文件或 SQLite 数据库
dashboards_db = [
    {"id": "default", "name": "默认看板", "createdAt": "2024-01-01"}
]
dashboard_items_db = []

@app.get("/")
def read_root():
    return {"status": "Backend is running"}

@app.post("/api/query")
def query_data(request: QueryRequest):
    """
    接收自然语言，返回图表数据
    """
    result = data_engine.process_query(request.text)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/api/dashboards")
def get_dashboards():
    return dashboards_db

@app.post("/api/dashboards")
def create_dashboard(name: str):
    new_dash = {"id": str(len(dashboards_db) + 1), "name": name}
    dashboards_db.append(new_dash)
    return new_dash

@app.get("/api/dashboard/{dashboard_id}/items")
def get_dashboard_items(dashboard_id: str):
    # 返回属于该看板的图表，并重新计算最新数据
    items = [item for item in dashboard_items_db if item["dashboardId"] == dashboard_id]
    
    # 重新获取实时数据 (Live Data)
    live_items = []
    for item in items:
        # 重新调用引擎获取最新数据 (模拟刷新)
        # 注意：这里简化了，实际应该存下查询语句重新跑一遍，或者存下 config
        # 这里假设 config 里存了 dimension/metric，我们简单重跑一次逻辑
        # 为了演示，我们直接复用存储的 renderData，但在真实 BI 中应该重算
        live_items.append(item)
    return live_items

@app.post("/api/dashboard/items")
def add_dashboard_item(item: DashboardItem):
    # 保存到后端
    item_dict = item.dict()
    dashboard_items_db.append(item_dict)
    return {"status": "success", "id": item.id}

@app.delete("/api/dashboard/items/{item_id}")
def delete_dashboard_item(item_id: str):
    global dashboard_items_db
    dashboard_items_db = [i for i in dashboard_items_db if i["id"] != item_id]
    return {"status": "deleted"}
