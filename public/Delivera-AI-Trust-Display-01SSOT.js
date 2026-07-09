/**
 * SSOT: unified AI trust display (browser key + server env + usage fallbacks).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { hasAiProviderKey } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';
import { resolveAiReadiness } from './Delivera-AI-Readiness-01SSOT.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

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
 *   slideVisionReady: boolean,
 *   fallbackRate: number|null,
 *   suppressAdvisorBadge: boolean,
 *   statusLineHtml: string,
 *   pillHtml: string,
 * }>}
 */
export async function resolveAiTrustDisplay(opts = {}) {
  const mobileDot = Boolean(opts.mobileDot);
  const hasBrowser = hasAiProviderKey();
  const usage = await fetchUsage24h();
  const total = Number(usage?.totalCalls) || 0;
  const fallbacks = Number(usage?.fallbacks) || 0;
  const fallbackRate = total > 0 ? fallbacks / total : null;

  const readiness = await resolveAiReadiness({
    forceStatus: Boolean(opts.forceStatus),
    narratedBy: opts.narratedBy || 'template',
    fallbackRate,
  });

  const {
    mode,
    label,
    configured,
    slideVisionReady,
    suppressAdvisorBadge,
    browserFailed,
    capability,
  } = readiness;

  const fallbackWarn = fallbackRate != null && fallbackRate >= 0.3
    ? `<p class="gov-ai-helper-note gov-ai-helper-note--warn" data-ai-fallback-warn="1">High template fallback (${Math.round(fallbackRate * 100)}% in 24h). Brief wording may use deterministic templates.</p>`
    : '';

  const envReady = Boolean(capability?.envSlideReady);
  const envNote = envReady && !capability?.overrideActive
    ? `<p class="gov-ai-helper-note" data-ai-env-note="1">${escapeHtml(COPY.aiCapabilityEnvNote)}</p>`
    : '';

  let statusLine = 'Templates only - optional browser key in Settings or configure server AI in .env.';
  if (slideVisionReady) {
    statusLine = `AI connected: ${mode === 'server' ? `Server (${label})` : label}${mode === 'server' && hasBrowser ? ' - browser override active' : ''} · ${COPY.aiSlideReadyShort}`;
  } else if (configured) {
    statusLine = `AI partial — ${COPY.aiSlideTemplatesOnly}`;
  }
  if (browserFailed && envReady) {
    statusLine = `${COPY.aiBrowserOverrideFailed} (${label})`;
  }

  const statusLineHtml = slideVisionReady || configured
    ? `<p class="gov-ai-helper-status gov-ai-helper-status--ok" data-ai-trust-mode="${mode}" data-ai-slide-ready="${slideVisionReady ? '1' : '0'}">${escapeHtml(statusLine)}</p>${envNote}`
    : `<p class="gov-ai-helper-status" data-ai-trust-mode="template" data-ai-slide-ready="0">${escapeHtml(statusLine)}</p>`;

  const usageLine = usage
    ? `<p class="gov-ai-helper-note" data-ai-usage-line="1">Last 24h: ${total} calls - Fallbacks: ${fallbacks}</p>${fallbackWarn}`
    : '';

  let pillText;
  if (mobileDot) {
    pillText = '';
  } else if (slideVisionReady) {
    pillText = `AI · ${COPY.aiSlideReadyShort}`;
  } else if (configured) {
    pillText = COPY.aiSlideTemplatesOnly;
  } else {
    pillText = 'AI - templates';
  }

  const pillTitle = slideVisionReady
    ? `Slide vision ready (${label})${suppressAdvisorBadge ? ' — narration may use templates' : ''}`
    : configured
      ? COPY.aiSlideTemplatesOnly
      : 'Built-in templates';
  const pillVisual = slideVisionReady ? (mode === 'browser' ? 'browser' : 'server') : 'template';
  const pillAttrMode = slideVisionReady ? mode : 'template';
  const pillInner = mobileDot
    ? `<span class="app-top-ai-trust-dot app-top-ai-trust-dot--${slideVisionReady ? 'ready' : 'template'}" aria-hidden="true"></span><span class="visually-hidden">${escapeHtml(pillTitle)}</span>`
    : escapeHtml(pillText);

  const pillHtml = `<span class="app-top-ai-trust-pill app-top-ai-trust-pill--${pillVisual}${mobileDot ? ' app-top-ai-trust-pill--dot' : ''}" data-ai-trust-pill="${pillAttrMode}" data-ai-slide-ready="${slideVisionReady ? '1' : '0'}" title="${escapeHtml(pillTitle)}">${pillInner}</span>`;

  return {
    mode: pillAttrMode,
    label,
    configured,
    slideVisionReady,
    fallbackRate,
    suppressAdvisorBadge,
    statusLineHtml,
    usageLineHtml: usageLine,
    pillHtml,
  };
}
