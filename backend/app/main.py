from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .engine import data_engine
from . import gemini_engine

app = FastAPI(title="PharmCube BI Backend")

# 允许跨域 (前端 React 在 3000/5173，后端在 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Server Startup: Preload Data"""
    print("Preloading data...")
    # Run in threadpool to avoid blocking event loop, though startup is sync-ish here
    # gemini_engine.get_cached_data()  # Direct call might block, but better here than request
    try:
        gemini_engine.get_cached_data()
        print("Data preloaded successfully.")
    except Exception as e:
        print(f"Data preload failed: {e}")



# --- 数据模型 ---
class QueryRequest(BaseModel):
    text: str
    history: Optional[List[Dict[str, Any]]] = None  # 可选：最近对话，供 Gemini 历史上下文
    module: Optional[str] = None # 'dashboard' | 'research' | 'report'

class DashboardItem(BaseModel):
    id: str
    dashboardId: str
    config: Dict[str, Any]
    title: str
    gridSpan: int = 1
    renderData: Optional[List[Dict[str, Any]]] = None  # 前端图表数据，用于看板展示
    queryText: Optional[str] = None  # 原始查询语句，用于刷新数据

class ExecutePlanRequest(BaseModel):
    items: List[Dict[str, Any]]

# --- 模拟数据库 (文件持久化) ---
import json
import os
DASHBOARDS_FILE = os.path.join(gemini_engine.DATA_DIR, "dashboards.json")
ITEMS_FILE = os.path.join(gemini_engine.DATA_DIR, "dashboard_items.json")

def load_db():
    global dashboards_db, dashboard_items_db
    if os.path.exists(DASHBOARDS_FILE):
        try:
            with open(DASHBOARDS_FILE, "r", encoding="utf-8") as f:
                dashboards_db = json.load(f)
        except Exception:
            dashboards_db = [{"id": "default", "name": "默认看板", "createdAt": "2024-01-01"}]
    else:
        dashboards_db = [{"id": "default", "name": "默认看板", "createdAt": "2024-01-01"}]
        
    if os.path.exists(ITEMS_FILE):
        try:
            with open(ITEMS_FILE, "r", encoding="utf-8") as f:
                dashboard_items_db = json.load(f)
        except Exception:
            dashboard_items_db = []
    else:
        dashboard_items_db = []

