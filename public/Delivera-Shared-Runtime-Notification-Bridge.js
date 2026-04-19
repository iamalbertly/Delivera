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
    });
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
      appendRuntimeAlert({ level: 'error', message: normalizeArgs(args), source: 'console.error' });
    }
  };

  console.warn = function patchedConsoleWarn(...args) {
    try {
      origWarn(...args);
    } finally {
      appendRuntimeAlert({ level: 'warn', message: normalizeArgs(args), source: 'console.warn' });
    }
  };

  window.addEventListener(
    'error',
    (ev) => {
      const msg = ev?.message || (ev?.error && ev.error.message) || 'Script error';
      appendRuntimeAlert({ level: 'error', message: String(msg), source: 'window.error' });
    },
    true,
  );

  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    const msg = r instanceof Error ? r.stack || r.message : String(r);
    appendRuntimeAlert({ level: 'error', message: msg, source: 'unhandledrejection' });
  });
}

initRuntimeNotificationBridge();
