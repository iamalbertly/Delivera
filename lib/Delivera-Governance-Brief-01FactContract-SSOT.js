/**
 * SSOT: Brief Fact Contract.
 *
 * Assembles the evidence-bound JSON contract from per-board current-sprint
 * payloads (buildCurrentSprintPayload) plus portfolio context. Every count and
 * every risk maps to a Jira object (issue key + timestamp). This is the only
 * structure the narrator is allowed to read; nothing here is invented.
 *
 * Pure: takes already-fetched payloads, returns a plain object. No Jira/IO.
 */
import { buildMergedWorkRiskRows, getUnifiedBlockerCount } from '../public/Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
import {
  RISK_TYPES,
  GOVERNANCE_THRESHOLDS,
  deriveFreshnessState,
  deriveDeliveryConfidence,
  clampConfidenceToFreshness,
  escalationLevel,
  riskTypeLabel,
} from './Delivera-Governance-Grammar-01Rules-SSOT.js';

const NOT_STARTED_STATUSES = ['to do', 'todo', 'open', 'backlog', 'new', 'selected for development'];

function asNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function statusIsDone(status) {
  return String(status || '').toLowerCase().includes('done');
}

function statusIsNotStarted(status) {
  return NOT_STARTED_STATUSES.includes(String(status || '').toLowerCase().trim());
}

function storyHasDependencySignal(story) {
  const labels = Array.isArray(story?.labels) ? story.labels : [];
  if (labels.some((l) => /depend|dependency|blocked-by/i.test(String(l || '')))) return true;
  const links = story?.issuelinks || story?.issueLinks || [];
  if (Array.isArray(links) && links.some((l) => /blocked|depend/i.test(String(l?.type || l?.inward || l?.outward || '')))) {
    return true;
  }
  return false;
}

/** Map a merged work-risk row to a canonical governance risk type. */
function classifyRiskType(row) {
  if (row?.dependencySignal) return RISK_TYPES.DEPENDENCY;
  const tags = Array.isArray(row?.riskTags) ? row.riskTags : [];
  if (tags.includes('scope')) return RISK_TYPES.LATE_SCOPE;
  if (tags.includes('unassigned')) return RISK_TYPES.MISSING_OWNER;
  if (tags.includes('blocker')) return RISK_TYPES.STALE_IN_PROGRESS;
  if (tags.includes('parent-flow') || tags.includes('subtask-flow')) return RISK_TYPES.STALE_IN_PROGRESS;
  if (tags.includes('missing-estimate')) return RISK_TYPES.MISSING_ESTIMATE;
  if (tags.includes('no-log')) return RISK_TYPES.NO_LOG;
  return RISK_TYPES.STALE_IN_PROGRESS;
}

/** Deterministic, defensible evidence string for a risk row. */
function buildEvidence(row, riskType) {
  const hours = asNum(row?.hoursInStatus, 0);
  const status = String(row?.status || '').trim() || 'In progress';
  switch (riskType) {
    case RISK_TYPES.LATE_SCOPE:
      return row?.updated ? `created/added on ${String(row.updated).slice(0, 10)}, after sprint start` : 'added after sprint start';
    case RISK_TYPES.MISSING_OWNER:
      return `no assignee or reporter on record (status ${status})`;
    case RISK_TYPES.MISSING_ESTIMATE:
      return 'no estimate recorded on subtask';
    case RISK_TYPES.NO_LOG:
      return 'estimated but no time logged';
    case RISK_TYPES.DEPENDENCY:
      return row?.dependencyEvidence || 'cross-team dependency unresolved';
    case RISK_TYPES.STALE_IN_PROGRESS:
    default:
      return hours > 0 ? `status unchanged for ${Math.round(hours)}h in ${status}` : `flagged in ${status}`;
  }
}

