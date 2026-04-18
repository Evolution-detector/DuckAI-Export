@echo off
set "NODE_DIR=C:\Users\AI\.workbuddy\binaries\node\versions\22.12.0.installing.11448.__extract_temp__\node-v22.12.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "C:\Users\AI\Documents\WorkBuddy\DuckAI-Export"
call node_modules\.bin\wxt.cmd %*
