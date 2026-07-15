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
import { narrateBriefViaOrchestrator } from './Delivera-Governance-Narrator-02AI-Agent.js';
import { loadNarrationKnowledge } from './Delivera-Governance-Narration-Knowledge-IO.js';
import { comparePIBaselineToNow } from './Delivera-Governance-PIBaseline-02Compare.js';
import { buildEpicActivityByKey } from './Delivera-Governance-PIBaseline-04Epic-Activity-Intelligence-SSOT.js';
import { resolveJiraHostFromEnv } from './server-utils.js';
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
import { scoreEpicHygiene, detectAdHocEpics, collectEpicsFromPayloads } from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';
import { logger } from './Delivera-Server-Logging-Utility.js';
import { buildPiFocusState, applyPiFocusToSetupGaps } from './Delivera-Governance-PIFocus-01Synergy-Build-SSOT.js';
import { listProfileOverrides } from './Delivera-Governance-Profile-01Resolve-SSOT.js';
import { buildJiraProjectFieldsFromPayloads } from './Delivera-Governance-SquadRoles-01Resolve-SSOT.js';
import { buildBriefBoardSummaries } from './Delivera-Governance-Brief-BoardSummaries-01Build-SSOT.js';
import { resolveAiReadiness } from './Delivera-AI-Readiness-01SSOT.js';

const MAX_BOARDS = 5;

/** Populate deliveryTruth.removed/carryover from baseline compare when available. */
export function enrichDeliveryTruthFromBaseline(contract, baselineComparison) {
  if (!contract?.deliveryTruth || !baselineComparison?.summary) return contract;
  const s = baselineComparison.summary;
  contract.deliveryTruth.removed = Number(s.removed) || 0;
  contract.deliveryTruth.carryover = Number(s.delayed) || 0;
  return contract;
}

/** Build per-board current-sprint payloads with fault isolation.
 *  Boards whose location.projectKey doesn't match any requested project are
 *  filtered out to prevent shared/foreign boards (e.g. a DevSecOps board
 *  touching SD issues) from contaminating a squad's insight with a wrong
 *  boardName. (Audit 2026-07-15: "COPS PROJECT" phantom squad bug.) */
