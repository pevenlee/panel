# PharmCube BI 系统架构文档

## 一、项目概览

这是一个 **PharmCube BI 系统** - 一个基于 AI 的商业智能平台，集成了 Gemini AI 进行自然语言查询、数据分析和市场研究。

**技术栈：**
- 前端：React 18 + Vite + TailwindCSS + ECharts
- 后端：FastAPI + Pandas + Google Gemini API
- 数据存储：Excel/CSV 文件 + JSON 持久化

---

## 二、前端结构详解

### 2.1 前端目录树
```
frontend/
├── src/
│   ├── main.jsx              # React 入口
│   ├── App.jsx               # 主应用组件（135KB+）
│   ├── index.css             # Tailwind 样式
│   ├── components/
│   │   ├── ChartRenderer.jsx # 图表渲染组件（ECharts）
│   │   └── EnhancedTable.jsx # 增强表格组件
│   └── services/
│       └── api.js            # API 调用服务
├── package.json              # 依赖配置
├── vite.config.js            # Vite 配置
├── tailwind.config.js        # TailwindCSS 配置
└── postcss.config.js         # PostCSS 配置
```

### 2.2 核心前端组件

**App.jsx** - 主应用组件
- 多模块支持：Dashboard（看板）、Research（调研）、Report（报告）
- 对话界面：支持多轮对话、历史记录
- 看板管理：创建、编辑、删除看板
- 图表管理：添加、刷新、删除图表
- 实时数据刷新和意图识别

**ChartRenderer.jsx** - 图表渲染
- 支持多种图表类型：柱状图、折线图、饼图、地图等
- 数据格式化：大数字转换（万、亿）、百分比处理
- 省份名称规范化（处理中文地名）
- ECharts 集成

**EnhancedTable.jsx** - 增强表格
- 排序、筛选、列拖拽
- 数据切片器（Slicer）
- 列可见性控制
- 数据导出

### 2.3 API 服务层（api.js）

```javascript
chatApi 对象包含的主要方法：
- queryData()              # 自然语言查询
- identifyIntent()         # 意图识别
- getDashboards()          # 获取看板列表
- createDashboard()        # 创建看板
- getDashboardItems()      # 获取看板项目
- addDashboardItem()       # 添加图表
- refreshDashboardItem()   # 刷新图表数据
- suggestChart()           # 图表推荐
- generateDashboardInsight() # 生成洞察
- executePlan()            # 执行查询计划
- executeResearchStep()    # 执行调研步骤
- generateResearchReport() # 生成调研报告
```

---

## 三、后端结构详解

### 3.1 后端目录树
```
backend/
├── app/
│   ├── main.py             # FastAPI 主应用（347 行）
│   ├── gemini_engine.py    # Gemini AI 引擎（1614 行）
│   ├── engine.py           # 规则引擎（160 行）
│   └── __init__.py
├── data/
│   ├── hcmdata.xlsx        # 主数据表（HCM 数据）
│   ├── structure.xlsx      # 结构/客户表
│   ├── fact.csv            # 事实表
│   ├── ipmdata.xlsx        # IPM 数据
│   ├── dashboards.json     # 看板配置
│   ├── dashboard_items.json # 看板项目
│   └── metadata_analysis.json # 元数据分析
├── requirements.txt        # Python 依赖
├── .env                    # 环境变量（GENAI_API_KEY）
└── venv/                   # Python 虚拟环境
```

### 3.2 后端依赖
```
fastapi              # Web 框架
uvicorn              # ASGI 服务器
pandas               # 数据处理
openpyxl             # Excel 读写
python-multipart     # 表单数据处理
google-genai         # Google Gemini API
```

---

## 四、API 端点详解

### 4.1 核心查询端点

**POST /api/query**
- 请求：`{ text, history?, module? }`
- 功能：自然语言查询，支持 dashboard/research 两种模式
- 流程：
  1. 检查 Gemini API 是否配置
  2. 若配置，使用 Gemini 进行意图路由和取数
  3. 若未配置，使用规则引擎
  4. 返回图表数据或分析结果

**POST /api/identify-intent**
- 功能：快速意图识别（不执行查询）
- 返回：`{ intent: "simple|complex|analysis|..." }`

### 4.2 看板管理端点

```
GET    /api/dashboards                    # 获取所有看板
POST   /api/dashboards                    # 创建看板
DELETE /api/dashboards/{dashboard_id}     # 删除看板
PUT    /api/dashboards/{dashboard_id}     # 更新看板

GET    /api/dashboard/{dashboard_id}/items      # 获取看板项目
POST   /api/dashboard/items                     # 添加项目
DELETE /api/dashboard/items/{item_id}           # 删除项目
PUT    /api/dashboard/items/{item_id}           # 更新项目
POST   /api/dashboard/items/{item_id}/refresh   # 刷新项目数据
```

