/**
 * DuckAI-Export - Content Script 入口
 * 运行于 duck.ai 页面上下文，直接读取 IndexedDB
 *
 * 架构原则：
 * 1. 所有数据处理在 Content Script 中完成（不依赖 Background）
 * 2. IndexedDB 只读访问（readonly 事务）
 * 3. 图片使用 Cursor 分页 + fflate 流式写入，内存恒定
 * 4. 数据库句柄用完立即关闭
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import { openDB, type IDBPDatabase } from 'idb';
import { Zip, ZipDeflate, strToU8 } from 'fflate';
import type { ExportSettings, SavedChat, ImageMap, ChatImage } from '../../src/utils/types';
import { chatToMarkdown, getArchivePath, getFilenameWithDate, sanitizeFilename, isValidChat, getImagePath, isImageMime } from '../../src/utils/format';

// ============================================================
// 常量
// ============================================================

const DB_NAME = 'savedAIChatData';
const STORE_CHATS = 'saved-chats';
const STORE_IMAGES = 'chat-images';

const defaultSettings: ExportSettings = {
  includeImages: true,
  archiveLevel: 'year',
};

// ============================================================
// 导出管理器
// ============================================================

class ExportManager {
  private db: IDBPDatabase | null = null;
  private settings: ExportSettings;
  private onProgress: (step: string, current: number, total: number) => void;

  constructor(settings: ExportSettings, onProgress: (step: string, current: number, total: number) => void) {
    this.settings = settings;
    this.onProgress = onProgress;
  }

  private async connect(): Promise<IDBPDatabase> {
    if (this.db) return this.db;
    // 不指定版本号，打开现有数据库
    this.db = await openDB(DB_NAME);
    return this.db;
  }

  private async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }


  /** 获取对话总数（包含无效记录） */
  async getChatCount(): Promise<number> {
    const db = await this.connect();
    const tx = db.transaction(STORE_CHATS, 'readonly');
    const count = await tx.objectStore(STORE_CHATS).count();
    await tx.done;
    return count;
  }

  /** 获取有效对话数量（过滤掉 metadata 等非会话记录） */
  async getValidChatCount(): Promise<number> {
    const db = await this.connect();
    const tx = db.transaction(STORE_CHATS, 'readonly');
    const allChats = await tx.objectStore(STORE_CHATS).getAll() as SavedChat[];
    await tx.done;
    return allChats.filter(chat => isValidChat(chat)).length;
  }

  /** 导出单个对话（无附件时直接下载 MD，有附件时打包 ZIP） */
  async exportSingleChat(chatId: string): Promise<void> {
    const db = await this.connect();
    const tx = db.transaction(STORE_CHATS, 'readonly');
    const chat = await tx.objectStore(STORE_CHATS).get(chatId) as SavedChat | undefined;
    await tx.done;

    if (!chat) {
      await this.close();
      throw new Error(`未找到 ID 为 ${chatId} 的对话`);
    }

    console.log('[DuckAI-Export] 单个导出会话:', chat.title, 'chatId:', chatId);

    // 获取该对话的图片
    let imageMap: ImageMap | undefined;
    if (this.settings.includeImages) {
      const imgTx = db.transaction(STORE_IMAGES, 'readonly');
      const store = imgTx.objectStore(STORE_IMAGES);
      const allKeys = await store.getAllKeys();

      // 收集原始数据（事务内只做同步读取）
      interface RawImg { uuid: string; rawBlob: Blob; mimeType: string; }
      const rawImgs: RawImg[] = [];

      for (const key of allKeys) {
        const value = await store.get(key);
        if (!value) continue;

        let uuid = '';
        let rawBlob: Blob | null = null;
        let mimeType = 'image/png';

        if (typeof key === 'string') uuid = key;

        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          if (typeof obj.uuid === 'string') uuid = uuid || obj.uuid;
          if (typeof obj.chatId === 'string' && obj.chatId !== chatId) continue;
          if (obj.file instanceof Blob) { rawBlob = obj.file; mimeType = obj.file.type || mimeType; }
          else if (obj.data instanceof Blob) { rawBlob = obj.data; mimeType = obj.data.type || mimeType; }
        }

        if (uuid && rawBlob) rawImgs.push({ uuid, rawBlob, mimeType });
      }

      // 事务结束后再做异步解码
      await imgTx.done;

      const imageList: ChatImage[] = [];
      const attachmentList: ChatImage[] = [];
      for (const raw of rawImgs) {
        try {
          const data = await blobToUint8Array(raw.rawBlob);
          const chatImage: ChatImage = { uuid: raw.uuid, chatId, data, mimeType: raw.mimeType };
          if (isImageMime(raw.mimeType)) {
            imageList.push(chatImage);
            console.log('[DuckAI-Export] 单个导出 - 图片已解码:', raw.uuid, data.byteLength, '字节', raw.mimeType);
          } else {
            attachmentList.push(chatImage);
            console.log('[DuckAI-Export] 单个导出 - 附件已解码:', raw.uuid, data.byteLength, '字节', raw.mimeType);
          }
        } catch (err) {
          console.error('[DuckAI-Export] 单个导出 - 附件解码失败:', raw.uuid, err);
        }
      }

      // imageMap 用于 chatToMarkdown 中的图片/附件引用生成
      if (imageList.length > 0 || attachmentList.length > 0) {
        imageMap = new Map([[chatId, [...imageList, ...attachmentList]]]);
        console.log('[DuckAI-Export] 单个导出找到', imageList.length, '张图片，', attachmentList.length, '个附件');
      }
    }

    await this.close();

    // 生成 Markdown（chatToMarkdown 会按 MIME 类型分别生成图片引用和附件引用）
    const md = chatToMarkdown(chat, imageMap);

    // 获取时间戳用于文件名：用 lastEdit 或第一条消息的 createdAt
    const timestamp = chat.lastEdit || (chat.messages?.[0] as Record<string, unknown>)?.createdAt;
    // 单次导出使用扁平结构 + 带时间戳的文件名
    const filenameWithDate = getFilenameWithDate(chat.title, timestamp);

    const attachments = imageMap?.get(chatId) ?? [];
    const imageCount = attachments.filter(a => isImageMime(a.mimeType)).length;
    const attachCount = attachments.length - imageCount;
    console.log('[DuckAI-Export] 单个导出文件名:', filenameWithDate, '图片:', imageCount, '附件:', attachCount);

    // 如果没有任何附件，直接下载 .md 文件
    if (attachments.length === 0) {
      console.log('[DuckAI-Export] 无附件，直接下载 .md 文件');
      const mdBlob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      triggerDownload(mdBlob, filenameWithDate + '.md');
      return;
    }

    // 有附件，打包成 ZIP
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve, reject) => {
      let rejected = false;

      const zip = new Zip((err, chunk, isFinal) => {
        if (err) {
          console.error('[DuckAI-Export] ZIP 错误:', err);
          if (!rejected) {
            rejected = true;
            reject(err);
          }
          return;
        }
        if (chunk) chunks.push(chunk);
        if (isFinal) {
          const zipBlob = new Blob(chunks, { type: 'application/zip' });
          triggerDownload(zipBlob, `${filenameWithDate}.zip`);
          resolve();
        }
      });

      const mdDeflate = new ZipDeflate(filenameWithDate, { level: 6 });
      zip.add(mdDeflate);
      mdDeflate.push(strToU8(md), true);

      // 收集所有附件的写入 Promise，等待全部完成后再关闭 ZIP
      const writePromises: Promise<void>[] = [];
      for (const att of attachments) {
        const attPath = getImagePath(filenameWithDate, att.uuid, att.mimeType);
        const attDeflate = new ZipDeflate(attPath, { level: 0 });
        zip.add(attDeflate);

        const attPromise = Promise.resolve().then(() => {
          attDeflate.push(att.data, true);
          const typeLabel = isImageMime(att.mimeType) ? '添加图片' : '添加附件';
          console.log(`[DuckAI-Export] 单个导出 - ${typeLabel}:`, attPath, att.data.byteLength, '字节');
        }).catch((err) => {
          console.error('[DuckAI-Export] 附件写入 ZIP 失败:', attPath, err);
        });
        writePromises.push(attPromise);
      }

      // 等待所有附件写入完成后再关闭 ZIP
      Promise.all(writePromises).then(() => {
        if (!rejected) {
          console.log('[DuckAI-Export] 所有附件已写入，关闭 ZIP');
          zip.end();
        }
      }).catch((err) => {
        console.error('[DuckAI-Export] 附件处理出错:', err);
        if (!rejected) {
          rejected = true;
          reject(err);
        }
      });
    });

    console.log('[DuckAI-Export] 单个导出完成');
  }

  /** 全量打包导出 */
  async exportAll(settings: ExportSettings): Promise<void> {
    const db = await this.connect();
    this.onProgress('正在索引本地数据...', 0, 100);

    const tx = db.transaction(STORE_CHATS, 'readonly');
    const allChats = await tx.objectStore(STORE_CHATS).getAll() as SavedChat[];
    await tx.done;

    console.log('[DuckAI-Export] 数据库中共', allChats.length, '条记录');

    // 过滤有效会话（去除空会话）
    const validChats = allChats.filter((chat, i) => {
      const valid = isValidChat(chat);
      console.log(`[DuckAI-Export] 会话 #${i + 1}: "${chat.title}" - ${valid ? '有效' : '无效(空会话)'}`);
      return valid;
    });

    console.log('[DuckAI-Export] 有效会话:', validChats.length, '条');

    if (validChats.length === 0) {
      await this.close();
      throw new Error('没有找到任何有效对话记录');
    }

    // 如果需要图片，先读取所有图片并构建 ImageMap
    let imageMap: ImageMap | undefined;
    if (settings.includeImages) {
      imageMap = await this.buildImageMap(db);
    }

    const chunks: Uint8Array[] = [];

    // 使用 Promise 等待 ZIP 完成
    await new Promise<void>((resolve, reject) => {
      let rejected = false; // 防止 ZIP 出错后 IIFE 继续写入

      const zip = new Zip((err, chunk, isFinal) => {
        if (err) {
          console.error('[DuckAI-Export] ZIP 错误:', err);
          if (!rejected) {
            rejected = true;
            reject(err);
          }
          return;
        }
        if (chunk) chunks.push(chunk);
        if (isFinal) {
          const zipBlob = new Blob(chunks, { type: 'application/zip' });
          console.log('[DuckAI-Export] ZIP 生成完成，大小:', zipBlob.size, '字节，包含', validChats.length, '个文件');
          triggerDownload(zipBlob, 'DuckAI-Export-Full.zip');
          resolve();
        }
      });

      (async () => {
        try {
          for (let i = 0; i < validChats.length; i++) {
            // 如果 ZIP 已经出错，立即停止
            if (rejected) {
              console.error('[DuckAI-Export] ZIP 已出错，停止后续处理');
              break;
            }

            const chat = validChats[i];
            console.log(`[DuckAI-Export] 处理会话 #${i + 1}: "${chat.title}"`);

            // 传入 chatId 和 imageMap 以便在 Markdown 中引用图片
            const md = chatToMarkdown(chat, imageMap);

            // 获取文件夹路径的时间：用 lastEdit 或第一条消息的 createdAt
            const timestamp = chat.lastEdit || (chat.messages?.[0] as Record<string, unknown>)?.createdAt;
            // 文件名带时间戳
            const filenameWithDate = getFilenameWithDate(chat.title, timestamp);
            const mdPath = getArchivePath(filenameWithDate, timestamp, settings.archiveLevel);
            console.log(`[DuckAI-Export] 文件路径: ${mdPath}, 内容长度: ${md.length}`);
            const deflate = new ZipDeflate(mdPath, { level: 6 });
            zip.add(deflate);
            deflate.push(strToU8(md), true);

            // 如果有图片，写入同一目录
            if (settings.includeImages && imageMap && imageMap.has(chat.chatId)) {
              const chatImages = imageMap.get(chat.chatId)!;
              const imgCount = chatImages.filter(a => isImageMime(a.mimeType)).length;
              const attCount = chatImages.length - imgCount;
              console.log(`[DuckAI-Export] 对话 ${chat.chatId} 有 ${chatImages.length} 个附件（${imgCount} 张图片，${attCount} 个其他文件）`);
              for (const img of chatImages) {
                if (rejected) break;
                const imgPath = getImagePath(mdPath, img.uuid, img.mimeType);
                const imgDeflate = new ZipDeflate(imgPath, { level: 0 });
                zip.add(imgDeflate);
                // img.data 是已在 buildImageMap 中解码好的当前 realm Uint8Array，直接写入
                imgDeflate.push(img.data, true);
                const typeLabel = isImageMime(img.mimeType) ? '添加图片' : '添加附件';
                console.log(`[DuckAI-Export] ${typeLabel}: ${imgPath}, ${img.data.byteLength} 字节`);
              }
            } else if (settings.includeImages && imageMap) {
              console.log(`[DuckAI-Export] 对话 ${chat.chatId} 在附件映射中不存在，imageMap 有 ${imageMap.size} 个键`);
            }

            this.onProgress(`正在处理对话 (${i + 1}/${validChats.length})`, i + 1, validChats.length);
          }

          if (!rejected) {
            console.log('[DuckAI-Export] 所有文件处理完成，关闭 ZIP');
            zip.end();
          }
        } catch (err) {
          console.error('[DuckAI-Export] 处理文件时出错:', err);
          if (!rejected) {
            rejected = true;
            reject(err as Error);
          }
        }
      })();
    });

    await this.close();
  }

  /** 构建 chatId -> 图片数组的映射
   *
   * 关键设计：将跨域 Blob 在此处一次性解码为 Uint8Array 并存储，
   * 之后写入 ZIP 时无需再调用任何 Blob/arrayBuffer 方法，
   * 彻底规避 Firefox "Permission denied to access property constructor" 跨域问题。
   */
  private async buildImageMap(db: IDBPDatabase): Promise<ImageMap> {
    const imageMap: ImageMap = new Map();

    if (!db.objectStoreNames.contains(STORE_IMAGES)) {
      console.log('[DuckAI-Export] 图片 store 不存在，跳过图片映射');
      return imageMap;
    }

    try {
      const tx = db.transaction(STORE_IMAGES, 'readonly');
      const store = tx.objectStore(STORE_IMAGES);

      const allKeys = await store.getAllKeys();
      console.log('[DuckAI-Export] 构建图片映射，获取到', allKeys.length, '个图片键');

      // 收集原始数据（事务内只做同步读取）
      interface RawImageData {
        uuid: string;
        chatId: string;
        rawBlob: Blob;
        mimeType: string;
      }
      const rawImages: RawImageData[] = [];

      for (let i = 0; i < allKeys.length; i++) {
        const key = allKeys[i];
        const value = await store.get(key);
        if (!value) continue;

        let uuid = '';
        let chatId = '';
        let rawBlob: Blob | null = null;
        let mimeType = 'image/png';

        // 从键提取 UUID / chatId
        if (typeof key === 'string') {
          uuid = key;
        } else if (key && typeof key === 'object') {
          const k = key as Record<string, unknown>;
          if (typeof k.uuid === 'string') uuid = k.uuid;
          if (typeof k.chatId === 'string') chatId = k.chatId;
        }

        // 从值提取数据
        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          if (typeof obj.uuid === 'string') uuid = uuid || obj.uuid;
          if (typeof obj.chatId === 'string') chatId = chatId || obj.chatId;
          if (obj.file instanceof Blob) { rawBlob = obj.file; mimeType = obj.file.type || mimeType; }
          else if (obj.data instanceof Blob) { rawBlob = obj.data; mimeType = obj.data.type || mimeType; }
          else if (obj.blob instanceof Blob) { rawBlob = obj.blob; mimeType = obj.blob.type || mimeType; }
        }

        if (uuid && chatId && rawBlob) {
          rawImages.push({ uuid, chatId, rawBlob, mimeType });
          console.log('[DuckAI-Export] 找到图片:', chatId, uuid, rawBlob.size, '字节', mimeType);
        } else {
          console.warn('[DuckAI-Export] 跳过不完整图片记录: uuid=', uuid, 'chatId=', chatId, 'hasBlob=', !!rawBlob);
        }
      }

      // 事务结束后再做异步解码（避免事务超时）
      await tx.done;

      // 将跨域 Blob 一次性解码为当前 realm 的 Uint8Array
      // 使用 FileReader + atob 完全绕开 ArrayBuffer 的跨 realm 访问限制
      for (const raw of rawImages) {
        try {
          const data = await blobToUint8Array(raw.rawBlob);
          console.log('[DuckAI-Export] 图片已解码为 Uint8Array:', raw.uuid, data.byteLength, '字节');

          const img: ChatImage = {
            uuid: raw.uuid,
            chatId: raw.chatId,
            data,
            mimeType: raw.mimeType,
          };
          if (!imageMap.has(raw.chatId)) imageMap.set(raw.chatId, []);
          imageMap.get(raw.chatId)!.push(img);
        } catch (err) {
          console.error('[DuckAI-Export] 图片解码失败，跳过:', raw.uuid, err);
        }
      }

      console.log('[DuckAI-Export] 图片映射构建完成，共', imageMap.size, '个对话有图片，总计',
        [...imageMap.values()].reduce((s, arr) => s + arr.length, 0), '张');
    } catch (err) {
      console.error('[DuckAI-Export] 构建图片映射失败:', err);
    }

    return imageMap;
  }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 将 Blob 转换为当前 JavaScript realm 的 Uint8Array。
 *
 * 直接调用 blob.arrayBuffer() 在 Firefox 中会得到跨 realm 的 ArrayBuffer，
 * 导致后续 new Uint8Array(ab) 或 ab.slice() 时触发
 * "Permission denied to access property constructor" 错误。
 *
 * 解决方案：使用 FileReader.readAsDataURL() 将 Blob 转为 base64 字符串，
 * 再通过 btoa/atob 解码。DOMString 不受跨 realm 保护，整个过程安全。
 */