async function fetchBoardPayloads({ boards, projects, agileClient, fields }) {
  const active = (Array.isArray(boards) ? boards : []).slice(0, MAX_BOARDS);
  const requestedKeys = new Set((Array.isArray(projects) ? projects : [])
    .map((p) => String(p || '').trim().toUpperCase()).filter(Boolean));
  const filtered = active.filter((board) => {
    const bp = String(board?.location?.projectKey || '').trim().toUpperCase();
    if (!bp) return true; // keep unmapped boards — they'll be attributed by issue key prefix
    return requestedKeys.size === 0 || requestedKeys.has(bp);
  });
  const settled = await Promise.allSettled(filtered.map((board) => buildCurrentSprintPayload({
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
      boardPayloads.push({ board: filtered[idx], payload: s.value });
      if (s.value?.meta?.fromSnapshot) fromSnapshot = true;
    } else {
      failures += 1;
    }
  });
  return { boardPayloads, failures, total: filtered.length, fromSnapshot };
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

function issueProjectKey(key = '') {
  const k = String(key || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9]+-\d+$/.test(k) ? k.split('-')[0] : '';
}

function boardProjectKey(board = {}, payload = {}) {
  return String(
    board?.location?.projectKey
    || payload?.meta?.projectKey
    || (Array.isArray(payload?.meta?.projectKeys) ? payload.meta.projectKeys[0] : '')
    || '',
  ).trim().toUpperCase();
}

/**
 * Build issue status lookup. Optionally restrict to project keys and/or epic rollups only
 * so PI compare never floods foreign-squad stories into another squad's baseline.
 */
export function buildCurrentByKey(boardPayloads, { projectKeys = null, epicOnly = false } = {}) {
  const allow = Array.isArray(projectKeys) && projectKeys.length
    ? new Set(projectKeys.map((p) => String(p || '').trim().toUpperCase()).filter(Boolean))
    : null;
  const map = new Map();
  const epicRollup = new Map();
  for (const { board, payload } of (Array.isArray(boardPayloads) ? boardPayloads : [])) {
    const boardPk = boardProjectKey(board, payload);
    if (allow && boardPk && !allow.has(boardPk)) continue;
    for (const s of (Array.isArray(payload?.stories) ? payload.stories : [])) {
      const k = String(s?.issueKey || s?.key || '').trim().toUpperCase();
      const storyPk = issueProjectKey(k) || boardPk;
      if (allow && storyPk && !allow.has(storyPk)) continue;
      if (k && !epicOnly) {
        map.set(k, { status: s?.status || '', updated: s?.updated || '', created: s?.created || '', title: s?.summary || '' });
      }
      const ek = String(s?.epicKey || '').trim().toUpperCase();
      if (!ek) continue;
      const epicPk = issueProjectKey(ek) || storyPk || boardPk;
      if (allow && epicPk && !allow.has(epicPk)) continue;
      if (!epicRollup.has(ek)) {
        epicRollup.set(ek, { total: 0, done: 0, title: s?.epicSummary || s?.summary || ek });
      }
      const row = epicRollup.get(ek);
      row.total += 1;
      if (statusIsDone(s?.status)) row.done += 1;
    }
  }
  for (const [ek, agg] of epicRollup) {
    if (!epicOnly && map.has(ek)) continue;
    const status = agg.total > 0 && agg.done === agg.total ? 'Done' : 'In Progress';
    map.set(ek, { status, updated: '', created: '', title: agg.title, epicRollup: true });
  }
  return map;
}

function baselinesMapFromArgs({ projects = [], baseline = null, baselinesByProject = null } = {}) {
  const map = new Map();
  const pks = (Array.isArray(projects) ? projects : [])
    .map((p) => String(p || '').trim().toUpperCase())
    .filter(Boolean);
  if (baselinesByProject instanceof Map) {
    for (const pk of pks) map.set(pk, baselinesByProject.get(pk) || null);
    for (const [pk, row] of baselinesByProject.entries()) {
      if (!map.has(pk)) map.set(String(pk).toUpperCase(), row || null);
    }
    return map;
  }
  if (baselinesByProject && typeof baselinesByProject === 'object') {
    for (const pk of pks) {
      const key = Object.keys(baselinesByProject).find((k) => String(k).toUpperCase() === pk);
      map.set(pk, key ? baselinesByProject[key] : null);
    }
    return map;
  }
  const owned = (baseline?.projects || []).map((p) => String(p).trim().toUpperCase()).filter(Boolean);
  for (const pk of pks) {
    let hit = false;
    if (baseline?.committedItems?.length) {
      if (owned.includes(pk)) hit = true;
      else if (!owned.length) {
        hit = baseline.committedItems.some((i) => {
          const squad = String(i.squad || '').trim().toUpperCase();
          return squad === pk || issueProjectKey(i.issueKey) === pk;
        });
      }
    }
    map.set(pk, hit ? baseline : null);
  }
  return map;
}

function enrichComparisonWithLiveSignals(comparison, activityByKey, currentByKey) {
  if (!comparison?.items?.length) return comparison;
  return {
    ...comparison,
    items: comparison.items.map((item) => {
      const key = String(item.issueKey || '').trim().toUpperCase();
      const current = currentByKey instanceof Map ? currentByKey.get(key) : null;
      const act = (activityByKey instanceof Map ? activityByKey.get(key) : null) || item.epicActivity || null;
      return {
        ...item,
        created: item.created || current?.created || '',
        updated: item.updated || current?.updated || '',
        epicActivity: act || item.epicActivity || null,
        title: item.title || current?.title || act?.title || item.title,
      };
    }),
  };
}

function buildBaselineComparisonsByProject({ boardPayloads, baselinesByProject }) {
  const byProject = {};
  const activityByKey = buildEpicActivityByKey(boardPayloads);
  for (const [pk, bl] of baselinesByProject.entries()) {
    if (!bl?.committedItems?.length) {
      byProject[pk] = null;
      continue;
    }
    const statusMap = buildCurrentByKey(boardPayloads, { projectKeys: [pk], epicOnly: false });
    const epicMap = buildCurrentByKey(boardPayloads, { projectKeys: [pk], epicOnly: true });
    const currentByKey = new Map([...statusMap, ...epicMap]);
    try {
      const raw = comparePIBaselineToNow({
        baseline: bl,
        currentByKey,
        currentKeys: Array.from(epicMap.keys()),
      });
      byProject[pk] = enrichComparisonWithLiveSignals(raw, activityByKey, currentByKey);
    } catch (_) {
      byProject[pk] = null;
    }
  }
  return byProject;
}

function mergeTeamRosterFromPayloads(boardPayloads = []) {
  const map = new Map();
  for (const { payload } of boardPayloads) {
    const roster = Array.isArray(payload?.meta?.teamRoster) ? payload.meta.teamRoster : [];
    for (const person of roster) {
      const key = String(person?.accountId || person?.displayName || '').toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, person);
    }
  }
  return [...map.values()].sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
}

/**
 * Assemble a full governance brief.
 * @param {object} args
 * @returns {Promise<object>} brief object
 */
export async function assembleGovernanceBrief({
  projects = [],
  boards = [],
  projectErrors = [],
  agileClient,
  version3Client = null,
  fields = {},
  period = {},
  cache = null,
  providerConfig = null,
  includeEvidence = true,
  includePOReadiness = true,
  baseline = null,
  baselinesByProject = null,
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
    ? await narrateBriefViaOrchestrator(contract, providerConfig, templateFn, { projects })
    : templateFn();
  contract.leadershipNarrative = narrative;

  // PI baseline diff — per squad, never against a foreign slide.
  const projectBaselines = baselinesMapFromArgs({ projects, baseline, baselinesByProject });
  const baselineComparisonByProject = buildBaselineComparisonsByProject({
    boardPayloads,
    baselinesByProject: projectBaselines,
  });
  const anchorPk = String(projects[0] || '').trim().toUpperCase();
  const baselineComparison = baselineComparisonByProject[anchorPk] || null;
  const anchorBaseline = projectBaselines.get(anchorPk) || null;

  if (baselineComparison) {
    enrichDeliveryTruthFromBaseline(contract, baselineComparison);
  }

  const piBaselineCommittedKeys = [];
  const piBaselineCommittedKeysByProject = {};
  for (const [pk, bl] of projectBaselines.entries()) {
    const keys = (bl?.committedItems || [])
      .map((i) => String(i.issueKey || '').trim().toUpperCase())
      .filter(Boolean);
    piBaselineCommittedKeysByProject[pk] = keys;
    for (const k of keys) {
      if (!piBaselineCommittedKeys.includes(k)) piBaselineCommittedKeys.push(k);
    }
  }
  if (piBaselineCommittedKeys.length) {
    contract.meta = contract.meta || {};
    contract.meta.piBaselineCommittedKeys = piBaselineCommittedKeys;
    contract.meta.piBaselineCommittedKeysByProject = piBaselineCommittedKeysByProject;
    contract.meta.baselineReadinessByProject = Object.fromEntries(
      [...projectBaselines.entries()].map(([pk, bl]) => [pk, {
        hasBaseline: Boolean(bl?.committedItems?.length),
        piName: bl?.piName || '',
        baselineDate: bl?.baselineDate || '',
        committedCount: bl?.committedItems?.length || 0,
      }]),
    );
  } else {
    contract.meta = contract.meta || {};
    contract.meta.baselineReadinessByProject = Object.fromEntries(
      [...projectBaselines.entries()].map(([pk]) => [pk, {
        hasBaseline: false,
        piName: '',
        baselineDate: '',
        committedCount: 0,
      }]),
    );
  }

  const claimScore = scoreClaimConfidence(contract, contract.leadershipNarrative);

  const lastJob = await readLastCompletedBriefJob({ project: projects[0] });
  const sinceLastRun = computeSinceLastRun(contract, lastJob);
  const aiReadiness = resolveAiReadiness({
    narratedBy: narrative?.narratedBy || contract.leadershipNarrative?.narratedBy || 'template',
  });
  const setupGaps = buildSetupGaps(contract, { aiKeyConfigured: aiReadiness.aiKeyConfigured });
  const jobs = await readRecentJobs({ project: projects[0], limit: 3 });
  let inboxGrouped = {};
  try {
    const inboxItems = await readPendingInboxItems({ project: projects[0], maxAgeHours: 168 });
    inboxGrouped = groupInboxByType(inboxItems);
  } catch (_) { inboxGrouped = {}; }
  const workerReceipt = await buildWorkerReceipt(contract, inboxGrouped, jobs);

  const boardEpicIndex = collectEpicsFromPayloads(boardPayloads).map((e) => ({
    issueKey: e.issueKey,
    title: e.summary,
    squad: e.squad,
    projectKey: String(e.issueKey || '').split('-')[0] || '',
  }));
  const epicHygiene = scoreEpicHygiene(contract, boardPayloads);
  const adHocEpics = detectAdHocEpics(contract, boardPayloads);
  let profileOverrideRows = [];
  try { profileOverrideRows = await listProfileOverrides(); } catch (_) { profileOverrideRows = []; }
  const periodWindow = String(period?.window || period?.periodWindow || '28d').toLowerCase();
  const piBaselineCommittedKeysFinal = contract.meta?.piBaselineCommittedKeys
    || anchorBaseline?.committedItems?.map((i) => i.issueKey)
    || [];
  const jiraProjectFields = buildJiraProjectFieldsFromPayloads(boardPayloads);
  attachExecutiveViewToBrief(contract, boardPayloads, evidencePack, {
    profileOverrides: profileOverrideRows,
    jiraProjectFields,
    periodWindow,
    piBaselineCommittedKeys: piBaselineCommittedKeysFinal,
    adHocEpics,
  });
  if (jiraProjectFields) contract.meta = { ...contract.meta, jiraProjectFields };
  const piConfidence = buildPIConfidenceStrip(contract, boardPayloads);
  const teamRoster = mergeTeamRosterFromPayloads(boardPayloads);
  const boardSummaries = buildBriefBoardSummaries(boardPayloads);
  const scopeIntelligence = buildScopeIntelligence({
    boards: boardPayloads.map((e) => e.board).concat(
      boards.filter((b) => !boardPayloads.some((e) => e.board?.id === b.id)),
    ),
    boardPayloads,
    selectedProjects: projects,
    projectErrors: projectErrors.length
      ? projectErrors
      : partialProjects.map((pk) => ({ projectKey: pk, error: 'board-unavailable' })),
  });

  const piFocus = buildPiFocusState({
    ...contract,
    baselineComparison,
    baselineComparisonByProject,
    meta: {
      ...contract.meta,
      boardEpicIndex,
      piConfidence,
      epicHygiene,
      setupGaps,
      piBaselineCommittedKeys: piBaselineCommittedKeysFinal,
    },
  });
  const finalSetupGaps = applyPiFocusToSetupGaps(setupGaps, piFocus);

  return {
    ...contract,
    evidencePack,
    poReadiness,
    baselineComparison,
    baselineComparisonByProject,
    meta: {
      boardsResolved: boardPayloads.length,
      boardsTotal: total,
      boardsFailed: failures,
      partialProjects,
      projectErrors,
      narratedBy: narrative.narratedBy,
      evidenceFetched: evidencePack.fetched,
      evidenceDegraded: evidencePack.degraded,
      claimScore: claimScore.score,
      safeToSend: claimScore.safeToSend,
      setupGaps: finalSetupGaps,
      piFocus,
      sinceLastRun,
      workerReceipt,
      commandAnswerSentence: buildCommandAnswerSentence(contract),
      jobSnapshot: buildBriefSnapshotForJob(contract),
      boardEpicIndex,
      epicHygiene,
      adHocEpics,
      piConfidence,
      scopeIntelligence,
      piForumAnswer: buildPIForumAnswer({ ...contract, meta: { piConfidence } }),
      protectMeAnswer: buildProtectMeAnswer(contract),
      teamRoster,
      periodWindow,
      boardSummaries,
      piBaselineCommittedKeys: piBaselineCommittedKeysFinal,
      piBaselineCommittedKeysByProject: contract.meta?.piBaselineCommittedKeysByProject || {},
      baselineReadinessByProject: contract.meta?.baselineReadinessByProject || {},
      jiraHost: resolveJiraHostFromEnv() || '',
    },
  };
}