### 4.3 AI 功能端点

```
POST /api/chart-suggest              # 图表推荐
POST /api/dashboard/insight          # 生成看板洞察
POST /api/execute-plan               # 执行查询计划
POST /api/execute-research-step      # 执行调研步骤
POST /api/generate-research-report   # 生成调研报告
POST /api/clear-cache                # 清除缓存
GET  /api/metadata                   # 获取元数据预览
```

---

## 五、数据流向分析

### 5.1 查询流程

```
用户输入查询
    ↓
前端 (App.jsx) 调用 chatApi.queryData()
    ↓
POST /api/query (FastAPI)
    ↓
检查 Gemini API 配置
    ├─ 已配置 → gemini_engine.process_query_with_gemini()
    │   ├─ 加载缓存数据 (get_cached_data)
    │   ├─ 构建元数据 (build_metadata)
    │   ├─ 调用 Gemini 进行意图识别和取数
    │   ├─ 执行 SQL/Python 代码
    │   └─ 返回图表数据
    │
    └─ 未配置 → data_engine.process_query()
        ├─ 规则匹配维度和指标
        ├─ 从 Excel 读取数据
        ├─ 聚合计算
        └─ 返回图表数据
    ↓
前端接收数据
    ↓
ChartRenderer 渲染图表
```

### 5.2 看板保存流程

```
用户创建/编辑看板
    ↓
前端调用 chatApi.addDashboardItem()
    ↓
POST /api/dashboard/items (FastAPI)
    ↓
保存到 dashboard_items_db (内存)
    ↓
save_db() 写入 JSON 文件
    ↓
下次启动时 load_db() 恢复数据
```

### 5.3 数据加载流程

```
后端启动
    ↓
load_data() 函数执行
    ├─ 读取 hcmdata.xlsx (主表)
    ├─ 读取 structure.xlsx (结构表)
    ├─ 合并两表 (LEFT JOIN)
    ├─ 读取 fact.csv 和 ipmdata.xlsx
    └─ 数值列清理（去除千分位逗号）
    ↓
analyze_time_structure() 分析时间列
    ├─ 识别 YearQuarter 列
    ├─ 计算 MAT（最近4个季度）
    ├─ 计算 YTD（年初至今）
    └─ 返回时间上下文
    ↓
build_metadata() 构建元数据
    ├─ 列举所有列名和数据类型
    ├─ 统计唯一值数量
    ├─ 对于 <100 个唯一值的列，传递全部值
    └─ 对于 >=100 个唯一值的列，传递前 100 个
    ↓
缓存到全局变量
    (_cached_df, _cached_dfs, _cached_time_context, _cached_meta_data)
```

---

## 六、关键模块详解

### 6.1 Gemini 引擎 (gemini_engine.py)

**核心函数：**

1. **load_data()** - 数据加载
   - 加载主表、结构表、事实表
   - 数值列清理和转换
   - 返回 (df_main, dfs_map, status_msg)

2. **analyze_time_structure()** - 时间分析
   - 识别时间列
   - 计算 MAT、YTD 等时间上下文
   - 支持季度和年份分析

3. **build_metadata()** - 元数据构建
   - 为 Gemini Prompt 准备数据描述
   - 包含列名、数据类型、唯一值等

4. **get_cached_data()** - 缓存管理
   - 首次加载时执行 load_data()
   - 后续请求直接返回缓存
   - 支持 clear_cache() 清除

5. **process_query_with_gemini()** - 主查询处理
   - 调用 Gemini 进行意图识别
   - 根据意图执行相应操作
   - 返回图表数据或分析结果

6. **suggest_chart()** - 图表推荐
   - 分析数据特征
   - 推荐合适的图表类型
   - 支持自定义提示词

7. **generate_market_research_plan()** - 市场调研计划
   - 生成多步骤调研计划
   - 支持数据收集、分析、报告生成

### 6.2 规则引擎 (engine.py)

**核心类：DataEngine**

- **process_query()** - 规则匹配查询
  1. 从查询文本识别维度（省、市、产品等）
  2. 识别指标（销售额、销售量等）
  3. 匹配实际 Excel 列名
  4. 执行聚合计算
  5. 返回图表数据

**维度候选列表：**
```python
Province, City, Product, YearQuarter, Channel,
Manufacturer, DosageForm, Market
```

**指标候选列表：**
```python
SalesAmount, SalesVolume
```

