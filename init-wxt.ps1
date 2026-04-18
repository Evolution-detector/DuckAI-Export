$ErrorActionPreference = 'Continue'
$NODE_DIR = "C:\Users\AI\.workbuddy\binaries\node\versions\22.12.0.installing.11448.__extract_temp__\node-v22.12.0-win-x64"
$env:PATH = "$NODE_DIR;$env:PATH"
$env:Path = "$NODE_DIR;$env:Path"

Write-Host "=== 1. 初始化 WXT 项目 ===" -ForegroundColor Cyan
Set-Location "C:\Users\AI\Documents\WorkBuddy\DuckAI-Export"
Write-Host "Node: $(node --version)"
Write-Host "NPM: $(npm --version)"

# 初始化 WXT vanilla-ts 项目
npx --yes wxt@latest init DuckAI-Export --template vanilla-ts --skipInstall

Write-Host "=== WXT 初始化完成 ===" -ForegroundColor Green
