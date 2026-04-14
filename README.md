# DuckAI-Export

[English](#english) | [中文](#中文)

---

## English

> Browser extension: Export full Duck.ai conversations to Markdown with attachments as ZIP

### Features

- **Export scope**: All conversations or current conversation only
- **Output format**: ZIP containing Markdown files + all attachments (images, PDFs, etc.)
- **Markdown content**:
  - Title, timestamps, model info
  - User / AI dialogue with inline images
  - AI-generated images: filename prefixed with `【image】`
  - Non-image attachments
- **Naming**: `YYYY-MM-DD(UTC±N)-chat-title.md`, sorted by date
- **i18n**: Auto-detects browser language
  - Chinese: `👤 用户` / `🤖 AI`
  - English: `👤 User` / `🤖 AI`

### Supported Browsers

| Browser         | Status   | Notes                                  |
| --------------- | -------- | -------------------------------------- |
| Firefox 120+    | ✅ Stable | Upload to Firefox Add-ons              |
| Edge (Chromium) | ✅ Stable | Upload to Edge Add-ons                 |
| Chrome          | ✅ Stable | Developer mode only (no Web Store yet) |

> All three browsers share **100% identical source code**. The only differences are in the built `manifest.json`.

### Prerequisites

- Node.js 18+ (for building)
- Git (optional, for cloning)

### Quick Start

```bash
# Clone or download the source
git clone <repo-url>
cd DuckAI-Export

# Install dependencies
npm install

# Build for Firefox  ← produces dist/firefox-mv3/
npm run build

# Build for Chrome/Edge  ← produces dist/chrome-mv3/ + EdgeVersion/
npm run build:chrome
```

### Detailed Build Instructions

#### Firefox

```bash
npm run build
# Output: dist/firefox-mv3/
```

#### Edge / Chrome

```bash
# 1. Build Chrome target
npm run build:chrome

# 2. Post-process: remove gecko fields, add tabs permission
node post-build.cjs chrome

# 3. The processed build is in dist/chrome-mv3/
#    Copy to EdgeVersion/ for easy management
```

### Loading Extension Locally

#### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `dist/firefox-mv3/manifest.json`

#### Edge / Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `dist/chrome-mv3/`

### Usage

1. Open any conversation page on duck.ai
2. Click the extension icon in the toolbar
3. Choose **Export Current Chat** or **Export All Chats**
4. ZIP file downloads automatically

### Project Structure

```
DuckAI-Export/
├── entrypoints/
│   ├── content/
│   │   └── index.ts          # Content Script: IndexedDB read + ZIP generation
│   └── popup/
│       ├── index.ts          # Popup entry
│       ├── index.html        # Popup UI
│       ├── style.css         # Styles
│       └── i18n.ts           # Bilingual language pack
├── src/
│   └── utils/
│       ├── format.ts         # Markdown generation, filename formatting
│       └── types.ts          # TypeScript type definitions
├── icons/                    # Extension icons (SVG source + PNG)
├── public/                  # Static resources
├── wxt.config.ts            # WXT framework config (browser-specific manifest)
├── post-build.cjs           # Post-build script (removes gecko fields for Chrome/Edge)
├── tsconfig.json
└── package.json
```

### How Manifest Differences Work

The source code is identical across all browsers. WXT automatically generates a different `manifest.json` per build target from `wxt.config.ts`:

| Browser     | manifest.json differences                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Firefox     | Includes `browser_specific_settings.gecko` with extension ID + `data_collection_permissions: { required: ["none"] }` |
| Chrome/Edge | Excludes gecko fields, includes `tabs` permission                                                                    |

The `post-build.cjs` script then removes any residual gecko fields after Chrome/Edge builds.

### Tech Stack

- **Framework**: [WXT](https://wxt.dev) 0.20.x (MV3 cross-browser support)
- **Database**: IndexedDB via [idb](https://github.com/jakearchibald/idb)
- **Compression**: [fflate](https://github.com/101arrowz/fflate) (pure JS ZIP, no native deps)
- **Language**: TypeScript

---

## 中文

> 浏览器扩展：将 Duck.ai 对话完整导出为 Markdown + 附件 ZIP

### 功能

- **导出范围**：全量导出（所有对话）或单个导出（当前对话）
- **输出格式**：ZIP 压缩包，内含 Markdown 文件 + 所有附件（图片、PDF 等）
- **Markdown 内容**：
  - 标题、时间戳、模型信息
  - 用户 / AI 对话内容，图片直接嵌入
  - AI 生成图片：文件名自动加【image】前缀
  - 非图片附件
- **命名规则**：`YYYY-MM-DD(UTC±N)-会话名称.md`，按日期排序
- **国际化**：自动检测浏览器语言
  - 中文：`👤 用户` / `🤖 AI`
  - 英文：`👤 User` / `🤖 AI`

### 支持的浏览器

| 浏览器             | 状态   | 说明                 |
| --------------- | ---- | ------------------ |
| Firefox 120+    | ✅ 稳定 | 上架 Firefox Add-ons |
| Edge (Chromium) | ✅ 稳定 | 上架 Edge 加载项        |
| Chrome          | ✅ 稳定 | 仅开发者模式加载（暂未上架）     |

> 三款浏览器**源码 100% 相同**，差异仅在构建后的 `manifest.json`。

### 前置要求

- Node.js 18+
- Git（可选，用于克隆）

### 快速开始

```bash
# 克隆或下载源码
git clone <repo-url>
cd DuckAI-Export

# 安装依赖
npm install

# 构建 Firefox 版本  ← 输出到 dist/firefox-mv3/
npm run build

# 构建 Chrome/Edge 版本  ← 输出到 dist/chrome-mv3/ + EdgeVersion/
npm run build:chrome
```

### 详细构建说明

#### Firefox

```bash
npm run build
# 输出目录：dist/firefox-mv3/
```

#### Edge / Chrome

```bash
# 1. 构建 Chrome 目标
npm run build:chrome

# 2. 后处理：移除 gecko 字段，添加 tabs 权限
node post-build.cjs chrome

# 3. 构建产物位于 dist/chrome-mv3/
#    可复制到 EdgeVersion/ 便于管理
```

### 本地加载扩展

#### Firefox

1. 地址栏输入 `about:debugging#/runtime/this-firefox`
2. 点击**加载临时附加组件**
3. 选择 `dist/firefox-mv3/manifest.json`

#### Edge / Chrome

1. 打开 `chrome://extensions/`
2. 开启右上角**开发者模式**
3. 点击**加载解压的扩展程序**
4. 选择 `dist/chrome-mv3/`

### 使用方法

1. 在 duck.ai 打开任意对话页面
2. 点击工具栏扩展图标
3. 选择【导出当前会话】或【导出所有会话】
4. ZIP 文件自动下载

### 项目结构

```
DuckAI-Export/
├── entrypoints/
│   ├── content/
│   │   └── index.ts          # Content Script：IndexedDB 读写 + ZIP 生成
│   └── popup/
│       ├── index.ts          # Popup 主入口
│       ├── index.html        # Popup UI
│       ├── style.css         # 样式
│       └── i18n.ts           # 中英双语语言包
├── src/
│   └── utils/
│       ├── format.ts         # Markdown 生成、文件名格式化
│       └── types.ts          # TypeScript 类型定义
├── icons/                    # 扩展图标（SVG 源文件 + PNG）
├── public/                   # 静态资源
├── wxt.config.ts             # WXT 框架配置（浏览器差异化 manifest）
├── post-build.cjs            # 构建后脚本（移除 Chrome/Edge 的 gecko 字段）
├── tsconfig.json
└── package.json
```

### manifest.json 差异原理

三款浏览器的源码完全相同，由 WXT 根据 `wxt.config.ts` 自动为不同构建目标生成不同的 `manifest.json`：

| 浏览器         | manifest.json 差异                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Firefox     | 包含 `browser_specific_settings.gecko`（扩展 ID + `data_collection_permissions: { required: ["none"] }`） |
| Chrome/Edge | 不含 gecko 字段，包含 `tabs` 权限                                                                            |

`post-build.cjs` 脚本在 Chrome/Edge 构建后二次清理残留的 gecko 字段。

### 技术栈

- **框架**：[WXT](https://wxt.dev) 0.20.x（MV3 跨浏览器支持）
- **数据库**：IndexedDB（[idb](https://github.com/jakearchibald/idb) 封装）
- **压缩**：[fflate](https://github.com/101arrowz/fflate)（纯 JS ZIP，无 Native 依赖）
- **语言**：TypeScript
