/**
 * SSOT: Governance Brief assembly orchestrator.
 *
 * Ties the deterministic governance modules together into one brief:
 *   board payloads -> fact contract -> decision owners -> evidence pack ->
 *   PO readiness -> (optional) PI baseline diff -> narrative (template or advisor).
 *
 * Jira fetching is bounded (token/call discipline): one current-sprint payload
 * per board, and changelog only for the top flagged risks. Narration always has a
 * working template fallback.
 */
import { buildCurrentSprintPayload } from './currentSprint.js';
import { buildBriefFactContract } from './Delivera-Governance-Brief-01FactContract-SSOT.js';
import { assignDecisionOwners } from './Delivera-Governance-DecisionOwner-01Map-SSOT.js';
import { buildEvidencePack } from './Delivera-Governance-Evidence-01Pack-Builder.js';
import { buildPOReadinessScorecard } from './Delivera-Governance-POReadiness-01Signals.js';
import { narrateBriefTemplate } from './Delivera-Governance-Brief-02Narrator-Template.js';
import { narrateBriefViaProvider } from './Delivera-AI-Provider-Gateway.js';
import { loadNarrationKnowledge } from './Delivera-Governance-Narration-Knowledge-IO.js';
import { comparePIBaselineToNow } from './Delivera-Governance-PIBaseline-02Compare.js';
import { GOVERNANCE_THRESHOLDS } from './Delivera-Governance-Grammar-01Rules-SSOT.js';
import { attachExecutiveViewToBrief } from './Delivera-Governance-Executive-01View-SSOT.js';
import { scoreClaimConfidence } from './Delivera-Governance-Claim-Verify-01SSOT.js';
import {
  buildSetupGaps,
  buildBriefSnapshotForJob,
  buildCommandAnswerSentence,
  computeSinceLastRun,
  buildWorkerReceipt,
} from './Delivera-Governance-Worker-03Receipt-SSOT.js';
import {
  readRecentJobs,
  readLastCompletedBriefJob,
  readPendingInboxItems,
  groupInboxByType,
} from './Delivera-Governance-Worker-02Jobs-IO.js';
import { buildScopeIntelligence } from './Delivera-Governance-BoardIntelligence-01Scope-SSOT.js';
import { buildPIConfidenceStrip, buildPIForumAnswer, buildProtectMeAnswer } from './Delivera-Governance-PIConfidence-01Strip-SSOT.js';
import { scoreEpicHygiene, detectAdHocEpics } from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';
import { logger } from './Delivera-Server-Logging-Utility.js';

const MAX_BOARDS = 5;

/** Populate deliveryTruth.removed/carryover from baseline compare when available. */
export function enrichDeliveryTruthFromBaseline(contract, baselineComparison) {
  if (!contract?.deliveryTruth || !baselineComparison?.summary) return contract;
  const s = baselineComparison.summary;
  contract.deliveryTruth.removed = Number(s.removed) || 0;
  contract.deliveryTruth.carryover = Number(s.delayed) || 0;
  return contract;
}

/** Build per-board current-sprint payloads with fault isolation. */
async function fetchBoardPayloads({ boards, projects, agileClient, fields }) {
  const active = (Array.isArray(boards) ? boards : []).slice(0, MAX_BOARDS);
  const settled = await Promise.allSettled(active.map((board) => buildCurrentSprintPayload({
    board: { id: board.id, name: board.name, location: board.location },
    projectKeys: board.location?.projectKey ? [board.location.projectKey] : projects,
    agileClient,
    fields: {
      storyPointsFieldId: fields.storyPointsFieldId,
      epicLinkFieldId: fields.epicLinkFieldId,
      ebmFieldIds: fields.ebmFieldIds || {},
      storyPointsFieldCandidates: fields.storyPointsFieldCandidates || [],
    },
    options: {},
  })));
  const boardPayloads = [];
  let failures = 0;
  let fromSnapshot = false;
  settled.forEach((s, idx) => {
    if (s.status === 'fulfilled' && s.value) {
      boardPayloads.push({ board: active[idx], payload: s.value });
      if (s.value?.meta?.fromSnapshot) fromSnapshot = true;
    } else {
      failures += 1;
    }
  });
  return { boardPayloads, failures, total: active.length, fromSnapshot };
}

