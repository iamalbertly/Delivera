/**
 * SSOT: Cross-squad portfolio judgment ranking.
 */
import {
  ATTENTION_STATES,
  DATA_TRUST,
  formatAlignedCount,
  mapVerdictToAttention,
  attentionStateLabel,
  resolveDataTrust,
  dataTrustLabel,
  attentionStateHint,
} from './Delivera-Governance-GovernanceState-01SSOT.js';
import { summarizeCommitmentRows, buildCommitmentRealityRows } from './Delivera-Governance-CommitmentReality-01SSOT.js';
import { classifyPortfolioGap } from './Delivera-Governance-PortfolioExposure-01SSOT.js';
import {
  deliveryPct,
  squadDisplayName,
  resolveBaselineReadinessByProject,
  isBaselineMissingForProject,
} from './Delivera-Governance-PortfolioDecision-01SSOT.js';

import { PORTFOLIO_ALL } from './Delivera-Governance-Portfolio-Scope-Rank-01SSOT.js';
import { isDeliverySquad, operationalEntityKeys } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const ATTENTION_WEIGHT = Object.freeze({
  [ATTENTION_STATES.OFF_PLAN]: 100,
  [ATTENTION_STATES.DECISION_REQUIRED]: 90,
  [ATTENTION_STATES.PROOF_REQUIRED]: 70,
  [ATTENTION_STATES.CANNOT_VERIFY]: 40,
  [ATTENTION_STATES.NO_ACTION]: 10,
  [ATTENTION_STATES.COMPLETE]: 5,
});

/** Squads at or above this weight enter the attention set (includes missing baseline). */
export const ATTENTION_FLOOR = ATTENTION_WEIGHT[ATTENTION_STATES.CANNOT_VERIFY];

function squadMeaning({
  attentionState,
  unsupportedCount = 0,
  notPlannedCount = 0,
  aligned = '',
  openCases = 0,
  baselineMissing = false,
  boardResolved = true,
  linkedCount = 0,
  totalCount = 0,
  dataTrust = '',
} = {}) {
  if (!boardResolved) return 'Board not mapped to Jira';
  if (baselineMissing || dataTrust === DATA_TRUST.BOARD_HEALTH_ONLY) {
    return 'Cannot assess quarter delivery: PI commitments are not uploaded';
  }
  if (attentionState === ATTENTION_STATES.CANNOT_VERIFY) return 'Upload PI baseline slide for this quarter';
  if (attentionState === ATTENTION_STATES.COMPLETE) return 'All promises accepted';
  if (attentionState === ATTENTION_STATES.NO_ACTION) return 'Commitments remain aligned';
  if (unsupportedCount > 0) {
    if (notPlannedCount > 0 && notPlannedCount >= unsupportedCount) {
      return `${notPlannedCount} of ${Math.max(totalCount, notPlannedCount)} commitments have no supporting Jira stories`;
    }
    return `${unsupportedCount} of ${Math.max(totalCount, unsupportedCount)} commitments cannot be verified as delivery-ready`;
  }
  if (openCases > 0) return `${openCases} decision${openCases === 1 ? '' : 's'} open`;
  if (attentionState === ATTENTION_STATES.PROOF_REQUIRED) return 'Acceptance proof incomplete';
  return aligned || 'Needs review';
}