/** Scan stories for dependency labels/links not already in work-risk rows. */
function scanDependencyRisks(boardPayloads) {
  const byKey = new Map();
  for (const entry of boardPayloads) {
    const payload = entry?.payload;
    if (!payload) continue;
    const squad = payload?.board?.name || entry?.board?.name || '';
    for (const story of (Array.isArray(payload?.stories) ? payload.stories : [])) {
      if (!storyHasDependencySignal(story)) continue;
      if (statusIsDone(story?.status)) continue;
      const issueKey = String(story?.issueKey || story?.key || '').trim().toUpperCase();
      if (!issueKey) continue;
      byKey.set(issueKey, {
        issueKey,
        squad,
        summary: String(story?.summary || '').slice(0, 160),
        riskType: RISK_TYPES.DEPENDENCY,
        ruleFired: RISK_TYPES.DEPENDENCY,
        dependencySignal: true,
        dependencyEvidence: 'dependency label or link on issue',
        evidence: 'dependency label or blocked-by link detected',
        owner: String(story?.assignee || '').trim(),
        status: String(story?.status || '').trim(),
        ageHours: 0,
        escalation: 'act-today',
        issueUrl: String(story?.issueUrl || '').trim(),
        updated: story?.updated || null,
        recommendedAction: '',
        decisionNeededFrom: '',
      });
    }
  }
  return Array.from(byKey.values());
}

/**
 * Build the per-portfolio deterministic risk list from board payloads.
 * Returns ranked, deduped risks with issue keys and evidence.
 */
function buildRisks(boardPayloads) {
  const byKey = new Map();
  for (const entry of boardPayloads) {
    const payload = entry?.payload;
    if (!payload) continue;
    const boardName = payload?.board?.name || entry?.board?.name || '';
    const rows = buildMergedWorkRiskRows(payload);
    for (const row of rows) {
      const issueKey = String(row?.issueKey || row?.key || '').trim().toUpperCase();
      if (!issueKey || issueKey === '-') continue;
      // Never flag completed work, and drop rows with no recognised risk signal
      // (e.g. a missing-reporter-only row on an owned, progressing item).
      if (statusIsDone(row?.status)) continue;
      if (!Array.isArray(row?.riskTags) || row.riskTags.length === 0) continue;
      const riskType = classifyRiskType(row);
      const ageHours = asNum(row?.hoursInStatus, 0);
      const candidate = {
        issueKey,
        squad: boardName,
        summary: String(row?.summary || '').slice(0, 160),
        riskType,
        ruleFired: riskType,
        evidence: buildEvidence(row, riskType),
        owner: String(row?.owner || row?.assignee || '').replace(/^-$/, '').trim(),
        status: String(row?.status || '').trim(),
        ageHours: Math.round(ageHours),
        escalation: escalationLevel(ageHours),
        issueUrl: String(row?.issueUrl || '').trim(),
        updated: row?.updated || null,
        recommendedAction: '',
        decisionNeededFrom: '',
      };
      const existing = byKey.get(issueKey);
      if (!existing || candidate.ageHours > existing.ageHours) byKey.set(issueKey, candidate);
    }
  }
  for (const dep of scanDependencyRisks(boardPayloads)) {
    if (!byKey.has(dep.issueKey)) byKey.set(dep.issueKey, dep);
  }

  // Rank: escalate first, then by age.
  const order = { escalate: 0, 'act-today': 1, watch: 2 };
  return Array.from(byKey.values()).sort((a, b) => {
    const e = (order[a.escalation] ?? 3) - (order[b.escalation] ?? 3);
    if (e !== 0) return e;
    return b.ageHours - a.ageHours;
  });
}

/**
 * Board-level governance risks that have no single issue key - most importantly a
 * squad with no active sprint (invisible risk). Surfaced prominently so it is
 * never hidden behind issue-level noise.
 */
function buildPortfolioRisks(boardPayloads) {
  const out = [];
  for (const entry of boardPayloads) {
    const payload = entry?.payload;
    if (!payload) continue;
    const squad = payload?.board?.name || entry?.board?.name || '';
    const state = String(payload?.sprint?.state || '').toLowerCase();
    const activeCount = Number(payload?.meta?.activeSprintCount || 0);
    const noActive = activeCount === 0 && state !== 'active';
    if (noActive) {
      const next = payload?.nextSprint || {};
      const overdue = next?.startDate ? new Date(next.startDate).getTime() < Date.now() : false;
      out.push({
        issueKey: '',
        squad,
        riskType: RISK_TYPES.NO_ACTIVE_SPRINT,
        riskLabel: riskTypeLabel(RISK_TYPES.NO_ACTIVE_SPRINT),
        ruleFired: RISK_TYPES.NO_ACTIVE_SPRINT,
        evidence: next?.name
          ? `no active sprint; next sprint "${next.name}"${overdue ? ' is overdue to start' : ' not started'}`
          : 'no active sprint and no planned next sprint',
        owner: '',
        decisionNeededFrom: '',
        recommendedAction: '',
        escalation: overdue ? 'escalate' : 'act-today',
      });
    }
  }
  return out;
}

