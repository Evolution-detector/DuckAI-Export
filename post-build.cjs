/**
 * post-build.cjs - WXT 构建后处理脚本
 * Chrome/Edge: 移除 gecko 字段 + 添加 tabs 权限
 * Firefox: 保持原样
 * 用法: node post-build.cjs chrome
 */
const fs = require('fs');
const path = require('path');

const browser = process.argv[2];
if (!browser) {
  console.error('Usage: node post-build.cjs <chrome|firefox>');
  process.exit(1);
}

// 使用项目根目录（post-build.cjs 所在目录）
const projectRoot = __dirname;
const manifestPath = path.join(projectRoot, 'dist', 'chrome-mv3', 'manifest.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

if (browser === 'chrome' || browser === 'edge') {
  // 移除 gecko 专用字段
  if (manifest.browser_specific_settings?.gecko) {
    delete manifest.browser_specific_settings.gecko;
    if (Object.keys(manifest.browser_specific_settings).length === 0) {
      delete manifest.browser_specific_settings;
    }
    console.log('[post-build] Removed gecko fields');
  }
  // 添加 tabs 权限（popup 与 content script 通信必需）
  if (!manifest.permissions) manifest.permissions = [];
  if (!manifest.permissions.includes('tabs')) {
    manifest.permissions.push('tabs');
    console.log('[post-build] Added tabs permission');
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('[post-build] Done:', manifestPath);
console.log('  permissions:', manifest.permissions);
console.log('  gecko:', manifest.browser_specific_settings?.gecko ? 'yes' : 'no');
