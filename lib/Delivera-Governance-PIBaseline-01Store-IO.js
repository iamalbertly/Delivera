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
import { createHash, randomUUID } from 'crypto';
import { stablePromiseId } from './Delivera-Governance-ActiveLoop-01Domain-SSOT.js';
import { cache } from './cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const BASELINE_FILE = join(DATA_DIR, 'Delivera-PI-Baseline-Snapshots.jsonl');
const BASELINE_LEDGER_KEY = 'governance:pi-baselines:v2';

function contentHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeItem(item, { contractId = '', ordinal = 0 } = {}) {
  const act = item?.epicActivity;
  const epicActivity = act && typeof act === 'object'
    ? {
      lifecycle: String(act.lifecycle || '').trim() || undefined,
      sprintCount: Number(act.sprintCount) || 0,
      firstActiveSprintStart: act.firstActiveSprintStart ? String(act.firstActiveSprintStart) : '',
    }
    : undefined;
  const issueKey = String(item?.issueKey || '').trim().toUpperCase();
  const originalText = String(item?.originalText || item?.title || '').trim().slice(0, 1000);
  return {
    promiseId: String(item?.promiseId || stablePromiseId({
      contractId,
      issueKey,
      title: originalText,
      squad: item?.squad,
      ordinal,
    })),
    issueKey,
    candidateId: String(item?.candidateId || '').trim().slice(0, 160),
    title: String(item?.title || '').slice(0, 200),
    originalText,
    squad: String(item?.squad || '').trim(),
    month: String(item?.month || '').trim().slice(0, 40),
    theme: String(item?.theme || '').trim().slice(0, 80),
    businessValue: String(item?.businessValue || '').trim().slice(0, 500),
    piObjectiveId: String(item?.piObjectiveId || '').trim().slice(0, 160),
    piObjectiveTitle: String(item?.piObjectiveTitle || '').trim().slice(0, 300),
    commitmentClass: String(item?.commitmentClass || '').trim().toLowerCase().slice(0, 40),
    businessCase: String(item?.businessCase || '').trim().slice(0, 500),
    milestone: String(item?.milestone || '').trim().slice(0, 240),
    dependencyIssueKeys: Array.isArray(item?.dependencyIssueKeys)
      ? [...new Set(item.dependencyIssueKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean))].slice(0, 30)
      : [],
    dependencySquadKeys: Array.isArray(item?.dependencySquadKeys)
      ? [...new Set(item.dependencySquadKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean))].slice(0, 20)
      : [],
    confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
    sourceSpan: item?.sourceSpan && typeof item.sourceSpan === 'object'
      ? {
        artifactHash: String(item.sourceSpan.artifactHash || '').slice(0, 64),
        page: Number(item.sourceSpan.page) || 0,
        slide: Number(item.sourceSpan.slide) || 0,
        boundingBox: item.sourceSpan.boundingBox || null,
        textNode: String(item.sourceSpan.textNode || '').slice(0, 160),
        rawText: String(item.sourceSpan.rawText || originalText).slice(0, 2000),
        method: String(item.sourceSpan.method || '').slice(0, 80),
        extractorVersion: String(item.sourceSpan.extractorVersion || '').slice(0, 80),
      }
      : undefined,
    businessOutcome: String(item?.businessOutcome || '').slice(0, 300),
    owner: String(item?.owner || '').trim(),
    targetDate: item?.targetDate ? String(item.targetDate) : '',
    source: String(item?.source || '').trim().slice(0, 240),
    sourceReference: String(item?.sourceReference || item?.sourceBullet || '').trim().slice(0, 1000),
    readinessGaps: Array.isArray(item?.readinessGaps) ? item.readinessGaps.map((gap) => String(gap).slice(0, 120)) : [],
    committedWithRisk: item?.committedWithRisk === true,
    ...(epicActivity ? { epicActivity } : {}),
  };
}

/**
 * Persist a PI baseline snapshot.
 * @param {object} snapshot { piName, baselineDate, approvedBy, source, committedItems[] }
 * @returns {Promise<object>} the stored snapshot row
 */
