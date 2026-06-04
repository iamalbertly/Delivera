/**
 * SSOT: Governance worker job + action inbox stores (append-only JSONL).
 */
import { mkdir, appendFile, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { saveProfileOverride } from './Delivera-Governance-Profile-01Resolve-SSOT.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const JOBS_FILE = join(DATA_DIR, 'Delivera-Governance-Jobs.jsonl');
const INBOX_FILE = join(DATA_DIR, 'Delivera-Governance-Inbox.jsonl');

const INBOX_TYPES = new Set(['brief', 'nudge', 'pi-drift', 'confirm', 'impact', 'po-readiness']);

async function readJsonl(path) {
  try {
    const raw = await readFile(path, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

async function appendJsonl(path, row) {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(path, `${JSON.stringify(row)}\n`, 'utf8');
}

/**
 * @param {object} entry
 * @returns {Promise<object>}
 */
export async function recordJob(entry) {
  const row = {
    id: entry?.id || randomUUID(),
    type: String(entry?.type || '').trim(),
    status: String(entry?.status || 'running').trim(),
    projects: Array.isArray(entry?.projects) ? entry.projects.map((p) => String(p).trim().toUpperCase()) : [],
    startedAt: entry?.startedAt || new Date().toISOString(),
    completedAt: entry?.completedAt || null,
    dataFreshness: entry?.dataFreshness || 'live',
    errors: Array.isArray(entry?.errors) ? entry.errors : [],
    outputs: entry?.outputs || {},
    narratedBy: entry?.narratedBy || 'template',
  };
  await appendJsonl(JOBS_FILE, row);
  return row;
}

export async function updateJobStatus(jobId, patch = {}) {
  const all = await readJsonl(JOBS_FILE);
  const idx = all.findIndex((j) => j.id === jobId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(JOBS_FILE, `${all.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
  return all[idx];
}

export async function readRecentJobs({ project = null, limit = 5, type = null } = {}) {
  const all = await readJsonl(JOBS_FILE);
  const wanted = project ? String(project).trim().toUpperCase() : null;
  let filtered = wanted
    ? all.filter((j) => (j.projects || []).includes(wanted) || (j.projects || []).join('+') === wanted)
    : all;
  if (type) filtered = filtered.filter((j) => j.type === type);
  return filtered.slice(-limit).reverse();
}

export async function hasRecentRunningJob({ type, projects, withinMinutes = 10 }) {
  const key = (projects || []).join('+');
  const cutoff = Date.now() - withinMinutes * 60 * 1000;
  const recent = await readRecentJobs({ limit: 20 });
  return recent.some((j) => {
    if (j.type !== type || j.status !== 'running') return false;
    const pKey = (j.projects || []).join('+');
    if (pKey !== key) return false;
    const started = new Date(j.startedAt).getTime();
    return Number.isFinite(started) && started >= cutoff;
  });
}

/**
 * @param {object} item
 * @returns {Promise<object>}
 */
export async function appendInboxItem(item) {
  const type = String(item?.type || '').trim();
  if (!INBOX_TYPES.has(type)) throw new Error(`Unknown inbox type: ${type}`);
  const row = {
    id: item?.id || randomUUID(),
    jobId: item?.jobId || '',
    type,
    projects: Array.isArray(item?.projects) ? item.projects.map((p) => String(p).trim().toUpperCase()) : [],
    summary: String(item?.summary || '').slice(0, 300),
    safeToSend: item?.safeToSend === true,
    approvalRequired: item?.approvalRequired !== false,
    evidenceLinks: Array.isArray(item?.evidenceLinks) ? item.evidenceLinks : [],
    payload: item?.payload || {},
    resolution: null,
    resolvedAt: null,
    staleDismissCount: Number(item?.staleDismissCount) || 0,
    createdAt: item?.createdAt || new Date().toISOString(),
  };
  await appendJsonl(INBOX_FILE, row);
  return row;
}

function isExpired(item, maxAgeHours) {
  const created = new Date(item.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created > maxAgeHours * 3600 * 1000;
}

/**
 * @param {object} [opts]
 * @returns {Promise<object[]>}
 */
export async function readPendingInboxItems({ project = null, maxAgeHours = 168 } = {}) {
  const all = await readJsonl(INBOX_FILE);
  const wanted = project ? String(project).trim().toUpperCase() : null;
  const latestById = new Map();
  for (const row of all) {
    latestById.set(row.id, row);
  }
  let items = Array.from(latestById.values()).filter((r) => !r.resolution && !isExpired(r, maxAgeHours));
  if (wanted) {
    items = items.filter((r) => !r.projects?.length || r.projects.includes(wanted));
  }
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function resolveInboxItem(id, { resolution = 'dismissed', editedContent = '', userId = 'unknown' } = {}) {
  const all = await readJsonl(INBOX_FILE);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error('Inbox item not found');
  const item = all[idx];
  const staleDismissCount = resolution === 'dismissed' && item.type === 'confirm'
    ? (Number(item.staleDismissCount) || 0) + 1
    : Number(item.staleDismissCount) || 0;
  const updated = {
    ...item,
    resolution,
    resolvedAt: new Date().toISOString(),
    editedContent: String(editedContent || '').slice(0, 2000),
    staleDismissCount,
  };
  all[idx] = updated;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(INBOX_FILE, `${all.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');

  if (resolution === 'dismissed' && staleDismissCount >= 3 && item.type === 'confirm') {
    const scope = item.projects?.[0] ? `project:${item.projects[0]}` : 'portfolio:*';
    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    try {
      await saveProfileOverride({
        scope,
        key: 'suppressStaleConfirm',
        value: until,
        approvedBy: userId,
      });
    } catch (_) { /* non-blocking */ }
  }
  return updated;
}

export function groupInboxByType(items = []) {
  return {
    briefs: items.filter((i) => i.type === 'brief'),
    nudges: items.filter((i) => i.type === 'nudge'),
    piDrift: items.filter((i) => i.type === 'pi-drift'),
    confirm: items.filter((i) => i.type === 'confirm'),
    impact: items.filter((i) => i.type === 'impact'),
    poReadiness: items.filter((i) => i.type === 'po-readiness'),
  };
}
