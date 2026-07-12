/**
 * SSOT: Baseline-first commitment reality rows.
 */
import { BASELINE_VERDICTS } from './Delivera-Governance-PIBaseline-02Compare.js';
import { GOVERNANCE_STATES } from './Delivera-Governance-GovernanceState-01SSOT.js';
import { scopeDecisionCopy } from './Delivera-Governance-ScopeLanguage-01SSOT.js';

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function issueProject(key = '') {
  const k = String(key || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9]+-\d+$/.test(k) ? k.split('-')[0] : '';
}

function mapVerdictToGovernanceState(verdict = '', statusNow = '', hasEvidence = false) {
  const v = String(verdict || '').toLowerCase();
  const status = String(statusNow || '').toLowerCase();
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
    return hasEvidence ? GOVERNANCE_STATES.PARTIALLY_SUPPORTED : GOVERNANCE_STATES.UNSUPPORTED;
  }
  if (v === BASELINE_VERDICTS.DELAYED) {
    return GOVERNANCE_STATES.UNSUPPORTED;
  }
  if (v === BASELINE_VERDICTS.ADDED_AFTER_BASELINE) {
    return GOVERNANCE_STATES.PARTIALLY_SUPPORTED;
  }
  return GOVERNANCE_STATES.UNSUPPORTED;
}

function realityLabel(state = '') {
  switch (state) {
    case GOVERNANCE_STATES.VERIFIED: return 'Delivered';
    case GOVERNANCE_STATES.PARTIALLY_SUPPORTED: return 'At risk';
    case GOVERNANCE_STATES.DONE_UNPROVEN: return 'Done · unproven';
    case GOVERNANCE_STATES.EXTRACTION_UNCERTAIN: return 'Possible commitment';
    default: return 'Unsupported';
  }
}

function rowFromBaselineItem(item = {}, { evidencePack = {}, brief = {}, anchorKey = '' } = {}) {
  const issueKey = String(item.issueKey || '').trim().toUpperCase();
  const evidenceRow = (evidencePack.rows || []).find((r) => String(r.issueKey).toUpperCase() === issueKey);
  const hasEvidence = Boolean(evidenceRow);
  const matchScore = asNum(item.matchScore, item.confidence != null ? item.confidence * 100 : null);
  let governanceState = mapVerdictToGovernanceState(item.verdict, item.statusNow, hasEvidence);
  if (matchScore > 0 && matchScore < 55) governanceState = GOVERNANCE_STATES.EXTRACTION_UNCERTAIN;

  const lateKeys = new Set((brief?.deliveryTruthKeys?.lateAdded || []).map((k) => String(k).toUpperCase()));
  const scopeAfterPlanning = lateKeys.has(issueKey);

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
    governanceState,
    reality: realityLabel(governanceState),
    owner: item.owner || evidenceRow?.owner || '',
    scopeAfterPlanning,
    hasJiraMatch: issueKey && item.verdict !== BASELINE_VERDICTS.REMOVED,
    nextDecision: scopeDecisionCopy({
      commitment: { governanceState, verdict: item.verdict, scopeAfterPlanning },
      brief,
      matchScore,
      hasJiraMatch: issueKey && item.verdict !== BASELINE_VERDICTS.REMOVED,
      owner: item.owner,
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
  const baselineCompare = brief.baselineComparison || null;
  const AK = String(anchorKey || '').toUpperCase();

  if (baselineCompare?.items?.length) {
    const items = baselineCompare.items.filter((item) => {
      if (!AK) return true;
      const squad = String(item.squad || issueProject(item.issueKey)).toUpperCase();
      return !squad || squad === AK;
    });
    return items
      .map((item) => rowFromBaselineItem(item, { evidencePack, brief, anchorKey: AK }))
      .sort((a, b) => {
        const priority = (s) => (s === GOVERNANCE_STATES.UNSUPPORTED ? 0 : s === GOVERNANCE_STATES.DONE_UNPROVEN ? 1 : 2);
        return priority(a.governanceState) - priority(b.governanceState);
      });
  }

  if (baselineMissing) return [];

  return rowsFromRisks(brief, AK, cases);
}

export function summarizeCommitmentRows(rows = []) {
  const total = rows.length;
  const linked = rows.filter((r) => r.hasJiraMatch && r.governanceState !== GOVERNANCE_STATES.UNSUPPORTED).length;
  const unsupported = rows.filter((r) =>
    r.governanceState === GOVERNANCE_STATES.UNSUPPORTED
    || r.governanceState === GOVERNANCE_STATES.DONE_UNPROVEN
    || r.governanceState === GOVERNANCE_STATES.EXTRACTION_UNCERTAIN,
  ).length;
  const verified = rows.filter((r) => r.governanceState === GOVERNANCE_STATES.VERIFIED).length;
  return { total, linked, unsupported, verified };
}

export function filterRowsForDetail(rows = []) {
  return rows.filter((r) =>
    r.governanceState !== GOVERNANCE_STATES.VERIFIED
    && r.governanceState !== GOVERNANCE_STATES.PARTIALLY_SUPPORTED,
  );
}
