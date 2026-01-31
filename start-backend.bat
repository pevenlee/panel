@echo off
chcp 65001 >nul
echo ========================================
echo   正在启动后端服务器...
echo ========================================

REM 切换到脚本所在目录
cd /d "%~dp0"
cd backend

echo 当前目录: %cd%

REM 检查 FastAPI 是否已安装
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo [INFO] 正在安装依赖，请稍候...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] 依赖安装失败！
        pause
        exit /b 1
    )
)

echo [INFO] 启动 FastAPI 服务器...
echo [INFO] 后端地址: http://localhost:8000
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

echo.
echo [INFO] 服务器已停止
pause
