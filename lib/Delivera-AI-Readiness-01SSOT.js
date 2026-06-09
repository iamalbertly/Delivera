/**
 * SSOT: unified AI readiness — server-side (setup gaps, assemble, narration).
 */
import { buildAiProviderStatus } from './Delivera-AI-Provider-Status-01SSOT.js';

const FALLBACK_WARN_RATIO = 0.3;

/**
 * @param {object} opts
 * @param {object} [opts.serverStatus] pre-fetched buildAiProviderStatus result
 * @param {object} [opts.reqHeaders] request headers for provider resolution
 * @param {string} [opts.narratedBy] template | advisor
 * @param {number|null} [opts.fallbackRate] 0–1 template fallback rate (24h)
 * @returns {{ mode: string, configured: boolean, slideVisionReady: boolean, needsUserAction: boolean, aiKeyConfigured: boolean|null }}
 */
export function resolveAiReadiness(opts = {}) {
  const serverStatus = opts.serverStatus || buildAiProviderStatus(opts.reqHeaders || {});
  const narratedBy = String(opts.narratedBy || 'template').toLowerCase();
  const fallbackRate = opts.fallbackRate != null ? Number(opts.fallbackRate) : null;

  const serverReady = Boolean(serverStatus?.configured && serverStatus?.slideVisionReady);
  const configured = Boolean(serverStatus?.configured);
  const slideVisionReady = Boolean(serverStatus?.slideVisionReady);

  let mode = 'template';
  if (serverReady) mode = 'server';
  else if (configured) mode = 'server';

  const needsUserAction = !serverReady && narratedBy === 'template';

  let aiKeyConfigured = null;
  if (serverReady) aiKeyConfigured = true;
  else if (needsUserAction) aiKeyConfigured = false;

  const suppressAdvisorBadge = fallbackRate != null && fallbackRate >= FALLBACK_WARN_RATIO;

  return {
    mode,
    label: serverStatus?.label || 'Built-in templates',
    configured,
    slideVisionReady,
    needsUserAction,
    aiKeyConfigured,
    suppressAdvisorBadge,
    serverStatus,
  };
}
