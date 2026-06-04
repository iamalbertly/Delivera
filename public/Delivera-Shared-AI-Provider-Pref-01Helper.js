/**
 * SSOT: browser-only AI provider preference (localStorage). Keys never sent to Delivera server storage.
 */
import { AI_PROVIDER_PREF_KEY } from './Delivera-Shared-Storage-Keys.js';

const LEGACY_SESSION_KEY = 'wdd_ai_provider_v1';

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
    };
  } catch (_) {
    return { provider: 'built-in', key: '', host: '' };
  }
}

export function saveAiProviderPref(data = {}) {
  try {
    localStorage.setItem(AI_PROVIDER_PREF_KEY, JSON.stringify({
      provider: data.provider || 'built-in',
      key: data.key || '',
      host: data.host || '',
    }));
  } catch (_) { /* quota */ }
}

export function clearAiProviderPref() {
  try { localStorage.removeItem(AI_PROVIDER_PREF_KEY); } catch (_) {}
}

/** Headers for fetch calls that use optional AI (never log key). */
export function aiProviderRequestHeaders() {
  const ai = readAiProviderPref();
  const headers = {};
  if (ai.provider && ai.provider !== 'built-in') {
    headers['x-ai-provider'] = ai.provider;
    if (ai.key) headers['x-ai-key'] = ai.key;
    if (ai.host) headers['x-ai-host'] = ai.host;
  }
  return headers;
}

export function hasAiProviderKey() {
  const ai = readAiProviderPref();
  return Boolean(ai.key && ai.provider && ai.provider !== 'built-in');
}