export function rankPortfolioSquads({
  insights = [],
  cases = [],
  brief = {},
  baselineMissing = false,
  baselineMode = 'pi-baseline',
  anchorKey = '',
} = {}) {
  const squads = [];
  const projectKeys = insights.map((i) => String(i.projectKey || '').toUpperCase()).filter(Boolean);
  const readiness = resolveBaselineReadinessByProject(brief, projectKeys, baselineMode);

  for (const insight of insights) {
    const projectKey = String(insight.projectKey || '').toUpperCase();
    if (!projectKey || projectKey === PORTFOLIO_ALL || !isDeliverySquad(projectKey)) continue;
    const squadMissing = readiness[projectKey]
      ? Boolean(readiness[projectKey].missing)
      : (baselineMissing || isBaselineMissingForProject(brief, projectKey, baselineMode));
    const squadCases = cases.filter((c) => c.project === projectKey);
    const comparison = brief.baselineComparisonByProject?.[projectKey]
      || (projectKey === String(anchorKey).toUpperCase() ? brief.baselineComparison : null);
    const rows = buildCommitmentRealityRows({
      brief: { ...brief, baselineComparison: comparison || null },
      anchorKey: projectKey,
      cases: squadCases,
      baselineMissing: squadMissing,
    });
    const summary = summarizeCommitmentRows(rows);
    const gap = classifyPortfolioGap({
      anchor: insight,
      peers: [],
      cases: squadCases,
      brief,
      baselineMissing: squadMissing,
    });
    const boardResolved = insight.boardResolved !== false;
    const attentionState = mapVerdictToAttention({
      verdictTier: insight.verdictTier,
      gapPrimary: gap.primary,
      baselineMissing: squadMissing,
      boardResolved,
      unsupportedCount: summary.unsupported,
      openCases: squadCases.length,
    });
    const dataTrust = resolveDataTrust({ baselineMissing: squadMissing, boardResolved });
    const piCommitted = squadMissing ? 0 : asNum(insight.piCommitted, summary.total);
    const piDone = squadMissing ? 0 : asNum(insight.piDone, summary.verified);
    const linked = squadMissing ? 0 : (summary.linked || piDone);
    const total = squadMissing ? 0 : (piCommitted || summary.total);

    squads.push({
      projectKey,
      squadName: squadDisplayName(insight),
      attentionState,
      attentionLabel: attentionStateLabel(attentionState),
      attentionHint: attentionStateHint(attentionState),
      dataTrust,
      dataTrustLabel: dataTrustLabel(dataTrust),
      meaning: squadMeaning({
        attentionState,
        unsupportedCount: summary.unsupported,
        notPlannedCount: summary.notPlannedActive || summary.notPlanned || 0,
        aligned: formatAlignedCount({ linked, total }),
        openCases: squadCases.length,
        baselineMissing: squadMissing,
        boardResolved,
        linkedCount: linked,
        totalCount: total,
        dataTrust,
      }),
      weight: ATTENTION_WEIGHT[attentionState] || 10,
      unsupportedCount: summary.unsupported,
      notPlannedCount: summary.notPlannedActive || summary.notPlanned || 0,
      linkedCount: linked,
      totalCount: total,
      offPlanHours: asNum(insight.offPlanHours, 0),
      deliveryPct: deliveryPct(insight),
      boardResolved,
      baselineMissing: squadMissing,
      selected: projectKey === String(anchorKey).toUpperCase(),
      piName: readiness[projectKey]?.piName || '',
    });
  }

  squads.sort((a, b) => {
    const aGapRate = a.totalCount > 0 ? a.unsupportedCount / a.totalCount : 0;
    const bGapRate = b.totalCount > 0 ? b.unsupportedCount / b.totalCount : 0;
    return b.weight - a.weight
      || bGapRate - aGapRate
      || b.notPlannedCount - a.notPlannedCount
      || b.offPlanHours - a.offPlanHours
      || a.deliveryPct - b.deliveryPct
      || a.projectKey.localeCompare(b.projectKey);
  });
  squads.forEach((squad, index) => {
    squad.rank = index + 1;
    squad.rankReason = squad.baselineMissing
      ? 'Ranked by missing quarter evidence; delivery risk is not inferred'
      : squad.unsupportedCount > 0
        ? `${squad.unsupportedCount} of ${Math.max(squad.totalCount, squad.unsupportedCount)} commitments lack delivery-ready evidence`
        : squad.attentionHint || squad.meaning;
  });

  const atRisk = squads.filter((s) => s.weight >= ATTENTION_FLOOR);
  const safe = squads.filter((s) => s.weight < ATTENTION_FLOOR);

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
    operationalEntities: operationalEntityKeys(),
  };
}

export function collapsedSafeSquadsLine(safe = []) {
  const aligned = safe.filter((s) => s.attentionState === ATTENTION_STATES.NO_ACTION || s.attentionState === ATTENTION_STATES.COMPLETE);
  if (!aligned.length) return '';
  const names = aligned.map((s) => `${s.squadName} ${s.attentionState === ATTENTION_STATES.COMPLETE ? 'delivered' : 'aligned'}`);
  return `${aligned.length} squad${aligned.length === 1 ? '' : 's'} require no action: ${names.join(' · ')}`;
}
