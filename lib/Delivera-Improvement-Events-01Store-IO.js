/**
 * SSOT: Unified improvement events store (append-only JSONL).
 * All feedback paths write here — narration accept, inbox dismiss, UX feedback, etc.
 */
import { mkdir, appendFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const EVENTS_FILE = join(DATA_DIR, 'Delivera-Improvement-Events.jsonl');

export const IMPROVEMENT_EVENT_TYPES = Object.freeze([
  'accepted-copy',
  'dismissed-risk',
  'wrong-owner',
  'weak-proof',
  'bad-wording',
  'setup-fixed',
  'nudge-sent',
  'ai-fallback-used',
  'copy-exported',
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
 * @param {object} entry
 */
export async function recordImprovementEvent(entry = {}) {
  const row = {
    id: entry.id || randomUUID(),
    eventType: String(entry.eventType || 'bad-wording').slice(0, 64),
    surface: String(entry.surface || 'brief').slice(0, 32),
    scope: entry.scope || {},
    payload: entry.payload || {},
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  if (!IMPROVEMENT_EVENT_TYPES.includes(row.eventType) && row.eventType !== 'feedback') {
    row.eventType = 'bad-wording';
  }
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(EVENTS_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

/**
 * @param {{ project?: string, limit?: number, eventType?: string, hours?: number }} [opts]
 */
export async function readImprovementEvents({ project = '', limit = 100, eventType = null, hours = null } = {}) {
  const all = await readJsonl(EVENTS_FILE);
  const pk = String(project || '').trim().toUpperCase();
  const cutoff = hours != null ? Date.now() - hours * 3600 * 1000 : null;

  let rows = all;
  if (pk) {
    rows = rows.filter((r) => {
      const scopePk = String(r.scope?.project || r.scope?.portfolio || '').toUpperCase();
      return !scopePk || scopePk === pk || scopePk === '*';
    });
  }
  if (eventType) rows = rows.filter((r) => r.eventType === eventType);
  if (cutoff != null) {
    rows = rows.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
  }
  return rows.slice(-limit).reverse();
}