### 6.3 主应用 (main.py)

**数据模型：**
```python
QueryRequest:
  - text: 查询文本
  - history: 对话历史
  - module: 'dashboard' | 'research' | 'report'

DashboardItem:
  - id, dashboardId, config, title
  - gridSpan, renderData, queryText

ExecutePlanRequest:
  - items: 查询计划项目列表
```

**数据库操作：**
- 全局变量：dashboards_db, dashboard_items_db
- 持久化：JSON 文件 (dashboards.json, dashboard_items.json)
- 启动时加载，修改时保存

---

## 七、前后端交互方式

### 7.1 通信协议

- **基础 URL：** `http://localhost:8000/api`
- **方法：** REST (GET, POST, PUT, DELETE)
- **格式：** JSON
- **CORS：** 允许所有来源

### 7.2 请求/响应示例

**查询请求：**
```json
POST /api/query
{
  "text": "2024年江苏省销售额",
  "history": [...],
  "module": "dashboard"
}

响应：
{
  "intent": "simple",
  "data": [
    {"name": "产品A", "value": 1000000},
    {"name": "产品B", "value": 2000000}
  ],
  "title": "2024年江苏省销售额统计",
  "config": {"dimension": "Product", "metric": "SalesAmount"}
}
```

**看板项目请求：**
```json
POST /api/dashboard/items
{
  "id": "item_1",
  "dashboardId": "1",
  "title": "销售额趋势",
  "config": {"type": "line", "dimension": "YearQuarter"},
  "renderData": [...],
  "queryText": "2024年销售额趋势"
}

响应：
{
  "status": "success",
  "id": "item_1"
}
```

---

## 八、数据存储结构

### 8.1 Excel 数据表

**hcmdata.xlsx** - 主数据表
- 包含：Province, City, Product, YearQuarter, Channel, SalesAmount, SalesVolume 等
- 行数：数千行
- 用途：主要分析数据源

**structure.xlsx** - 结构/客户表
- 与主表通过公共列关联
- 包含额外的维度信息

**fact.csv** - 事实表
- 销售额、销售量等事实数据
- 数值列需要去除千分位逗号

**ipmdata.xlsx** - IPM 数据
- 额外的分析数据源

### 8.2 JSON 配置文件

**dashboards.json**
```json
[
  {
    "id": "1",
    "name": "2025Q3市场情况",
    "role": "总经理"
  }
]
```

**dashboard_items.json**
```json
[
  {
    "id": "item_1",
    "dashboardId": "1",
    "title": "销售额",
    "config": {...},
    "renderData": [...],
    "queryText": "..."
  }
]
```

---

## 九、关键特性

### 9.1 AI 功能
- 自然语言查询理解
- 意图识别和路由
- 图表类型推荐
- 数据洞察生成
- 市场调研计划生成
- HTML 报告生成

### 9.2 数据处理
- 多表关联和合并
- 数值清理和转换
- 时间序列分析（MAT、YTD）
- 聚合和分组计算
- 元数据自动构建

### 9.3 用户界面
- 多看板管理
- 拖拽式图表布局
- 实时数据刷新
- 表格切片器
- 响应式设计

---

## 十、完整运行流程示例

### 示例 1：用户查询"2024年江苏省销售额"

```
1. 用户在前端输入查询
   ↓
2. App.jsx 调用 chatApi.queryData({text: "2024年江苏省销售额", module: "dashboard"})
   ↓
3. axios 发送 POST 请求到 http://localhost:8000/api/query
   ↓
4. FastAPI main.py 接收请求，调用 gemini_engine.process_query_with_gemini()
   ↓
5. gemini_engine 执行：
   - get_cached_data() 获取缓存的 DataFrame
   - build_metadata() 构建数据描述
   - 调用 Gemini API 分析查询意图
   - Gemini 返回 Python 代码：df[df['Province']=='江苏省'].groupby('Product')['SalesAmount'].sum()
   - 执行代码获取结果
   - 格式化为前端需要的 JSON 格式
   ↓
6. 返回响应：
   {
     "intent": "simple",
     "data": [{"name": "产品A", "value": 1000000}, ...],
     "title": "2024年江苏省销售额",
     "config": {"dimension": "Product", "metric": "SalesAmount", "chartType": "bar"}
   }
   ↓
7. 前端接收数据，App.jsx 更新 state
   ↓
8. ChartRenderer 组件渲染 ECharts 柱状图
   ↓
9. 用户看到可视化结果
```

### 示例 2：用户保存图表到看板

