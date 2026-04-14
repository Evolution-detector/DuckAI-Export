/**
 * DuckAI-Export - 共享工具函数
 */

import type { ImageMap, ChatImage } from '../utils/types';

// DEBUG 模式：设为 true 时会输出详细日志
const DEBUG = true;
function log(...args: unknown[]): void {
  if (DEBUG) console.log('[DuckAI-Export]', ...args);
}

/**
 * 统一将时间值转换为 Date 对象
 * 兼容：Unix 毫秒数、Unix 秒数、ISO 字符串、Date 对象、"Date ..." 字符串
 * 以及包含 getTime() 方法的 Date-like 对象
 */
function toDate(value: unknown): Date {
  if (value === undefined || value === null) return new Date(0);

  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms);
  }

  if (typeof value === 'string') {
    if (value.startsWith('{') || value.startsWith('[')) {
      try { return toDate(JSON.parse(value)); } catch { return new Date(0); }
    }
    const dateStrMatch = value.match(/^Date\s+(.+?)\s*\(/);
    if (dateStrMatch) {
      const parsed = new Date(dateStrMatch[1]);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
    return new Date(0);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof (obj as { getTime?: () => number }).getTime === 'function') {
      return new Date((obj as { getTime: () => number }).getTime());
    }
    const timeFields = ['timestamp', 'time', 'date', 'valueOf', 'value'];
    for (const field of timeFields) {
      if (obj[field] !== undefined) {
        const result = toDate(obj[field]);
        if (result.getTime() > 0) return result;
      }
    }
    return new Date(0);
  }

  return new Date(0);
}

/**
 * 从消息中提取所有附件（含图片和文件）及其元数据
 * 返回格式: [{ id, mimeType, filename? }]
 *
 * 支持格式（来自 IndexedDB 原始数据）：
 * - content.images: [{ type: "image", mimeType: "image/png", filename?: "...", savedData: { id: "uuid" } }]
 * - content.files:  [{ type: "file",  mimeType: "application/pdf", filename: "...pdf", id: "uuid" }]
 * - parts:          [{ type: "generated-image", savedData: { id: "uuid" }, format: "jpeg" }]
 *   （AI 生成图片，UUID 在 savedData.id，格式在 format 字段）
 */
interface AttachmentRef {
  id: string;
  mimeType: string;
  filename?: string;
}

function extractMessageAttachments(msg: Record<string, unknown>): AttachmentRef[] {
  const refs: AttachmentRef[] = [];

  // content.images / content.files 分支（仅当 content 是对象时）
  if (msg.content && typeof msg.content === 'object') {
    const content = msg.content as Record<string, unknown>;

    // content.images 数组（图片类型附件）
    if (Array.isArray(content.images)) {
      for (const item of content.images as Array<Record<string, unknown>>) {
        if (!item.savedData || typeof item.savedData !== 'object') continue;
        const savedData = item.savedData as Record<string, unknown>;
        if (typeof savedData.id !== 'string') continue;
        refs.push({
          id: savedData.id,
          mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'image/png',
          filename: typeof item.filename === 'string' ? item.filename : undefined,
        });
      }
    }

    // content.files 数组（文件类型附件，如 PDF）
    // 注意：PDF/文档的 UUID 在 savedData.id 中，而不是 item.id
    if (Array.isArray(content.files)) {
      for (const item of content.files as Array<Record<string, unknown>>) {
        if (item.type !== 'file') continue;
        let uuid: string | undefined;
        // 先尝试 item.savedData.id（PDF/文档格式）
        if (item.savedData && typeof item.savedData === 'object') {
          const sd = item.savedData as Record<string, unknown>;
          if (typeof sd.id === 'string') uuid = sd.id;
        }
        // 回退到顶层 item.id（如果有）
        if (!uuid && typeof item.id === 'string') uuid = item.id;
        if (!uuid) continue;
        refs.push({
          id: uuid,
          mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'application/octet-stream',
          filename: typeof item.filename === 'string' ? item.filename : undefined,
        });
      }
    }
  }

  // parts 数组（AI 生成图片：type = "generated-image"）
  // 重要：此分支独立于 content 检查，即使 content 不存在也要执行
  const parts = msg.parts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (part.type === 'generated-image') {
        const savedData = part.savedData as Record<string, unknown> | undefined;
        if (savedData && typeof savedData.id === 'string') {
          const format = typeof part.format === 'string' ? part.format : 'jpeg';
          refs.push({ id: savedData.id, mimeType: `image/${format.replace(/^image\//, '')}` });
          log(`[AI 生图] ${savedData.id}`);
        }
      }
    }
  }

  log(`[attach] ${refs.length} 个附件`);
  return refs;
}

