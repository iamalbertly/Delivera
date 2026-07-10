import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  INTERVENTION_STATES,
  assertInterventionTransition,
  compactCaseForUi,
  interventionFingerprint,
  isOpenInterventionCase,
  normalizeInterventionCase,
  normalizeIssueKeys,
  normalizePeriodKey,
  normalizeProjectKey,
} from './Delivera-Governance-InterventionCase-01SSOT.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const CASES_FILE = join(DATA_DIR, 'Delivera-Governance-InterventionCases.json');
let writeQueue = Promise.resolve();

async function readStore() {
  try {
    const raw = await readFile(CASES_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { cases: Array.isArray(parsed.cases) ? parsed.cases : [] };
  } catch (err) {
    if (err?.code === 'ENOENT') return { cases: [] };
    // Corrupted/truncated store file: recover what we can instead of bricking every
    // endpoint that reads cases (portfolio-decision, interventions list, actions page).
    // Attempt a tolerant line-by-line recovery for the common { "cases": [ ... ] } shape,
    // then fall back to an empty store so the app stays usable.
    try {
      console.warn('[InterventionCase-Store] JSON parse failed — attempting recovery:', err?.message);
      const raw = await readFile(CASES_FILE, 'utf8').catch(() => '');
      const recovered = recoverCasesFromCorruptedJson(raw);
      if (recovered.length) {
        console.warn(`[InterventionCase-Store] recovered ${recovered.length} case(s) from corrupted store`);
        return { cases: recovered };
      }
    } catch (_) {}
    console.warn('[InterventionCase-Store] recovery failed — returning empty store');
    return { cases: [] };
  }
}

// Best-effort extraction of case objects from a truncated/corrupted JSON document.
// Scans for balanced {...} objects that look like intervention cases.
function recoverCasesFromCorruptedJson(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const cases = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const candidate = raw.slice(start, i + 1);
        try {
          const obj = JSON.parse(candidate);
          if (obj && typeof obj === 'object' && (obj.id || obj.project || obj.state)) {
            cases.push(obj);
          }
        } catch (_) {
          // skip malformed object
        }
        start = -1;
      }
    }
  }
  return cases;
}

async function writeStore(store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CASES_FILE, JSON.stringify({ cases: store.cases || [] }, null, 2), 'utf8');
}

async function mutateStore(mutator) {
  const task = writeQueue.then(async () => {
    const store = await readStore();
    const result = await mutator(store);
    await writeStore(store);
    return JSON.parse(JSON.stringify(result));
  });
  writeQueue = task.catch(() => {});
  return task;
}

export async function listInterventionCases({ project = '', status = '', periodKey = '', limit = 50 } = {}) {
  const store = await readStore();
  const pk = project ? normalizeProjectKey(project) : '';
  const period = periodKey ? normalizePeriodKey(periodKey) : '';
  let rows = store.cases.slice();
  if (pk) rows = rows.filter((row) => row.project === pk);
  if (period) rows = rows.filter((row) => row.periodKey === period);
  if (status === 'open') rows = rows.filter(isOpenInterventionCase);
  else if (status) rows = rows.filter((row) => row.state === status);
  return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, limit);
}

export async function getInterventionCase(caseId) {
  const store = await readStore();
  return store.cases.find((row) => row.id === caseId) || null;
}

export async function upsertInterventionCase(input = {}) {
  return mutateStore((store) => {
    const project = normalizeProjectKey(input.project || input.projectKey);
    const periodKey = normalizePeriodKey(input.periodKey || input.period);
    const issueKeys = normalizeIssueKeys(input.issueKeys || input.triggerIssueKeys || [input.issueKey].filter(Boolean));
    const fingerprint = input.fingerprint || interventionFingerprint({
      project,
      periodKey,
      triggerType: input.triggerType || input.riskType,
      issueKeys,
    });
    const existing = store.cases.find((row) => row.fingerprint === fingerprint && isOpenInterventionCase(row));
    const now = new Date();
    if (existing) {
      existing.updatedAt = now.toISOString();
      existing.facts = mergeByKey(existing.facts, input.facts || [], 'key');
      existing.unknowns = mergeByKey(existing.unknowns, input.unknowns || [], 'key');
      existing.actions = mergeByKey(existing.actions, input.actions || [], 'actionId');
      existing.checkpoints = mergeByKey(existing.checkpoints, input.checkpoints || [], 'checkpointId');
      existing.history = [...(existing.history || []), { at: now.toISOString(), event: 'case-refreshed', state: existing.state }];
      return existing;
    }
    const seq = store.cases.filter((row) => row.project === project && row.periodKey === periodKey).length + 1;
    const row = normalizeInterventionCase({ ...input, project, periodKey, issueKeys, fingerprint }, { seq, now });
    store.cases.push(row);
    return row;
  });
}

export async function transitionInterventionCase(caseId, toState, patch = {}) {
  return mutateStore((store) => {
    const row = store.cases.find((item) => item.id === caseId);
    if (!row) {
      const error = new Error('Intervention case not found');
      error.code = 'INTERVENTION_CASE_NOT_FOUND';
      throw error;
    }
    assertInterventionTransition(row.state, toState);
    const now = new Date().toISOString();
    row.state = toState;
    row.updatedAt = now;
    Object.assign(row, patch);
    row.history = [...(row.history || []), { at: now, event: `state:${toState}`, state: toState, patch: sanitizeHistoryPatch(patch) }];
    return row;
  });
}

export async function patchInterventionCase(caseId, patch = {}, event = 'case-updated') {
  return mutateStore((store) => {
    const row = store.cases.find((item) => item.id === caseId);
    if (!row) {
      const error = new Error('Intervention case not found');
      error.code = 'INTERVENTION_CASE_NOT_FOUND';
      throw error;
    }
    const now = new Date().toISOString();
    Object.assign(row, patch);
    row.updatedAt = now;
    row.history = [...(row.history || []), { at: now, event, state: row.state, patch: sanitizeHistoryPatch(patch) }];
    return row;
  });
}

export async function getCompactInterventionCases(options = {}) {
  const rows = await listInterventionCases(options);
  return rows.map(compactCaseForUi);
}

function mergeByKey(existing = [], incoming = [], key) {
  const map = new Map();
  for (const row of existing || []) map.set(row?.[key] || JSON.stringify(row), row);
  for (const row of incoming || []) map.set(row?.[key] || JSON.stringify(row), row);
  return Array.from(map.values());
}

function sanitizeHistoryPatch(patch = {}) {
  const out = { ...patch };
  delete out.history;
  return out;
}

export { INTERVENTION_STATES };