function buildSprintStartByKey(boardPayloads) {
  const map = new Map();
  for (const { payload } of boardPayloads) {
    const start = payload?.sprint?.startDate || '';
    for (const s of (Array.isArray(payload?.stories) ? payload.stories : [])) {
      const k = String(s?.issueKey || s?.key || '').trim().toUpperCase();
      if (k) map.set(k, start);
    }
  }
  return map;
}

function statusIsDone(status) {
  return String(status || '').toLowerCase().includes('done');
}

function buildCurrentByKey(boardPayloads) {
  const map = new Map();
  const epicRollup = new Map();
  for (const { payload } of boardPayloads) {
    for (const s of (Array.isArray(payload?.stories) ? payload.stories : [])) {
      const k = String(s?.issueKey || s?.key || '').trim().toUpperCase();
      if (k) map.set(k, { status: s?.status || '', updated: s?.updated || '', created: s?.created || '', title: s?.summary || '' });
      const ek = String(s?.epicKey || '').trim().toUpperCase();
      if (!ek) continue;
      if (!epicRollup.has(ek)) {
        epicRollup.set(ek, { total: 0, done: 0, title: s?.epicSummary || s?.summary || ek });
      }
      const row = epicRollup.get(ek);
      row.total += 1;
      if (statusIsDone(s?.status)) row.done += 1;
    }
  }
  for (const [ek, agg] of epicRollup) {
    if (map.has(ek)) continue;
    const status = agg.total > 0 && agg.done === agg.total ? 'Done' : 'In Progress';
    map.set(ek, { status, updated: '', created: '', title: agg.title, epicRollup: true });
  }
  return map;
}

/**
 * Assemble a full governance brief.
 * @param {object} args
 * @returns {Promise<object>} brief object
 */
