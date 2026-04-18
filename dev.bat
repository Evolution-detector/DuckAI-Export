@echo off
setlocal
set "NODE_PATH=C:\Users\AI\.workbuddy\binaries\node\versions\22.12.0.installing.11448.__extract_temp__\node-v22.12.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"
cd /d "C:\Users\AI\Documents\WorkBuddy\DuckAI-Export"
echo [Node] & node --version
echo [WXT] & npx wxt --version
echo.
echo [Build Firefox MV3] & npx wxt build -b firefox --mv3 2>&1
pause