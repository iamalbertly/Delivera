/**
 * On localhost only: forwards console.warn/error, window errors, and unhandled rejections
 * into the shared notification store so they surface in the bell/sidebar like sprint alerts.
 */
import {
  readNotificationSummary,
  writeNotificationSummary,
  refreshNotificationDockFromStore,
} from './Delivera-Shared-Notifications-Dock-Manager.js';

const MAX_RUNTIME = 30;
const DEDUPE_MS = 4500;
let installed = false;

function isLocalDevHost() {
  if (typeof window === 'undefined' || !window.location) return false;
  const h = String(window.location.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
}

function normalizeArgs(args) {
  return Array.from(args)
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      try {
        if (a !== null && typeof a === 'object') return JSON.stringify(a);
        return String(a);
      } catch (_) {
        return '[object]';
      }
    })
    .join(' ');
}

function appendRuntimeAlert({ level, message, source }) {
  try {
    if (!message || !String(message).trim()) return;
    const text = String(message).slice(0, 800);
    const prev = readNotificationSummary() || {};
    const list = Array.isArray(prev.runtimeAlerts) ? [...prev.runtimeAlerts] : [];
    const now = Date.now();
    const last = list[list.length - 1];
    if (last && last.message === text && now - (last.at || 0) < DEDUPE_MS) return;
    list.push({
      id: `${now}-${list.length}`,
      level: level || 'error',
      message: text,
      source: source || 'runtime',
      at: now,
      diagnosticsOnly: true,
    });
    try {
      window.__deliveraDiagnostics = list.slice(-MAX_RUNTIME);
    } catch (_) {}
    while (list.length > MAX_RUNTIME) list.shift();
    const next = {
      ...prev,
      runtimeAlerts: list,
      total: typeof prev.total === 'number' ? prev.total : Number(prev.total) || 0,
    };
    writeNotificationSummary(next);
    try {
      window.dispatchEvent(new CustomEvent('app:notification-summary-updated', { detail: next }));
    } catch (_) {}
    refreshNotificationDockFromStore();
  } catch (_) {}
}

function diagnosticsEnabled() {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true;
    return localStorage.getItem('delivera_diagnostics_v1') === '1';
  } catch (_) {
    return false;
  }
}

function maybeAppendRuntimeAlert(opts) {
  if (!diagnosticsEnabled()) return;
  appendRuntimeAlert(opts);
}

export function initRuntimeNotificationBridge() {
  if (installed || typeof window === 'undefined') return;
  if (!isLocalDevHost()) return;
  installed = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = function patchedConsoleError(...args) {
    try {
      origError(...args);
    } finally {
      const text = normalizeArgs(args);
      if (/runtime\.lastError|message port closed|extension/i.test(text)) return;
      maybeAppendRuntimeAlert({ level: 'error', message: text, source: 'console.error' });
    }
  };

  console.warn = function patchedConsoleWarn(...args) {
    try {
      origWarn(...args);
    } finally {
      const text = normalizeArgs(args);
      if (/runtime\.lastError|message port closed|extension/i.test(text)) return;
      maybeAppendRuntimeAlert({ level: 'warn', message: text, source: 'console.warn' });
    }
  };

  window.addEventListener(
    'error',
    (ev) => {
      const msg = ev?.message || (ev?.error && ev.error.message) || 'Script error';
      maybeAppendRuntimeAlert({ level: 'error', message: String(msg), source: 'window.error' });
    },
    true,
  );

  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    const msg = r instanceof Error ? r.stack || r.message : String(r);
    maybeAppendRuntimeAlert({ level: 'error', message: msg, source: 'unhandledrejection' });
  });
}

const RECONNECT_DELAYS_MS = [1000, 2000, 4000];
let reconnectToastVisible = false;

function shouldRetryFetch(response, error) {
  if (error) return true;
  if (!response) return false;
  return response.status === 502 || response.status === 503 || response.status === 504;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showReconnectToast(message) {
  try {
    appendRuntimeAlert({ level: 'warn', message, source: 'reconnect' });
    reconnectToastVisible = true;
  } catch (_) {}
}

function clearReconnectToast() {
  if (!reconnectToastVisible) return;
  reconnectToastVisible = false;
  try {
    window.dispatchEvent(new CustomEvent('delivera:server-back'));
  } catch (_) {}
}

async function fetchWithReconnect(input, init) {
  const nativeFetch = fetchWithReconnect.__native || window.fetch.bind(window);
  let lastError = null;
  let lastResponse = null;

  for (let attempt = 0; attempt <= RECONNECT_DELAYS_MS.length; attempt++) {
    try {
      const response = await nativeFetch(input, init);
      lastResponse = response;
      if (!shouldRetryFetch(response, null) || attempt >= RECONNECT_DELAYS_MS.length) {
        if (response?.ok) clearReconnectToast();
        return response;
      }
      showReconnectToast('Reconnecting to server…');
      await sleep(RECONNECT_DELAYS_MS[attempt] || 4000);
    } catch (error) {
      lastError = error;
      if (attempt >= RECONNECT_DELAYS_MS.length) break;
      showReconnectToast('Reconnecting to server…');
      await sleep(RECONNECT_DELAYS_MS[attempt] || 4000);
    }
  }

  if (lastError) throw lastError;
  if (lastResponse) return lastResponse;
  return nativeFetch(input, init);
}

export function initFetchReconnectBridge() {
  if (typeof window === 'undefined' || fetchWithReconnect.__patched) return;
  fetchWithReconnect.__native = window.fetch.bind(window);
  fetchWithReconnect.__patched = true;
  window.fetch = fetchWithReconnect;
}

initRuntimeNotificationBridge();
initFetchReconnectBridge();
