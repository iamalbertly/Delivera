/**
 * SSOT: Cross-squad portfolio judgment ranking.
 */
import {
  ATTENTION_STATES,
  formatAlignedCount,
  mapVerdictToAttention,
  attentionStateLabel,
} from './Delivera-Governance-GovernanceState-01SSOT.js';
import { summarizeCommitmentRows, buildCommitmentRealityRows } from './Delivera-Governance-CommitmentReality-01SSOT.js';
import { classifyPortfolioGap } from './Delivera-Governance-PortfolioExposure-01SSOT.js';
import { deliveryPct, offPlanPct, proofConfidencePct, squadDisplayName } from './Delivera-Governance-PortfolioDecision-01SSOT.js';

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const ATTENTION_WEIGHT = Object.freeze({
  [ATTENTION_STATES.OFF_PLAN]: 100,
  [ATTENTION_STATES.DECISION_REQUIRED]: 90,
  [ATTENTION_STATES.PROOF_REQUIRED]: 70,
  [ATTENTION_STATES.CANNOT_VERIFY]: 40,
  [ATTENTION_STATES.NO_ACTION]: 10,
  [ATTENTION_STATES.COMPLETE]: 5,
});

function squadMeaning({ attentionState, unsupportedCount = 0, aligned = '', openCases = 0, baselineMissing = false, boardResolved = true, linkedCount = 0, totalCount = 0 } = {}) {
  if (baselineMissing && totalCount === 0) return 'Upload PI baseline slide for this quarter';
  if (attentionState === ATTENTION_STATES.CANNOT_VERIFY && boardResolved === false) return 'Board not mapped to Jira';
  if (attentionState === ATTENTION_STATES.CANNOT_VERIFY) return 'Upload baseline to compare commitments';
  if (attentionState === ATTENTION_STATES.COMPLETE) return 'All promises accepted';
  if (attentionState === ATTENTION_STATES.NO_ACTION) return 'Commitments remain aligned';
  if (unsupportedCount > 0) return `${linkedCount} linked · ${unsupportedCount} need attention`;
  if (openCases > 0) return `${openCases} decision${openCases === 1 ? '' : 's'} open`;
  if (attentionState === ATTENTION_STATES.PROOF_REQUIRED) return 'Acceptance proof incomplete';
  return aligned || 'Needs attention';
}

export function rankPortfolioSquads({
  insights = [],
  cases = [],
  brief = {},
  baselineMissing = false,
  anchorKey = '',
} = {}) {
  const squads = [];

  for (const insight of insights) {
    const projectKey = String(insight.projectKey || '').toUpperCase();
    if (!projectKey) continue;
    const squadCases = cases.filter((c) => c.project === projectKey);
    const rows = buildCommitmentRealityRows({
      brief: projectKey === String(anchorKey).toUpperCase()
        ? brief
        : { ...brief, baselineComparison: brief.baselineComparison },
      anchorKey: projectKey,
      cases: squadCases,
      baselineMissing,
    });
    const summary = summarizeCommitmentRows(rows);
    const gap = classifyPortfolioGap({
      anchor: insight,
      peers: [],
      cases: squadCases,
      brief,
      baselineMissing,
    });
    const attentionState = mapVerdictToAttention({
      verdictTier: insight.verdictTier,
      gapPrimary: gap.primary,
      baselineMissing: baselineMissing && asNum(insight.piCommitted) === 0,
      boardResolved: insight.boardResolved !== false,
      unsupportedCount: summary.unsupported,
      openCases: squadCases.length,
    });
    const piCommitted = asNum(insight.piCommitted, summary.total);
    const piDone = asNum(insight.piDone, summary.verified);
    const linked = summary.linked || piDone;
    const total = piCommitted || summary.total;

    squads.push({
      projectKey,
      squadName: squadDisplayName(insight),
      attentionState,
      attentionLabel: attentionStateLabel(attentionState),
      meaning: squadMeaning({
        attentionState,
        unsupportedCount: summary.unsupported,
        aligned: formatAlignedCount({ linked, total }),
        openCases: squadCases.length,
        baselineMissing: baselineMissing && asNum(insight.piCommitted) === 0,
        boardResolved: insight.boardResolved !== false,
        linkedCount: linked,
        totalCount: total,
      }),
      weight: ATTENTION_WEIGHT[attentionState] || 10,
      unsupportedCount: summary.unsupported,
      linkedCount: linked,
      totalCount: total,
      offPlanHours: asNum(insight.offPlanHours, 0),
      deliveryPct: deliveryPct(insight),
      boardResolved: insight.boardResolved !== false,
      selected: projectKey === String(anchorKey).toUpperCase(),
    });
  }

  squads.sort((a, b) => b.weight - a.weight || b.unsupportedCount - a.unsupportedCount);

  const atRisk = squads.filter((s) => s.weight >= ATTENTION_WEIGHT[ATTENTION_STATES.PROOF_REQUIRED]);
  const safe = squads.filter((s) => s.weight < ATTENTION_WEIGHT[ATTENTION_STATES.PROOF_REQUIRED]);

  return {
    squads,
    leadingSquad: squads[0] || null,
    atRisk,
    safe,
    safeSquadsLine: collapsedSafeSquadsLine(safe),
    offPlanCount: atRisk.filter((s) =>
      s.attentionState === ATTENTION_STATES.OFF_PLAN
      || s.attentionState === ATTENTION_STATES.DECISION_REQUIRED,
    ).length,
  };
}

export function collapsedSafeSquadsLine(safe = []) {
  const aligned = safe.filter((s) => s.attentionState === ATTENTION_STATES.NO_ACTION || s.attentionState === ATTENTION_STATES.COMPLETE);
  if (!aligned.length) return '';
  const names = aligned.map((s) => `${s.squadName} ${s.attentionState === ATTENTION_STATES.COMPLETE ? 'delivered' : 'aligned'}`);
  return `${aligned.length} squad${aligned.length === 1 ? '' : 's'} require no action: ${names.join(' · ')}`;
}
