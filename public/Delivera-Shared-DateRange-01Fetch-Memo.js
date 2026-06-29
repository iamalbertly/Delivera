/**
 * Memoized /api/date-range fetches — mirrors quarters-list memo pattern.
 */
const inFlight = new Map();
const cache = new Map();

export async function fetchDateRangeMemo(quarterNum) {
  const key = `Q${quarterNum}`;
  if (cache.has(key)) return cache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = fetch(`/api/date-range?quarter=${encodeURIComponent(key)}`)
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.start && data?.end) cache.set(key, data);
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}

export function clearDateRangeMemo() {
  cache.clear();
  inFlight.clear();
}
