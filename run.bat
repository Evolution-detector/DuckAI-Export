@echo off
setlocal

REM 添加 Node.js 到 PATH
set "NODE_PATH=C:\Users\AI\.workbuddy\binaries\node\versions\22.12.0.installing.11448.__extract_temp__\node-v22.12.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"

cd /d "C:\Users\AI\Documents\WorkBuddy\DuckAI-Export"

echo [1/2] Node 版本:
node --version

echo.
echo [2/2] WXT 版本:
npx wxt --version

pause
