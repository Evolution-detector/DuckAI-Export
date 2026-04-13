/**
 * DuckAI Export - 国际化模块
 * 根据浏览器 UI 语言自动切换中/英文
 */

export type Lang = 'zh' | 'en';

export interface Messages {
  // 状态栏
  statusConnecting: string;
  statusConnected: string;
  statusErrorNoData: string;
  statusErrorNotDuckAi: string;
  statusErrorLoadFailed: string;
  statusExportFailed: (msg: string) => string;

  // 隐私角标
  privacyBadge: string;
  privacyBadgeTitle: string;

  // 数据大盘
  statsLabel: string;

  // 按钮
  btnExportAll: string;
  btnExportSingle: string;

  // 进度
  stepWaiting: string;
  stepReadingData: string;
  stepIndexing: string;
  stepExportingCurrent: string;

  // 设置面板
  settingsToggle: string;
  settingIncludeImages: string;
  settingIncludeImagesHint: string;
  settingArchiveLabel: string;
  archiveFlat: string;
  archiveYear: string;
  archiveYearMonth: string;

  // 底部
  successHint: string;
  githubLink: string;
  githubLinkTitle: string;
}

const zh: Messages = {
  statusConnecting: '正在连接...',
  statusConnected: '已连接本地数据库',
  statusErrorNoData: '未检测到 Duck.ai 数据',
  statusErrorNotDuckAi: '请在 duck.ai 页面使用本扩展',
  statusErrorLoadFailed: '读取数据失败，请刷新页面重试',
  statusExportFailed: (msg) => `导出失败: ${msg}`,

  privacyBadge: '隐私安全',
  privacyBadgeTitle: '数据仅在本地处理，不会上传任何服务器',

  statsLabel: '个对话主题',

  btnExportAll: '全量打包导出 (ZIP)',
  btnExportSingle: '导出最近对话 (MD/ZIP)',

  stepWaiting: '等待中...',
  stepReadingData: '正在读取数据...',
  stepIndexing: '正在索引本地数据...',
  stepExportingCurrent: '正在导出当前会话...',

  settingsToggle: '⚙️ 选项设置',
  settingIncludeImages: '包含图片资源',
  settingIncludeImagesHint: '关闭可大幅提升速度并减小体积',
  settingArchiveLabel: '全量导出归档模式',
  archiveFlat: '平铺式',
  archiveYear: '按年份',
  archiveYearMonth: '按年月',

  successHint: '导出成功，请在浏览器下载记录中查看',
  githubLink: '看源码点亮⭐',
  githubLinkTitle: '查看源码',
};

const en: Messages = {
  statusConnecting: 'Connecting...',
  statusConnected: 'Local database connected',
  statusErrorNoData: 'No Duck.ai data detected',
  statusErrorNotDuckAi: 'Please use this extension on duck.ai',
  statusErrorLoadFailed: 'Failed to load data, please refresh the page',
  statusExportFailed: (msg) => `Export failed: ${msg}`,

  privacyBadge: 'Privacy Safe',
  privacyBadgeTitle: 'Data is processed locally only — never uploaded',

  statsLabel: 'conversation(s)',

  btnExportAll: 'Export All Chats (ZIP)',
  btnExportSingle: 'Export Latest Chat (MD/ZIP)',

  stepWaiting: 'Waiting...',
  stepReadingData: 'Reading data...',
  stepIndexing: 'Indexing local data...',
  stepExportingCurrent: 'Exporting current chat...',

  settingsToggle: '⚙️ Options',
  settingIncludeImages: 'Include images',
  settingIncludeImagesHint: 'Disable to speed up export and reduce size',
  settingArchiveLabel: 'Archive structure',
  archiveFlat: 'Flat',
  archiveYear: 'By year',
  archiveYearMonth: 'By year/month',

  successHint: 'Export complete — check your browser downloads',
  githubLink: 'Star on GitHub ⭐',
  githubLinkTitle: 'View source code',
};

/** 检测浏览器 UI 语言，返回 'zh' 或 'en' */
export function detectLang(): Lang {
  const lang = (navigator.language || '').toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

/** 返回当前语言的翻译包 */
export function getMessages(): Messages {
  return detectLang() === 'zh' ? zh : en;
}
