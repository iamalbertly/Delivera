export const DELIVERA_CLIENT_RELEASE_SCHEMA = '20260730a';

const RELEASE_KEY = 'delivera:runtime-release:v1';
const CHECK_INTERVAL_MS = 30 * 1000;
const CACHE_PREFIXES = [
  'delivera:governance:active-loop:',
  'delivera:current-sprint:snapshot:',
];

let lastCheckedAt = 0;
let checkInFlight = null;

function clearIncompatibleCaches() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch (_) {
    // Storage can be unavailable in private browsing; network truth still wins.
  }
}

function activeEditInProgress() {
  const active = document.activeElement;
  const editingField = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
  return Boolean(
    editingField
    || document.querySelector('dialog[open], [aria-modal="true"], .right-drawer.open, .drawer.open'),
  );
}

function storeRelease(release) {
  try { localStorage.setItem(RELEASE_KEY, release); } catch (_) { /* privacy mode */ }
}

function storedRelease() {
  try { return String(localStorage.getItem(RELEASE_KEY) || ''); } catch (_) { return ''; }
}

function reloadForRelease(release) {
  clearIncompatibleCaches();
  storeRelease(release);
  if (activeEditInProgress()) {
    window.addEventListener('focusout', () => window.location.reload(), { once: true });
    window.dispatchEvent(new CustomEvent('delivera:release-ready', { detail: { release } }));
    return;
  }
  window.location.reload();
}

async function readRuntimeRelease() {
  const response = await fetch('/healthz', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'x-delivera-release-check': '1' },
  });
  if (!response.ok) return '';
  const headerRelease = String(response.headers.get('x-delivera-release') || '').trim();
  if (headerRelease) return headerRelease;
  try {
    const body = await response.json();
    return String(body?.releaseId || '').trim();
  } catch (_) {
    return '';
  }
}

export function installReleaseCacheGuard() {
  const schemaKey = `${RELEASE_KEY}:schema`;
  try {
    if (localStorage.getItem(schemaKey) !== DELIVERA_CLIENT_RELEASE_SCHEMA) {
      clearIncompatibleCaches();
      localStorage.setItem(schemaKey, DELIVERA_CLIENT_RELEASE_SCHEMA);
    }
  } catch (_) { /* privacy mode */ }

  const check = async ({ force = false } = {}) => {
    if (!force && Date.now() - lastCheckedAt < CHECK_INTERVAL_MS) return;
    if (checkInFlight) return checkInFlight;
    lastCheckedAt = Date.now();
    checkInFlight = readRuntimeRelease()
      .then((release) => {
        if (!release) return;
        const prior = storedRelease();
        if (prior && prior !== release) reloadForRelease(release);
        else if (!prior) storeRelease(release);
      })
      .catch(() => {})
      .finally(() => { checkInFlight = null; });
    return checkInFlight;
  };

  check({ force: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === RELEASE_KEY && event.newValue && event.newValue !== event.oldValue) {
      reloadForRelease(event.newValue);
    }
  });
}
