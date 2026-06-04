/**
 * SSOT: Pilot adoption-metrics store.
 *
 * Captures the falsifiable pilot signals (reporting time saved, carryover flagged
 * before sprint end, blocker age at first escalation, repeat-question rate,
 * leader confidence 1-5) so the MPSA/MAS governance pilot can be measured rather
 * than asserted. Append-only JSONL.
 */
import { mkdir, appendFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const METRICS_FILE = join(DATA_DIR, 'Delivera-Governance-Adoption-Metrics.jsonl');

const ALLOWED_METRICS = new Set([
  'reportingMinutesSaved',
  'carryoverFlaggedBeforeRetro',
  'blockerAgeAtEscalationHours',
  'repeatQuestionCount',
  'leaderConfidence1to5',
]);

/**
 * Record one adoption metric data point.
 * @param {object} entry { metric, value, project?, user?, note? }
 * @returns {Promise<object>} stored row
 */
export async function recordAdoptionMetric(entry) {
  const metric = String(entry?.metric || '').trim();
  if (!ALLOWED_METRICS.has(metric)) throw new Error(`Unknown adoption metric: ${metric}`);
  const value = Number(entry?.value);
  if (!Number.isFinite(value)) throw new Error('Adoption metric value must be numeric');
  const row = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    metric,
    value,
    project: String(entry?.project || '').trim().toUpperCase(),
    user: String(entry?.user || 'unknown'),
    note: String(entry?.note || '').slice(0, 300),
  };
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(METRICS_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

async function readAll() {
  try {
    const raw = await readFile(METRICS_FILE, 'utf8');
    return raw.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Summarize adoption metrics (count + average per metric), optionally per project.
 * @param {object} [args] { project }
 * @returns {Promise<object>} { byMetric: { metric: { count, avg, latest } }, total }
 */
export async function summarizeAdoptionMetrics({ project = null } = {}) {
  const rows = await readAll();
  const wanted = project ? String(project).trim().toUpperCase() : null;
  const filtered = wanted ? rows.filter((r) => r.project === wanted) : rows;
  const byMetric = {};
  for (const r of filtered) {
    if (!byMetric[r.metric]) byMetric[r.metric] = { count: 0, sum: 0, latest: null };
    byMetric[r.metric].count += 1;
    byMetric[r.metric].sum += Number(r.value) || 0;
    byMetric[r.metric].latest = r.value;
  }
  for (const m of Object.keys(byMetric)) {
    byMetric[m].avg = byMetric[m].count ? Math.round((byMetric[m].sum / byMetric[m].count) * 100) / 100 : null;
    delete byMetric[m].sum;
  }
  return { byMetric, total: filtered.length };
}
