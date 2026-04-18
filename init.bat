@echo off
chcp 65001 >nul
set NODE_DIR=C:\Users\AI\.workbuddy\binaries\node\versions\22.12.0.installing.11448.__extract_temp__\node-v22.12.0-win-x64
set PATH=%NODE_DIR%;%PATH%
cd /d C:\Users\AI\Documents\WorkBuddy\DuckAI-Export
echo Node version:
node --version
echo.
echo NPM version:
npm --version
echo.
echo 开始初始化 WXT 项目...
npm create wxt@latest -- DuckAI-Export --template vanilla-ts --skipInstall
echo.
echo 完成！
