/**
 * Client fetch helpers — surface API errors without silent console-only failures.
 */

import { showSurfaceToast } from './Delivera-Shared-Surface-State-01SSOT.js';

export function logClientFetchFailure({ url = '', status = null, message = '', context = '' } = {}) {
  void fetch('/api/client-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, status, message, context }),
  }).catch(() => {});
}

export async function fetchJson(url, options = {}, logContext = '') {
  const res = await fetchWithRetry(url, options, logContext);
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = null;
  }
  if (!res.ok) {
    const msg = body?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    logClientFetchFailure({ url, status: res.status, message: msg, context: logContext });
    throw err;
  }
  return body;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

export async function fetchWithRetry(url, options = {}, logContext = '', { retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, options);
      if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      // Don't retry on abort — user cancelled intentionally
      if (err?.name === 'AbortError') throw err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      logClientFetchFailure({ url, status: null, message: err?.message || 'network', context: logContext });
      throw err;
    }
  }
  throw lastErr || new Error('fetch failed');
}

export function showInlineToast(host, message, kind = 'error') {
  // Delegate to the unified surface toast SSOT for consistent styling/animation.
  showSurfaceToast(host, message, kind);
}
