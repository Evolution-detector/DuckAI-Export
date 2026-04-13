/**
 * DuckAI-Export - 共享类型定义
 * 被 Content Script 和 Popup 共用
 */

/** Duck.ai saved-chats 表中的对话数据结构 */
export interface SavedChat {
  chatId: string;              // 对话 ID（原名 id）
  title: string;
  model?: string;
  createdAt: number | string;    // 可能是 Unix 毫秒数或 ISO 字符串
  updatedAt: number | string;
  messages: ChatMessage[];
  status?: string;
  pinned?: boolean;
  metadata?: Record<string, unknown>;
}

/** 单条消息 */
export interface ChatMessage {
  // 标识字段
  messageId?: string;           // 优先用这个
  id?: string;

  // 角色
  role: 'user' | 'assistant';

  // 用户消息直接用 content
  content?: string;

  // AI 回复用 parts 数组
  parts?: Array<{
    type?: string;
    text?: string;
    url?: string;              // 图片 URL
  }>;

  // 时间戳
  createdAt?: number | string;

  // AI 回复额外字段
  model?: string;
  status?: string;
  origin?: string;
  generationTimestamp?: number;

  // 图片 UUID 列表（如果有）
  imageIds?: string[];
}

/** 图片/附件数据结构 */
export interface ChatImage {
  uuid: string;
  chatId: string;
  /** 已解码为当前 realm 的原始字节，避免 Firefox 跨域 Blob 问题 */
  data: Uint8Array;
  mimeType: string;
  /** 原始文件名（如 PDF 上传时的文件名），可选 */
  filename?: string;
}

/** 图片映射类型 */
export type ImageMap = Map<string, ChatImage[]>;

/** 用户设置 */
export interface ExportSettings {
  includeImages: boolean;       // 是否包含图片
  archiveLevel: 'flat' | 'year' | 'yearMonth'; // 归档层级
}

/** 进度回调类型 */
export type ProgressCallback = (step: string, current: number, total: number) => void;
