/**
 * DuckAI Export - Popup 主入口
 * 职责：UI 交互、状态管理、向 Content Script 发送消息
 */

import type { ExportSettings } from '../../src/utils/types';
import { getMessages, detectLang } from './i18n';

// ============================================================
// i18n 初始化：在 DOM 加载时填充所有 data-i18n 元素
// ============================================================
const t = getMessages();

function applyI18n(): void {
  // 填充所有带 data-i18n 属性的元素
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n as keyof typeof t;
    const val = t[key];
    if (typeof val === 'string') el.textContent = val;
  });

  // 设置隐私角标 title
  const privacyBadge = document.getElementById('privacyBadge');
  if (privacyBadge) privacyBadge.title = t.privacyBadgeTitle;

  // 设置 GitHub 链接 title
  const githubLink = document.getElementById('githubLink');
  if (githubLink) githubLink.title = t.githubLinkTitle;

  // 设置 html lang 属性
  document.documentElement.lang = detectLang() === 'zh' ? 'zh-CN' : 'en';
}

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
  // 先应用 i18n，填充所有静态文本
  applyI18n();

  const tab = await getCurrentTab();
  const isDuckAi = tab?.url?.includes('duck.ai') ?? false;

  if (!isDuckAi) {
    setStatus('error', t.statusErrorNotDuckAi);
    disableActions();
    return;
  }

  try {
    await sendToContent({ action: 'ping' });
    setStatus('connected', t.statusConnected);
    await loadStats();
  } catch {
    setStatus('error', t.statusErrorNoData);
    disableActions();
  }
}

// ============================================================
// 状态管理
// ============================================================
function setStatus(type: 'connected' | 'error' | 'idle', text: string): void {
  $statusIndicator.className = 'status-indicator ' +
    (type === 'connected' ? 'connected' : type === 'error' ? 'error' : '');
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
    $progressBar.style.width = `${Math.round((current / total) * 100)}%`;
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
  $step1Text.textContent = t.stepReadingData;
  $progressSection.hidden = false;
  $progressBarWrapper.hidden = true;

  try {
    const resp = await sendToContent({ action: 'getStats', settings: getSettings() });
    if (!resp.ok) throw new Error((resp.error as string) ?? t.statusErrorLoadFailed);
    chatCount = (resp.count as number) ?? 0;
    $chatCount.textContent = String(chatCount);
    setState('idle');
  } catch (err) {
    console.error('[DuckAI-Export] load stats failed:', err);
    $chatCount.textContent = '--';
    setState('error');
    setStatus('error', t.statusErrorLoadFailed);
  }
}

// ============================================================
// 导出操作
// ============================================================
async function handleExportAll(): Promise<void> {
  if (currentState !== 'idle') return;
  const settings = getSettings();
  setState('exporting');
  $step1Text.textContent = t.stepIndexing;
  $progressBar.style.width = '0%';

  try {
    const resp = await sendToContent({ action: 'exportAll', settings });
    if (!resp.ok) throw new Error((resp.error as string) ?? '');
    setState('done');
  } catch (err) {
    console.error('[DuckAI-Export] export all failed:', err);
    setState('error');
    setStatus('error', t.statusExportFailed(err instanceof Error ? err.message : String(err)));
  }
}

async function handleExportSingle(): Promise<void> {
  if (currentState !== 'idle') return;
  const settings = getSettings();
  setState('exporting');
  $step1Text.textContent = t.stepExportingCurrent;
  $progressBar.style.width = '0%';

  try {
    console.log('[DuckAI-Export] getting current chat ID...');

    const resp = await sendToContent({ action: 'getCurrentChatId' });
    console.log('[DuckAI-Export] getCurrentChatId response:', resp);

    if (!resp.ok || !resp.chatId) {
      throw new Error((resp.error as string) ?? '');
    }

    const chatId = resp.chatId as string;
    console.log('[DuckAI-Export] chatId:', chatId);

    const exportResp = await sendToContent({ action: 'exportSingle', chatId, settings });
    console.log('[DuckAI-Export] export response:', exportResp);
    if (!exportResp.ok) throw new Error((exportResp.error as string) ?? '');
    setState('done');
  } catch (err) {
    console.error('[DuckAI-Export] export single failed:', err);
    setState('error');
    setStatus('error', t.statusExportFailed(err instanceof Error ? err.message : String(err)));
  }
}

// ============================================================
// 事件绑定
// ============================================================
$btnExportAll.addEventListener('click', handleExportAll);
$btnExportSingle.addEventListener('click', handleExportSingle);

// 监听 Content Script 发来的进度更新
browser.runtime.onMessage.addListener((msg) => {
  if ((msg as { action?: string }).action === 'progress') {
    const { step, current, total } = msg as { step: string; current: number; total: number };
    updateProgress(step, current, total);
  }
});

// ============================================================
// 工具函数
// ============================================================
async function getCurrentTab(): Promise<browser.tabs.Tab | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

/**
 * 向当前标签页的 Content Script 发送消息
 */
async function sendToContent(message: unknown): Promise<Record<string, unknown>> {
  const tab = await getCurrentTab();
  if (!tab?.id) throw new Error('cannot get current tab');

  return browser.tabs.sendMessage(tab.id, message);
}

// ============================================================
// 启动
// ============================================================
init();
