/**
 * DuckAI-Export - 核心导出逻辑
 * 运行于 duck.ai 页面上下文的 Content Script
 *
 * 架构原则：
 * 1. 所有数据处理在 Content Script 中完成（不依赖 Background）
 * 2. IndexedDB 只读访问（readonly 事务）
 * 3. 图片使用 Cursor 分页 + fflate 流式写入，内存恒定
 * 4. 数据库句柄用完立即关闭
 */

import { openDB, type IDBPDatabase } from 'idb';
import { Zip, ZipDeflate, strToU8 } from 'fflate';

// ============================================================
// 类型定义
// ============================================================

/** Duck.ai saved-chats 表中的对话数据结构 */
interface SavedChat {
  id: string;
  title: string;
  model?: string;
  createdAt: number;       // Unix 时间戳（毫秒）
  updatedAt: number;
  messages: ChatMessage[];
}

/** 单条消息 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;        // 主要字段
  parts?: Array<{ text?: string }>; // 备用字段
  createdAt?: number;
  model?: string;           // AI 回复中可能携带模型信息
}

/** 用户设置 */
interface ExportSettings {
  includeImages: boolean;  // 是否包含图片
  archiveLevel: 'flat' | 'year' | 'yearMonth'; // 归档层级
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 从消息对象中提取纯文本内容
 * 兼容两种字段格式，并处理 Schema 变更
 */
export function extractMessageContent(msg: ChatMessage): string {
  if (msg.content && typeof msg.content === 'string') {
    return msg.content;
  }
  if (Array.isArray(msg.parts)) {
    const parts = msg.parts
      .filter(p => p && typeof p === 'object' && 'text' in p && p.text)
      .map(p => (p as { text: string }).text);
    if (parts.length > 0) return parts.join('');
  }
  // Schema 异常，降级提示（而非静默跳过）
  console.warn('[DuckAI-Export] 消息格式无法识别，已跳过该消息内容。字段：', Object.keys(msg));
  return '[此消息因数据格式变更无法解析]';
}

/**
 * 净化文件名，去除操作系统禁忌字符
 * 只处理文件名，不影响 Markdown 正文内容
 */
export function sanitizeFilename(title: string): string {
  return title.replace(/[\/\\?%*:|"<>]/g, '_').trim() || '未命名会话';
}

/**
 * Unix 时间戳 → 人类可读日期字符串
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 生成 Zip 内相对路径
 */
export function getArchivePath(title: string, timestamp: number, level: ExportSettings['archiveLevel']): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const safeTitle = sanitizeFilename(title);

  switch (level) {
    case 'flat':
      return `${safeTitle}.md`;
    case 'year':
      return `${year}/${safeTitle}.md`;
    case 'yearMonth':
      return `${year}/${month.toString().padStart(2, '0')}_${getMonthName(month)}/${safeTitle}.md`;
    default:
      return `${year}/${safeTitle}.md`;
  }
}

function getMonthName(month: number): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return names[month - 1] ?? 'Unknown';
}

// ============================================================
// 核心导出类
// ============================================================

/** IndexedDB 数据库名称和版本 */
const DB_NAME = 'savedAIChatData';
const DB_VERSION = 1;
const STORE_CHATS = 'saved-chats';
const STORE_IMAGES = 'chat-images';

/** 进度回调类型 */
export type ProgressCallback = (step: string, current: number, total: number) => void;

/**
 * 导出管理器
 * 负责从 IndexedDB 读取数据 → 转换为 Markdown → 流式写入 ZIP
 */
export class ExportManager {
  private db: IDBPDatabase | null = null;
  private settings: ExportSettings;
  private onProgress: ProgressCallback;

  constructor(settings: ExportSettings, onProgress: ProgressCallback) {
    this.settings = settings;
    this.onProgress = onProgress;
  }

