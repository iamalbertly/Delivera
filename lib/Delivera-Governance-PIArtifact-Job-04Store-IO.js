import { randomUUID } from 'node:crypto';
import { cache } from './cache.js';
import { PI_IMPORT_PROGRESS, piImportError } from './Delivera-Governance-PIArtifact-Contracts-01SSOT.js';

const JOB_TTL = 90 * 24 * 60 * 60 * 1000;
const RESULT_TTL = 180 * 24 * 60 * 60 * 1000;
const ACTIVE_TTL = 10 * 60 * 1000;

function namespace(organizationId = 'delivera') {
  return String(organizationId || 'delivera').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'delivera';
}

function jobKey(organizationId, jobId) {
  return `pi-import:${namespace(organizationId)}:job:${jobId}`;
}

function artifactKey(organizationId, artifactHash) {
  return `pi-import:${namespace(organizationId)}:artifact:${artifactHash}`;
}

function activeKey(organizationId, artifactHash) {
  return `pi-import:${namespace(organizationId)}:active:${artifactHash}`;
}

export async function readPIImportJob(organizationId, jobId) {
  return (await cache.get(jobKey(organizationId, jobId), { namespace: 'pi-import-job' }))?.value || null;
}

export async function readPIArtifactResult(organizationId, artifactHash) {
  return (await cache.get(artifactKey(organizationId, artifactHash), { namespace: 'pi-import-result' }))?.value || null;
}

export async function findActivePIImport(organizationId, artifactHash) {
  const pointer = (await cache.get(activeKey(organizationId, artifactHash), { namespace: 'pi-import-active' }))?.value;
  if (!pointer?.jobId) return null;
  const job = await readPIImportJob(organizationId, pointer.jobId);
  return job && !['failed', 'cancelled', 'approved'].includes(job.state) ? job : null;
}

export async function createPIImportJob({
  organizationId = 'delivera',
  actor = 'unknown',
  artifactHash,
  meta,
  requestedSquad = '',
  requestedQuarter = '',
} = {}) {
  const now = new Date().toISOString();
  const job = {
    jobId: randomUUID(),
    artifactId: artifactHash.slice(0, 24),
    organizationId: namespace(organizationId),
    actor,
    artifactHash,
    source: meta,
    requestedSquad,
    requestedQuarter,
    state: 'accepted',
    stage: 'accepted',
    progress: PI_IMPORT_PROGRESS.accepted,
    revision: 1,
    message: 'Secure import accepted.',
    retryable: false,
    allowedNextAction: 'wait',
    cache: { artifactHit: false, callsAvoided: 0 },
    methods: [],
    models: [],
    stageHistory: [{ stage: 'accepted', enteredAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  await Promise.all([
    cache.set(jobKey(organizationId, job.jobId), job, JOB_TTL, { namespace: 'pi-import-job' }),
    cache.set(activeKey(organizationId, artifactHash), { jobId: job.jobId }, ACTIVE_TTL, { namespace: 'pi-import-active' }),
  ]);
  await cache.appendDurableLog(`pi-import:${namespace(organizationId)}:audit`, {
    event: 'created', jobId: job.jobId, artifactHash, actor, at: now,
  });
  return job;
}

export async function updatePIImportJob(organizationId, jobId, patch = {}) {
  const current = await readPIImportJob(organizationId, jobId);
  if (!current) throw piImportError('PI_IMPORT_NOT_FOUND', 'This import receipt no longer exists.', 404);
  const stage = patch.stage || patch.state || current.stage;
  const now = new Date().toISOString();
  const stageChanged = stage !== current.stage;
  const job = {
    ...current,
    ...patch,
    stage,
    state: patch.state || stage,
    progress: Number.isFinite(patch.progress) ? patch.progress : (PI_IMPORT_PROGRESS[stage] ?? current.progress),
    revision: current.revision + 1,
    updatedAt: now,
    stageHistory: stageChanged
      ? [...current.stageHistory, { stage, enteredAt: now }].slice(-50)
      : current.stageHistory,
  };
  await cache.set(jobKey(organizationId, jobId), job, JOB_TTL, { namespace: 'pi-import-job' });
  if (['awaiting-review', 'failed', 'cancelled', 'approved'].includes(job.state)) {
    await cache.delete(activeKey(organizationId, job.artifactHash), { namespace: 'pi-import-active' });
  }
  await cache.appendDurableLog(`pi-import:${namespace(organizationId)}:audit`, {
    event: 'transition', jobId, revision: job.revision, stage, at: now,
  });
  return job;
}

export async function savePIArtifactResult(organizationId, artifactHash, result) {
  const row = { ...result, artifactHash, cachedAt: new Date().toISOString() };
  await cache.set(artifactKey(organizationId, artifactHash), row, RESULT_TTL, { namespace: 'pi-import-result' });
  return row;
}

export async function cancelPIImportJob(organizationId, jobId) {
  const job = await readPIImportJob(organizationId, jobId);
  if (!job) throw piImportError('PI_IMPORT_NOT_FOUND', 'This import receipt no longer exists.', 404);
  if (['awaiting-review', 'approved', 'failed', 'cancelled'].includes(job.state)) return job;
  return updatePIImportJob(organizationId, jobId, {
    state: 'cancelled',
    message: 'Import cancelled. No baseline was changed.',
    allowedNextAction: 'retry',
  });
}

export async function claimPIArtifactLease(organizationId, artifactHash) {
  return cache.claimLease(artifactHash, 2 * 60 * 1000, { namespace: `pi-import-producer:${namespace(organizationId)}` });
}

export async function releasePIArtifactLease(lease) {
  return cache.releaseLease(lease);
}