/** Story-point or field-mapping gaps limit predictability — surface as governance risks, not silent zeros. */
function buildDataConfidenceRisks(boardPayloads) {
  const out = [];
  for (const entry of boardPayloads) {
    const payload = entry?.payload;
    if (!payload) continue;
    const squad = payload?.board?.name || entry?.board?.name || '';
    const summary = payload?.summary || {};
    const spWarning = summary.storyPointsFieldWarning === true;
    const totalSP = Number(summary.totalSP || 0);
    if (!spWarning && totalSP > 0) continue;
    const evidence = spWarning
      ? 'multiple story-point fields detected; only primary field used'
      : 'no story points in current sprint scope';
    out.push({
      issueKey: '',
      squad,
      riskType: RISK_TYPES.DATA_CONFIDENCE_GAP,
      riskLabel: riskTypeLabel(RISK_TYPES.DATA_CONFIDENCE_GAP),
      ruleFired: RISK_TYPES.DATA_CONFIDENCE_GAP,
      evidence,
      owner: '',
      decisionNeededFrom: '',
      recommendedAction: '',
      escalation: 'act-today',
    });
  }
  return out;
}

/** Zero completed delivery in scope — decision trigger, not a quiet zero in a table. */
function buildInsufficientDeliveryRisks(boardPayloads, period = {}) {
  const out = [];
  for (const entry of boardPayloads) {
    const payload = entry?.payload;
    if (!payload) continue;
    const squad = payload?.board?.name || entry?.board?.name || '';
    const stories = Array.isArray(payload.stories) ? payload.stories : [];
    const done = stories.filter((s) => statusIsDone(s?.status)).length;
    if (done > 0 || stories.length === 0) continue;
    const quarter = period?.vodacomQuarter ? ` (${period.vodacomQuarter})` : '';
    out.push({
      issueKey: '',
      squad,
      riskType: RISK_TYPES.INSUFFICIENT_DELIVERY,
      riskLabel: riskTypeLabel(RISK_TYPES.INSUFFICIENT_DELIVERY),
      ruleFired: RISK_TYPES.INSUFFICIENT_DELIVERY,
      evidence: `0 done stories of ${stories.length} committed in scope${quarter}`,
      owner: '',
      decisionNeededFrom: '',
      recommendedAction: '',
      escalation: 'escalate',
    });
  }
  return out;
}

/** Aggregate delivery-truth counts across boards, keeping issue keys per metric. */
export function buildDeliveryTruth(boardPayloads) {
  let committed = 0;
  let done = 0;
  let inProgress = 0;
  let notStarted = 0;
  let blocked = 0;
  let staleInProgress = 0;
  let lateAdded = 0;
  const keys = { done: [], inProgress: [], notStarted: [], blocked: [], staleInProgress: [], lateAdded: [] };

  for (const entry of boardPayloads) {
    const payload = entry?.payload;
    if (!payload) continue;
    const stories = Array.isArray(payload.stories) ? payload.stories : [];
    committed += stories.length;
    for (const s of stories) {
      const key = String(s?.issueKey || s?.key || '').trim().toUpperCase();
      if (statusIsDone(s?.status)) { done += 1; if (key) keys.done.push(key); }
      else if (statusIsNotStarted(s?.status)) { notStarted += 1; if (key) keys.notStarted.push(key); }
      else { inProgress += 1; if (key) keys.inProgress.push(key); }
    }
    blocked += getUnifiedBlockerCount(payload);
    const stuck = Array.isArray(payload.stuckCandidates) ? payload.stuckCandidates : [];
    staleInProgress += stuck.length;
    for (const r of stuck) { const k = String(r?.issueKey || r?.key || '').trim().toUpperCase(); if (k) keys.staleInProgress.push(k); }
    const scope = Array.isArray(payload.scopeChanges) ? payload.scopeChanges : [];
    lateAdded += scope.length;
    for (const r of scope) { const k = String(r?.issueKey || r?.key || '').trim().toUpperCase(); if (k) keys.lateAdded.push(k); }
  }

  return {
    counts: {
      committed,
      done,
      inProgress,
      notStarted,
      blocked,
      staleInProgress,
      lateAdded,
      removed: null,    // requires changelog; never invented
      carryover: null,  // requires PI baseline; never invented
    },
    keys,
  };
}

