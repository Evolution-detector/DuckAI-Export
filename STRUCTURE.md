# DuckAI-Export - Source Code Structure

[English](#english) | [中文](#中文)

---

## English

### Directory & File Overview

```
DuckAI-Export/
|--- entrypoints/          # Extension entry points
|    |--- content/         # Content script (runs on duck.ai pages)
|    |    L--- index.ts    # Core export logic: IndexedDB read + ZIP generation
|    |
|    L--- popup/           # Browser toolbar popup UI
|         L--- index.html  # Popup HTML structure
|         L--- index.ts    # Popup logic: state management, message passing
|         L--- style.css   # Popup styles
|         L--- i18n.ts     # Bilingual language pack (en/zh-CN)
|
|--- src/                  # Shared utilities
|    L--- utils/
|         L--- format.ts   # Markdown generation, filename formatting, date handling
|         L--- types.ts   # TypeScript type definitions
|
|--- icons/                # Extension icons (SVG source + PNG)
|
|--- public/               # Static resources (copied to build output)
|
|--- _locales/             # i18n language files
|    |--- en/messages.json # English
|    L--- zh-CN/messages.json # Simplified Chinese
|
|--- extension/             # Legacy V1.0 manifest (reference only)
|
|--- wxt.config.ts         # WXT framework config (manifest template)
|
|--- post-build.cjs         # Post-build processor (removes gecko fields for Chrome/Edge)
|
|--- package.json           # Dependencies: wxt, idb, fflate
|
|--- tsconfig.json          # TypeScript compiler config
|
|--- README.md              # Project documentation (bilingual)
|
|--- build scripts (*.bat, *.py)  # Convenience scripts for building
```

### Build Order

```
1. npm install              # Install dependencies (wxt, idb, fflate)
       |
       v
2. npm run build            # Build Firefox version
   or
   npm run build:chrome     # Build Chrome/Edge version
       |
       v
3. node post-build.cjs      # For Chrome/Edge only:
   (chrome | firefox)       # - Remove gecko fields
                            # - Add tabs permission
                            # - Copy _locales to dist
       |
       v
4. Load extension           # In browser developer mode
```

### Code Flow

```
User clicks extension icon
       |
       v
┌─────────────────────────────┐
│  Popup (entrypoints/popup/) │
│  - Detects current tab      │
│  - Sends message to content  │
│  - Shows progress UI        │
└────────────┬────────────────┘
             │ browser.runtime.sendMessage
             v
┌─────────────────────────────┐
│ Content Script              │
│ (entrypoints/content/)      │
│  - Opens IndexedDB          │
│  - Reads saved-chats store  │
│  - Reads chat-images store  │
│  - Generates Markdown       │
│  - Creates ZIP with fflate  │
│  - Triggers download        │
└─────────────────────────────┘
```

### Key Type Definitions

| Type | Location | Purpose |
|------|----------|---------|
| `SavedChat` | `src/utils/types.ts` | Chat data structure from IndexedDB |
| `ChatImage` | `src/utils/types.ts` | Image/attachment data (uuid, data: Uint8Array) |
| `ImageMap` | `src/utils/types.ts` | Map<chatId, ChatImage[]> |
| `ExportSettings` | `src/utils/types.ts` | User preferences (includeImages, archiveLevel) |

### Shared Utilities

| Function | Location | Purpose |
|----------|----------|---------|
| `chatToMarkdown()` | `src/utils/format.ts` | Convert SavedChat to Markdown string |
| `getFilenameWithDate()` | `src/utils/format.ts` | Generate dated filename: `YYYY-MM-DD(UTC±N)-title.md` |
| `getArchivePath()` | `src/utils/format.ts` | Generate ZIP internal path (flat/year/yearMonth) |
| `extractMessageContent()` | `src/utils/format.ts` | Extract text from message (content.text or parts) |
| `extractMessageAttachments()` | `src/utils/format.ts` | Extract attachment UUIDs (images, PDFs, etc.) |
| `toDate()` | `src/utils/format.ts` | Parse various timestamp formats |

### Browser Compatibility

All three browsers use **identical source code**. Differences are handled by:

| Browser | Config Location | Notes |
|---------|----------------|-------|
| Firefox | `wxt.config.ts` | Default target, includes gecko fields |
| Chrome/Edge | `post-build.cjs` | Removes gecko fields, adds tabs permission |

---

## 中文

### 目录与文件说明

```
DuckAI-Export/
|--- entrypoints/          # 扩展入口点
|    |--- content/         # Content Script（运行在 duck.ai 页面）
|    |    L--- index.ts    # 核心导出逻辑：IndexedDB 读取 + ZIP 生成
|    |
|    L--- popup/           # 浏览器工具栏弹出 UI
|         L--- index.html  # Popup HTML 结构
|         L--- index.ts    # Popup 逻辑：状态管理、消息传递
|         L--- style.css   # Popup 样式
|         L--- i18n.ts     # 中英双语语言包
|
|--- src/                  # 共享工具库
|    L--- utils/
|         L--- format.ts   # Markdown 生成、文件名格式化、日期处理
|         L--- types.ts   # TypeScript 类型定义
|
|--- icons/                # 扩展图标（SVG 源文件 + PNG）
|
|--- public/               # 静态资源（复制到构建产物）
|
|--- _locales/             # 国际化语言文件
|    |--- en/messages.json # 英文
|    L--- zh-CN/messages.json # 简体中文
|
|--- extension/            # 旧版 V1.0 manifest（仅供参考）
|
|--- wxt.config.ts         # WXT 框架配置（manifest 模板）
|
|--- post-build.cjs         # 构建后处理器（Chrome/Edge 移除 gecko 字段）
|
|--- package.json           # 依赖：wxt, idb, fflate
|
|--- tsconfig.json          # TypeScript 编译配置
|
|--- README.md              # 项目说明文档（中英双语）
|
|--- 构建脚本 (*.bat, *.py) # 便捷构建脚本
```

### 构建顺序

```
1. npm install              # 安装依赖（wxt, idb, fflate）
       |
       v
2. npm run build            # 构建 Firefox 版本
   或
   npm run build:chrome     # 构建 Chrome/Edge 版本
       |
       v
3. node post-build.cjs      # 仅 Chrome/Edge 需要：
   (chrome | firefox)       # - 移除 gecko 字段
                            # - 添加 tabs 权限
                            # - 复制 _locales 到 dist
       |
       v
4. 加载扩展                 # 在浏览器开发者模式中加载
```

### 代码流程

```
用户点击扩展图标
       |
       v
┌─────────────────────────────┐
│  Popup (entrypoints/popup/) │
│  - 检测当前标签页            │
│  - 向 content script 发送消息│
│  - 显示进度 UI              │
└────────────┬────────────────┘
             │ browser.runtime.sendMessage
             v
┌─────────────────────────────┐
│ Content Script             │
│ (entrypoints/content/)     │
│  - 打开 IndexedDB           │
│  - 读取 saved-chats store  │
│  - 读取 chat-images store  │
│  - 生成 Markdown            │
│  - 使用 fflate 创建 ZIP     │
│  - 触发下载                 │
└─────────────────────────────┘
```

### 关键类型定义

| 类型 | 位置 | 用途 |
|------|------|------|
| `SavedChat` | `src/utils/types.ts` | IndexedDB 中的对话数据结构 |
| `ChatImage` | `src/utils/types.ts` | 图片/附件数据（uuid, data: Uint8Array） |
| `ImageMap` | `src/utils/types.ts` | Map<chatId, ChatImage[]> |
| `ExportSettings` | `src/utils/types.ts` | 用户设置（includeImages, archiveLevel） |

### 共享工具函数

| 函数 | 位置 | 用途 |
|------|------|------|
| `chatToMarkdown()` | `src/utils/format.ts` | 将 SavedChat 转换为 Markdown 字符串 |
| `getFilenameWithDate()` | `src/utils/format.ts` | 生成带日期的文件名：`YYYY-MM-DD(UTC±N)-标题.md` |
| `getArchivePath()` | `src/utils/format.ts` | 生成 ZIP 内部路径（flat/year/yearMonth） |
| `extractMessageContent()` | `src/utils/format.ts` | 从消息中提取文本（content.text 或 parts） |
| `extractMessageAttachments()` | `src/utils/format.ts` | 提取附件 UUID（图片、PDF 等） |
| `toDate()` | `src/utils/format.ts` | 解析各种时间戳格式 |

### 浏览器兼容性

三款浏览器使用**完全相同的源码**，差异由以下机制处理：

| 浏览器 | 配置位置 | 说明 |
|--------|----------|------|
| Firefox | `wxt.config.ts` | 默认构建目标，包含 gecko 字段 |
| Chrome/Edge | `post-build.cjs` | 移除 gecko 字段，添加 tabs 权限 |