export async function savePIBaseline(snapshot) {
  const piName = String(snapshot?.piName || '').trim();
  if (!piName) throw new Error('piName is required for a PI baseline');
  const previous = await getLatestPIBaseline(piName);
  const currentRevision = Number(previous?.revision) || 0;
  if (snapshot?.expectedRevision != null && Number(snapshot.expectedRevision) !== currentRevision) {
    const error = new Error('A newer PI baseline exists. Review the latest version before saving.');
    Object.assign(error, { code: 'PI_BASELINE_VERSION_CONFLICT', httpStatus: 409, latestVersion: currentRevision });
    throw error;
  }
  const id = snapshot?.id || randomUUID();
  const contractId = String(snapshot?.contractId || previous?.contractId || randomUUID());
  const row = {
    id,
    contractId,
    revision: currentRevision + 1,
    supersedesId: String(snapshot?.supersedesId || previous?.id || ''),
    rollbackReference: previous?.id || '',
    ts: new Date().toISOString(),
    piName,
    baselineDate: snapshot?.baselineDate ? String(snapshot.baselineDate) : new Date().toISOString().slice(0, 10),
    approvedBy: String(snapshot?.approvedBy || '').trim(),
    source: String(snapshot?.source || 'manual-snapshot').trim(),
    sourceType: ['full-deck', 'squad-image', 'manual'].includes(snapshot?.sourceType) ? snapshot.sourceType : (/image|slide/i.test(snapshot?.source || '') ? 'squad-image' : 'manual'),
    sourceLabel: String(snapshot?.sourceLabel || '').trim().slice(0, 240),
    artifactRef: String(snapshot?.artifactRef || snapshot?.sourceRef || '').trim().slice(0, 1000),
    artifactHash: String(snapshot?.artifactHash || '').trim().slice(0, 64),
    modelContribution: Array.isArray(snapshot?.modelContribution)
      ? snapshot.modelContribution.map((item) => String(item).slice(0, 160)).slice(0, 3)
      : [],
    capturedAt: String(snapshot?.capturedAt || snapshot?.baselineDate || new Date().toISOString()).trim(),
    verifiedAt: String(snapshot?.verifiedAt || new Date().toISOString()).trim(),
    verifiedBy: String(snapshot?.verifiedBy || snapshot?.approvedBy || '').trim().slice(0, 240),
    projects: Array.isArray(snapshot?.projects) ? snapshot.projects.map((p) => String(p).trim().toUpperCase()) : [],
    committedItems: (Array.isArray(snapshot?.committedItems) ? snapshot.committedItems : [])
      .map((item, ordinal) => normalizeItem(item, { contractId: id, ordinal }))
      .filter((i) => i.originalText || i.issueKey),
  };
  const previousKeys = new Set((previous?.committedItems || []).map((item) => item.issueKey || item.originalText));
  const nextKeys = new Set(row.committedItems.map((item) => item.issueKey || item.originalText));
  row.diffSummary = {
    added: [...nextKeys].filter((key) => !previousKeys.has(key)).length,
    removed: [...previousKeys].filter((key) => !nextKeys.has(key)).length,
    unchanged: [...nextKeys].filter((key) => previousKeys.has(key)).length,
  };
  row.contentHash = contentHash({ ...row, ts: undefined, contentHash: undefined });
  const durable = await cache.appendDurableLog(BASELINE_LEDGER_KEY, row, 10000);
  if (durable) return row;
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const err = new Error('Durable baseline storage is unavailable. No PI contract was saved.');
    err.code = 'DURABLE_BASELINE_STORE_REQUIRED';
    throw err;
  }
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(BASELINE_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

async function readAllBaselines() {
  const durable = await cache.readDurableLog(BASELINE_LEDGER_KEY, 10000);
  try {
    const raw = await readFile(BASELINE_FILE, 'utf8');
    const disk = raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
    const seen = new Set();
    return [...disk, ...(durable || [])].filter((row) => row?.id && !seen.has(row.id) && seen.add(row.id));
  } catch (err) {
    if (err?.code === 'ENOENT') return durable || [];
    throw err;
  }
}

export async function migrateExistingPIBaselinesToDurableStore() {
  const durable = await cache.readDurableLog(BASELINE_LEDGER_KEY, 10000);
  if (durable == null) return { migrated: 0, durable: false };
  let disk = [];
  try {
    const raw = await readFile(BASELINE_FILE, 'utf8');
    disk = raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  const known = new Set(durable.map((row) => row.id));
  let migrated = 0;
  for (const row of disk) {
    if (!row?.id || known.has(row.id)) continue;
    const normalized = { ...row, contentHash: row.contentHash || contentHash({ ...row, ts: undefined, contentHash: undefined }) };
    await cache.appendDurableLog(BASELINE_LEDGER_KEY, normalized, 10000);
    known.add(row.id);
    migrated += 1;
  }
  return { migrated, durable: true };
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
