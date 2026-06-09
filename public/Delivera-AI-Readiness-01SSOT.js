/**
 * SSOT: client-side AI readiness (setup gaps, PI wizard, trust display).
 */
import { fetchAiProviderStatus, hasAiProviderKey, readAiProviderPref } from './Delivera-Shared-AI-Provider-Pref-01Helper.js';

const FALLBACK_WARN_RATIO = 0.3;

/**
 * @param {object} opts
 * @param {object} [opts.serverStatus]
 * @param {string} [opts.narratedBy]
 * @param {number|null} [opts.fallbackRate]
 * @returns {Promise<{ mode: string, configured: boolean, slideVisionReady: boolean, needsUserAction: boolean, aiKeyConfigured: boolean|null, suppressAdvisorBadge: boolean, label: string }>}
 */
export async function resolveAiReadiness(opts = {}) {
  const serverStatus = opts.serverStatus || await fetchAiProviderStatus();
  const browser = readAiProviderPref();
  const hasBrowser = hasAiProviderKey();
  const narratedBy = String(opts.narratedBy || 'template').toLowerCase();
  const fallbackRate = opts.fallbackRate != null ? Number(opts.fallbackRate) : null;

  const serverReady = Boolean(serverStatus?.configured && serverStatus?.slideVisionReady);
  const configured = hasBrowser || Boolean(serverStatus?.configured);
  const slideVisionReady = hasBrowser || Boolean(serverStatus?.slideVisionReady);

  let mode = 'template';
  let label = 'Templates';
  if (hasBrowser) {
    mode = 'browser';
    label = browser.provider === 'openrouter' ? 'OpenRouter' : (browser.provider || 'Browser');
  } else if (serverReady) {
    mode = 'server';
    label = serverStatus?.label || serverStatus?.provider || 'Server';
  } else if (serverStatus?.configured) {
    mode = 'server';
    label = serverStatus?.label || 'Server';
  }

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
    needsUserAction,
    aiKeyConfigured,
    suppressAdvisorBadge,
    serverStatus,
  };
}