/**
 * 从消息对象中提取纯文本内容
 * 支持格式：
 * 1. { content: "字符串" }
 * 2. { content: { text: "..." } }
 * 3. { parts: [{ type: "text", text: "..." }] }
 * 4. { content: { text: "..." }, ... } - 同时有 content 和 parts
 * 5. { parts: [{ type: "generated-image", ... }] } - AI 生成图片（无文本时返回空字符串，图片由 chatToMarkdown 嵌入 Markdown）
 */
export function extractMessageContent(msg: unknown): string {
  if (!msg || typeof msg !== 'object') {
    return '[无效消息]';
  }

  const m = msg as Record<string, unknown>;
  const parts = m.parts as Array<Record<string, unknown>> | undefined;

  // 优先从 content.text 提取
  if (m.content && typeof m.content === 'object') {
    const content = m.content as Record<string, unknown>;
    if (typeof content.text === 'string' && content.text.length > 0) {
      return content.text;
    }
  }

  // AI 回复：从 parts 提取文本
  if (Array.isArray(parts)) {
    // 先检查 parts 组成
    let textParts: string[] = [];
    let hasGeneratedImage = false;
    for (const part of parts) {
      if (part.type === 'text' && typeof part.text === 'string' && part.text.length > 0) {
        textParts.push(part.text);
      }
      if (part.type === 'generated-image') {
        hasGeneratedImage = true;
      }
    }
    // 如果有文本片段（可能同时有 generated-image）
    if (textParts.length > 0) {
      return textParts.join('\n');
    }
    // 如果只有 generated-image，无文本 → 返回空字符串
    // 图片由调用方（chatToMarkdown）从 extractMessageAttachments 提取并嵌入 Markdown
    if (hasGeneratedImage) {
      return '';
    }
  }

  // content 本身就是字符串
  if (typeof m.content === 'string' && m.content.length > 0) {
    return m.content;
  }

  return '[此消息内容无法解析]';
}

/**
 * 检查对话是否有效（用于过滤空会话）
 */
export function isValidChat(chat: unknown): boolean {
  if (!chat || typeof chat !== 'object') return false;
  const c = chat as Record<string, unknown>;

  // 检查是否有有效标题
  const title = c.title;
  if (typeof title !== 'string' || title.trim().length === 0) {
    log('[isValidChat] 无效：标题为空');
    return false;
  }

  // 检查是否有消息
  const messages = c.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    log('[isValidChat] 无效：消息为空');
    return false;
  }

    // 检查是否有实际内容的消息（至少有一条消息有内容）
    const hasContent = messages.some(msg => {
      if (!msg || typeof msg !== 'object') return false;
      const m = msg as Record<string, unknown>;
      // 有文本 content
      if (typeof m.content === 'string' && m.content.length > 0) return true;
      // parts 中有文本 或 generated-image
      if (Array.isArray(m.parts)) {
        for (const part of m.parts as Array<Record<string, unknown>>) {
          if (typeof part.text === 'string' && part.text.length > 0) return true;
          if (part.type === 'generated-image') return true;
        }
      }
      return false;
    });

  if (!hasContent) {
    log('[isValidChat] 无效：所有消息都无内容');
    return false;
  }

  return true;
}

/**
 * 净化文件名，去除操作系统禁忌字符
 */