function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = reader.result as string;
        // dataUrl 格式: "data:image/png;base64,iVBORw0KGgo..."
        const base64 = dataUrl.split(',')[1];
        if (!base64) {
          reject(new Error('无法从 data URL 中提取 base64 数据'));
          return;
        }
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        resolve(bytes);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader 错误'));
    reader.readAsDataURL(blob);
  });
}


function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // 下一个 tick 释放资源，防止内存泄漏
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ============================================================
// WXT 入口点
// ============================================================

export default defineContentScript({
  matches: ['https://duck.ai/*'],

  main() {
    console.log('[DuckAI-Export] Content Script 已加载，运行于:', location.href);

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      (async () => {
        try {
          const { action, chatId, settings } = message;
          const cfg = settings ?? defaultSettings;

          if (action === 'ping') {
            sendResponse({ ok: true });
            return;
          }


          if (action === 'getStats') {
            const manager = new ExportManager(cfg, () => {});
            const count = await manager.getValidChatCount();
            sendResponse({ ok: true, count });
            return;
          }

          if (action === 'exportSingle') {
            const manager = new ExportManager(cfg, () => {});
            await manager.exportSingleChat(chatId);
            sendResponse({ ok: true });
            return;
          }

          if (action === 'exportAll') {
            const manager = new ExportManager(cfg, (step, cur, total) => {
              browser.runtime.sendMessage({ action: 'progress', step, current: cur, total });
            });
            await manager.exportAll(cfg);
            sendResponse({ ok: true });
            return;
          }

          if (action === 'getCurrentChatId') {
            console.log('[DuckAI-Export] 正在获取当前会话 ID...');

            // 方法 1: 从 localStorage/sessionStorage 获取
            let chatId = localStorage.getItem('currentChatId') ||
                         sessionStorage.getItem('currentChatId') ||
                         localStorage.getItem('activeChatId');

            // 方法 2: 从 DOM 元素获取
            if (!chatId) {
              const selectors = [
                '[data-chat-id]',
                '[data-conversation-id]',
                '[data-thread-id]',
              ];
              for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                  chatId = el.getAttribute('data-chat-id') ||
                           el.getAttribute('data-conversation-id') ||
                           el.getAttribute('data-thread-id');
                  if (chatId) break;
                }
              }
            }

            // 方法 3: 从 IndexedDB 获取最近修改的会话
            if (!chatId) {
              try {
                console.log('[DuckAI-Export] 尝试从 IndexedDB 获取最近会话...');
                const db = await openDB(DB_NAME);
                const tx = db.transaction(STORE_CHATS, 'readonly');
                const store = tx.objectStore(STORE_CHATS);
                const allChats = await store.getAll() as SavedChat[];
                await tx.done;

                console.log('[DuckAI-Export] IndexedDB 中有', allChats.length, '个会话');

                if (allChats.length > 0) {
                  // 根据 lastEdit 时间排序，取最新的
                  const sortedChats = allChats
                    .filter(c => c.lastEdit) // 过滤有效的
                    .sort((a, b) => {
                      const timeA = new Date(a.lastEdit).getTime();
                      const timeB = new Date(b.lastEdit).getTime();
                      return timeB - timeA; // 降序，最新的在前
                    });

                  if (sortedChats.length > 0) {
                    chatId = sortedChats[0].chatId;
                    console.log('[DuckAI-Export] 从 IndexedDB 获取最近会话:', chatId, sortedChats[0].title);
                  }
                }
              } catch (e) {
                console.log('[DuckAI-Export] IndexedDB 错误:', e);
              }
            }

            console.log('[DuckAI-Export] 最终获取到的 chatId:', chatId);

            if (!chatId) {
              sendResponse({ ok: false, error: '无法获取当前会话 ID，请刷新页面后重试' });
              return;
            }

            sendResponse({ ok: true, chatId });
            return;
          }

          sendResponse({ ok: false, error: '未知 action' });
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          console.error('[DuckAI-Export] Content Script 错误:', error);
          sendResponse({ ok: false, error });
        }
      })();
      return true;
    });
  },
});
