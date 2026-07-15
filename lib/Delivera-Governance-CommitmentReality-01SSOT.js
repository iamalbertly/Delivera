/**

 * SSOT: Baseline-first commitment reality rows.

 */

import { BASELINE_VERDICTS } from './Delivera-Governance-PIBaseline-02Compare.js';

import { GOVERNANCE_STATES } from './Delivera-Governance-GovernanceState-01SSOT.js';

import { scopeDecisionCopy } from './Delivera-Governance-ScopeLanguage-01SSOT.js';

import { classifyCommitmentRelevance, RELEVANCE_TIERS } from './Delivera-Governance-CommitmentRelevance-01SSOT.js';



function asNum(v, fallback = 0) {

  const n = Number(v);

  return Number.isFinite(n) ? n : fallback;

}



function issueProject(key = '') {

  const k = String(key || '').trim().toUpperCase();

  return /^[A-Z][A-Z0-9]+-\d+$/.test(k) ? k.split('-')[0] : '';

}



function legacyBaselineItemsForProject(brief = {}, projectKey = '') {

  const pk = String(projectKey || '').trim().toUpperCase();

  const items = brief?.baselineComparison?.items || [];

  return items.filter((item) => {

    const squad = String(item.squad || '').trim().toUpperCase();

    const issuePk = issueProject(item.issueKey);

    return squad === pk || issuePk === pk;

  });

}



function resolveLifecycleStage(item = {}) {

  const verdict = String(item.verdict || '').toLowerCase();

  if (verdict === BASELINE_VERDICTS.NOT_PLANNED) return 'not-planned';

  if (verdict === BASELINE_VERDICTS.REMOVED) {

    const lifecycle = String(item?.epicActivity?.lifecycle || '').toLowerCase();

    return lifecycle === 'missing' || !item.issueKey ? 'not-in-jira' : 'removed';

  }

  const lifecycle = String(item?.epicActivity?.lifecycle || '').toLowerCase();

  if (lifecycle === 'missing') return 'not-in-jira';

  if (lifecycle === 'jira-only' || lifecycle === 'not-started') return 'not-planned';

  if (verdict === BASELINE_VERDICTS.DELIVERED) return 'delivered';

  if (verdict === BASELINE_VERDICTS.ON_TRACK || verdict === BASELINE_VERDICTS.DELAYED) return 'in-delivery';

  return lifecycle || 'unknown';

}



function mapVerdictToGovernanceState(verdict = '', statusNow = '', hasEvidence = false, issueKey = '') {

  const v = String(verdict || '').toLowerCase();

  const status = String(statusNow || '').toLowerCase();

  const key = String(issueKey || '').trim().toUpperCase();

  if (v === BASELINE_VERDICTS.NOT_PLANNED) {

    return GOVERNANCE_STATES.UNSUPPORTED;

  }

  if (v === BASELINE_VERDICTS.REMOVED || v === BASELINE_VERDICTS.NOT_TRACEABLE) {

    return GOVERNANCE_STATES.UNSUPPORTED;

  }

  if (status.includes('done') && !hasEvidence) {

    return GOVERNANCE_STATES.DONE_UNPROVEN;

  }

  if (v === BASELINE_VERDICTS.DELIVERED && hasEvidence) {

    return GOVERNANCE_STATES.VERIFIED;

  }

  if (v === BASELINE_VERDICTS.ON_TRACK) {

    return key ? GOVERNANCE_STATES.PARTIALLY_SUPPORTED : GOVERNANCE_STATES.UNSUPPORTED;

  }

  if (v === BASELINE_VERDICTS.DELAYED) {

    return GOVERNANCE_STATES.UNSUPPORTED;

  }

  if (v === BASELINE_VERDICTS.ADDED_AFTER_BASELINE) {

    return GOVERNANCE_STATES.PARTIALLY_SUPPORTED;

  }

  return GOVERNANCE_STATES.UNSUPPORTED;

}



function realityLabel(state = '', {

  hasJiraMatch = false,

  issueKey = '',

  lifecycleStage = '',

  verdict = '',

} = {}) {

  if (lifecycleStage === 'not-planned' || verdict === BASELINE_VERDICTS.NOT_PLANNED) {

    return 'Committed · not planned yet';

  }

  if (lifecycleStage === 'not-in-jira') {

    return 'On PI slide · not in Jira yet';

  }

  if (lifecycleStage === 'removed' || verdict === BASELINE_VERDICTS.REMOVED) {

    return 'Removed from quarter plan';

  }

  const linked = Boolean(issueKey || hasJiraMatch);

  switch (state) {

    case GOVERNANCE_STATES.VERIFIED: return 'Delivered';

    case GOVERNANCE_STATES.PARTIALLY_SUPPORTED:

      return linked ? 'Linked · in progress' : 'At risk';

    case GOVERNANCE_STATES.DONE_UNPROVEN: return 'Done · unproven';

    case GOVERNANCE_STATES.EXTRACTION_UNCERTAIN: return 'Likely match · confirm';

    case GOVERNANCE_STATES.CANNOT_VERIFY: return 'Upload baseline to verify';

    default:

      return linked ? 'Linked · needs owner' : 'Not linked yet';

  }

}