export async function assembleGovernanceBrief({
  projects = [],
  boards = [],
  agileClient,
  version3Client = null,
  fields = {},
  period = {},
  cache = null,
  providerConfig = null,
  includeEvidence = true,
  includePOReadiness = true,
  baseline = null,
  profileOverrides = null,
  maxEvidenceItems = GOVERNANCE_THRESHOLDS.riskBriefTopN * 2,
} = {}) {
  const thresholds = profileOverrides?.thresholds || GOVERNANCE_THRESHOLDS;
  const riskTopN = thresholds.riskBriefTopN || GOVERNANCE_THRESHOLDS.riskBriefTopN;
  const { boardPayloads, failures, total, fromSnapshot } = await fetchBoardPayloads({ boards, projects, agileClient, fields });
  const partialProjects = failures > 0 && boardPayloads.length < total
    ? projects.filter((p) => {
      const PK = String(p).trim().toUpperCase();
      return !boardPayloads.some((e) => {
        const pk = String(e?.board?.location?.projectKey || '').toUpperCase();
        return pk === PK;
      });
    })
    : [];

  const freshnessMeta = {
    stale: false,
    partial: failures > 0 && boardPayloads.length > 0,
    fromSnapshot,
    fromCache: false,
    jiraFetchedAt: new Date().toISOString(),
    cacheAgeMinutes: 0,
  };

  const contract = buildBriefFactContract({ projects, boardPayloads, period, freshnessMeta });

  // Decision-owner enrichment; portfolio risks rank with issue risks for top decisions.
  const portfolioEnriched = assignDecisionOwners(contract.portfolioRisks || []);
  const issueEnriched = assignDecisionOwners(contract.risks);
  contract.portfolioRisks = portfolioEnriched;
  contract.risks = issueEnriched;
  const escOrder = { escalate: 0, 'act-today': 1, watch: 2 };
  const combined = [...portfolioEnriched, ...issueEnriched].sort(
    (a, b) => (escOrder[a.escalation] ?? 3) - (escOrder[b.escalation] ?? 3),
  );
  const suppressed = new Set(profileOverrides?.suppressedRiskTypes || []);
  if (suppressed.size) {
    contract.risks = contract.risks.filter((r) => !suppressed.has(r.riskType));
    contract.portfolioRisks = contract.portfolioRisks.filter((r) => !suppressed.has(r.riskType));
  }
  contract.topRisks = combined.filter((r) => !suppressed.has(r.riskType)).slice(0, riskTopN);

  // Evidence pack (bounded, top risks only).
  let evidencePack = { rows: [], fetched: 0, degraded: !version3Client };
  if (includeEvidence) {
    try {
      evidencePack = await buildEvidencePack({
        risks: contract.topRisks,
        version3Client,
        sprintStartByKey: buildSprintStartByKey(boardPayloads),
        cache,
        maxItems: maxEvidenceItems,
      });
    } catch (err) {
      logger.warn('Evidence pack assembly failed', { error: err?.message });
      evidencePack = { rows: [], fetched: 0, degraded: true };
    }
  }

  // PO readiness scorecard.
  const poReadiness = includePOReadiness ? buildPOReadinessScorecard(boardPayloads) : null;

  // Narrative: template is the always-working default; advisor is optional + validated.
  const primaryProject = projects[0] || '';
  let knowledge = profileOverrides?.phraseMap || null;
  if (!knowledge || !(knowledge instanceof Map)) {
    try { knowledge = await loadNarrationKnowledge(primaryProject); } catch (_) { knowledge = null; }
  }
  const templateFn = () => narrateBriefTemplate(contract, knowledge);
  const narrative = providerConfig
    ? await narrateBriefViaProvider(contract, providerConfig, templateFn)
    : templateFn();
  contract.leadershipNarrative = narrative;
  attachExecutiveViewToBrief(contract, boardPayloads, evidencePack);

  // PI baseline diff (optional).
  let baselineComparison = null;
  if (baseline) {
    try {
      baselineComparison = comparePIBaselineToNow({
        baseline,
        currentByKey: buildCurrentByKey(boardPayloads),
        currentKeys: Array.from(buildCurrentByKey(boardPayloads).keys()),
      });
    } catch (err) {
      logger.warn('PI baseline comparison failed', { error: err?.message });
    }
  }

  if (baselineComparison) {
    enrichDeliveryTruthFromBaseline(contract, baselineComparison);
    if (baseline?.committedItems?.length) {
      contract.meta = contract.meta || {};
      contract.meta.piBaselineCommittedKeys = baseline.committedItems
        .map((i) => String(i.issueKey || '').trim().toUpperCase())
        .filter(Boolean);
    }
  }

  const claimScore = scoreClaimConfidence(contract, contract.leadershipNarrative);

  const lastJob = await readLastCompletedBriefJob({ project: projects[0] });
  const sinceLastRun = computeSinceLastRun(contract, lastJob);
  const setupGaps = buildSetupGaps(contract, { aiKeyConfigured: providerConfig?.provider && providerConfig.provider !== 'built-in' ? true : null });
  const jobs = await readRecentJobs({ project: projects[0], limit: 3 });
  let inboxGrouped = {};
  try {
    const inboxItems = await readPendingInboxItems({ project: projects[0], maxAgeHours: 168 });
    inboxGrouped = groupInboxByType(inboxItems);
  } catch (_) { inboxGrouped = {}; }
  const workerReceipt = await buildWorkerReceipt(contract, inboxGrouped, jobs);

  const epicHygiene = scoreEpicHygiene(contract, boardPayloads);
  const adHocEpics = detectAdHocEpics(contract, boardPayloads);
  const piConfidence = buildPIConfidenceStrip(contract, boardPayloads);
  const scopeIntelligence = buildScopeIntelligence({
    boards: boardPayloads.map((e) => e.board).concat(
      boards.filter((b) => !boardPayloads.some((e) => e.board?.id === b.id)),
    ),
    boardPayloads,
    selectedProjects: projects,
    projectErrors: partialProjects.map((pk) => ({ projectKey: pk, error: 'board-unavailable' })),
  });

  return {
    ...contract,
    evidencePack,
    poReadiness,
    baselineComparison,
    meta: {
      boardsResolved: boardPayloads.length,
      boardsTotal: total,
      boardsFailed: failures,
      partialProjects,
      narratedBy: narrative.narratedBy,
      evidenceFetched: evidencePack.fetched,
      evidenceDegraded: evidencePack.degraded,
      claimScore: claimScore.score,
      safeToSend: claimScore.safeToSend,
      setupGaps,
      sinceLastRun,
      workerReceipt,
      commandAnswerSentence: buildCommandAnswerSentence(contract),
      jobSnapshot: buildBriefSnapshotForJob(contract),
      epicHygiene,
      adHocEpics,
      piConfidence,
      scopeIntelligence,
      piForumAnswer: buildPIForumAnswer({ ...contract, meta: { piConfidence } }),
      protectMeAnswer: buildProtectMeAnswer(contract),
    },
  };
}
