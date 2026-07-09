/**
 * SSOT: client-side AI readiness (setup gaps, PI wizard, trust display).
 */
import {
  browserOverrideActive,
  fetchAiProviderStatus,
  hasAiProviderKey,
  readAiProviderPref,
} from './Delivera-Shared-AI-Provider-Pref-01Helper.js';

const FALLBACK_WARN_RATIO = 0.3;
const VISION_PROVIDERS = new Set(['openai', 'claude', 'openrouter']);

function providerLabel(provider) {
  if (provider === 'openrouter') return 'OpenRouter';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'claude') return 'Claude';
  return provider || 'Templates';
}

/**
 * Unified AI capability — env-first; browser override when confirmed working.
 * @param {{ force?: boolean, narratedBy?: string, fallbackRate?: number|null }} opts
 */
export async function resolveEffectiveAiCapability(opts = {}) {
  const force = Boolean(opts.force);
  const envStatus = await fetchAiProviderStatus({ force, effective: false });
  const override = browserOverrideActive();
  let effectiveStatus = envStatus;
  let source = envStatus?.slideVision?.source || envStatus?.source || 'none';
  let label = envStatus?.label || 'Built-in templates';

  if (override) {
    effectiveStatus = await fetchAiProviderStatus({ force, effective: true });
    source = 'browser';
    label = providerLabel(readAiProviderPref().provider);
  } else if (envStatus?.slideVisionReady) {
    source = envStatus?.slideVision?.source || 'server';
    label = envStatus?.label || label;
  }

  const envSlideReady = Boolean(envStatus?.slideVisionReady || envStatus?.slideVision?.ready);
  const effectiveSlideReady = Boolean(effectiveStatus?.slideVisionReady || effectiveStatus?.slideVision?.ready);
  const slideVisionReady = override ? effectiveSlideReady : envSlideReady;

  const browser = readAiProviderPref();
  const hasBrowserKey = hasAiProviderKey();
  const browserFailed = hasBrowserKey && !browser.lastTestOk;

  let blockUpload = !slideVisionReady;
  let userAction = null;
  let reason = slideVisionReady ? 'ready' : 'not_configured';

  if (!slideVisionReady) {
    if (browser.provider === 'gemini' && hasBrowserKey) {
      reason = 'gemini_unsupported';
      userAction = 'switch_provider';
    } else if (!envSlideReady && !hasBrowserKey) {
      reason = 'missing_server_env';
      userAction = 'configure_env_or_settings';
    } else if (hasBrowserKey && !browser.lastTestOk) {
      reason = 'browser_test_required';
      userAction = 'test_browser_key';
    } else {
      userAction = 'configure_env_or_settings';
    }
  }

  const narrationReady = slideVisionReady || Boolean(envStatus?.configured);

  return {
    slideVisionReady,
    narrationReady,
    source,
    reason,
    label,
    blockUpload,
    userAction,
    browserFailed,
    envSlideReady,
    overrideActive: override,
    serverStatus: effectiveStatus,
    envStatus,
  };
}

/**
 * @param {object} opts
 * @param {object} [opts.serverStatus]
 * @param {string} [opts.narratedBy]
 * @param {number|null} [opts.fallbackRate]
 */
export async function resolveAiReadiness(opts = {}) {
  const capability = await resolveEffectiveAiCapability({
    force: Boolean(opts.forceStatus),
    narratedBy: opts.narratedBy,
    fallbackRate: opts.fallbackRate,
  });
  const serverStatus = opts.serverStatus || capability.serverStatus;
  const narratedBy = String(opts.narratedBy || 'template').toLowerCase();
  const fallbackRate = opts.fallbackRate != null ? Number(opts.fallbackRate) : null;

  const { slideVisionReady, narrationReady, label, source, browserFailed } = capability;

  let mode = 'template';
  if (source === 'browser') mode = 'browser';
  else if (source === 'server' || serverStatus?.configured) mode = 'server';

  const configured = slideVisionReady || Boolean(serverStatus?.configured) || hasAiProviderKey();
  const needsUserAction = !slideVisionReady && narratedBy === 'template';
  let aiKeyConfigured = null;
  if (slideVisionReady) aiKeyConfigured = true;
  else if (needsUserAction) aiKeyConfigured = false;

  const suppressAdvisorBadge = fallbackRate != null && fallbackRate >= FALLBACK_WARN_RATIO;

  return {
    mode,
    label,
    configured,
    slideVisionReady,
    narrationReady,
    needsUserAction,
    aiKeyConfigured,
    suppressAdvisorBadge,
    browserFailed,
    serverStatus,
    capability,
  };
}
