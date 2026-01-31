@echo off
chcp 65001 >nul
echo ========================================
echo   正在启动前端开发服务器...
echo ========================================

REM 切换到脚本所在目录
cd /d "%~dp0"
cd frontend

echo 当前目录: %cd%

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo [INFO] 正在安装依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo [ERROR] 依赖安装失败！
        pause
        exit /b 1
    )
)

echo [INFO] 启动 Vite 开发服务器...
echo [INFO] 启动后请访问显示的地址（通常是 http://localhost:5173）
echo.

call npm run dev -- --host 127.0.0.1

echo.
echo [INFO] 服务器已停止
pause
