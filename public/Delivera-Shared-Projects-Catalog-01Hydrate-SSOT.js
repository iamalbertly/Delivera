/**
 * SSOT: hydrate project pickers from /api/projects-catalog.json.
 */
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';
import { seedProjectCatalogCache } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import { defaultSelectedKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';

/**
 * @returns {Promise<{ projects: object[], displayMode: string, catalogSource: string }>}
 */
export async function fetchProjectsCatalog() {
  const res = await fetch('/api/projects-catalog.json', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const data = await res.json();
  seedProjectCatalogCache(data);
  return data;
}

export function readStoredProjectKeys() {
  try {
    const raw = localStorage.getItem(PROJECTS_SSOT_KEY);
    if (!raw) return [];
    return raw.split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function isProjectSelected(key, stored, catalogEntry) {
  const pk = String(key || '').trim().toUpperCase();
  if (stored.length) return stored.includes(pk);
  return Boolean(catalogEntry?.defaultSelected);
}

export function fallbackDefaultKey(catalog) {
  const fromCatalog = catalog.find((p) => p.defaultSelected)?.key;
  return fromCatalog || catalog[0]?.key || defaultSelectedKeys()[0] || 'MPSA';
}
