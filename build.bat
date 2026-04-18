@echo off
setlocal

set "NODE_PATH=C:\Users\AI\.workbuddy\binaries\node\versions\22.12.0.installing.11448.__extract_temp__\node-v22.12.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"

cd /d "C:\Users\AI\Documents\WorkBuddy\DuckAI-Export"

echo.
echo [1/3] 清理旧构建产物...
npx wxt clean 2>&1

echo.
echo [2/3] 构建 Firefox MV3 扩展...
npx wxt build -b firefox --mv3 2>&1

echo.
echo [3/3] 检查输出...
dir /s /b extension\dist\*.xpi 2>nul
if exist "extension\dist" dir extension\dist /b 2>&1

pause
