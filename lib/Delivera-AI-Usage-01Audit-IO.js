/**
 * SSOT: AI usage audit log (append-only JSONL).
 */
import { mkdir, appendFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const AUDIT_FILE = join(DATA_DIR, 'Delivera-AI-Usage-Audit.jsonl');

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
export async function recordAiUsage(entry = {}) {
  const row = {
    taskType: String(entry.taskType || '').slice(0, 64),
    provider: String(entry.provider || 'built-in').slice(0, 32),
    model: String(entry.model || '').slice(0, 128),
    promptTokens: Number(entry.promptTokens) || 0,
    completionTokens: Number(entry.completionTokens) || 0,
    costEstimate: entry.costEstimate != null ? Number(entry.costEstimate) : null,
    success: entry.success !== false,
    fallbackUsed: entry.fallbackUsed === true,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(AUDIT_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

/**
 * @param {{ hours?: number, taskType?: string }} [opts]
 */
export async function readRecentAiUsage({ hours = 24, taskType = null } = {}) {
  const all = await readJsonl(AUDIT_FILE);
  const cutoff = Date.now() - hours * 3600 * 1000;
  return all.filter((row) => {
    const t = new Date(row.createdAt).getTime();
    if (!Number.isFinite(t) || t < cutoff) return false;
    if (taskType && row.taskType !== taskType) return false;
    return true;
  });
}

/**
 * Summary for Settings AI panel.
 */
export async function buildAiUsageSummary({ hours = 24 } = {}) {
  const recent = await readRecentAiUsage({ hours });
  const fallbacks = recent.filter((r) => r.fallbackUsed).length;
  const byTask = {};
  for (const row of recent) {
    byTask[row.taskType] = (byTask[row.taskType] || 0) + 1;
  }
  return {
    hours,
    totalCalls: recent.length,
    fallbacks,
    byTask,
    lastCallAt: recent.length ? recent[recent.length - 1].createdAt : null,
  };
}
