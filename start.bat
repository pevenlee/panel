@echo off
chcp 65001 >nul
echo ========================================
echo    启动前后端服务
echo ========================================
echo.

REM 检查是否安装了 Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查是否安装了 Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Python，请先安装 Python
    pause
    exit /b 1
)

echo [1/4] 检查前端依赖...
cd frontend
if not exist "node_modules" (
    echo [提示] 正在安装前端依赖，请稍候...
    call npm install
)

echo.
echo [2/4] 检查后端依赖...
cd ..\backend
if not exist "venv" (
    echo [提示] 创建 Python 虚拟环境...
    python -m venv venv
)

echo [提示] 激活虚拟环境并检查依赖...
call venv\Scripts\activate.bat
pip install -r requirements.txt >nul 2>nul

echo.
echo [3/4] 启动后端服务 (端口 8000)...
start "Backend Server" cmd /k "cd /d %~dp0backend && venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo.
echo [4/4] 启动前端服务 (端口 5173)...
start "Frontend Server" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo    服务启动完成！
echo ========================================
echo.
echo 前端地址: http://localhost:5173
echo 后端地址: http://localhost:8000
echo API 文档: http://localhost:8000/docs
echo.
echo 按任意键关闭此窗口（服务将继续运行）
echo 要停止服务，请关闭对应的命令行窗口
echo ========================================
pause >nul