function resolveHasJiraMatch(item = {}) {

  const issueKey = String(item.issueKey || '').trim().toUpperCase();

  const verdict = String(item.verdict || '').toLowerCase();

  const lifecycleStage = resolveLifecycleStage(item);

  if (!issueKey) return false;

  if (verdict === BASELINE_VERDICTS.NOT_PLANNED || lifecycleStage === 'not-planned') return true;

  if (verdict === BASELINE_VERDICTS.REMOVED && lifecycleStage === 'not-in-jira') return false;

  if (verdict === BASELINE_VERDICTS.REMOVED) return false;

  return true;

}



function rowFromBaselineItem(item = {}, { evidencePack = {}, brief = {}, anchorKey = '' } = {}) {

  const issueKey = String(item.issueKey || '').trim().toUpperCase();

  const evidenceRow = (evidencePack.rows || []).find((r) => String(r.issueKey).toUpperCase() === issueKey);

  const hasEvidence = Boolean(evidenceRow);

  const matchScore = asNum(item.matchScore, item.confidence != null ? item.confidence * 100 : null);

  let governanceState = mapVerdictToGovernanceState(item.verdict, item.statusNow, hasEvidence, issueKey);

  if (matchScore > 0 && matchScore < 55) governanceState = GOVERNANCE_STATES.EXTRACTION_UNCERTAIN;



  const lateKeys = new Set((brief?.deliveryTruthKeys?.lateAdded || []).map((k) => String(k).toUpperCase()));

  const scopeAfterPlanning = lateKeys.has(issueKey);

  const lifecycleStage = resolveLifecycleStage(item);

  const hasJiraMatch = resolveHasJiraMatch(item);



  return {

    id: issueKey || item.title,

    issueKey,

    title: item.title || issueKey,

    projectKey: item.squad || issueProject(issueKey) || anchorKey,

    baselinePromise: item.title || item.sourceBullet || 'PI commitment',

    sourceBullet: item.sourceBullet || '',

    matchScore,

    matchMethod: item.matchMethod || '',

    verdict: item.verdict || '',

    statusNow: item.statusNow || '',

    epicActivity: item.epicActivity || null,

    created: item.created || '',

    updated: item.updated || '',

    lifecycleStage,

    governanceState,

    reality: realityLabel(governanceState, {

      hasJiraMatch,

      issueKey,

      lifecycleStage,

      verdict: item.verdict,

    }),

    owner: item.owner || evidenceRow?.owner || '',

    scopeAfterPlanning,

    hasJiraMatch,

    nextDecision: scopeDecisionCopy({

      commitment: { governanceState, verdict: item.verdict, scopeAfterPlanning, lifecycleStage },

      brief,

      matchScore,

      hasJiraMatch,

      owner: item.owner,

      verdict: item.verdict,

    }),

    confirmedBy: item.confirmedBy || '',

    confirmedAt: item.confirmedAt || '',

  };

}



function rowsFromRisks(brief = {}, anchorKey = '', cases = []) {

  const rows = [];

  const seen = new Set();

  const risks = [

    ...(brief.topRisks || []),

    ...(brief.leadershipNarrative?.decisionsNeeded || []),

  ].filter((r) => {

    const pk = String(r.projectKey || r.project || issueProject(r.issueKey)).toUpperCase();

    return !anchorKey || pk === anchorKey;

  });



  for (const risk of risks) {

    const key = String(risk.issueKey || risk.summary || '').slice(0, 120);

    if (!key || seen.has(key)) continue;

    seen.add(key);

    const issueKey = String(risk.issueKey || '').toUpperCase();

    const lateKeys = new Set((brief?.deliveryTruthKeys?.lateAdded || []).map((k) => String(k).toUpperCase()));

    rows.push({

      id: key,

      issueKey,

      title: risk.displayTitle || risk.summary || key,

      projectKey: anchorKey,

      baselinePromise: risk.displayTitle || risk.summary || key,

      governanceState: GOVERNANCE_STATES.UNSUPPORTED,

      reality: 'At risk',

      scopeAfterPlanning: lateKeys.has(issueKey),

      hasJiraMatch: Boolean(issueKey),

      nextDecision: scopeDecisionCopy({ risk, brief }),

      owner: risk.assigneeName || risk.decisionNeededFrom || '',

    });

  }



  for (const c of cases.filter((x) => x.project === anchorKey)) {

    const key = String(c.id || c.title || '');

    if (!key || seen.has(key)) continue;

    seen.add(key);

    rows.push({

      id: c.id || key,

      issueKey: (c.issueKeys || [])[0] || '',

      title: c.title || key,

      projectKey: anchorKey,

      baselinePromise: c.title || key,

      governanceState: GOVERNANCE_STATES.UNSUPPORTED,

      reality: 'Decision required',

      nextDecision: c.primaryAction?.action || 'Record governance decision',

      owner: c.primaryAction?.owner || c.decisionOwner?.name || '',

    });

  }



  return rows;

}



