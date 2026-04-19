function ensurePerfStore() {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.__perfMarks || typeof window.__perfMarks !== 'object') {
      window.__perfMarks = {};
    }
    return window.__perfMarks;
  } catch (_) {
    return null;
  }
}

export function resetPerfMarks(routeKey) {
  const store = ensurePerfStore();
  if (!store) return null;
  const key = String(routeKey || 'app').trim() || 'app';
  store[key] = {
    routeKey: key,
    navStart: Date.now(),
  };
  return store[key];
}

export function markPerf(routeKey, name, extra = {}) {
  const store = ensurePerfStore();
  if (!store) return null;
  const key = String(routeKey || 'app').trim() || 'app';
  if (!store[key]) {
    resetPerfMarks(key);
  }
  const entry = store[key];
  const now = Date.now();
  let nextValue = now;
  if (name === 'fullRenderComplete' && Number.isFinite(entry.firstValueRendered)) {
    nextValue = Math.max(now, entry.firstValueRendered);
  }
  if (Number.isFinite(entry[name])) {
    nextValue = Math.max(nextValue, entry[name]);
  }
  entry[name] = nextValue;
  if (extra && typeof extra === 'object') {
    Object.assign(entry, extra);
  }
  return entry;
}

export function readPerfMarks(routeKey) {
  const store = ensurePerfStore();
  if (!store) return null;
  const key = String(routeKey || 'app').trim() || 'app';
  return store[key] || null;
}
