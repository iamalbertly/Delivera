/**
 * SSOT: unified AI trust display (browser key + server env + usage fallbacks).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import {
  fetchAiProviderStatus,
  hasAiProviderKey,
} from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { resolveAiReadiness } from './Delivera-AI-Readiness-01SSOT.js';

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
  const hasBrowser = hasAiProviderKey();
  const usage = await fetchUsage24h();
  const total = Number(usage?.totalCalls) || 0;
  const fallbacks = Number(usage?.fallbacks) || 0;
  const fallbackRate = total > 0 ? fallbacks / total : null;

  const readiness = await resolveAiReadiness({
    serverStatus: server,
    narratedBy: opts.narratedBy || 'template',
    fallbackRate,
  });

  const { mode, label, configured, suppressAdvisorBadge } = readiness;

  const fallbackWarn = fallbackRate != null && fallbackRate >= 0.3
    ? `<p class="gov-ai-helper-note gov-ai-helper-note--warn" data-ai-fallback-warn="1">High template fallback (${Math.round(fallbackRate * 100)}% in 24h). Brief wording may use deterministic templates.</p>`
    : '';

  const statusLineHtml = configured
    ? `<p class="gov-ai-helper-status gov-ai-helper-status--ok" data-ai-trust-mode="${mode}">AI connected: ${escapeHtml(mode === 'server' ? `Server (${label})` : label)}${mode === 'server' && hasBrowser ? ' - browser override active' : ''}</p>`
    : '<p class="gov-ai-helper-status" data-ai-trust-mode="template">Templates only - optional browser key in Settings or configure server AI in .env.</p>';

  const usageLine = usage
    ? `<p class="gov-ai-helper-note" data-ai-usage-line="1">Last 24h: ${total} calls - Fallbacks: ${fallbacks}</p>${fallbackWarn}`
    : '';

  const pillText = mobileDot
    ? ''
    : (suppressAdvisorBadge && mode === 'server'
      ? 'AI - templates'
      : (mode === 'server' ? 'AI - server' : mode === 'browser' ? 'AI - browser' : 'AI - templates'));
  const pillTitle = mode === 'server'
    ? (suppressAdvisorBadge ? 'AI is using template fallback' : `Server AI (${label})`)
    : mode === 'browser'
      ? `Browser AI (${label})`
      : 'Built-in templates';
  const pillVisual = mode === 'template' ? 'template' : (suppressAdvisorBadge && mode === 'server' ? 'template' : mode);
  const pillAttrMode = mode === 'template' ? 'template' : mode;
  const pillInner = mobileDot
    ? `<span class="app-top-ai-trust-dot" aria-hidden="true"></span><span class="visually-hidden">${escapeHtml(pillTitle)}</span>`
    : escapeHtml(pillText);

  const pillHtml = `<span class="app-top-ai-trust-pill app-top-ai-trust-pill--${pillVisual}${mobileDot ? ' app-top-ai-trust-pill--dot' : ''}" data-ai-trust-pill="${pillAttrMode}" title="${escapeHtml(pillTitle)}">${pillInner}</span>`;

  return {
    mode: pillAttrMode,
    label,
    configured,
    fallbackRate,
    suppressAdvisorBadge,
    statusLineHtml,
    usageLineHtml: usageLine,
    pillHtml,
  };
}
