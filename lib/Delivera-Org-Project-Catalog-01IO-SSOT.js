/**
 * SSOT: Org project catalog from data/Delivera-Org-Project-Catalog.json with JS fallback.
 */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  PROJECT_CATALOG,
  readCatalogKeys,
  defaultSelectedKeys,
} from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import { logger } from './Delivera-Server-Logging-Utility.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = join(__dirname, '..', 'data', 'Delivera-Org-Project-Catalog.json');

let cachedCatalog = null;
let catalogSource = 'builtin';

function normalizeEntry(raw) {
  const key = String(raw?.key || '').trim().toUpperCase();
  if (!key) return null;
  const label = String(raw?.label || key).trim();
  const shortLabel = String(raw?.shortLabel || label).trim();
  return {
    key,
    label,
    shortLabel,
    subtitle: raw?.subtitle ? String(raw.subtitle).trim() : undefined,
    portfolioGroup: raw?.portfolioGroup ? String(raw.portfolioGroup).trim() : undefined,
    entityType: String(raw?.entityType || 'delivery-squad').trim().toLowerCase(),
    scoreable: raw?.scoreable !== false,
    defaultSelected: Boolean(raw?.defaultSelected),
  };
}

function fromBuiltin() {
  return PROJECT_CATALOG.map((entry) => normalizeEntry({
    ...entry,
    shortLabel: entry.shortLabel || entry.label,
  })).filter(Boolean);
}

function validateAndNormalize(parsed) {
  const list = Array.isArray(parsed?.projects) ? parsed.projects : [];
  const out = list.map(normalizeEntry).filter(Boolean);
  if (!out.length) throw new Error('Catalog JSON has no valid projects');
  return out;
}

/**
 * @returns {Promise<{ projects: object[], keys: string[], source: string }>}
 */
export async function loadOrgProjectCatalog() {
  if (cachedCatalog) {
    return {
      projects: cachedCatalog,
      keys: cachedCatalog.map((p) => p.key),
      source: catalogSource,
    };
  }
  try {
    const raw = await readFile(CATALOG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cachedCatalog = validateAndNormalize(parsed);
    catalogSource = 'json';
    return {
      projects: cachedCatalog,
      keys: cachedCatalog.map((p) => p.key),
      source: catalogSource,
    };
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      logger.warn('org project catalog JSON invalid, using builtin', { error: err?.message });
    }
    cachedCatalog = fromBuiltin();
    catalogSource = 'builtin';
    return {
      projects: cachedCatalog,
      keys: cachedCatalog.map((p) => p.key),
      source: catalogSource,
    };
  }
}

export function getProjectDisplayMode() {
  const mode = String(process.env.DELIVERA_PROJECT_DISPLAY_MODE || 'label').trim().toLowerCase();
  if (mode === 'key' || mode === 'both') return mode;
  return 'label';
}

export function catalogEntryFromList(projects, key) {
  const k = String(key || '').trim().toUpperCase();
  return projects.find((p) => p.key === k) || null;
}

export function readCatalogKeysFromLoaded(projects) {
  return projects.map((p) => p.key);
}

export function defaultSelectedKeysFromLoaded(projects) {
  return projects.filter((p) => p.defaultSelected).map((p) => p.key);
}

/** Invalidate in-memory cache (tests / hot reload). */
export function clearOrgProjectCatalogCache() {
  cachedCatalog = null;
  catalogSource = 'builtin';
}

/** Re-export for callers still on builtin during transition. */
export { readCatalogKeys, defaultSelectedKeys };
