/**
 * Lightweight client watchdog — surfaces API outages without silent failure.
 */
let watchdogTimer = null;

export function startDeliveraHealthWatchdog({ intervalMs = 60000 } = {}) {
  if (typeof window === 'undefined') return;
  // Global guard — prevents multiple watchdog instances when the module is loaded
  // multiple times (which happens with ES module re-imports).
  if (window.__deliveraHealthWatchdog || watchdogTimer) return;
  window.__deliveraHealthWatchdog = true;
  const ping = async () => {
    try {
      const res = await fetch('/healthz', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`healthz ${res.status}`);
      const body = await res.json();
      if (!body?.ok) throw new Error('healthz not ok');
      document.body?.classList.remove('delivera-api-degraded');
    } catch (_) {
      document.body?.classList.add('delivera-api-degraded');
    }
  };
  ping();
  watchdogTimer = window.setInterval(ping, intervalMs);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startDeliveraHealthWatchdog());
  } else {
    startDeliveraHealthWatchdog();
  }
}
