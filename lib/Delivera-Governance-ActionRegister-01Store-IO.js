import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const ACTIONS_FILE = join(DATA_DIR, 'Delivera-Governance-ActionRegister.json');
let actionWriteQueue = Promise.resolve();

async function readStore() {
  try {
    const raw = await readFile(ACTIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
  } catch (err) {
    if (err?.code === 'ENOENT') return { actions: [] };
    throw err;
  }
}

async function writeStore(store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ACTIONS_FILE, JSON.stringify({ actions: store.actions || [] }, null, 2), 'utf8');
}

async function mutateStore(mutator) {
  const task = actionWriteQueue.then(async () => {
    const store = await readStore();
    const result = await mutator(store);
    await writeStore(store);
    return JSON.parse(JSON.stringify(result));
  });
  actionWriteQueue = task.catch(() => {});
  return task;
}

export async function upsertCaseAction(action = {}) {
  return mutateStore((store) => {
    const now = new Date().toISOString();
    const actionId = action.actionId || `act-${randomUUID().slice(0, 8)}`;
    const existing = store.actions.find((row) => row.actionId === actionId);
    const row = existing || {
      actionId,
      caseId: String(action.caseId || ''),
      history: [],
      createdAt: now,
    };
    Object.assign(row, {
      ownerRole: String(action.ownerRole || row.ownerRole || 'Product Owner'),
      ownerAccountId: String(action.ownerAccountId || row.ownerAccountId || ''),
      action: String(action.action || row.action || 'Confirm scope or decision.').slice(0, 500),
      dueAt: action.dueAt || row.dueAt || new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      status: String(action.status || row.status || 'open'),
      verificationRule: String(action.verificationRule || row.verificationRule || 'jira-comment-or-status-change').slice(0, 200),
      escalationPath: Array.isArray(action.escalationPath) ? action.escalationPath : (row.escalationPath || []),
      updatedAt: now,
    });
    row.history = [...(row.history || []), { at: now, event: existing ? 'action-updated' : 'action-created', status: row.status }];
    if (!existing) store.actions.push(row);
    return row;
  });
}

export async function listCaseActions(caseId) {
  const store = await readStore();
  return store.actions.filter((row) => row.caseId === caseId);
}

export async function patchCaseAction(actionId, patch = {}) {
  return mutateStore((store) => {
    const row = store.actions.find((item) => item.actionId === actionId);
    if (!row) {
      const error = new Error('Action not found');
      error.code = 'INTERVENTION_ACTION_NOT_FOUND';
      throw error;
    }
    const now = new Date().toISOString();
    Object.assign(row, patch, { updatedAt: now });
    row.history = [...(row.history || []), { at: now, event: 'action-patched', status: row.status }];
    return row;
  });
}

