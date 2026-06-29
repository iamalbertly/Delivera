/**
 * SSOT: Silent governance worker scheduler (mirrors snapshot-worker discipline).
 */
import { logger } from './Delivera-Server-Logging-Utility.js';
import { cache } from './cache.js';
import {
  CACHE_NS,
  deriveCacheTtlMs,
  governanceBriefCacheKey,
} from './Delivera-Cache-AgeTier-01TTL-SSOT.js';
import { createAgileClient, createVersion3Client } from './jiraClients.js';
import { discoverBoardsWithCache, discoverFieldsWithCache, isSystemBusy } from './server-utils.js';
import { assembleGovernanceBrief } from './Delivera-Governance-Brief-03Assemble-Service.js';
import { getLatestPIBaseline } from './Delivera-Governance-PIBaseline-01Store-IO.js';
import { comparePIBaselineToNow } from './Delivera-Governance-PIBaseline-02Compare.js';
import { jiraEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';
import { resolveSnapshotProjects } from './snapshot-worker.js';
import { readCatalogKeys } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import { readAccessibleCatalogKeys } from './Delivera-Shared-Projects-Access-01Index-SSOT.js';
import { refreshProjectsAccessBatch } from './Delivera-Shared-Projects-Access-02Refresh-Worker.js';
import { GOVERNANCE_THRESHOLDS } from './Delivera-Governance-Grammar-01Rules-SSOT.js';
import { scoreClaimConfidence } from './Delivera-Governance-Claim-Verify-01SSOT.js';
import { resolveEffectiveGovernanceProfile, isStaleConfirmSuppressed } from './Delivera-Governance-Profile-01Resolve-SSOT.js';
import { buildHumanNudgeDraft } from '../public/Delivera-CurrentSprint-JiraNudge-01HumanText-SSOT.js';
import {
  recordJob,
  updateJobStatus,
  appendInboxItem,
  hasRecentRunningJob,
} from './Delivera-Governance-Worker-02Jobs-IO.js';
import { buildImpactPack } from './Delivera-Governance-Worker-05ImpactPack-Builder.js';
import { riskToUseCase } from './Delivera-Governance-RiskToUseCase-01Map-SSOT.js';
import {
  runProposeBaselineJob,
  runEpicHygieneJob,
  runFeedbackTriageJob,
  runSimpleModeCopyJob,
  runGroupedActionsJob,
  hasWorkerAiKey,
} from './Delivera-Agent-Orchestrator-01Runtime.js';
import { resetBudgetRun } from './Delivera-AI-Budget-01Guard-SSOT.js';

const GOVERNANCE_NS = CACHE_NS.GOVERNANCE_BRIEF;
const BUILT_IN_PROVIDER = { provider: 'built-in' };
const CHECK_INTERVAL_MS = 60 * 1000;

let governanceWorkerInFlight = false;

function defaultWorkerProjects() {
  const accessible = readAccessibleCatalogKeys();
  if (accessible.length) return accessible.slice(0, 2);
  const keys = readCatalogKeys();
  return keys.length ? keys.slice(0, 2) : ['MPSA', 'MAS'];
}

async function buildBriefForProjects(projects) {
  const agileClient = createAgileClient();
  const version3Client = createVersion3Client();
  const fields = await discoverFieldsWithCache(version3Client);
  const { boards } = await discoverBoardsWithCache(projects, agileClient);
  const portfolioKey = projects.join('+');
  let baseline = null;
  try { baseline = await getLatestPIBaseline(portfolioKey); } catch (_) { baseline = null; }

  const profile = await resolveEffectiveGovernanceProfile({
    portfolioKey,
    project: projects[0] || '',
  });

  const brief = await assembleGovernanceBrief({
    projects,
    boards,
    agileClient,
    version3Client,
    fields,
    period: { vodacomQuarter: null, sprintNames: [] },
    cache,
    providerConfig: BUILT_IN_PROVIDER,
    includeEvidence: true,
    includePOReadiness: true,
    baseline,
    profileOverrides: profile,
    maxEvidenceItems: profile.thresholds?.riskBriefTopN
      ? profile.thresholds.riskBriefTopN * 2
      : GOVERNANCE_THRESHOLDS.riskBriefTopN * 2,
  });

  const cacheKey = governanceBriefCacheKey({
    projects,
    periodWindow: '28d',
    includeEvidence: true,
    includePOReadiness: true,
  });
  const { ttlMs } = deriveCacheTtlMs({
    generatedAt: brief?.generatedAt,
    periodEnd: brief?.period?.end || brief?.meta?.periodEnd,
  });
  await cache.set(cacheKey, brief, ttlMs, { namespace: GOVERNANCE_NS });
  return brief;
}

async function runPrepareWeeklyBrief(projects) {
  if (await hasRecentRunningJob({ type: 'prepare-weekly-brief', projects, withinMinutes: 10 })) {
    logger.info('Skipping prepare-weekly-brief — recent job in flight');
    return;
  }
  const job = await recordJob({ type: 'prepare-weekly-brief', status: 'running', projects });
  try {
    const brief = await buildBriefForProjects(projects);
    const claim = scoreClaimConfidence(brief, brief.leadershipNarrative || {});
    const summary = brief.leadershipNarrative?.meetingAnswer
      || brief.leadershipNarrative?.headline
      || `${brief.portfolio} brief ready`;
    await appendInboxItem({
      jobId: job.id,
      type: 'brief',
      projects,
      summary: String(summary).slice(0, 280),
      safeToSend: claim.safeToSend,
      approvalRequired: false,
      evidenceLinks: (brief.topRisks || []).slice(0, 5).map((r) => r.issueUrl || r.issueKey).filter(Boolean),
      payload: { briefId: brief.briefId, narratedBy: brief.meta?.narratedBy },
    });
    if (!claim.safeToSend && !isStaleConfirmSuppressed(await resolveEffectiveGovernanceProfile({ portfolioKey: projects.join('+'), project: projects[0] }))) {
      await appendInboxItem({
        jobId: job.id,
        type: 'confirm',
        projects,
        summary: 'Brief has claims that need human confirmation before sharing externally.',
        safeToSend: false,
        approvalRequired: true,
        evidenceLinks: [],
        payload: { briefId: brief.briefId, score: claim.score },
      });
    }
    await updateJobStatus(job.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      narratedBy: brief.meta?.narratedBy || 'template',
      outputs: { briefId: brief.briefId, riskCount: brief.risks?.length || 0, safeToSend: claim.safeToSend },
    });
    logger.info('prepare-weekly-brief completed', { projects: projects.join(','), safeToSend: claim.safeToSend });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
    logger.warn('prepare-weekly-brief failed', { error: err?.message });
  }
}

