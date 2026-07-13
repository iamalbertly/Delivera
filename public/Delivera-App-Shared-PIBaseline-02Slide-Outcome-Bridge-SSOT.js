/**
 * SSOT: Client cache for slide propose results + Work Draft / PI focus bridge.
 */
const CACHE_KEY = 'delivera_pi_slide_propose_v2';

export function cacheSlideProposeResult(data = {}) {
  if (!data || typeof data !== 'object') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      method: data.method || '',
      createWorkNarrative: data.createWorkNarrative || '',
      matchedCount: Number(data.matchedCount) || 0,
      missingCount: Number(data.missingCount) || 0,
      duplicateRisk: Array.isArray(data.duplicateRisk) ? data.duplicateRisk.length : 0,
      extracted: (data.extracted || []).length,
      resolved: data.resolved || [],
    }));
  } catch (_) { /* quota */ }
}

export function readCachedSlidePropose() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function mergePiFocusWithCache(piFocus = {}) {
  const cached = readCachedSlidePropose();
  if (!cached) return piFocus;
  const narrative = cached.createWorkNarrative || piFocus.createWorkNarrative || '';
  const missing = Number(cached.missingCount) || piFocus.proposedMissing || 0;
  const dup = Number(cached.duplicateRisk) || piFocus.duplicateRiskCount || 0;
  const matched = Number(cached.matchedCount) || piFocus.matchedCount || 0;
  let synergy = piFocus.synergy || 'ok';
  if ((missing > 0 || dup > 0) && synergy !== 'low') synergy = 'low';
  return {
    ...piFocus,
    synergy,
    reason: missing > 0 ? 'slide-missing' : (dup > 0 ? 'slide-missing' : piFocus.reason),
    proposedMissing: missing || piFocus.proposedMissing,
    duplicateRiskCount: dup,
    matchedCount: matched,
    createWorkNarrative: narrative,
    primaryAction: narrative ? 'create-work' : piFocus.primaryAction,
    aiKnows: {
      method: cached.method || '',
      extractedCount: cached.extracted || 0,
      cachedAt: cached.ts || null,
    },
  };
}

export function dispatchPiBaselineEpicsCreated(createdKeys = [], source = 'work-draft') {
  const keys = (createdKeys || []).map((k) => String(k || '').toUpperCase()).filter(Boolean);
  if (!keys.length) return;
  window.dispatchEvent(new CustomEvent('app:piBaselineEpicsCreated', {
    detail: { createdKeys: keys, source },
  }));
}
