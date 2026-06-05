/**
 * SSOT: deduplicated /api/quarters-list fetch with in-flight + session memoization.
 */
const inflight = new Map();
const SESSION_PREFIX = 'delivera:quarters:';

function sessionKey(count) {
  return `${SESSION_PREFIX}${count}`;
}

function readSession(count) {
  try {
    const raw = sessionStorage.getItem(sessionKey(count));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > 5 * 60 * 1000) return null;
    return parsed.data || null;
  } catch (_) {
    return null;
  }
}

function writeSession(count, data) {
  try {
    sessionStorage.setItem(sessionKey(count), JSON.stringify({ at: Date.now(), data }));
  } catch (_) {}
}

/**
 * @param {number} [count]
 * @param {{ includeCached?: boolean }} [options]
 * @returns {Promise<{ quarters: object[] }>}
 */
export async function fetchQuartersListMemo(count = 8, { includeCached = false } = {}) {
  const safeCount = Math.max(1, Number(count) || 8);
  const cached = readSession(safeCount);
  if (cached) return cached;

  const cacheKey = `${safeCount}:${includeCached ? 1 : 0}`;
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const qs = new URLSearchParams({ count: String(safeCount) });
  if (includeCached) qs.set('includeCached', '1');

  const promise = fetch(`/api/quarters-list?${qs.toString()}`, { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : { quarters: [] }))
    .catch(() => ({ quarters: [] }))
    .then((data) => {
      writeSession(safeCount, data);
      return data;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, promise);
  return promise;
}
