import { defineConfig } from 'wxt';

export default defineConfig({
  // 扩展基本信息
  languages: ['zh-CN', 'en-US'],
  defaultLanguage: 'zh-CN',

  // Firefox MV3 构建目标
  browser: 'firefox',

  // Content Scripts - 只注入 duck.ai 域名
  contentScripts: [
    {
      matches: ['https://duck.ai/*'],
      entries: ['entrypoints/content/main.ts'],
    },
  ],

  // Popup 入口（自定义 HTML）
  popup: 'entrypoints/popup/index.html',

  // 权限最小化
  permissions: [],

  // Web-accessible resources（如果有的话）
  webAccessibleResources: [],

  // 图标
  manifest: {
    icons: {
      48: 'icons/icon-48.png',
      96: 'icons/icon-96.png',
      128: 'icons/icon-128.png',
    },
  },

  // 构建产物输出到当前目录
  outDir: './dist',
});