def save_db():
    try:
        with open(DASHBOARDS_FILE, "w", encoding="utf-8") as f:
            json.dump(dashboards_db, f, ensure_ascii=False, indent=2)
        with open(ITEMS_FILE, "w", encoding="utf-8") as f:
            json.dump(dashboard_items_db, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving DB: {e}")

# Load on startup
dashboards_db = []
dashboard_items_db = []
load_db()

@app.get("/")
def read_root():
    return {"status": "Backend is running"}


@app.post("/api/clear-cache")
def clear_cache():
    """清除数据缓存，下次请求会重新加载数据和构建元数据。"""
    gemini_engine.clear_cache()
    return {"status": "缓存已清除，下次请求将重新加载数据"}


@app.get("/api/metadata")
def get_metadata():
    """获取当前元数据预览，用于调试。"""
    return gemini_engine.get_metadata_preview()

@app.post("/api/query")
def query_data(request: QueryRequest):
    """
    接收自然语言，返回图表/分析数据。
    若配置了 GENAI_API_KEY，则使用 Gemini 意图路由 + 取数/分析；否则使用规则引擎。
    """
    if gemini_engine._get_client() is not None:
        history_context = "无历史对话。"
        if request.history:
            history_context = gemini_engine.get_history_context(request.history, turn_limit=3)
        
        # New Routing Logic
        if request.module == 'research':
            # Use Specialized Market Research Planner
            # Ensure metadata is ready
            _, _, _, meta_data = gemini_engine.get_cached_data()
            result = gemini_engine.generate_market_research_plan(
                request.text, 
                history_context, 
                meta_data
            )
        else:
            # Standard Dashboard Logic
            result = gemini_engine.process_query_with_gemini(
                request.text,
                history_context=history_context,
            )
    else:
        result = data_engine.process_query(request.text)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/identify-intent")
def api_identify_intent(request: QueryRequest):
    """
    仅执行意图识别，用于前端快速反馈。
    """
    if gemini_engine._get_client() is not None:
        history_context = "无历史对话。"
        if request.history:
            history_context = gemini_engine.get_history_context(request.history, turn_limit=3)
        intent = gemini_engine.identify_intent(request.text, history_context)
        return {"intent": intent}
    return {"intent": "simple"}

@app.get("/api/dashboards")
def get_dashboards():
    return dashboards_db

@app.post("/api/dashboards")
def create_dashboard(name: str, role: str = "总经理"):
    new_dash = {"id": str(len(dashboards_db) + 1), "name": name, "role": role}
    dashboards_db.append(new_dash)
    save_db()
    return new_dash

@app.delete("/api/dashboards/{dashboard_id}")
def delete_dashboard(dashboard_id: str):
    global dashboards_db, dashboard_items_db
    dashboards_db = [d for d in dashboards_db if d["id"] != dashboard_id]
    dashboard_items_db = [i for i in dashboard_items_db if i["dashboardId"] != dashboard_id]
    save_db()
    return {"status": "deleted"}

    raise HTTPException(status_code=404, detail="Dashboard not found")

@app.put("/api/dashboards/{dashboard_id}")
def update_dashboard(dashboard_id: str, name: Optional[str] = None, role: Optional[str] = None):
    for d in dashboards_db:
        if d["id"] == dashboard_id:
            if name is not None:
                d["name"] = name
            if role is not None:
                d["role"] = role
            save_db()
            return d
    raise HTTPException(status_code=404, detail="Dashboard not found")

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
    save_db()
    return {"status": "success", "id": item.id}

@app.delete("/api/dashboard/items/{item_id}")
def delete_dashboard_item(item_id: str):
    global dashboard_items_db
    dashboard_items_db = [i for i in dashboard_items_db if i["id"] != item_id]
    save_db()
    return {"status": "deleted"}


@app.put("/api/dashboard/items/{item_id}")
def update_dashboard_item(item_id: str, item: Dict[str, Any]):
    # item 只需要包含要更新的字段，如 title, config 等
    for i in dashboard_items_db:
        if i["id"] == item_id:
            i.update(item)
            save_db()
            return i
    raise HTTPException(status_code=404, detail="Item not found")


@app.post("/api/dashboard/items/{item_id}/refresh")
def refresh_dashboard_item(item_id: str):
    """
    刷新看板项目数据：使用存储的 queryText 重新执行查询。
    """
    # 找到该项目
    target_item = None
    for i in dashboard_items_db:
        if i["id"] == item_id:
            target_item = i
            break
    
    if not target_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    query_text = target_item.get("queryText")
    if not query_text:
        raise HTTPException(status_code=400, detail="该项目没有关联的查询语句，无法刷新")
    
    # 重新执行查询
    try:
        if gemini_engine._get_client() is not None:
            result = gemini_engine.process_query_with_gemini(query_text)
        else:
            result = data_engine.process_query(query_text)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # 更新 renderData
        new_data = result.get("data") or result.get("fullData") or []
        target_item["renderData"] = new_data
        
        return {"status": "refreshed", "item": target_item}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"刷新失败: {e}")


class ChartSuggestRequest(BaseModel):
    data: List[Dict[str, Any]]  # 图表数据
    title: str = ""             # 数据标题
    customPrompt: str = ""      # 用户自定义提示词（为空则智能推荐）


@app.post("/api/chart-suggest")
def suggest_chart(request: ChartSuggestRequest):
    """
    调用 Gemini 分析数据并推荐图表类型。
    - customPrompt 为空：智能推荐
    - customPrompt 有值：根据用户提示词推荐
    """
    result = gemini_engine.suggest_chart(
        data=request.data,
        title=request.title,
        custom_prompt=request.customPrompt,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class DashboardInsightRequest(BaseModel):
    items: List[Dict[str, Any]]


@app.post("/api/dashboard/insight")
def generate_dashboard_insight(req: DashboardInsightRequest):
    """
    根据看板内所有图表数据生成综合洞察。
    items: [{ title, renderData, config }, ...]
    """
    return gemini_engine.generate_insight_for_dashboard(req.items)


class ExecutePlanRequest(BaseModel):
    items: List[Dict[str, Any]]

@app.post("/api/execute-plan")
def execute_query_plan(request: ExecutePlanRequest):
    """
    执行表格生成计划
    """
    results = gemini_engine.execute_query_plan(request.items)
    return results
