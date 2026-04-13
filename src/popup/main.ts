/**
 * DuckAI Export - Popup 主入口
 * 职责：UI 交互、状态管理、向 Content Script 发送消息
 */

import type { ExportSettings } from '../content-scripts/main';

// ============================================================
// DOM 元素引用
// ============================================================
const $statusIndicator = document.getElementById('statusIndicator')!;
const $statusText = document.getElementById('statusText')!;
const $chatCount = document.getElementById('chatCount')!;
const $btnExportAll = document.getElementById('btnExportAll') as HTMLButtonElement;
const $btnExportSingle = document.getElementById('btnExportSingle') as HTMLButtonElement;
const $progressSection = document.getElementById('progressSection')!;
const $step1Text = document.getElementById('step1Text')!;
const $progressBarWrapper = document.getElementById('progressBarWrapper')!;
const $progressBar = document.getElementById('progressBar')!;
const $optIncludeImages = document.getElementById('optIncludeImages') as HTMLInputElement;
const $archiveRadios = document.querySelectorAll<HTMLInputElement>('input[name="archiveLevel"]');
const $footer = document.getElementById('footer')!;
const $successHint = document.getElementById('successHint')!;

// ============================================================
// 状态
// ============================================================
type AppState = 'idle' | 'loading' | 'exporting' | 'done' | 'error';
let currentState: AppState = 'idle';
let chatCount = 0;

// ============================================================
// 初始化
// ============================================================
async function init(): Promise<void> {
  // 检查当前标签页是否是 duck.ai
  const tab = await getCurrentTab();
  const isDuckAi = tab?.url?.includes('duck.ai') ?? false;

  if (!isDuckAi) {
    setStatus('error', '请在 duck.ai 页面使用本扩展');
    disableActions();
    return;
  }

  // ping Content Script，确认其已注入
  try {
    await sendToContent({ action: 'ping' });
    setStatus('connected', '已连接本地数据库');
    await loadStats();
  } catch {
    setStatus('error', '未检测到 Duck.ai 数据');
    disableActions();
  }
}

// ============================================================
// 状态管理
// ============================================================
function setStatus(type: 'connected' | 'error' | 'idle', text: string): void {
  $statusIndicator.className = 'status-indicator ' + (type === 'connected' ? 'connected' : type === 'error' ? 'error' : '');
  $statusText.textContent = text;
}

function setState(state: AppState): void {
  currentState = state;
  switch (state) {
    case 'idle':
      $btnExportAll.disabled = false;
      $btnExportSingle.disabled = false;
      $progressSection.hidden = true;
      $footer.hidden = true;
      break;
    case 'loading':
      $btnExportAll.disabled = true;
      $btnExportSingle.disabled = true;
      $progressSection.hidden = false;
      $footer.hidden = true;
      break;
    case 'exporting':
      $btnExportAll.disabled = true;
      $btnExportSingle.disabled = true;
      $progressSection.hidden = false;
      $footer.hidden = true;
      break;
    case 'done':
      $btnExportAll.disabled = false;
      $btnExportSingle.disabled = false;
      $progressSection.hidden = true;
      $footer.hidden = false;
      break;
    case 'error':
      $btnExportAll.disabled = false;
      $btnExportSingle.disabled = false;
      $progressSection.hidden = true;
      $footer.hidden = true;
      break;
  }
}

function disableActions(): void {
  $btnExportAll.disabled = true;
  $btnExportSingle.disabled = true;
}

function updateProgress(step: string, current: number, total: number): void {
  setState('exporting');
  $step1Text.textContent = step;

  if (total > 0) {
    $progressBarWrapper.hidden = false;
    const pct = Math.round((current / total) * 100);
    $progressBar.style.width = `${pct}%`;
  } else {
    $progressBarWrapper.hidden = true;
  }
}

// ============================================================
// 获取设置
// ============================================================
function getSettings(): ExportSettings {
  const archiveLevel = (
    document.querySelector<HTMLInputElement>('input[name="archiveLevel"]:checked')?.value
    ?? 'year'
  ) as ExportSettings['archiveLevel'];

  return {
    includeImages: $optIncludeImages.checked,
    archiveLevel,
  };
}

// ============================================================
// 数据加载
// ============================================================
async function loadStats(): Promise<void> {
  setState('loading');
  $step1Text.textContent = '正在读取数据...';
  $progressSection.hidden = false;
  $progressBarWrapper.hidden = true;

  try {
    const resp = await sendToContent({ action: 'getStats', settings: getSettings() });
    if (!resp.ok) throw new Error(resp.error ?? '获取数据失败');
    chatCount = resp.count ?? 0;
    $chatCount.textContent = String(chatCount);
    setState('idle');
  } catch (err) {
    console.error('[DuckAI-Export] 加载统计失败:', err);
    $chatCount.textContent = '--';
    setState('error');
    setStatus('error', '读取数据失败，请刷新页面重试');
  }
}

// ============================================================
// 导出操作
// ============================================================
async function handleExportAll(): Promise<void> {
  if (currentState !== 'idle') return;
  const settings = getSettings();
  setState('exporting');
  $step1Text.textContent = '正在索引本地数据...';
  $progressBar.style.width = '0%';

  try {
    const resp = await sendToContent({ action: 'exportAll', settings });
    if (!resp.ok) throw new Error(resp.error ?? '导出失败');
    setState('done');
  } catch (err) {
    console.error('[DuckAI-Export] 导出失败:', err);
    setState('error');
    setStatus('error', `导出失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleExportSingle(): Promise<void> {
  if (currentState !== 'idle') return;
  const settings = getSettings();
  setState('exporting');
  $step1Text.textContent = '正在导出当前会话...';
  $progressBar.style.width = '0%';

  try {
    // 获取当前标签页 URL，提取 chat ID
    const tab = await getCurrentTab();
    const url = tab?.url ?? '';
    const match = url.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error('未找到当前会话 ID');
    const chatId = match[1];

    const resp = await sendToContent({ action: 'exportSingle', chatId, settings });
    if (!resp.ok) throw new Error(resp.error ?? '导出失败');
    setState('done');
  } catch (err) {
    console.error('[DuckAI-Export] 导出失败:', err);
    setState('error');
    setStatus('error', `导出失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================
// 事件绑定
// ============================================================
$btnExportAll.addEventListener('click', handleExportAll);
$btnExportSingle.addEventListener('click', handleExportSingle);

// 设置变更时重新加载统计
$optIncludeImages.addEventListener('change', () => loadStats());
$archiveRadios.forEach(r => r.addEventListener('change', () => loadStats()));

// 监听 Content Script 发来的进度更新
browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'progress') {
    updateProgress(msg.step, msg.current, msg.total);
  }
});

// ============================================================
// 工具函数
// ============================================================

/** 获取当前标签页 */
async function getCurrentTab(): Promise<browser.tabs.Tab | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

/**
 * 向当前标签页的 Content Script 发送消息
 * 并等待响应（超时 30s）
 */
function sendToContent(message: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.runtime.onMessage.removeListener(handler);
      reject(new Error('消息发送超时，请检查 duck.ai 页面是否正常加载'));
    }, 30_000);

    const handler = (response: Record<string, unknown>) => {
      clearTimeout(timeout);
      browser.runtime.onMessage.removeListener(handler);
      resolve(response);
    };

    browser.runtime.sendMessage(message).then(handler).catch(reject);
  });
}

// ============================================================
// 启动
// ============================================================
init();
