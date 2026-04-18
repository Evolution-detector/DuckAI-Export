/**
 * post-build.cjs - WXT 构建后处理脚本
 *
 * Chrome/Edge:
 *   1. 移除 gecko 字段
 *   2. 添加 tabs 权限
 *   3. 复制 _locales 到 dist
 *   4. 写入 default_locale 到 manifest
 *
 * Firefox:
 *   1. 复制 _locales 到 dist（用于解析 __MSG_extensionName__ 等占位符）
 *
 * 用法: node post-build.cjs chrome | firefox
 */
const fs = require('fs');
const path = require('path');

const browser = process.argv[2];
if (!browser) {
  console.error('Usage: node post-build.cjs <chrome|firefox>');
  process.exit(1);
}

const projectRoot = __dirname;
const localesSrc = path.join(projectRoot, '_locales');

function copyLocales(destDir) {
  if (!fs.existsSync(localesSrc)) return;
  const localesDest = path.join(destDir, '_locales');
  if (fs.existsSync(localesDest)) fs.rmSync(localesDest, { recursive: true });
  fs.cpSync(localesSrc, localesDest, { recursive: true });
  console.log(`[post-build] Copied _locales to ${path.basename(destDir)}`);
}

if (browser === 'firefox') {
  const distDir = path.join(projectRoot, 'dist', 'firefox-mv3');
  const manifestPath = path.join(distDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // 1. 复制 _locales（用于解析 __MSG_extensionName__ 等占位符）
  copyLocales(distDir);
  // 2. 写入 default_locale（Firefox 需要此字段才知道默认语言）
  manifest.default_locale = 'en';
  console.log('[post-build] Set default_locale: en');
  // 3. action.default_title 也走 i18n（工具提示）
  if (manifest.action?.default_title) {
    manifest.action.default_title = '__MSG_extensionName__';
    console.log('[post-build] Set action.default_title to __MSG_extensionName__');
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('[post-build] Done:', manifestPath);
  return;
}

// Chrome / Edge
const distChrome = path.join(projectRoot, 'dist', 'chrome-mv3');
const manifestPath2 = path.join(distChrome, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath2, 'utf-8'));

// 1. 移除 gecko 专用字段
if (manifest.browser_specific_settings?.gecko) {
  delete manifest.browser_specific_settings.gecko;
  if (Object.keys(manifest.browser_specific_settings).length === 0) {
    delete manifest.browser_specific_settings;
  }
  console.log('[post-build] Removed gecko fields');
}
// 2. 添加 tabs 权限
if (!manifest.permissions) manifest.permissions = [];
if (!manifest.permissions.includes('tabs')) {
  manifest.permissions.push('tabs');
  console.log('[post-build] Added tabs permission');
}
// 3. 复制 _locales（Chrome/Edge 商店多语言支持）
copyLocales(distChrome);
// 4. 写入 default_locale
manifest.default_locale = 'en';
console.log('[post-build] Set default_locale: en');
// 5. action.default_title 也走 i18n（工具提示）
if (manifest.action?.default_title) {
  manifest.action.default_title = '__MSG_extensionName__';
  console.log('[post-build] Set action.default_title to __MSG_extensionName__');
}

fs.writeFileSync(manifestPath2, JSON.stringify(manifest, null, 2));
console.log('[post-build] Done:', manifestPath2);
console.log('  permissions:', manifest.permissions);
console.log('  default_locale:', manifest.default_locale || '(not set)');
console.log('  gecko:', manifest.browser_specific_settings?.gecko ? 'yes' : 'no');