async function runPrepareNudges(projects) {
  if (await hasRecentRunningJob({ type: 'prepare-nudges', projects, withinMinutes: 10 })) return;
  const job = await recordJob({ type: 'prepare-nudges', status: 'running', projects });
  try {
    const brief = await buildBriefForProjects(projects);
    const top = (brief.topRisks || []).filter((r) => r.issueKey).slice(0, 5);
    for (const risk of top) {
      const text = buildHumanNudgeDraft({
        issueKey: risk.issueKey,
        issueSummary: risk.summary || risk.displayTitle,
        issueStatus: risk.status,
        useCase: riskToUseCase(risk.riskType),
        staleHours: risk.ageHours,
      });
      await appendInboxItem({
        jobId: job.id,
        type: 'nudge',
        projects,
        summary: `${risk.issueKey}: ${text.slice(0, 120)}`,
        safeToSend: brief.freshness?.confidenceLimit !== 'stale',
        approvalRequired: true,
        evidenceLinks: [risk.issueUrl || risk.issueKey].filter(Boolean),
        payload: { issueKey: risk.issueKey, draftText: text },
      });
    }
    await updateJobStatus(job.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      outputs: { nudgeCount: top.length },
    });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
  }
}

async function runScanPoReadiness(projects) {
  if (await hasRecentRunningJob({ type: 'scan-po-readiness', projects, withinMinutes: 10 })) return;
  const job = await recordJob({ type: 'scan-po-readiness', status: 'running', projects });
  try {
    const brief = await buildBriefForProjects(projects);
    const po = brief.poReadiness;
    if (po?.totalFlagged > 0) {
      await appendInboxItem({
        jobId: job.id,
        type: 'po-readiness',
        projects,
        summary: po.readinessLabel || `${po.totalFlagged} backlog readiness signal(s)`,
        safeToSend: true,
        approvalRequired: false,
        evidenceLinks: [],
        payload: { signals: po.signals },
      });
    }
    await updateJobStatus(job.id, { status: 'completed', completedAt: new Date().toISOString(), outputs: { flagged: po?.totalFlagged || 0 } });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
  }
}

