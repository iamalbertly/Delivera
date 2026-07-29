/**
 * Persisted Jira board-access flags per catalog project key.
 */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cache } from './cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const INDEX_FILE = join(DATA_DIR, 'Delivera-Shared-Projects-Access-Index.json');
const CACHE_KEY = 'jira-access:projects-index:v2';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function readProjectsAccessIndex() {
  const cached = await cache.get(CACHE_KEY, { namespace: 'jira-access' });
  if (Array.isArray(cached?.value?.projects)) return cached.value.projects;
  try {
    const raw = await readFile(INDEX_FILE, 'utf8');
    const data = JSON.parse(raw);
    const projects = Array.isArray(data?.projects) ? data.projects : [];
    if (projects.length) {
      await cache.set(CACHE_KEY, { projects, migratedAt: new Date().toISOString() }, CACHE_TTL_MS, {
        namespace: 'jira-access',
      });
    }
    return projects;
  } catch (err) {
    return [];
  }
}

export async function writeProjectsAccessIndex(entries = []) {
  return cache.set(CACHE_KEY, {
    projects: entries,
    updatedAt: new Date().toISOString(),
  }, CACHE_TTL_MS, { namespace: 'jira-access' });
}

export async function getAccessMap() {
  const rows = await readProjectsAccessIndex();
  const map = new Map();
  for (const row of rows) {
    const key = String(row.projectKey || '').trim().toUpperCase();
    if (key) map.set(key, row);
  }
  return map;
}

export async function upsertAccessRow(projectKey, accessible, userId = 'system', details = {}) {
  const key = String(projectKey || '').trim().toUpperCase();
  if (!key) return;
  const rows = await readProjectsAccessIndex();
  const previous = rows.find((row) => row.projectKey === key) || {};
  const next = rows.filter((r) => r.projectKey !== key);
  const probeSucceeded = accessible === true || accessible === false;
  next.unshift({
    projectKey: key,
    accessible: probeSucceeded ? accessible === true : previous.accessible ?? null,
    lastChecked: new Date().toISOString(),
    lastSuccessAt: probeSucceeded ? new Date().toISOString() : previous.lastSuccessAt || previous.lastChecked || null,
    boardCount: probeSucceeded ? Math.max(0, Number(details.boardCount) || 0) : previous.boardCount ?? null,
    state: probeSucceeded ? (accessible ? 'verified' : 'no-board') : 'degraded',
    errorCode: probeSucceeded ? '' : String(details.errorCode || 'JIRA_PROBE_FAILED').slice(0, 80),
    userId: userId || 'system',
  });
  await writeProjectsAccessIndex(next.slice(0, 64));
}

export async function readAccessibleCatalogKeys(catalogKeys = []) {
  const map = await getAccessMap();
  const accessible = catalogKeys.filter((k) => map.get(k)?.accessible === true);
  if (accessible.length) return accessible;
  return catalogKeys;
}