export function buildCommitmentRealityRows({

  brief = {},

  anchorKey = '',

  cases = [],

  baselineMissing = false,

} = {}) {

  const evidencePack = brief.evidencePack || {};

  const AK = String(anchorKey || '').toUpperCase();

  const baselineCompare = brief.baselineComparisonByProject?.[AK]

    || (legacyBaselineItemsForProject(brief, AK).length

      ? { ...brief.baselineComparison, items: legacyBaselineItemsForProject(brief, AK) }

      : null)

    || null;



  if (baselineMissing) return [];



  if (baselineCompare?.items?.length) {

    const items = baselineCompare.items.filter((item) => {

      if (!AK) return true;

      const squad = String(item.squad || issueProject(item.issueKey)).toUpperCase();

      // Require an identifiable same-project squad — never attribute unsquadded foreign noise.

      if (!squad) return false;

      return squad === AK;

    });

    return items

      .map((item) => rowFromBaselineItem(item, { evidencePack, brief, anchorKey: AK }))

      .sort((a, b) => {

        const priority = (s) => (s === GOVERNANCE_STATES.UNSUPPORTED ? 0 : s === GOVERNANCE_STATES.DONE_UNPROVEN ? 1 : 2);

        return priority(a.governanceState) - priority(b.governanceState);

      });

  }



  return [];

}



export function summarizeCommitmentRows(rows = []) {

  const total = rows.length;

  const linked = rows.filter((r) =>

    r.issueKey

    && r.governanceState !== GOVERNANCE_STATES.UNSUPPORTED

    && r.governanceState !== GOVERNANCE_STATES.EXTRACTION_UNCERTAIN,

  ).length;

  const notPlanned = rows.filter((r) =>

    r.lifecycleStage === 'not-planned' || r.verdict === BASELINE_VERDICTS.NOT_PLANNED,

  ).length;

  // Relevance-aware count: exclude stale candidates from the active gap count

  // so dormant epics (created long ago, never touched) don't inflate a

  // squad's position in the board-gap list. (Audit 2026-07-15: epics created

  // so long ago should lower their relevance / effect on the gap-list.)

  const notPlannedActive = rows.filter((r) =>

    (r.lifecycleStage === 'not-planned' || r.verdict === BASELINE_VERDICTS.NOT_PLANNED)

    && classifyCommitmentRelevance(r).tier !== RELEVANCE_TIERS.STALE_CANDIDATE,

  ).length;

  const unsupported = rows.filter((r) =>

    r.governanceState === GOVERNANCE_STATES.UNSUPPORTED

    || r.governanceState === GOVERNANCE_STATES.DONE_UNPROVEN

    || r.governanceState === GOVERNANCE_STATES.EXTRACTION_UNCERTAIN,

  ).length;

  const verified = rows.filter((r) => r.governanceState === GOVERNANCE_STATES.VERIFIED).length;

  return { total, linked, unsupported, verified, notPlanned, notPlannedActive };

}



export function filterRowsForDetail(rows = []) {

  return rows.filter((r) => {

    if (r.lifecycleStage === 'not-planned' || r.verdict === BASELINE_VERDICTS.NOT_PLANNED) return true;

    if (r.lifecycleStage === 'not-in-jira') return true;

    if (r.governanceState === GOVERNANCE_STATES.VERIFIED) return false;

    if (r.governanceState === GOVERNANCE_STATES.PARTIALLY_SUPPORTED) return false;

    const title = String(r.title || r.baselinePromise || '');

    const isPiEpic = /FY\d{2}\s*Q\d/i.test(title) || Boolean(r.verdict) || Boolean(r.sourceBullet);

    return isPiEpic || r.governanceState === GOVERNANCE_STATES.EXTRACTION_UNCERTAIN;

  });

}


