/**
 * SSOT: client-side portfolio decision cache (sessionStorage) — peek + background revalidate.
 */
const SESSION_KEY = 'delivera:portfolio-decision:cache:v2';
const DEFAULT_TTL_MS = 3 * 60 * 1000;

function cacheKey(anchor, compare, periodKey, briefId = '') {
  const compareKey = (Array.isArray(compare) ? compare : String(compare || '').split(','))
    .map((p) => String(p || '').trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(',');
  return `${String(anchor || '').trim().toUpperCase()}|${compareKey}|${String(periodKey || '').trim()}|${String(briefId || '').trim().slice(0, 64)}`;
}

function readMap() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function writeMap(map) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(map));
  } catch (_) { /* ignore quota */ }
}

export function peekPortfolioDecisionCache({ anchor = '', compare = [], periodKey = '', briefId = '' } = {}) {
  const map = readMap();
  const entry = map[cacheKey(anchor, compare, periodKey, briefId)];
  if (!entry?.payload || !entry?.at) return null;
  const ttlMs = entry.ttlMs || DEFAULT_TTL_MS;
  const ageMs = Date.now() - entry.at;
  const stale = ageMs > ttlMs;
  return {
    payload: entry.payload,
    at: entry.at,
    ttlMs,
    stale,
    ageMs,
  };
}

export function writePortfolioDecisionCache({
  anchor = '',
  compare = [],
  periodKey = '',
  briefId = '',
  payload = null,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  if (!payload) return;
  const map = readMap();
  const serverTtl = Number(payload?.meta?.cacheTtlMs);
  const effectiveTtl = Number.isFinite(serverTtl) && serverTtl > 0
    ? Math.min(serverTtl, DEFAULT_TTL_MS)
    : ttlMs;
  map[cacheKey(anchor, compare, periodKey, briefId)] = {
    payload,
    at: Date.now(),
    ttlMs: effectiveTtl,
  };
  writeMap(map);
}

export function invalidatePortfolioDecisionCacheEntry({
  anchor = '',
  compare = [],
  periodKey = '',
  briefId = '',
} = {}) {
  const map = readMap();
  const anchorKey = String(anchor || '').trim().toUpperCase();
  const period = String(periodKey || '').trim();
  const brief = String(briefId || '').trim().slice(0, 64);
  if (compare?.length || brief) {
    delete map[cacheKey(anchor, compare, periodKey, briefId)];
  } else {
    for (const key of Object.keys(map)) {
      if (key.startsWith(`${anchorKey}|`) && (!period || key.includes(`|${period}|`))) {
        delete map[key];
      }
    }
  }
  writeMap(map);
}

/**
 * @returns {{ servedFromCache: boolean, stale: boolean }}
 */
export async function fetchPortfolioDecisionCached({
  anchor,
  compare,
  periodKey,
  briefId,
  brief,
  baselineMode,
  baselineMissing,
  partialSquads,
  cases,
  fetcher,
  force = false,
} = {}) {
  if (!force) {
    const peeked = peekPortfolioDecisionCache({ anchor, compare, periodKey, briefId });
    if (peeked?.payload) {
      if (!peeked.stale) {
        return { payload: peeked.payload, servedFromCache: true, stale: false };
      }
      void fetcher({
        brief,
        anchor,
        compare,
        periodKey,
        baselineMode,
        baselineMissing,
        partialSquads,
        cases,
        refresh: true,
      }).then((fresh) => {
        if (fresh?.decision) {
          writePortfolioDecisionCache({
            anchor,
            compare,
            periodKey,
            briefId,
            payload: fresh,
          });
          try {
            window.dispatchEvent(new CustomEvent('portfolio:decision-revalidated', { detail: { payload: fresh } }));
          } catch (_) { /* ignore */ }
        }
      }).catch(() => {});
      return { payload: peeked.payload, servedFromCache: true, stale: true };
    }
  } else {
    invalidatePortfolioDecisionCacheEntry({ anchor, compare, periodKey, briefId });
  }

  const payload = await fetcher({
    brief,
    anchor,
    compare,
    periodKey,
    baselineMode,
    baselineMissing,
    partialSquads,
    cases,
  });
  if (payload?.decision) {
    writePortfolioDecisionCache({ anchor, compare, periodKey, briefId, payload });
  }
  return { payload, servedFromCache: false, stale: false };
}
