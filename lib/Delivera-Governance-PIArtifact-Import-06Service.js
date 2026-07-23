import { aiProviderEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';
import { AI_TASK_TYPES, runStructuredAITask, runVisionAITask } from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import { matchSlideToEpics } from './Delivera-Governance-PIBaseline-03Propose-Agent.js';
import { PI_ARTIFACT_LIMITS, piImportError, safeImportFailure, validateArtifactMeta } from './Delivera-Governance-PIArtifact-Contracts-01SSOT.js';
import { resolveCanonicalSquad, sha256 } from './Delivera-Governance-PIArtifact-Identity-01SSOT.js';
import { buildVisualExtraction, extractNativeArtifact } from './Delivera-Governance-PIArtifact-NativeExtract-02Service.js';
import {
  extractStructuredLocalCommitments, runLocalOcr, validateImageDimensions,
} from './Delivera-Governance-PIArtifact-LocalOCR-03Service.js';
import {
  claimPIArtifactLease, createPIImportJob, findActivePIImport, readPIArtifactResult,
  releasePIArtifactLease, savePIArtifactResult, updatePIImportJob,
} from './Delivera-Governance-PIArtifact-Job-04Store-IO.js';
import { recordPIArtifactProviderOutcome, reservePIArtifactCall } from './Delivera-Governance-PIArtifact-AIQuota-05SSOT.js';

function extractTextBlocks(result = {}) {
  return (Array.isArray(result.textBlocks) ? result.textBlocks : [])
    .map((block) => typeof block === 'string' ? block : block?.text)
    .map((text) => String(text || '').trim())
    .filter(Boolean);
}

function toSlideRows(commitments = []) {
  return commitments.map((item) => ({
    month: item.month,
    theme: item.theme,
    bullet: item.originalText || item.title,
    title: item.title,
    sourceSpan: item.sourceSpan,
    squad: item.squad,
  }));
}

async function runRemoteStage({ organizationId, job, buffer, meta, taskType, model, role, payload }) {
  const reservation = await reservePIArtifactCall(organizationId, { jobId: job.jobId, model, role });
  if (!reservation.reserved) return { result: null, model: '', fallbackUsed: true, reason: reservation.reason };
  const outcome = taskType === AI_TASK_TYPES.PI_ARTIFACT_RECONCILE
    ? await runStructuredAITask(taskType, payload, {
      runId: job.jobId,
      providerConfig: { provider: 'openrouter', apiKey: aiProviderEnvConfig.openrouterApiKey, modelOverride: model },
    })
    : await runVisionAITask(taskType, {
      imageBase64: buffer.toString('base64'),
      mimeType: meta.mimeType,
      ...payload,
    }, {
      runId: job.jobId,
      providerConfig: {
        provider: 'openrouter',
        apiKey: aiProviderEnvConfig.openrouterApiKey,
        modelOverride: model,
        cacheEnabled: process.env.OPENROUTER_RESPONSE_CACHE_ENABLED === 'true',
      },
    });
  await recordPIArtifactProviderOutcome(model, {
    success: !outcome.fallbackUsed,
    error: outcome.error || (outcome.violations || []).join(','),
  });
  return { ...outcome, model: outcome.model || model, requestedModel: model, reservation };
}

async function extractImage({ organizationId, job, buffer, meta }) {
  await validateImageDimensions(buffer);
  await updatePIImportJob(organizationId, job.jobId, {
    state: 'local-ocr', message: 'Reading visible commitments locally. No AI allowance used.',
  });
  const localOcrEnabled = process.env.DELIVERA_LOCAL_OCR_ENABLED !== 'false' && !process.env.VERCEL;
  const local = await runLocalOcr(buffer, { enabled: localOcrEnabled }).catch((error) => ({
    text: '', regions: [], confidence: 0, method: 'tesseract-local-failed', error: error.message,
  }));
  const localText = [local.text, ...(local.regions || []).map((row) => row.text)].filter(Boolean).join('\n');
  let extraction = buildVisualExtraction(local.text, job.artifactHash, {
    filename: meta.filename, method: local.method, confidence: local.confidence,
  });
  const structured = extractStructuredLocalCommitments(local.regions, job.artifactHash);
  if (structured.length) {
    const squad = extraction.squads[0]?.key || '';
    extraction.commitments = structured.map((item) => ({ ...item, squad }));
    extraction.pages[0].commitments = extraction.commitments;
    extraction.text = localText;
  }
  const methods = [local.method];
  const models = [];
  let callsConsumed = 0;
  if (local.confidence < 0.7 || extraction.commitments.length === 0) {
    await updatePIImportJob(organizationId, job.jobId, {
      state: 'remote-ocr', message: 'Local reading is incomplete. Checking one unresolved image securely.',
    });
    const remote = await runRemoteStage({
      organizationId, job, buffer, meta,
      taskType: AI_TASK_TYPES.PI_ARTIFACT_OCR,
      model: aiProviderEnvConfig.openrouterModelPiOcr,
      role: 'ocr',
      payload: { localTextBlocks: localText ? [{ text: localText }] : [], artifactHash: job.artifactHash },
    });
    if (remote.reservation?.reserved) callsConsumed += 1;
    if (remote.model) models.push(remote.model);
    const remoteText = extractTextBlocks(remote.result).join('\n');
    if (remoteText) {
      extraction = buildVisualExtraction(remoteText, job.artifactHash, {
        filename: meta.filename, method: 'qianfan-ocr', confidence: 0.75,
      });
      methods.push('qianfan-ocr');
    }
  }
  if (extraction.commitments.length === 0 && callsConsumed < PI_ARTIFACT_LIMITS.maxCallsPerArtifact) {
    await updatePIImportJob(organizationId, job.jobId, {
      state: 'verifying', message: 'Resolving visual structure without creating new source text.',
    });
    const visual = await runRemoteStage({
      organizationId, job, buffer, meta,
      taskType: AI_TASK_TYPES.PI_ARTIFACT_STRUCTURE_CLASSIFY,
      model: aiProviderEnvConfig.openrouterModelPiVision,
      role: 'visual-structure',
      payload: {
        textBlocks: extraction.text ? [{ text: extraction.text }] : [],
        slideNumber: 1,
        title: meta.filename,
        deterministicType: extraction.pages[0]?.classification,
        deterministicSquad: extraction.squads[0]?.key || '',
        deterministicPeriod: extraction.period?.label || '',
      },
    });
    if (visual.reservation?.reserved) callsConsumed += 1;
    if (visual.model) models.push(visual.model);
    const spans = (visual.result?.commitmentSpans || [])
      .map((item) => typeof item === 'string' ? item : item?.text)
      .filter(Boolean).join('\n');
    if (spans) {
      extraction = buildVisualExtraction(spans, job.artifactHash, {
        filename: meta.filename, method: 'qwen-structure', confidence: 0.75,
      });
    }
    methods.push(visual.fallbackUsed ? 'visual-review-unavailable' : 'qwen-structure');
  }
  return { extraction, methods, models, callsConsumed, localConfidence: local.confidence };
}

function buildReviewResult(extraction, boardEpics, request, stages) {
  const { candidates, unmatched } = matchSlideToEpics(toSlideRows(extraction.commitments), boardEpics);
  const requestedSquad = resolveCanonicalSquad(request.requestedSquad).key || request.requestedSquad;
  const detectedSquad = extraction.squads[0]?.key || '';
  const detectedPeriod = extraction.period?.label || '';
  const conflicts = [];
  if (requestedSquad && detectedSquad && requestedSquad !== detectedSquad) {
    conflicts.push({ type: 'squad', requested: requestedSquad, detected: detectedSquad });
  }
  if (request.requestedQuarter && detectedPeriod && !detectedPeriod.includes(request.requestedQuarter)) {
    conflicts.push({ type: 'period', requested: request.requestedQuarter, detected: detectedPeriod });
  }
  return {
    method: extraction.method,
    artifactHash: extraction.artifactHash,
    period: detectedPeriod
      ? extraction.period
      : { label: request.requestedQuarter || '', confidence: request.requestedQuarter ? 0.6 : 0, source: 'requested-context' },
    squads: extraction.squads,
    pages: extraction.pages.map(({ text, lines, commitments, ...page }) => page),
    extracted: toSlideRows(extraction.commitments),
    commitments: extraction.commitments,
    candidates: [...candidates, ...unmatched].slice(0, 100),
    unmatched,
    conflicts,
    needsHumanApproval: true,
    provenanceComplete: extraction.commitments.length > 0
      && extraction.commitments.every((item) => item.sourceSpan?.rawText && item.sourceSpan?.artifactHash),
    ...stages,
  };
}

export async function preparePIArtifactImport({
  organizationId = 'delivera', actor = 'unknown', artifactHash, meta,
  requestedSquad = '', requestedQuarter = '',
} = {}) {
  const cached = await readPIArtifactResult(organizationId, artifactHash);
  if (cached) return { status: 'cached', result: cached, callsAvoided: Math.max(1, cached.callsConsumed || 1) };
  const lease = await claimPIArtifactLease(organizationId, `prepare:${artifactHash}`);
  if (!lease.acquired) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    const joined = await findActivePIImport(organizationId, artifactHash);
    if (joined) return { status: 'joined', job: joined };
    throw piImportError('PI_IMPORT_BUSY', 'Another secure import is starting. Retry in a moment.', 409, true);
  }
  try {
    const active = await findActivePIImport(organizationId, artifactHash);
    if (active) return { status: 'joined', job: active };
    const job = await createPIImportJob({ organizationId, actor, artifactHash, meta, requestedSquad, requestedQuarter });
    return { status: 'upload-required', job };
  } finally {
    await releasePIArtifactLease(lease);
  }
}

