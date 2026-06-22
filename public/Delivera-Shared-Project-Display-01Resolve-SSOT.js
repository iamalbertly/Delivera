/**
 * SSOT: Client-side project display name resolution (cached catalog from API).
 */

let catalogCache = null;
let displayModeCache = 'label';
let catalogSourceCache = 'builtin';
let loadPromise = null;

function catalogEntry(key) {
  const k = String(key || '').trim().toUpperCase();
  if (!catalogCache) return null;
  return catalogCache.find((p) => p.key === k) || null;
}

/**
 * @returns {Promise<{ projects: object[], displayMode: string, catalogSource: string }>}
 */
export async function ensureProjectCatalogLoaded() {
  if (catalogCache) {
    return { projects: catalogCache, displayMode: displayModeCache, catalogSource: catalogSourceCache };
  }
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch('/api/projects-catalog.json', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`catalog ${res.status}`);
      const data = await res.json();
      catalogCache = Array.isArray(data.projects) ? data.projects : [];
      displayModeCache = data.displayMode || 'label';
      catalogSourceCache = data.catalogSource || 'builtin';
    } catch (_) {
      catalogCache = [];
      displayModeCache = 'label';
      catalogSourceCache = 'builtin';
    } finally {
      loadPromise = null;
    }
    return { projects: catalogCache, displayMode: displayModeCache, catalogSource: catalogSourceCache };
  })();
  return loadPromise;
}

export function seedProjectCatalogCache(data) {
  if (!data) return;
  catalogCache = Array.isArray(data.projects) ? data.projects : catalogCache;
  if (data.displayMode) displayModeCache = data.displayMode;
  if (data.catalogSource) catalogSourceCache = data.catalogSource;
}

export function invalidateProjectCatalogCache() {
  catalogCache = null;
  loadPromise = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'delivera_catalog_invalidate') invalidateProjectCatalogCache();
  });
}

/**
 * @param {string} key
 * @param {{ context?: 'chip'|'summary'|'export'|'tooltip', displayMode?: string, entry?: object|null }} [opts]
 */
export function resolveProjectDisplay(key, opts = {}) {
  const k = String(key || '').trim().toUpperCase();
  const mode = opts.displayMode || displayModeCache || 'label';
  const context = opts.context || 'summary';
  const entry = opts.entry !== undefined ? opts.entry : catalogEntry(k);
  const label = entry?.label || k;
  const short = entry?.shortLabel || label;
  const primary = context === 'chip' ? short : label;

  if (!entry) {
    return {
      key: k,
      primary: k,
      secondary: '',
      tooltip: k ? `Not in org catalog (Jira: ${k})` : '',
      ariaLabel: k,
      full: k,
    };
  }

  let primaryText = primary;
  let secondary = '';
  if (mode === 'key') {
    primaryText = k;
    secondary = label !== k ? label : '';
  } else if (mode === 'both') {
    primaryText = `${primary} (${k})`;
  }

  const subtitle = entry.subtitle ? String(entry.subtitle).trim() : '';
  const tooltip = subtitle
    ? `${label} (Jira: ${k}) — ${subtitle}`
    : `${label} (Jira: ${k})`;

  return {
    key: k,
    primary: primaryText,
    secondary,
    tooltip,
    ariaLabel: tooltip,
    full: mode === 'both' ? `${label} (${k})` : primaryText,
  };
}

/**
 * @param {string[]} keys
 * @param {{ context?: string, displayMode?: string }} [opts]
 */
export function summarizeProjectKeys(keys, opts = {}) {
  const list = (keys || []).map((k) => String(k || '').trim().toUpperCase()).filter(Boolean);
  if (!list.length) return { label: 'None', full: 'None' };
  const resolved = list.map((k) => resolveProjectDisplay(k, { ...opts, context: opts.context || 'summary' }).primary);
  if (resolved.length <= 2) return { label: resolved.join(', '), full: resolved.join(', ') };
  return {
    label: `${resolved[0]}, ${resolved[1]} +${resolved.length - 2}`,
    full: resolved.join(', '),
  };
}

export function getCachedCatalog() {
  return catalogCache ? [...catalogCache] : [];
}

export function formatProjectsCsvForDisplay(csv) {
  const keys = String(csv || '').split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
  if (!keys.length) return '';
  return summarizeProjectKeys(keys, { context: 'summary' }).full;
}