function buildBriefId(projects, quarterLabel, generatedAt) {
  const portfolio = (projects || []).join('-').toUpperCase() || 'PORTFOLIO';
  const q = String(quarterLabel || '').replace(/\s+/g, '').toUpperCase() || 'NA';
  const week = isoWeekLabel(generatedAt);
  return `${portfolio}-${q}-${week}`;
}

function isoWeekLabel(iso) {
  const d = iso ? new Date(iso) : new Date();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Build the full Brief Fact Contract.
 * @param {object} args
 * @param {string[]} args.projects portfolio project keys (e.g. ['MPSA','MAS'])
 * @param {Array<{ board: object, payload: object }>} args.boardPayloads per-board sprint payloads
 * @param {object} args.period { vodacomQuarter, sprintNames }
 * @param {object} args.freshnessMeta { stale, partial, fromCache, fromSnapshot, jiraFetchedAt, cacheAgeMinutes }
 * @param {string} [args.generatedAt] ISO timestamp
 * @returns {object} the evidence-bound contract (leadershipNarrative is an empty shell for the narrator)
 */
export function buildBriefFactContract({ projects = [], boardPayloads = [], period = {}, freshnessMeta = {}, generatedAt } = {}) {
  const ts = generatedAt || new Date().toISOString();
  const freshness = deriveFreshnessState(freshnessMeta);
  const deliveryTruth = buildDeliveryTruth(boardPayloads);
  const risks = buildRisks(boardPayloads);
  const portfolioRisks = [
    ...buildPortfolioRisks(boardPayloads),
    ...buildDataConfidenceRisks(boardPayloads),
    ...buildInsufficientDeliveryRisks(boardPayloads, period),
  ];

  const completionPct = deliveryTruth.counts.committed > 0
    ? Math.round((deliveryTruth.counts.done / deliveryTruth.counts.committed) * 100)
    : 0;
  const proposedConfidence = deriveDeliveryConfidence({
    completionPct,
    blocked: deliveryTruth.counts.blocked,
    staleInProgress: deliveryTruth.counts.staleInProgress,
    lateAdded: deliveryTruth.counts.lateAdded,
  });
  const confidence = clampConfidenceToFreshness(proposedConfidence, freshness);

  return {
    briefId: buildBriefId(projects, period.vodacomQuarter, ts),
    generatedAt: ts,
    freshness: {
      jiraFetchedAt: freshnessMeta.jiraFetchedAt || ts,
      cacheAgeMinutes: asNum(freshnessMeta.cacheAgeMinutes, 0),
      confidenceLimit: freshness,
    },
    portfolio: (projects || []).join(' + '),
    projects: [...projects],
    period: {
      vodacomQuarter: period.vodacomQuarter || null,
      sprintNames: Array.isArray(period.sprintNames) ? period.sprintNames : [],
    },
    deliveryTruth: deliveryTruth.counts,
    deliveryTruthKeys: deliveryTruth.keys,
    completionPct,
    risks: risks.slice(0, Math.max(GOVERNANCE_THRESHOLDS.riskBriefTopN, 5) * 4),
    topRisks: risks.slice(0, GOVERNANCE_THRESHOLDS.riskBriefTopN),
    portfolioRisks,
    leadershipNarrative: {
      confidence,
      headline: '',
      oneParagraph: '',
      decisionsNeeded: [],
    },
  };
}
