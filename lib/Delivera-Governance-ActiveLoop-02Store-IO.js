import { appendFile, mkdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { cache } from './cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const EVENTS_FILE = join(DATA_DIR, 'Delivera-Governance-ActiveLoop-Events.jsonl');
const REDIS_EVENTS_KEY = 'governance:active-loop:events:v1';
const memoryEvents = [];
let writeQueue = Promise.resolve();

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function responseDeadlineFromEvent(event, businessDays = 1) {
  const value = new Date(event?.ts || 0);
  if (!Number.isFinite(value.getTime())) return '';
  // Legacy receipts did not persist the organization calendar used at send time.
  // Use a conservative elapsed-time SLA so an old Friday nudge cannot remain
  // "awaiting owner" through the weekend. New sends persist responseDueAt.
  value.setTime(value.getTime() + (Math.max(1, Number(businessDays) || 1) * 24 * 60 * 60 * 1000));
  return value.toISOString();
}

async function readDiskEvents() {
  try {
    const raw = await readFile(EVENTS_FILE, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'EROFS') return [];
    throw err;
  }
}

export async function readActiveLoopEvents({ promiseId = '', limit = 1000 } = {}) {
  const durable = await cache.readDurableLog(REDIS_EVENTS_KEY, limit);
  const disk = await readDiskEvents();
  const combined = [...disk, ...(durable || []), ...memoryEvents];
  const filtered = promiseId ? combined.filter((event) => event.promiseId === promiseId) : combined;
  const seen = new Set();
  return filtered.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  }).slice(-Math.max(1, Math.min(5000, Number(limit) || 1000)));
}

function normalizeEvent(event = {}) {
  return {
    id: event.id || randomUUID(),
    ts: event.ts || new Date().toISOString(),
    organizationId: clean(event.organizationId || 'org-delivera-local', 180),
    contractId: clean(event.contractId, 240),
    promiseId: clean(event.promiseId, 240),
    type: clean(event.type, 100),
    actorId: clean(event.actorId || 'unknown', 240),
    expectedVersion: Math.max(0, Number(event.expectedVersion) || 0),
    nextVersion: Math.max(1, Number(event.nextVersion) || 1),
    payload: event.payload && typeof event.payload === 'object' ? event.payload : {},
  };
}

export async function appendActiveLoopEvent(event = {}) {
  const row = normalizeEvent(event);
  if (!row.promiseId || !row.type) throw new Error('promiseId and type are required');
  if (row.expectedVersion >= 1) {
    const versioned = await cache.appendVersionedDurableLog({
      logKey: REDIS_EVENTS_KEY,
      versionKey: `governance:active-loop:promise-version:v1:${row.promiseId}`,
      expectedVersion: row.expectedVersion,
      value: row,
    });
    if (versioned) {
      if (!versioned.appended) {
        const err = new Error('This item was updated by another PI Team user. Reload latest state before deciding.');
        err.code = 'GOVERNANCE_VERSION_CONFLICT';
        err.httpStatus = 412;
        err.latestVersion = versioned.version;
        throw err;
      }
      return { ...row, expectedVersion: versioned.version - 1, nextVersion: versioned.version };
    }
  }
  const durable = await cache.appendDurableLog(REDIS_EVENTS_KEY, row);
  if (durable) return row;
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const err = new Error('Durable governance decision storage is unavailable. Nothing was changed.');
    err.code = 'DURABLE_GOVERNANCE_STORE_REQUIRED';
    err.httpStatus = 503;
    throw err;
  }
  writeQueue = writeQueue.then(async () => {
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await appendFile(EVENTS_FILE, `${JSON.stringify(row)}\n`, 'utf8');
    } catch (err) {
      if (err?.code !== 'EROFS' && err?.code !== 'EACCES') throw err;
      memoryEvents.push(row);
    }
  });
  await writeQueue;
  return row;
}

