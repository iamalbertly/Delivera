/**
 * SSOT: Agent queue store — unified queue for brief, inbox, bell, worker receipt.
 */
import { mkdir, appendFile, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { readPendingInboxItems, appendInboxItem } from './Delivera-Governance-Worker-02Jobs-IO.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const QUEUE_FILE = join(DATA_DIR, 'Delivera-Agent-Queue.jsonl');

export const AGENT_QUEUE_SOURCES = Object.freeze([
  'worker',
  'ai-orchestrator',
  'inbox',
  'brief',
  'settings',
]);

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

/**
 * @param {object} item
 */
export async function appendAgentQueueItem(item = {}) {
  const row = {
    id: item.id || randomUUID(),
    source: String(item.source || 'ai-orchestrator').slice(0, 32),
    agentType: String(item.agentType || 'general').slice(0, 32),
    taskType: String(item.taskType || '').slice(0, 64),
    summary: String(item.summary || '').slice(0, 300),
    aiContributed: item.aiContributed === true,
    approvalRequired: item.approvalRequired !== false,
    payload: item.payload || {},
    projects: Array.isArray(item.projects) ? item.projects.map((p) => String(p).trim().toUpperCase()) : [],
    createdAt: item.createdAt || new Date().toISOString(),
    resolvedAt: null,
  };
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(QUEUE_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

/**
 * @param {{ project?: string, limit?: number, aiOnly?: boolean }} [opts]
 */
export async function readAgentQueueItems({ project = null, limit = 50, aiOnly = false } = {}) {
  const stored = await readJsonl(QUEUE_FILE);
  const inbox = await readPendingInboxItems({ project, maxAgeHours: 168 });
  const inboxMapped = inbox.map((i) => ({
    id: i.id,
    source: 'inbox',
    agentType: i.type,
    taskType: i.type,
    summary: i.summary,
    aiContributed: Boolean(i.payload?.aiContributed),
    approvalRequired: i.approvalRequired !== false,
    payload: i.payload,
    projects: i.projects,
    createdAt: i.createdAt,
    resolvedAt: i.resolvedAt,
  }));

  const byId = new Map();
  for (const row of [...stored, ...inboxMapped]) {
    if (!row.resolvedAt) byId.set(row.id, row);
  }

  let items = Array.from(byId.values());
  const wanted = project ? String(project).trim().toUpperCase() : null;
  if (wanted) {
    items = items.filter((r) => !r.projects?.length || r.projects.includes(wanted));
  }
  if (aiOnly) items = items.filter((r) => r.aiContributed);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

export async function resolveAgentQueueItem(id, { resolution = 'dismissed' } = {}) {
  const all = await readJsonl(QUEUE_FILE);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], resolvedAt: new Date().toISOString(), resolution };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(QUEUE_FILE, `${all.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
  return all[idx];
}

/** AI contribution chips for brief receipt strip. */
export async function buildAiContributionSummary({ project = null } = {}) {
  const items = await readAgentQueueItems({ project, limit: 20, aiOnly: true });
  const chips = [];
  const seen = new Set();
  for (const item of items) {
    const label = item.taskType || item.agentType;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    chips.push({ label, taskType: item.taskType, summary: item.summary });
    if (chips.length >= 5) break;
  }
  return { chips, count: items.length, noJiraChangesMade: true };
}

export { appendInboxItem };
