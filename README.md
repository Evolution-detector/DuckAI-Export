# DuckAI-Export

> Firefox 扩展：将 Duck.ai 对话完整导出为 Markdown + 附件 ZIP

## 功能

- **导出范围**：全量导出（所有对话）/ 单个导出（当前对话）
- **格式**：ZIP 压缩包，内含 Markdown 文件 + 所有附件（图片、PDF 等）
- **Markdown 内容**：
  - 标题、时间戳、模型信息
  - 用户/AI 对话内容
  - 嵌入图片：`![图片](uuid.png)`
  - 附件引用：`> 📎 [原始文件名](uuid.ext)`
- **文件名**：`YYYY-MM-DD(UTC±N)-会话名称.md`，按时间排序
- **存储**：从 IndexedDB（`savedAIChatData`）读取，附件以原始格式保存
- **多语言**：自动检测浏览器语言，支持中文和英文界面

## 系统要求

- Firefox 120+
- Node.js（构建时需要）

## 构建

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 生产构建（Firefox MV3）
npm run build

# 构建产物位于 dist/firefox-mv3/
```

## 安装扩展

1. Firefox 地址栏输入 `about:debugging#/runtime/this-firefox`
2. 点击【加载临时附加组件】
3. 选择 `dist/firefox-mv3/` 目录

## 使用

1. 在 duck.ai 打开任意对话页面
2. 点击工具栏扩展图标
3. 选择【导出当前会话】或【导出所有会话】
4. ZIP 文件自动下载

## 项目结构

```
├── entrypoints/
│   ├── content/
│   │   └── index.ts      # Content Script：IndexedDB 读写 + ZIP 生成
│   └── popup/
│       ├── index.ts      # Popup 主入口
│       ├── index.html    # Popup UI
│       ├── style.css     # 样式
│       └── i18n.ts       # 中英双语语言包
├── src/
│   └── utils/
│       ├── format.ts      # Markdown 生成、文件名格式化
│       └── types.ts      # 类型定义
├── icons/                # 扩展图标
├── wxt.config.ts         # WXT 配置
├── tsconfig.json
└── package.json
```

## 技术栈

- **框架**：WXT 0.20.x（Firefox MV3）
- **数据库**：IndexedDB（idb 封装）
- **压缩**：fflate（纯 JS ZIP，无 Native 依赖）
- **语言**：TypeScript
