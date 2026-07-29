import { cache } from './cache.js';
import { projectSquadSprintTruth } from './Delivera-Governance-Sprint-Reality-01SSOT.js';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const NS = 'governanceSquadSprintTruthV1';
const TTL_MS = 8 * 60 * 60 * 1000;
const LOCAL_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'Delivera-Governance-Squad-Sprint-Truth.json');
let localRecordsPromise = null;
let localWriteQueue = Promise.resolve();

function clean(value, max = 120) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function squadSprintTruthCacheKey({ squadKey, quarter = 'current', presentationContractVersion = 3 } = {}) {
  return `sprint-truth:v1:p${Number(presentationContractVersion) || 3}:${clean(quarter).toLowerCase()}:${clean(squadKey).toUpperCase()}`;
}

async function readLocalRecords() {
  if (process.env.NODE_ENV === 'production') return {};
  if (!localRecordsPromise) {
    localRecordsPromise = readFile(LOCAL_FILE, 'utf8')
      .then((raw) => JSON.parse(raw))
      .catch((error) => {
        if (error?.code === 'ENOENT' || error instanceof SyntaxError) return {};
        throw error;
      });
  }
  return localRecordsPromise;
}

async function rememberLocalRecord(record) {
  if (process.env.NODE_ENV === 'production') return;
  const records = await readLocalRecords();
  records[squadSprintTruthCacheKey({ squadKey: record.squadKey, quarter: record.quarter })] = record;
  localWriteQueue = localWriteQueue.then(async () => {
    await mkdir(dirname(LOCAL_FILE), { recursive: true });
    await writeFile(LOCAL_FILE, JSON.stringify(records, null, 2), 'utf8');
  });
  await localWriteQueue;
}

export async function writeSquadSprintTruth({ squadKey, quarter = 'current', payload, checkedBoards = [] } = {}) {
  const key = clean(squadKey).toUpperCase();
  if (!key || !payload) return null;
  const previous = await readSquadSprintTruth({ squadKey: key, quarter });
  const truth = projectSquadSprintTruth({
    ...payload,
    checkedBoards: checkedBoards.length ? checkedBoards : payload?.meta?.checkedBoards,
  });
  const record = {
    ...truth,
    squadKey: key,
    quarter: clean(quarter) || 'current',
    sourceSnapshotKeys: [clean(payload?.meta?.snapshotKey || payload?.meta?.requestId)].filter(Boolean),
    currentWork: (payload?.stories || payload?.issues || []).slice(0, 60).map((item) => ({
      id: clean(item.issueKey || item.key || item.id),
      issueKey: clean(item.issueKey || item.key),
      epicKey: clean(item.epicKey || item.epic?.key || item.fields?.parent?.key),
      parentKey: clean(item.parentKey || item.parentIssueKey || item.fields?.parent?.key),
      summary: clean(item.summary || item.fields?.summary, 240),
      parentSummary: clean(item.parentSummary || item.parent?.summary || item.fields?.parent?.fields?.summary, 240),
      epicTitle: clean(item.epicTitle || item.epicSummary || item.epic?.summary, 240),
      status: clean(item.status || item.fields?.status?.name, 80),
      sprintName: clean(item.sprintName || payload?.sprint?.name, 160),
      sprintState: clean(item.sprintState || payload?.sprint?.state, 40),
      created: clean(item.created || item.fields?.created, 80),
      updated: clean(item.updated || item.fields?.updated, 80),
      fixVersion: clean(item.fixVersion || item.fields?.fixVersions?.[0]?.name, 120),
      quarterLabel: clean(item.quarterLabel || item.piLabel, 80),
      category: item.piAligned === true || item.contractMatched === true ? 'pi' : item.operational === true ? 'support' : 'unknown',
      worklogSeconds: Math.max(0, Number(item.worklogSeconds || item.timeSpentSeconds || item.fields?.timespent) || 0),
    })),
  };
  if (previous) {
    record.checkedBoards = [...new Map([...(previous.checkedBoards || []), ...(record.checkedBoards || [])].map((board) => [String(board?.id || board?.name), board])).values()];
    record.sourceSnapshotKeys = [...new Set([...(previous.sourceSnapshotKeys || []), ...record.sourceSnapshotKeys])];
    if (!record.currentWork.length && previous.currentWork?.length) record.currentWork = previous.currentWork;
    const previousAge = Date.now() - new Date(previous.evidenceAt || 0).getTime();
    if (previousAge <= 20 * 60 * 1000 && previous.sprintId && record.sprintId && String(previous.sprintId) !== String(record.sprintId)) {
      record.state = 'partial';
      record.copy = `Mapped boards disagree: ${clean(previous.sprintName || previous.sprintId)} and ${clean(record.sprintName || record.sprintId)} are both reported. Review board mapping before making a cadence claim.`;
    }
  }
  record.payloadHash = createHash('sha256').update(JSON.stringify({ state: record.state, sprintId: record.sprintId, sprintName: record.sprintName, checkedBoards: record.checkedBoards, evidenceAt: record.evidenceAt })).digest('hex');
  await cache.set(squadSprintTruthCacheKey({ squadKey: key, quarter }), record, TTL_MS, { namespace: NS });
  await rememberLocalRecord(record);
  return record;
}

export async function readSquadSprintTruth({ squadKey, quarter = 'current' } = {}) {
  const hit = await cache.get(squadSprintTruthCacheKey({ squadKey, quarter }), { namespace: NS }).catch(() => null);
  if (hit?.value || hit) return hit?.value || hit;
  const local = await readLocalRecords();
  return local[squadSprintTruthCacheKey({ squadKey, quarter })] || null;
}

export async function readSquadSprintTruthBatch({ squadKeys = [], quarter = 'current' } = {}) {
  const rows = await Promise.all([...new Set(squadKeys.map((key) => clean(key).toUpperCase()).filter(Boolean))]
    .map(async (squadKey) => [squadKey, await readSquadSprintTruth({ squadKey, quarter })
      || (quarter !== 'current' ? await readSquadSprintTruth({ squadKey, quarter: 'current' }) : null)]));
  return new Map(rows.filter(([, value]) => value));
}