export async function processPIArtifactImport({
  organizationId = 'delivera', actor = 'unknown', buffer, meta: rawMeta,
  expectedHash = '', requestedSquad = '', requestedQuarter = '', boardEpics = [], preparedJob = null,
} = {}) {
  const meta = validateArtifactMeta({ ...rawMeta, size: buffer?.length || rawMeta?.size });
  const artifactHash = sha256(buffer);
  if (expectedHash && expectedHash !== artifactHash) throw piImportError('PI_ARTIFACT_HASH_MISMATCH', 'The uploaded file changed after preparation.', 409);
  const cached = await readPIArtifactResult(organizationId, artifactHash);
  if (cached) return { job: null, result: { ...cached, cacheStatus: 'exact-hit', callsAvoided: Math.max(1, cached.callsConsumed || 1) } };
  const lease = await claimPIArtifactLease(organizationId, artifactHash);
  if (!lease.acquired) {
    const active = await findActivePIImport(organizationId, artifactHash);
    if (active) return { job: active, joined: true, result: null };
    throw piImportError('PI_IMPORT_BUSY', 'Another secure import is starting. Retry in a moment.', 409, true);
  }
  const job = preparedJob || await createPIImportJob({
    organizationId, actor, artifactHash, meta, requestedSquad, requestedQuarter,
  });
  try {
    await updatePIImportJob(organizationId, job.jobId, {
      state: 'extracting-native', message: 'Extracting reusable source evidence.',
    });
    let extraction = await extractNativeArtifact(buffer, meta, artifactHash);
    let stages = { methods: [extraction.method], models: [], callsConsumed: 0 };
    if (meta.kind === 'image') {
      const visual = await extractImage({ organizationId, job, buffer, meta });
      extraction = visual.extraction;
      stages = {
        methods: visual.methods,
        models: visual.models,
        callsConsumed: visual.callsConsumed,
        localConfidence: visual.localConfidence,
      };
    }
    await updatePIImportJob(organizationId, job.jobId, {
      state: 'matching-squad', message: 'Matching detected names to the canonical squad registry.',
      methods: stages.methods, models: stages.models,
    });
    const result = buildReviewResult(extraction, boardEpics, { requestedSquad, requestedQuarter }, stages);
    if (result.conflicts.length && stages.callsConsumed < PI_ARTIFACT_LIMITS.maxCallsPerArtifact) {
      await updatePIImportJob(organizationId, job.jobId, {
        state: 'verifying', message: 'Reconciling conflicting evidence for human review.',
      });
      const reconciled = await runRemoteStage({
        organizationId, job, buffer, meta,
        taskType: AI_TASK_TYPES.PI_ARTIFACT_RECONCILE,
        model: aiProviderEnvConfig.openrouterModelPiReconcile,
        role: 'reconciliation',
        payload: {
          interpretations: result.conflicts,
          sourceSpans: result.commitments.map((item) => item.sourceSpan),
          allowedIssueKeys: result.candidates.map((item) => item.issueKey).filter(Boolean),
          artifactHash,
        },
      });
      if (reconciled.reservation?.reserved) stages.callsConsumed += 1;
      if (reconciled.model) stages.models.push(reconciled.model);
      result.reconciliation = reconciled.result;
      result.callsConsumed = stages.callsConsumed;
      result.models = stages.models;
    }
    const stored = await savePIArtifactResult(organizationId, artifactHash, result);
    const complete = await updatePIImportJob(organizationId, job.jobId, {
      state: 'awaiting-review',
      message: result.conflicts.length
        ? 'Evidence is ready. Resolve the highlighted conflict before approval.'
        : 'Evidence is ready for human approval.',
      allowedNextAction: 'review',
      result: stored,
      completedAt: new Date().toISOString(),
    });
    return { job: complete, result: stored, joined: false };
  } catch (error) {
    await updatePIImportJob(organizationId, job.jobId, {
      state: 'failed',
      message: safeImportFailure(error).error,
      terminalError: safeImportFailure(error),
      retryable: error?.retryable === true,
      allowedNextAction: error?.retryable ? 'retry' : 'replace-file',
    }).catch(() => {});
    throw error;
  } finally {
    await releasePIArtifactLease(lease);
  }
}
