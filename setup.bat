@echo off
chcp 65001 >nul
set NODE_DIR=C:\Users\AI\.workbuddy\binaries\node\versions\22.12.0.installing.11448.__extract_temp__\node-v22.12.0-win-x64
set PATH=%NODE_DIR%;%NODE_DIR%\node_modules\npm\bin\node.npm;%PATH%
cd /d C:\Users\AI\Documents\WorkBuddy\DuckAI-Export
echo 开始安装依赖...
call npm install
echo.
echo 安装完成！运行以下命令启动开发模式：
echo   npm run dev
echo.
pause
