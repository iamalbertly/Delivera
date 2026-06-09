/**
 * SSOT: client-side governance brief cache (sessionStorage) to avoid duplicate fetches across pages.
 */
const SESSION_KEY = 'delivera:brief:cache:v1';
const DEFAULT_TTL_MS = 3 * 60 * 1000;

function cacheKey(projects, quarter = '', periodWindow = '') {
  const periodKey = String(periodWindow || '').toLowerCase();
  return `${String(projects || '').trim().toUpperCase()}|${String(quarter || '').trim()}|${periodKey}`;
}

function readEntry(projects, quarter, periodWindow = '') {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const entry = map?.[cacheKey(projects, quarter, periodWindow)];
    if (!entry?.brief || !entry?.at) return null;
    if (Date.now() - entry.at > (entry.ttlMs || DEFAULT_TTL_MS)) return null;
    return entry;
  } catch (_) {
    return null;
  }
}

function writeEntry(projects, quarter, brief, ttlMs = DEFAULT_TTL_MS, periodWindow = '') {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const periodKey = String(periodWindow || brief?.meta?.periodWindow || '').toLowerCase();
    map[cacheKey(projects, quarter, periodKey)] = { brief, at: Date.now(), ttlMs };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(map));
  } catch (_) {}
}

export function normalizeProjectsCsv(projects) {
  return String(projects || '')
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(',');
}

export function briefMatchesProjects(brief, projectsCsv) {
  const requested = normalizeProjectsCsv(projectsCsv);
  const fromBrief = normalizeProjectsCsv((brief?.projects || []).join(','));
  if (!fromBrief) return true;
  return Boolean(requested && requested === fromBrief);
}

export function invalidateBriefCacheEntry(projects, quarter = '', periodWindow = '') {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    const pk = String(projects || '').trim().toUpperCase();
    const q = String(quarter || '').trim();
    const periodKey = String(periodWindow || '').toLowerCase();
    if (periodKey) {
      delete map[cacheKey(pk, q, periodKey)];
    } else {
      for (const key of Object.keys(map)) {
        if (key.startsWith(`${pk}|${q}|`) || key === `${pk}|${q}|`) delete map[key];
      }
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(map));
  } catch (_) { /* ignore */ }
}

/**
 * @param {{ projects: string, quarter?: string, force?: boolean }} opts
 * @returns {Promise<object|null>}
 */
export async function fetchGovernanceBriefCached({ projects, quarter = '', periodWindow = '', force = false } = {}) {
  const pk = String(projects || '').trim();
  if (!pk) return null;
  const periodKey = String(periodWindow || '').toLowerCase();
  if (force) invalidateBriefCacheEntry(pk, quarter, periodKey);
  if (!force) {
    const hit = readEntry(pk, quarter, periodKey);
    if (hit?.brief && briefMatchesProjects(hit.brief, pk)) {
      return hit.brief;
    }
  }
  const qs = new URLSearchParams({ projects: pk });
  if (quarter) qs.set('quarter', quarter);
  if (periodKey) qs.set('periodWindow', periodKey);
  if (force) qs.set('refresh', '1');
  const res = await fetch(`/api/governance-brief.json?${qs.toString()}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const brief = await res.json();
  writeEntry(pk, quarter, brief, DEFAULT_TTL_MS, periodKey);
  return brief;
}

export function peekGovernanceBriefCache(projects, quarter = '', periodWindow = '') {
  const periodKey = String(periodWindow || '').toLowerCase();
  const brief = readEntry(projects, quarter, periodKey)?.brief || null;
  if (!brief) return null;
  if (!briefMatchesProjects(brief, projects)) return null;
  return brief;
}
