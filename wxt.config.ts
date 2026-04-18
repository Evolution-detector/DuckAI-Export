import { defineConfig } from 'wxt';

export default defineConfig({
  // 扩展基本信息
  languages: ['en', 'zh-CN'],
  defaultLanguage: 'en',

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

  // 权限最小化（Chrome/Edge 需要 tabs，Firefox 由 gecko 设置覆盖）
  permissions: ['tabs'],

  // Web-accessible resources（如果有的话）
  webAccessibleResources: [],

  // 图标 & 扩展信息（Chrome/Edge 必须用 __MSG_ 占位符才能多语言）
  manifest: {
    version: '1.1.1',
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    icons: {
      48: 'icons/icon-48.png',
      96: 'icons/icon-96.png',
      128: 'icons/icon-128.png',
    },
    // Firefox MV3 上架必需
    browser_specific_settings: {
      gecko: {
        id: 'duckai-export@yourdomain.example',
        // 声明不收集任何数据（必需）
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },

  // 构建产物输出到当前目录
  outDir: './dist',
});