export function sanitizeFilename(title: unknown): string {
  const str = String(title ?? '');
  return str.replace(/[\/\\?%*:|"<>]/g, '_').trim() || '未命名会话';
}

/**
 * MIME 类型 → 文件扩展名
 * Duck.ai 支持上传多种文件类型，包括图片和 PDF 等
 */
export function mimeTypeToExt(mimeType: string): string {
  const mt = mimeType.toLowerCase();
  const map: Record<string, string> = {
    // 图片
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/tiff': 'tiff',
    'image/x-icon': 'ico',
    // 文档
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/json': 'json',
    'application/xml': 'xml',
    // Office
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    // 其他
    'application/zip': 'zip',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'video/mp4': 'mp4',
  };
  return map[mt] ?? 'bin';
}

/**
 * 判断 MIME 类型是否为图片（以 image/ 开头）
 */
export function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

/**
 * 根据 UUID 生成 Markdown 图片引用
 * 注意：图片与 Markdown 文件在同一目录，直接使用文件名
 */
export function getImageMarkdownRef(uuid: string, mimeType: string = 'image/png'): string {
  const ext = mimeTypeToExt(mimeType);
  return `![图片](${uuid}.${ext})`;
}

/**
 * 根据 UUID 生成 Markdown 非图片附件引用（PDF、Office 等）
 * 格式：> 📎 [文件名](文件名)
 * @param originalFilename 原始文件名，优先使用；否则回退到 uuid.ext
 */
export function getAttachmentMarkdownRef(
  uuid: string,
  mimeType: string,
  originalFilename?: string,
): string {
  const ext = mimeTypeToExt(mimeType);
  // 优先使用原始文件名（含扩展名），否则使用 uuid.ext
  const displayName = originalFilename ?? `${uuid}.${ext}`;
  const linkName = `${uuid}.${ext}`;
  return `> 📎 [${displayName}](${linkName})`;
}

/**
 * Date → 人类可读日期字符串（带本地时区）
 * 例如：2026/04/09 16:42 UTC+8
 */
export function formatDate(timestamp: number | string | undefined): string {
  const date = toDate(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const tz = getTimezoneString();
  return `${year}/${month}/${day} ${hour}:${minute} ${tz}`;
}

/**
 * 生成 Zip 内相对路径
 * @param titleOrFilename 如果文件名已包含 .md 后缀（如 from getFilenameWithDate），则直接使用
 * @param model 如果为 'image-generation'，在标题前加【image】
 */
export function getArchivePath(
  title: unknown,
  timestamp: number | string | undefined,
  level: 'flat' | 'year' | 'yearMonth',
  model?: string,
): string {
  const date = toDate(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const titleStr = String(title ?? '');
  const prefix = model === 'image-generation' ? '【image】' : '';

  // 如果文件名已经包含 .md 后缀（来自 getFilenameWithDate），直接使用文件名
  if (titleStr.endsWith('.md')) {
    // 已含【image】说明是 getFilenameWithDate 加的，勿重复
    const alreadyHasPrefix = titleStr.includes('【image】');
    const nameWithPrefix = alreadyHasPrefix
      ? titleStr
      : titleStr.replace(/^(\d{4}-\d{2}-\d{2}\([^)]+\)-)/, `$1${prefix}`);
    switch (level) {
      case 'flat':
        return nameWithPrefix;
      case 'year':
        return `${year}/${nameWithPrefix}`;
      case 'yearMonth':
        return `${year}/${month.toString().padStart(2, '0')}_${getMonthName(month)}/${nameWithPrefix}`;
      default:
        return `${year}/${nameWithPrefix}`;
    }
  }

  // 否则按传统方式处理（标题 + .md）
  const safeTitle = sanitizeFilename(title);

  switch (level) {
    case 'flat':
      return `${prefix}${safeTitle}.md`;
    case 'year':
      return `${year}/${prefix}${safeTitle}.md`;
    case 'yearMonth':
      return `${year}/${month.toString().padStart(2, '0')}_${getMonthName(month)}/${prefix}${safeTitle}.md`;
    default:
      return `${year}/${prefix}${safeTitle}.md`;
  }
}

function getMonthName(month: number): string {
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return names[month - 1] ?? 'Unknown';
}

/**
 * 获取当前系统时区字符串
 * 例如：UTC+8, UTC-5, UTC
 */
function getTimezoneString(): string {
  const offset = new Date().getTimezoneOffset();
  const hours = Math.abs(Math.floor(offset / 60));
  const minutes = Math.abs(offset % 60);
  const sign = offset <= 0 ? '+' : '-';
  const tz = `UTC${sign}${hours}`;
  return minutes > 0 ? `${tz}:${minutes.toString().padStart(2, '0')}` : tz;
}

/**
 * 生成带时间戳的文件名
 * 例如：会话标题-2026-04-09(UTC+8).md
 * 如果 model 为 'image-generation'，在标题前加【image】
 */
export function getFilenameWithDate(
  title: unknown,
  timestamp: number | string | undefined,
  model?: string,
): string {
  const date = toDate(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const safeTitle = sanitizeFilename(title);
  const tz = getTimezoneString();
  const prefix = model === 'image-generation' ? '【image】' : '';
  return `${year}-${month}-${day}(${tz})-${prefix}${safeTitle}.md`;
}

/**
 * 获取 Markdown 文件所在的目录路径
 * 例如：2026/04_April/对话.md → 2026/04_April/
 */
function getArchiveDir(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return path.substring(0, lastSlash + 1);
}

/**
 * 根据图片 UUID 和 Markdown 路径生成图片的 ZIP 内路径
 * 图片与 Markdown 在同一目录
 */
export function getImagePath(markdownPath: string, uuid: string, mimeType: string = 'image/png'): string {
  const dir = getArchiveDir(markdownPath);
  const ext = mimeTypeToExt(mimeType);
  return `${dir}${uuid}.${ext}`;
}

/**
 * 根据 UUID 从 imageMap 中查找图片
 */
function findImageByUuid(imageMap: ImageMap, uuid: string): ChatImage | undefined {
  for (const images of imageMap.values()) {
    for (const img of images) {
      if (img.uuid === uuid) return img;
    }
  }
  return undefined;
}

/**
 * 将对话对象转换为 Markdown 字符串
 */
export function chatToMarkdown(
  chat: {
    chatId?: string;
    title: unknown;
    createdAt?: number | string;
    updatedAt?: number | string;
    lastEdit?: number | string;
    model?: string;
    messages?: unknown[];
  },
  imageMap?: ImageMap,
): string {
  const lines: string[] = [];
  const title = sanitizeFilename(chat.title);
  const chatId = chat.chatId ?? '';

  const messages = chat.messages ?? [];

  // 获取创建时间：如果 chat.createdAt 无效，用第一条消息的 createdAt
  const firstMsg = messages[0] as Record<string, unknown> | undefined;
  const createdAt = chat.createdAt ?? firstMsg?.createdAt;

  // --- 元数据页头 ---
  lines.push('```');
  lines.push(`title: ${title}`);
  lines.push(`created: ${formatDate(createdAt)}`);
  lines.push(`updated: ${formatDate(chat.lastEdit)}`);
  lines.push(`model: ${chat.model ?? '未知'}`);
  lines.push(`messages: ${messages.length}`);
  lines.push('```');
  lines.push('');
  lines.push(`# ${title}`);
  lines.push('');

  // --- 消息轮次 ---
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;

    const m = msg as Record<string, unknown>;
    const content = extractMessageContent(msg);
    const role = String(m.role ?? 'unknown');
    const roleLabel = role === 'user'
      ? (navigator.language.startsWith('en') ? '👤 User' : '👤 用户')
      : '🤖 AI';
    const timeLabel = m.createdAt ? formatDate(m.createdAt) : '';

    lines.push(`## ${roleLabel}${timeLabel ? ` · ${timeLabel}` : ''}`);
    lines.push('');
    lines.push(content);

    // 提取该消息关联的所有附件（含图片和文件），分别处理
    const attachments = extractMessageAttachments(m);
    if (attachments.length > 0 && imageMap) {
      const imageRefs: string[] = [];
      const attachmentRefs: string[] = [];
      for (const att of attachments) {
        const img = findImageByUuid(imageMap, att.id);
        if (!img) {
          log(`[attach] ${att.id} 在 imageMap 中不存在`);
          continue;
        }
        if (isImageMime(att.mimeType)) {
          imageRefs.push(getImageMarkdownRef(img.uuid, img.mimeType));
        } else {
          attachmentRefs.push(
            getAttachmentMarkdownRef(img.uuid, img.mimeType, img.filename ?? att.filename),
          );
        }
      }
      if (imageRefs.length > 0) {
        lines.push('');
        lines.push(...imageRefs);
      }
      if (attachmentRefs.length > 0) {
        lines.push('');
        lines.push(...attachmentRefs);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
