/**
 * Persisted Jira board-access flags per catalog project key.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const INDEX_FILE = join(DATA_DIR, 'Delivera-Shared-Projects-Access-Index.json');

export async function readProjectsAccessIndex() {
  try {
    const raw = await readFile(INDEX_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.projects) ? data.projects : [];
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    return [];
  }
}

export async function writeProjectsAccessIndex(entries = []) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(INDEX_FILE, `${JSON.stringify({ projects: entries, updatedAt: new Date().toISOString() })}\n`, 'utf8');
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