```
1. 用户点击"添加到看板"按钮
   ↓
2. App.jsx 调用 chatApi.addDashboardItem({
     dashboardId: "1",
     title: "江苏省销售额",
     config: {...},
     renderData: [...],
     queryText: "2024年江苏省销售额"
   })
   ↓
3. POST 请求到 /api/dashboard/items
   ↓
4. main.py 接收请求：
   - 生成唯一 ID
   - 保存到 dashboard_items_db (内存字典)
   - 调用 save_db() 写入 dashboard_items.json
   ↓
5. 返回成功响应
   ↓
6. 前端更新看板显示，新图表出现在看板中
```

### 示例 3：后端启动流程

```
1. 运行 uvicorn app.main:app --reload
   ↓
2. FastAPI 应用初始化
   ↓
3. 触发 @app.on_event("startup")
   ↓
4. 执行 gemini_engine.get_cached_data()
   ↓
5. load_data() 执行：
   - 读取 backend/data/hcmdata.xlsx
   - 读取 backend/data/structure.xlsx
   - 使用 pandas merge 合并两表
   - 清理数值列（去除逗号）
   - 读取 fact.csv 和 ipmdata.xlsx
   ↓
6. analyze_time_structure() 分析时间列
   - 识别 YearQuarter 列
   - 计算最新季度、MAT、YTD
   ↓
7. build_metadata() 构建元数据
   - 遍历所有列
   - 统计数据类型和唯一值
   - 生成元数据字典
   ↓
8. 数据缓存到全局变量
   ↓
9. load_db() 加载看板配置
   - 读取 dashboards.json
   - 读取 dashboard_items.json
   ↓
10. 服务器就绪，监听 8000 端口
    ↓
11. 打印 "Data preloaded successfully."
```

---

## 十一、关键文件路径

### 前端关键文件
- `frontend/src/App.jsx` - 主应用组件
- `frontend/src/components/ChartRenderer.jsx` - 图表渲染
- `frontend/src/components/EnhancedTable.jsx` - 增强表格
- `frontend/src/services/api.js` - API 服务层
- `frontend/package.json` - 依赖配置

### 后端关键文件
- `backend/app/main.py` - FastAPI 主应用
- `backend/app/gemini_engine.py` - Gemini AI 引擎
- `backend/app/engine.py` - 规则引擎
- `backend/requirements.txt` - Python 依赖

### 数据文件
- `backend/data/hcmdata.xlsx` - 主数据表
- `backend/data/structure.xlsx` - 结构表
- `backend/data/fact.csv` - 事实表
- `backend/data/ipmdata.xlsx` - IPM 数据
- `backend/data/dashboards.json` - 看板配置
- `backend/data/dashboard_items.json` - 看板项目

### 配置文件
- `backend/.env` - 环境变量（GENAI_API_KEY）
- `frontend/vite.config.js` - Vite 配置
- `frontend/tailwind.config.js` - TailwindCSS 配置

---

## 十二、启动和部署

### 开发环境启动

**方式 1：使用一键启动脚本**
```bash
# Windows
start.bat

# 自动启动前后端服务
# 前端: http://localhost:5173
# 后端: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

**方式 2：手动启动**
```bash
# 启动后端
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 启动前端（新终端）
cd frontend
npm install
npm run dev
```

### 环境变量配置

创建 `backend/.env` 文件：
```
GENAI_API_KEY=your_gemini_api_key_here
```

---

## 十三、技术亮点

1. **AI 驱动的自然语言查询**
   - 使用 Gemini 2.0 Flash 模型
   - 自动生成 Python/SQL 代码
   - 智能意图识别和路由

2. **双引擎架构**
   - Gemini 引擎：强大的 AI 能力
   - 规则引擎：快速响应简单查询
   - 自动降级机制

3. **数据缓存优化**
   - 启动时预加载数据
   - 内存缓存减少 I/O
   - 支持手动清除缓存

4. **灵活的图表系统**
   - 支持 10+ 种图表类型
   - 自动图表推荐
   - 响应式布局

5. **完整的看板管理**
   - 多看板支持
   - 拖拽式布局
   - 实时数据刷新
   - JSON 持久化

---

## 十四、未来扩展方向

1. **数据源扩展**
   - 支持数据库连接（MySQL, PostgreSQL）
   - 支持 API 数据源
   - 实时数据流

2. **AI 功能增强**
   - 多轮对话上下文
   - 自动异常检测
   - 预测分析

3. **协作功能**
   - 用户权限管理
   - 看板分享
   - 评论和标注

4. **性能优化**
   - 数据分页加载
   - 增量更新
   - WebSocket 实时推送

---

**文档版本：** 1.0
**最后更新：** 2026-02-01
**维护者：** PharmCube BI Team