  /** 打开数据库连接 */
  private async connect(): Promise<IDBPDatabase> {
    if (this.db) return this.db;
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 不做写入，只读场景不需要 upgrade 回调
      },
    });
    return this.db;
  }

  /** 关闭数据库连接，释放句柄 */
  private async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 获取对话总数（用于展示大盘数据）
   */
  async getChatCount(): Promise<number> {
    const db = await this.connect();
    const tx = db.transaction(STORE_CHATS, 'readonly');
    const count = await tx.objectStore(STORE_CHATS).count();
    await tx.done;
    return count;
  }

  /**
   * 导出单个对话 → 返回 .md Blob
   */
  async exportSingleChat(chatId: string): Promise<Blob> {
    const db = await this.connect();
    const tx = db.transaction(STORE_CHATS, 'readonly');
    const chat = await tx.objectStore(STORE_CHATS).get(chatId) as SavedChat | undefined;
    await tx.done;
    await this.close();

    if (!chat) throw new Error(`未找到 ID 为 ${chatId} 的对话`);

    const md = this.chatToMarkdown(chat);
    return new Blob([md], { type: 'text/markdown;charset=utf-8' });
  }

  /**
   * 全量打包导出 → 返回 ZIP Blob
   */
  async exportAll(settings: ExportSettings): Promise<Blob> {
    const db = await this.connect();

    // ---------- Step 1: 读取所有对话 ----------
    this.onProgress('正在索引本地数据...', 0, 100);

    const tx = db.transaction(STORE_CHATS, 'readonly');
    const allChats = await tx.objectStore(STORE_CHATS).getAll() as SavedChat[];
    await tx.done;

    if (allChats.length === 0) {
      await this.close();
      throw new Error('没有找到任何对话记录');
    }

    // ---------- Step 2: 构建 ZIP（流式） ----------
    const chunks: Uint8Array[] = [];
    let processedCount = 0;
    const total = allChats.length;

    const zip = new Zip((err, chunk, isFinal) => {
      if (err) {
        console.error('[DuckAI-Export] ZIP 流错误:', err);
        return;
      }
      chunks.push(chunk);
      if (isFinal) {
        // ZIP 流结束，触发下载
        const zipBlob = new Blob(chunks, { type: 'application/zip' });
        this.triggerDownload(zipBlob, 'DuckAI-Export-Full.zip');
      }
    });

    // 逐对话写入 Markdown
    for (const chat of allChats) {
      const md = this.chatToMarkdown(chat);
      const path = getArchivePath(chat.title, chat.createdAt, settings.archiveLevel);
      const deflate = new ZipDeflate(path, { level: 6 });
      zip.add(deflate);
      deflate.push(strToU8(md), true); // true = 该文件结束

      processedCount++;
      this.onProgress(`正在处理对话 (${processedCount}/${total})`, processedCount, total);
    }

    // ---------- Step 3: 如果包含图片，流式写入图片 ----------
    if (settings.includeImages) {
      await this.streamImagesToZip(db, zip, allChats);
    }

    // 关闭 ZIP
    zip.end();
    await this.close();
    // Blob 已在 zip 回调中通过 triggerDownload 发出
    return new Blob(chunks, { type: 'application/zip' });
  }

  /**
   * 将对话对象转换为 Markdown 字符串
   */
  private chatToMarkdown(chat: SavedChat): string {
    const lines: string[] = [];

    // --- 元数据页头（YAML 风格引用块）---
    lines.push('```');
    lines.push(`title: ${chat.title}`);
    lines.push(`created: ${formatDate(chat.createdAt)}`);
    lines.push(`updated: ${formatDate(chat.updatedAt)}`);
    lines.push(`model: ${chat.model ?? '未知'}`);
    lines.push(`messages: ${chat.messages?.length ?? 0}`);
    lines.push('```');
    lines.push('');

    // --- 标题 ---
    lines.push(`# ${chat.title}`);
    lines.push('');

    // --- 消息轮次 ---
    for (let i = 0; i < chat.messages.length; i++) {
      const msg = chat.messages[i];
      const content = extractMessageContent(msg);
      const roleLabel = msg.role === 'user'
        ? (navigator.language.startsWith('en') ? '👤 User' : '👤 用户')
        : '🤖 AI';
      const timeLabel = msg.createdAt ? formatDate(msg.createdAt) : '';

      lines.push(`## ${roleLabel}${timeLabel ? ` · ${timeLabel}` : ''}`);
      lines.push('');
      lines.push(content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 使用 Cursor 分页读取图片，流式写入 ZIP
   * 关键：每处理一张图就立即写入并清内存，不会 OOM
   */
  private async streamImagesToZip(
    db: IDBPDatabase,
    zip: InstanceType<typeof Zip>,
    _chats: SavedChat[],
  ): Promise<void> {
    this.onProgress('正在处理图片 (0/?)', 0, 0);

    const tx = db.transaction(STORE_IMAGES, 'readonly');
    const store = tx.objectStore(STORE_IMAGES);

    let cursor = await store.openCursor();
    let imageCount = 0;

    while (cursor) {
      const [hash, blob] = cursor.primaryKey
        ? [String(cursor.primaryKey), cursor.value as Blob]
        : [String(imageCount), cursor.value as Blob];

      if (blob && blob.size > 0) {
        const fileName = `images/${sanitizeFilename(hash)}.png`;
        const imgDeflate = new ZipDeflate(fileName, { level: 0 }); // PNG 已压缩，level:0 跳过再压缩
        zip.add(imgDeflate);

        // 同步读取 Blob 内容（图片一般不大，同步读可接受）
        const buffer = await blob.arrayBuffer();
        imgDeflate.push(new Uint8Array(buffer), true); // true = 该文件结束

        imageCount++;
        this.onProgress(`正在处理图片 (${imageCount}/?)`, imageCount, 0);
      }

      cursor = await cursor.continue();
    }

    await tx.done;
    this.onProgress(`图片处理完成，共 ${imageCount} 张`, imageCount, imageCount);
  }

  /**
   * 触发浏览器下载
   * ⚠️ URL.revokeObjectURL() 绝对不可省略，否则每次导出都泄漏 ZIP 大小的内存
   */
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // 下一个 tick 释放资源
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

// ============================================================
// Content Script 入口：监听来自 Popup 的消息
// ============================================================

// 注册消息处理器
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      const { action, chatId, settings } = message;

      if (action === 'ping') {
        sendResponse({ ok: true });
        return;
      }

      if (action === 'getStats') {
        const manager = new ExportManager(settings ?? defaultSettings, () => {});
        const count = await manager.getChatCount();
        sendResponse({ ok: true, count });
        return;
      }

      if (action === 'exportSingle') {
        const manager = new ExportManager(settings ?? defaultSettings, () => {});
        await manager.exportSingleChat(chatId);
        sendResponse({ ok: true });
        return;
      }

      if (action === 'exportAll') {
        const manager = new ExportManager(settings ?? defaultSettings, (step, cur, total) => {
          // 将进度实时发回给调用方
          browser.runtime.sendMessage({ action: 'progress', step, current: cur, total });
        });
        await manager.exportAll(settings ?? defaultSettings);
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: '未知 action' });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[DuckAI-Export] Content Script 错误:', error);
      sendResponse({ ok: false, error });
    }
  })();
  return true; // 保持消息通道开放，支持异步响应
});

const defaultSettings: ExportSettings = {
  includeImages: true,
  archiveLevel: 'year',
};