async function runCheckPiBaselineDrift(projects) {
  const portfolioKey = projects.join('+');
  const baseline = await getLatestPIBaseline(portfolioKey);
  if (!baseline) return;
  if (await hasRecentRunningJob({ type: 'check-pi-baseline-drift', projects, withinMinutes: 55 })) return;
  const job = await recordJob({ type: 'check-pi-baseline-drift', status: 'running', projects });
  try {
    const brief = await buildBriefForProjects(projects);
    const diff = brief.baselineComparison;
    if (!diff) {
      await updateJobStatus(job.id, { status: 'skipped', completedAt: new Date().toISOString() });
      return;
    }
    const s = diff.summary || {};
    const driftCount = (s.removed || 0) + (s.addedAfterBaseline || 0) + (s.delayed || 0);
    if (driftCount > 0) {
      await appendInboxItem({
        jobId: job.id,
        type: 'pi-drift',
        projects,
        summary: `PI drift: ${s.removed || 0} removed, ${s.addedAfterBaseline || 0} added, ${s.delayed || 0} delayed vs baseline`,
        safeToSend: true,
        approvalRequired: true,
        evidenceLinks: [],
        payload: { summary: s, piName: diff.piName },
      });
    }
    await updateJobStatus(job.id, { status: 'completed', completedAt: new Date().toISOString(), outputs: { driftCount } });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
  }
}

async function runBuildImpactPack(projects) {
  if (await hasRecentRunningJob({ type: 'build-impact-pack', projects, withinMinutes: 60 })) return;
  const job = await recordJob({ type: 'build-impact-pack', status: 'running', projects });
  try {
    const result = await buildImpactPack({ project: projects[0] || 'MPSA' });
    if (!result.skipped) {
      await appendInboxItem({
        jobId: job.id,
        type: 'impact',
        projects,
        summary: `Impact pack ready for ${result.month}`,
        safeToSend: true,
        approvalRequired: true,
        evidenceLinks: [],
        payload: { month: result.month },
      });
    }
    await updateJobStatus(job.id, {
      status: result.skipped ? 'skipped' : 'completed',
      completedAt: new Date().toISOString(),
      outputs: { month: result.month, skipped: result.skipped },
    });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
  }
}

async function runAiSubAgentJobs(projects, brief, boardPayloads) {
  if (!hasWorkerAiKey()) return;
  const runId = `gov-tick-${Date.now()}`;
  resetBudgetRun(runId);
  const ctx = { brief, boardPayloads, projects, quarter: brief?.period?.vodacomQuarter };

  await runProposeBaselineJob(projects, {
    cache,
    version3Client: createVersion3Client(),
    quarter: ctx.quarter,
  });
  await runEpicHygieneJob(projects, ctx);
  await runFeedbackTriageJob(projects);
  await runSimpleModeCopyJob(projects, { tier: brief?.executiveView?.verdictTier, brief });
  await runGroupedActionsJob(projects, ctx);
}

async function resolveGovernanceProjects() {
  try {
    const catalog = readCatalogKeys();
    const accessible = await readAccessibleCatalogKeys(catalog);
    const snapshot = await resolveSnapshotProjects();
    const fallback = defaultWorkerProjects();
    const merged = [...new Set([...accessible, ...snapshot, ...fallback])];
    return merged.length ? merged.slice(0, 12) : fallback;
  } catch (_) {
    return defaultWorkerProjects();
  }
}

async function governanceWorkerTick() {
  if (governanceWorkerInFlight) return;
  if (!jiraEnvConfig.host || !jiraEnvConfig.email || !jiraEnvConfig.apiToken) return;
  if (isSystemBusy()) return;

  governanceWorkerInFlight = true;
  try {
    const projects = await resolveGovernanceProjects();
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay();
    const date = now.getDate();

    await refreshProjectsAccessBatch({ userId: 'governance-worker' });
    await runPrepareWeeklyBrief(projects);

    const brief = await buildBriefForProjects(projects).catch(() => null);
    if (brief && hasWorkerAiKey()) {
      await runAiSubAgentJobs(projects, brief, brief?.meta?.boardPayloads || []);
    }

    if (hour === 7 && minute < 2) {
      await runPrepareNudges(projects);
      await runScanPoReadiness(projects);
    }

    if (minute < 2) {
      await runCheckPiBaselineDrift(projects);
    }

    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isLastWeekday = date >= lastDay - 2 && day >= 1 && day <= 5;
    if (isLastWeekday && hour === 18 && minute < 2) {
      await runBuildImpactPack(projects);
    }

    if (day === 1 && hour === 6 && minute >= 28 && minute < 32) {
      await runPrepareWeeklyBrief(projects);
    }
  } catch (err) {
    logger.error('governance worker tick failed', { error: err?.message });
  } finally {
    governanceWorkerInFlight = false;
  }
}

export function startGovernanceWorker() {
  setTimeout(() => governanceWorkerTick(), 45 * 1000);
  setInterval(() => governanceWorkerTick(), CHECK_INTERVAL_MS);
  logger.info('Governance worker scheduler started');
}
