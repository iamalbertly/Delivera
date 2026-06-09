/**
 * SSOT: unified AI trust display (browser key + server env + usage fallbacks).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import {
  fetchAiProviderStatus,
  hasAiProviderKey,
  readAiProviderPref,
} from './Delivera-Shared-AI-Provider-Pref-01Helper.js';

const FALLBACK_WARN_RATIO = 0.3;

async function fetchUsage24h() {
  try {
    const res = await fetch('/api/settings/ai-usage.json?hours=24', { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  } catch (_) {
    return null;
  }
}

/**
 * @returns {Promise<{
 *   mode: 'server'|'browser'|'template',
 *   label: string,
 *   configured: boolean,
 *   fallbackRate: number|null,
 *   suppressAdvisorBadge: boolean,
 *   statusLineHtml: string,
 *   pillHtml: string,
 * }>}
 */
export async function resolveAiTrustDisplay(opts = {}) {
  const mobileDot = Boolean(opts.mobileDot);
  const server = await fetchAiProviderStatus(opts.forceStatus);
  const browser = readAiProviderPref();
  const hasBrowser = hasAiProviderKey();
  const usage = await fetchUsage24h();
  const total = Number(usage?.totalCalls) || 0;
  const fallbacks = Number(usage?.fallbacks) || 0;
  const fallbackRate = total > 0 ? fallbacks / total : null;
  const suppressAdvisorBadge = fallbackRate != null && fallbackRate >= FALLBACK_WARN_RATIO;

  let mode = 'template';
  let label = 'Templates';
  let configured = false;

  if (hasBrowser) {
    mode = 'browser';
    label = browser.provider === 'openrouter' ? 'OpenRouter' : (browser.provider || 'Browser');
    configured = true;
  } else if (server?.configured && server?.slideVisionReady) {
    mode = 'server';
    label = server.label || server.provider || 'Server';
    configured = true;
  } else if (server?.configured) {
    mode = 'server';
    label = server.label || server.provider || 'Server';
    configured = true;
  }

  const fallbackWarn = fallbackRate != null && fallbackRate >= FALLBACK_WARN_RATIO
    ? `<p class="gov-ai-helper-note gov-ai-helper-note--warn" data-ai-fallback-warn="1">High template fallback (${Math.round(fallbackRate * 100)}% in 24h) — Brief may use templates instead of AI wording.</p>`
    : '';

  const statusLineHtml = configured
    ? `<p class="gov-ai-helper-status gov-ai-helper-status--ok" data-ai-trust-mode="${mode}">AI connected: ${escapeHtml(mode === 'server' ? `Server (${label})` : label)}${mode === 'server' && hasBrowser ? ' · browser override active' : ''}</p>`
    : `<p class="gov-ai-helper-status" data-ai-trust-mode="template">Templates only — add a browser key or configure server AI in <code>.env</code>.</p>`;

  const usageLine = usage
    ? `<p class="gov-ai-helper-note" data-ai-usage-line="1">Last 24h: ${total} calls · Fallbacks: ${fallbacks}</p>${fallbackWarn}`
    : '';

  const pillText = mobileDot
    ? ''
    : (mode === 'server' ? `AI · server` : mode === 'browser' ? `AI · browser` : 'AI · templates');
  const pillTitle = mode === 'server'
    ? `Server AI (${label})`
    : mode === 'browser'
      ? `Browser AI (${label})`
      : 'Built-in templates';
  const pillMode = mode === 'template' ? 'template' : mode;
  const pillInner = mobileDot
    ? `<span class="app-top-ai-trust-dot" aria-hidden="true"></span><span class="visually-hidden">${escapeHtml(pillTitle)}</span>`
    : escapeHtml(pillText);

  const pillHtml = `<span class="app-top-ai-trust-pill app-top-ai-trust-pill--${pillMode}${mobileDot ? ' app-top-ai-trust-pill--dot' : ''}" data-ai-trust-pill="${pillMode}" title="${escapeHtml(pillTitle)}">${pillInner}</span>`;

  return {
    mode,
    label,
    configured,
    fallbackRate,
    suppressAdvisorBadge,
    statusLineHtml,
    usageLineHtml: usageLine,
    pillHtml,
  };
}