export function projectActiveLoopCases(events = [], { now = new Date() } = {}) {
  const cases = {};
  for (const event of events) {
    if (!event?.promiseId) continue;
    const current = cases[event.promiseId] || { version: 1, state: 'needs-attention', amendments: [], actions: [], sourceWrites: [], responseDueAt: '', ownerRoute: null };
    current.version = Math.max(current.version, Number(event.nextVersion) || current.version);
    if (event.type === 'contract-amended') {
      current.amendments.push({ id: event.id, ...event.payload, status: 'approved', approvedAt: event.ts, approvedBy: event.actorId });
      current.state = 'aligned-amended';
    } else if (event.type === 'risk-accepted') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      current.state = 'risk-accepted';
    } else if (event.type === 'source-write-receipt' || event.type === 'source-write-queued' || event.type === 'source-write-pending' || event.type === 'source-write-confirmed' || event.type === 'source-write-failed' || event.type === 'source-write-reconciled') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      const receiptId = event.payload?.receiptId || event.id;
      const existingIndex = current.sourceWrites.findIndex((write) => write.receiptId === receiptId);
      const writeState = ({
        'source-write-receipt': 'local-receipt',
        'source-write-queued': 'queued',
        'source-write-pending': 'source-pending',
        'source-write-confirmed': 'source-confirmed',
        'source-write-failed': 'source-failed',
        'source-write-reconciled': 'projection-reconciled',
      })[event.type];
      const nextWrite = { ...(existingIndex >= 0 ? current.sourceWrites[existingIndex] : {}), ...event.payload, receiptId, state: writeState, ts: event.ts, actorId: event.actorId };
      if (existingIndex >= 0) current.sourceWrites.splice(existingIndex, 1, nextWrite); else current.sourceWrites.push(nextWrite);
    } else if (event.type === 'nudge-queued') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      if (event.payload?.receiptId) current.sourceWrites.push({ ...event.payload, state: 'queued', ts: event.ts, actorId: event.actorId });
      current.state = 'awaiting-owner';
      current.responseDueAt = event.payload?.responseDueAt || current.responseDueAt || responseDeadlineFromEvent(event, event.payload?.responseBusinessDays);
    } else if (event.type === 'nudge-sent') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      if (event.payload?.receiptId) {
        const index = current.sourceWrites.findIndex((write) => write.receiptId === event.payload.receiptId);
        const next = { ...(index >= 0 ? current.sourceWrites[index] : {}), ...event.payload, state: 'source-confirmed', ts: event.ts, actorId: event.actorId };
        if (index >= 0) current.sourceWrites.splice(index, 1, next); else current.sourceWrites.push(next);
      }
      current.state = 'awaiting-owner';
      current.responseDueAt = event.payload?.responseDueAt || current.responseDueAt || responseDeadlineFromEvent(event, event.payload?.responseBusinessDays);
    } else if (event.type === 'nudge-failed') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      if (event.payload?.receiptId) {
        const index = current.sourceWrites.findIndex((write) => write.receiptId === event.payload.receiptId);
        const next = { ...(index >= 0 ? current.sourceWrites[index] : {}), ...event.payload, state: 'source-failed', ts: event.ts, actorId: event.actorId };
        if (index >= 0) current.sourceWrites.splice(index, 1, next); else current.sourceWrites.push(next);
      }
      current.state = 'needs-attention';
    } else if (event.type === 'owner-replied' || event.type === 'evidence-changed-after-nudge') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      current.state = 'reply-received-ready-to-recheck';
    } else if (event.type === 'recheck-started') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      current.state = 'rechecking';
    } else if (event.type === 'recheck-completed') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      current.state = event.payload?.aligned ? 'resolved-matched' : 'reply-received-proof-still-missing';
    } else if (event.type === 'recheck-failed') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      current.state = 'reply-received-ready-to-recheck';
    } else if (event.type === 'escalation-sent') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      current.state = 'escalated-awaiting-owner';
    } else if (event.type === 'owner-assigned' || event.type === 'match-approved') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      if (event.type === 'match-approved') current.state = 'aligned';
    } else if (event.type === 'owner-route-overridden') {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
      current.ownerRoute = event.payload?.recipient || current.ownerRoute;
    } else {
      current.actions.push({ id: event.id, type: event.type, ts: event.ts, actorId: event.actorId, ...event.payload });
    }
    cases[event.promiseId] = current;
  }
  const nowMs = new Date(now).getTime();
  for (const current of Object.values(cases)) {
    const dueMs = current.responseDueAt ? new Date(current.responseDueAt).getTime() : NaN;
    if (current.state === 'awaiting-owner' && Number.isFinite(dueMs) && dueMs <= nowMs) current.state = 'escalation-due';
  }
  return cases;
}

export async function currentPromiseVersion(promiseId) {
  const events = await readActiveLoopEvents({ promiseId });
  return events.reduce((version, event) => Math.max(version, Number(event.nextVersion) || 1), 1);
}

export async function appendVersionedActiveLoopEvent({ promiseId, expectedVersion, ...event }) {
  const proposed = normalizeEvent({ ...event, promiseId, expectedVersion, nextVersion: Number(expectedVersion) + 1 });
  if (!proposed.promiseId || !proposed.type) throw new Error('promiseId and type are required');
  const durable = await cache.appendVersionedDurableLog({
    logKey: REDIS_EVENTS_KEY,
    versionKey: `governance:active-loop:promise-version:v1:${proposed.promiseId}`,
    expectedVersion: Number(expectedVersion),
    value: proposed,
  });
  if (durable) {
    if (!durable.appended) {
      const err = new Error('This item was updated by another PI Team user. Reload latest state before deciding.');
      err.code = 'GOVERNANCE_VERSION_CONFLICT';
      err.httpStatus = 412;
      err.latestVersion = durable.version;
      throw err;
    }
    return { ...proposed, expectedVersion: durable.version - 1, nextVersion: durable.version };
  }
  const currentVersion = await currentPromiseVersion(promiseId);
  if (Number(expectedVersion) !== currentVersion) {
    const err = new Error('This item was updated by another PI Team user. Reload latest state before deciding.');
    err.code = 'GOVERNANCE_VERSION_CONFLICT';
    err.httpStatus = 412;
    err.latestVersion = currentVersion;
    throw err;
  }
  return appendActiveLoopEvent({ ...event, promiseId, expectedVersion: currentVersion, nextVersion: currentVersion + 1 });
}
