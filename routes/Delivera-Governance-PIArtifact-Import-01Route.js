import express from 'express';
import Busboy from 'busboy';
import { requireAuth } from '../lib/middleware.js';
import { cache } from '../lib/cache.js';
import { PI_ARTIFACT_LIMITS, safeImportFailure, validateArtifactMeta } from '../lib/Delivera-Governance-PIArtifact-Contracts-01SSOT.js';
import { sha256 } from '../lib/Delivera-Governance-PIArtifact-Identity-01SSOT.js';
import { preparePIArtifactImport, processPIArtifactImport } from '../lib/Delivera-Governance-PIArtifact-Import-06Service.js';
import { cancelPIImportJob, readPIImportJob } from '../lib/Delivera-Governance-PIArtifact-Job-04Store-IO.js';
import { readPIArtifactCircuit, readPIArtifactQuota } from '../lib/Delivera-Governance-PIArtifact-AIQuota-05SSOT.js';
import { aiProviderEnvConfig } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';
import { consumePIImportUploadToken, createPIImportUploadToken } from '../lib/Delivera-Governance-PIArtifact-UploadToken-07SSOT.js';
import { proposeFromBoardCache } from '../lib/Delivera-Governance-PIBaseline-03Propose-Agent.js';
import { savePIBaseline } from '../lib/Delivera-Governance-PIBaseline-01Store-IO.js';

function orgId() {
  return process.env.DELIVERA_ORGANIZATION_ID || 'delivera';
}

function actorId(req) {
  return req.authUser?.id || req.session?.user?.id || req.session?.user || 'authorized-user';
}

function workerCors(req, res, next) {
  const allowed = String(process.env.PI_IMPORT_ALLOWED_ORIGIN || '').trim();
  const origin = String(req.headers.origin || '');
  if (allowed && origin === allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-PI-Import-Token');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

function parseProjects(raw) {
  const values = Array.isArray(raw) ? raw : String(raw || '').split(',');
  return [...new Set(values.map((value) => String(value).trim().toUpperCase()).filter(Boolean))];
}

async function readMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let file = null;
    let exceeded = false;
    const parser = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: PI_ARTIFACT_LIMITS.documentBytes, fields: 20 },
    });
    parser.on('field', (name, value) => { fields[name] = value; });
    parser.on('file', (_name, stream, info) => {
      const chunks = [];
      stream.on('limit', () => { exceeded = true; });
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        file = { buffer: Buffer.concat(chunks), filename: info.filename, mimeType: info.mimeType };
      });
    });
    parser.on('error', reject);
    parser.on('finish', () => {
      if (exceeded) return reject(Object.assign(new Error('The file exceeds the 50 MB import limit.'), { code: 'PI_ARTIFACT_TOO_LARGE', httpStatus: 413 }));
      if (!file) return reject(Object.assign(new Error('Choose a file to import.'), { code: 'PI_ARTIFACT_REQUIRED', httpStatus: 400 }));
      resolve({ fields, file });
    });
    req.pipe(parser);
  });
}

async function cachedBoardEpics(fields) {
  const projects = parseProjects(fields.projects || fields.projectsCsv);
  if (!projects.length) return [];
  const board = await proposeFromBoardCache({ projects, cache, quarter: fields.requestedQuarter || fields.quarter || '' });
  return (board.candidates || []).map((item) => ({
    issueKey: item.issueKey, title: item.title, summary: item.title, squad: item.squad,
  }));
}

async function processMultipart(req, claims = null) {
  const { fields, file } = await readMultipart(req);
  const organizationId = claims?.organizationId || orgId();
  const expectedHash = claims?.artifactHash || fields.artifactHash || '';
  const meta = validateArtifactMeta({ filename: file.filename, mimeType: file.mimeType, size: file.buffer.length });
  const job = claims?.jobId ? await readPIImportJob(organizationId, claims.jobId) : null;
  const boardEpics = await cachedBoardEpics(fields);
  return processPIArtifactImport({
    organizationId,
    actor: claims?.actor || actorId(req),
    buffer: file.buffer,
    meta,
    expectedHash,
    requestedSquad: fields.requestedSquad || fields.squad || '',
    requestedQuarter: fields.requestedQuarter || fields.quarter || '',
    boardEpics,
    preparedJob: job,
  });
}

