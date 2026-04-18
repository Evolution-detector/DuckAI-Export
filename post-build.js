/**
 * post-build.js
 * WXT 构建后处理脚本：
 * 1. 移除 Chrome/Edge manifest 中的 gecko 字段
 * 2. 确保 tabs 权限存在
 * 用法: node post-build.js chrome
 */
const fs = require('fs');
const path = require('path');

const browser = process.argv[2];
if (!browser) {
  console.error('Usage: node post-build.js <chrome|firefox>');
  process.exit(1);
}

const manifestPath = path.join(__dirname, 'dist', 'chrome-mv3', 'manifest.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Chrome/Edge 移除 gecko 专用字段
if (browser === 'chrome' || browser === 'edge') {
  if (manifest.browser_specific_settings?.gecko) {
    delete manifest.browser_specific_settings.gecko;
    if (Object.keys(manifest.browser_specific_settings).length === 0) {
      delete manifest.browser_specific_settings;
    }
  }
  // 确保 tabs 权限存在
  if (!manifest.permissions) manifest.permissions = [];
  if (!manifest.permissions.includes('tabs')) {
    manifest.permissions.push('tabs');
  }
}

// Firefox 保持原样（gecko 设置由 wxt.config 生成）
if (browser === 'firefox') {
  console.log('[post-build] Firefox build - no changes needed');
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[post-build] Done for ${browser}: tabs permission=${manifest.permissions?.includes('tabs')}, gecko=${!!manifest.browser_specific_settings?.gecko}`);
