/**
 * SSOT: PI Baseline snapshot store (append-only JSONL, mirrors the Jira activity
 * audit log pattern). A baseline is the approved set of PI-committed items at a
 * point in time. Storing it lets Delivera answer "what changed since baseline?"
 * which is far beyond a Jira sprint summary.
 *
 * Source order (caller's choice): manual Delivera snapshot first, then PI label /
 * Fix Version once confirmed with a Jira admin.
 */
import { mkdir, appendFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const BASELINE_FILE = join(DATA_DIR, 'Delivera-PI-Baseline-Snapshots.jsonl');

function normalizeItem(item) {
  const act = item?.epicActivity;
  const epicActivity = act && typeof act === 'object'
    ? {
      lifecycle: String(act.lifecycle || '').trim() || undefined,
      sprintCount: Number(act.sprintCount) || 0,
      firstActiveSprintStart: act.firstActiveSprintStart ? String(act.firstActiveSprintStart) : '',
    }
    : undefined;
  return {
    issueKey: String(item?.issueKey || '').trim().toUpperCase(),
    title: String(item?.title || '').slice(0, 200),
    squad: String(item?.squad || '').trim(),
    businessOutcome: String(item?.businessOutcome || '').slice(0, 300),
    owner: String(item?.owner || '').trim(),
    targetDate: item?.targetDate ? String(item.targetDate) : '',
    sourceBullet: String(item?.sourceBullet || item?.bullet || '').slice(0, 300),
    matchScore: Number.isFinite(Number(item?.matchScore)) ? Number(item.matchScore) : undefined,
    matchMethod: String(item?.matchMethod || '').trim() || undefined,
    confirmedBy: String(item?.confirmedBy || '').trim() || undefined,
    confirmedAt: item?.confirmedAt ? String(item.confirmedAt) : undefined,
    sourceImagePath: String(item?.sourceImagePath || '').trim() || undefined,
    ...(epicActivity ? { epicActivity } : {}),
  };
}

/**
 * Persist a PI baseline snapshot.
 * @param {object} snapshot { piName, baselineDate, approvedBy, source, committedItems[] }
 * @returns {Promise<object>} the stored snapshot row
 */
export async function savePIBaseline(snapshot) {
  const row = {
    id: snapshot?.id || randomUUID(),
    ts: new Date().toISOString(),
    piName: String(snapshot?.piName || '').trim(),
    baselineDate: snapshot?.baselineDate ? String(snapshot.baselineDate) : new Date().toISOString().slice(0, 10),
    approvedBy: String(snapshot?.approvedBy || '').trim(),
    source: String(snapshot?.source || 'manual-snapshot').trim(),
    projects: Array.isArray(snapshot?.projects) ? snapshot.projects.map((p) => String(p).trim().toUpperCase()) : [],
    committedItems: (Array.isArray(snapshot?.committedItems) ? snapshot.committedItems : [])
      .map(normalizeItem)
      .filter((i) => i.issueKey),
  };
  if (!row.piName) throw new Error('piName is required for a PI baseline');
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(BASELINE_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

async function readAllBaselines() {
  try {
    const raw = await readFile(BASELINE_FILE, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Latest baseline for a PI name (most recent append wins).
 * @param {string} piName
 * @returns {Promise<object|null>}
 */
export async function getLatestPIBaseline(piName) {
  const wanted = String(piName || '').trim().toLowerCase();
  const all = await readAllBaselines();
  const matches = wanted ? all.filter((b) => String(b.piName || '').toLowerCase() === wanted) : all;
  if (!matches.length) return null;
  return matches[matches.length - 1];
}

/** List all baselines (most recent first), optionally filtered by project. */
export async function listPIBaselines({ project = null } = {}) {
  const all = await readAllBaselines();
  const filtered = project
    ? all.filter((b) => Array.isArray(b.projects) && b.projects.includes(String(project).trim().toUpperCase()))
    : all;
  return filtered.reverse();
}
