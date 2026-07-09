/**
 * SSOT: browser-only AI provider preference (localStorage). Keys never sent to Delivera server storage.
 */
import { AI_PROVIDER_PREF_KEY } from './Delivera-Shared-Storage-Keys.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';

const LEGACY_SESSION_KEY = 'wdd_ai_provider_v1';
const STATUS_CACHE_TTL_MS = 60_000;

function migrateSessionToLocal() {
  try {
    const existing = localStorage.getItem(AI_PROVIDER_PREF_KEY);
    if (existing) return;
    const raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (raw) localStorage.setItem(AI_PROVIDER_PREF_KEY, raw);
  } catch (_) { /* ignore */ }
}

migrateSessionToLocal();

export function readAiProviderPref() {
  try {
    const data = JSON.parse(localStorage.getItem(AI_PROVIDER_PREF_KEY) || 'null') || {};
    return {
      provider: data.provider || 'built-in',
      key: data.key || '',
      host: data.host || '',
      lastTestOk: Boolean(data.lastTestOk),
      lastTestAt: data.lastTestAt || null,
    };
  } catch (_) {
    return { provider: 'built-in', key: '', host: '', lastTestOk: false, lastTestAt: null };
  }
}

export function saveAiProviderPref(data = {}) {
  try {
    const prior = readAiProviderPref();
    const next = {
      provider: data.provider || 'built-in',
      key: data.key !== undefined ? data.key : prior.key,
      host: data.host !== undefined ? data.host : prior.host,
      lastTestOk: data.lastTestOk !== undefined ? Boolean(data.lastTestOk) : prior.lastTestOk,
      lastTestAt: data.lastTestAt !== undefined ? data.lastTestAt : prior.lastTestAt,
    };
    localStorage.setItem(AI_PROVIDER_PREF_KEY, JSON.stringify(next));
    emitAiCapabilityChanged();
  } catch (_) { /* quota */ }
}

export function clearAiProviderPref() {
  try { localStorage.removeItem(AI_PROVIDER_PREF_KEY); } catch (_) {}
  emitAiCapabilityChanged();
}

export function emitAiCapabilityChanged() {
  try {
    window.dispatchEvent(new CustomEvent('app:aiCapabilityChanged'));
  } catch (_) { /* ignore */ }
}

/** Browser override active only when key saved and last provider test succeeded. */
export function browserOverrideActive() {
  const ai = readAiProviderPref();
  return Boolean(ai.key && ai.provider && ai.provider !== 'built-in' && ai.lastTestOk);
}

/** Headers for fetch calls — only when browser override is confirmed working. */
export function aiProviderRequestHeaders() {
  if (!browserOverrideActive()) return {};
  const ai = readAiProviderPref();
  const headers = { 'x-ai-provider': ai.provider };
  if (ai.key) headers['x-ai-key'] = ai.key;
  if (ai.host) headers['x-ai-host'] = ai.host;
  headers['x-ai-override'] = '1';
  return headers;
}

export function hasAiProviderKey() {
  const ai = readAiProviderPref();
  return Boolean(ai.key && ai.provider && ai.provider !== 'built-in');
}

const statusCache = { env: null, effective: null, envAt: 0, effectiveAt: 0 };

export function invalidateAiStatusCache() {
  statusCache.env = null;
  statusCache.effective = null;
  statusCache.envAt = 0;
  statusCache.effectiveAt = 0;
}

function cacheFresh(at) {
  return at > 0 && (Date.now() - at) < STATUS_CACHE_TTL_MS;
}

async function fetchStatusFromServer(headers = {}) {
  const init = Object.keys(headers).length ? { headers } : {};
  return fetchJson('/api/ai-provider-status.json', init, 'ai-provider-status');
}

/**
 * @param {boolean|{ force?: boolean, effective?: boolean }} opts
 */
export async function fetchAiProviderStatus(opts = false) {
  const force = typeof opts === 'boolean' ? opts : Boolean(opts?.force);
  const wantEffective = typeof opts === 'object' ? opts.effective !== false : true;
  const override = browserOverrideActive();
  const bucket = wantEffective && override ? 'effective' : 'env';
  if (!force && cacheFresh(statusCache[`${bucket}At`]) && statusCache[bucket]) {
    return statusCache[bucket];
  }
  try {
    const headers = wantEffective && override ? aiProviderRequestHeaders() : {};
    const status = await fetchStatusFromServer(headers);
    statusCache[bucket] = status;
    statusCache[`${bucket}At`] = Date.now();
    if (bucket === 'effective') {
      statusCache.env = null;
      statusCache.envAt = 0;
    }
    return status;
  } catch (_) {
    const fallback = {
      provider: 'built-in',
      configured: false,
      slideVisionReady: false,
      label: 'Built-in templates',
      slideVision: { ready: false, provider: 'built-in', source: 'none', envProvider: 'built-in' },
    };
    if (!force) {
      statusCache[bucket] = fallback;
      statusCache[`${bucket}At`] = Date.now();
    }
    return fallback;
  }
}

/** @deprecated use resolveEffectiveAiCapability from Delivera-AI-Readiness-01SSOT.js */
export async function slideVisionReady() {
  const override = browserOverrideActive();
  const status = await fetchAiProviderStatus({ effective: override });
  return Boolean(status?.slideVisionReady || status?.slideVision?.ready);
}