function sendError(res, error) {
  return res.status(Number(error?.httpStatus) || 500).json(safeImportFailure(error));
}

function uploadResponse(output) {
  if (!output.result) return { job: output.job, joined: output.joined === true };
  return {
    jobId: output.job?.jobId || null,
    state: output.job?.state || 'awaiting-review',
    revision: output.job?.revision || null,
    result: output.result,
    joined: output.joined === true,
  };
}

export function createPIArtifactImportRouter() {
  const router = express.Router();

  router.options('/internal/pi-imports', workerCors);

  router.post('/api/governance/pi-imports/prepare', requireAuth, async (req, res) => {
    try {
      const meta = validateArtifactMeta(req.body || {});
      const artifactHash = String(req.body?.hash || req.body?.artifactHash || '').toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(artifactHash)) return res.status(422).json({ error: 'A SHA-256 artifact hash is required.', code: 'PI_ARTIFACT_HASH_REQUIRED' });
      if (process.env.VERCEL && !process.env.PI_IMPORT_WORKER_URL && meta.size > 4_000_000) {
        return res.status(503).json({
          error: 'This file requires the secure processing worker before upload.',
          code: 'PROCESSING_WORKER_REQUIRED',
          retryable: true,
          action: { label: 'Keep the file and retry when the worker is available' },
        });
      }
      const prepared = await preparePIArtifactImport({
        organizationId: orgId(),
        actor: actorId(req),
        artifactHash,
        meta,
        requestedSquad: String(req.body?.requestedSquad || ''),
        requestedQuarter: String(req.body?.requestedQuarter || ''),
      });
      if (prepared.status !== 'upload-required') return res.json(prepared);
      const uploadToken = createPIImportUploadToken({
        jobId: prepared.job.jobId,
        organizationId: orgId(),
        artifactHash,
        actor: actorId(req),
      });
      const worker = String(process.env.PI_IMPORT_WORKER_URL || '').replace(/\/$/, '');
      return res.status(202).json({
        ...prepared,
        uploadToken,
        uploadUrl: worker ? `${worker}/internal/pi-imports` : '/internal/pi-imports',
        workerState: worker ? 'configured' : 'bounded-local',
      });
    } catch (error) { return sendError(res, error); }
  });

  router.post('/internal/pi-imports', workerCors, async (req, res) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-pi-import-token'];
      const claims = await consumePIImportUploadToken(token);
      const output = await processMultipart(req, claims);
      return res.status(output.joined ? 202 : 200).json(uploadResponse(output));
    } catch (error) { return sendError(res, error); }
  });

  router.post('/api/governance/pi-imports', requireAuth, async (req, res) => {
    try {
      const output = await processMultipart(req);
      return res.status(output.joined ? 202 : 200).json(uploadResponse(output));
    } catch (error) { return sendError(res, error); }
  });

  router.get('/api/governance/pi-imports/:jobId', requireAuth, async (req, res) => {
    const job = await readPIImportJob(orgId(), req.params.jobId);
    return job ? res.json(job) : res.status(404).json({ error: 'Import receipt not found.', code: 'PI_IMPORT_NOT_FOUND' });
  });

  router.post('/api/governance/pi-imports/:jobId/cancel', requireAuth, async (req, res) => {
    try { return res.json(await cancelPIImportJob(orgId(), req.params.jobId)); } catch (error) { return sendError(res, error); }
  });

  router.post('/api/governance/pi-imports/:jobId/approve', requireAuth, async (req, res) => {
    try {
      const job = await readPIImportJob(orgId(), req.params.jobId);
      if (!job) return res.status(404).json({ error: 'Import receipt not found.', code: 'PI_IMPORT_NOT_FOUND' });
      if (Number(req.body?.expectedJobRevision) !== Number(job.revision)) {
        return res.status(409).json({ error: 'This import changed. Review the latest evidence before approval.', code: 'PI_IMPORT_VERSION_CONFLICT', latestVersion: job.revision });
      }
      if (job.state !== 'awaiting-review') {
        return res.status(409).json({ error: 'Only reviewed evidence can be approved.', code: 'PI_IMPORT_NOT_REVIEWABLE' });
      }
      const selected = new Set((req.body?.selectedCandidateIds || []).map(String));
      const commitments = (job.result?.commitments || []).filter((item) => selected.has(String(item.candidateId)));
      if (!commitments.length) return res.status(422).json({ error: 'Select at least one source-linked commitment.', code: 'PI_IMPORT_SELECTION_REQUIRED' });
      if (!commitments.every((item) => item.sourceSpan?.artifactHash && item.sourceSpan?.rawText)) {
        return res.status(422).json({ error: 'Every approved commitment requires source provenance.', code: 'PI_IMPORT_PROVENANCE_REQUIRED' });
      }
      const squad = String(req.body?.resolvedSquad || job.result?.squads?.[0]?.key || job.requestedSquad || '').toUpperCase();
      const period = String(req.body?.resolvedPeriod || job.result?.period?.label || job.requestedQuarter || '').trim();
      const baseline = await savePIBaseline({
        piName: String(req.body?.rebaselineTarget || `${squad}:${period}`).trim(),
        projects: squad ? [squad] : [],
        source: job.result?.method || 'artifact-import',
        sourceType: job.source?.kind === 'image' ? 'squad-image' : 'full-deck',
        sourceLabel: job.source?.filename || '',
        artifactHash: job.artifactHash,
        expectedRevision: Number(req.body?.expectedBaselineRevision) || 0,
        supersedesId: String(req.body?.supersedesId || ''),
        modelContribution: job.result?.models || [],
        committedItems: commitments,
        approvedBy: actorId(req),
      });
      const approved = await updatePIImportJob(orgId(), job.jobId, {
        state: 'approved', message: 'PI contract approved with source-linked evidence.',
        allowedNextAction: 'view-baseline', baselineId: baseline.id, completedAt: new Date().toISOString(),
      });
      return res.json({ success: true, job: approved, baseline: { id: baseline.id, revision: baseline.revision, supersedesId: baseline.supersedesId, diffSummary: baseline.diffSummary } });
    } catch (error) { return sendError(res, error); }
  });

  router.get('/api/governance/intelligence/health', requireAuth, async (_req, res) => {
    const modelIds = [
      aiProviderEnvConfig.openrouterModelPiOcr,
      aiProviderEnvConfig.openrouterModelPiVision,
      aiProviderEnvConfig.openrouterModelPiReconcile,
    ];
    const [quota, redis, metrics, circuits] = await Promise.all([
      readPIArtifactQuota(orgId()),
      cache.pingRedis(),
      Promise.resolve(cache.getMetricsSnapshot()),
      Promise.all(modelIds.map(async (model) => ({ model, ...(await readPIArtifactCircuit(model)) }))),
    ]);
    return res.json({
      localParsing: 'ready',
      localOcr: process.env.DELIVERA_LOCAL_OCR_ENABLED === 'false'
        ? 'disabled'
        : (process.env.VERCEL ? 'worker-required' : 'ready'),
      worker: process.env.PI_IMPORT_WORKER_URL ? 'configured' : 'bounded-local',
      redis,
      quota,
      modelRoles: { ocr: modelIds[0], visualStructure: modelIds[1], reconciliation: modelIds[2] },
      circuits,
      cache: metrics,
      privacy: { zdrRequired: true, providerCacheEnabled: process.env.OPENROUTER_RESPONSE_CACHE_ENABLED === 'true' },
    });
  });

  return router;
}
