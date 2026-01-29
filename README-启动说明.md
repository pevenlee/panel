# 启动说明

## 方式一：使用批处理文件（推荐）

### Windows 系统：

1. **启动后端**：双击 `start-backend.bat`
   - 会自动检查并安装依赖
   - 后端将在 `http://localhost:8000` 运行

2. **启动前端**：双击 `start-frontend.bat`（需要新开一个窗口）
   - 会自动检查并安装依赖
   - 前端将在 `http://localhost:5173` 运行

3. **访问应用**：浏览器打开 `http://localhost:5173/`

---

## 方式二：手动启动

### 启动后端：

**CMD 或 PowerShell（请逐行执行，不要用 `&&`）：**

```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

可选：启用 Gemini 时，先设置环境变量再启动：
- **PowerShell**：`$env:GENAI_API_KEY="你的Key"; cd backend; uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **CMD**：`set GENAI_API_KEY=你的Key` 然后另起一行执行 `cd backend` 和 `uvicorn ...`

### 启动前端（新开一个终端窗口）：

```powershell
cd frontend
npm install
npm run dev
```

然后访问：`http://localhost:5173/`

---

## 常见问题

### 1. 端口被占用（Error 10048）
- **后端**：说明后端已经在运行，不需要重复启动
- **前端**：检查是否有其他进程占用 5173 端口，或修改 `vite.config.js` 中的端口

### 2. 连接失败（Error -102）
- 确认前端开发服务器是否正在运行
- 检查终端窗口是否显示 `Local: http://localhost:5173/`
- 如果显示其他端口，请访问对应的端口

### 3. 依赖安装失败
- **后端**：确保已安装 Python 3.8+，并且 pip 可用
- **前端**：确保已安装 Node.js 16+，并且 npm 可用

### 4. Gemini 智能分析（可选）
- 若需使用「意图路由 + 取数/分析」的智能对话，需配置环境变量 `GENAI_API_KEY`（Google Gemini API Key）。
- 未配置时，后端使用规则引擎解析问题，仍可正常取数。

---

## 项目结构

```
panel/
├── backend/          # FastAPI 后端
│   ├── app/         # 应用代码
│   ├── data/        # 数据文件
│   └── requirements.txt
├── frontend/        # React + Vite 前端
│   ├── src/         # 源代码
│   └── package.json
├── start-backend.bat    # 后端启动脚本
└── start-frontend.bat   # 前端启动脚本
```
