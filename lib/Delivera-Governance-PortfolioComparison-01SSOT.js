/**
 * SSOT: Portfolio comparison carousel cards — squad-specific explanations.
 */
import {
  deliveryPct,
  offPlanPct,
  proofConfidencePct,
  squadDisplayName,
  EARLY_WARNING_TIERS,
  PORTFOLIO_RECOMMENDATIONS,
} from './Delivera-Governance-PortfolioDecision-01SSOT.js';
import { buildAffectedCommitments } from './Delivera-Governance-PortfolioExposure-01SSOT.js';
import {
  resolveSquadReadinessStage,
  summarizeReadinessAcrossSquads,
  READINESS_STAGES,
} from './Delivera-Governance-ReadinessGate-01SSOT.js';

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function statusLabel(tier = '', verdictTier = '') {
  if (tier === EARLY_WARNING_TIERS.CRITICAL || verdictTier === 'blocked') return 'At risk';
  if (tier === EARLY_WARNING_TIERS.NEEDS_DECISION || verdictTier === 'watch') return 'Watch';
  if (verdictTier === 'onTrack') return 'Improving';
  return 'Watch';
}

function statusClass(tier = '', verdictTier = '') {
  // Align with public CardStatus grammar (critical / on-track / watch).
  if (tier === EARLY_WARNING_TIERS.CRITICAL || verdictTier === 'blocked') return 'critical';
  if (verdictTier === 'onTrack') return 'on-track';
  return 'watch';
}

function squadMainIssue(insight = {}, delivery = 0, offPlan = 0, proof = 0) {
  if (!insight.boardResolved) return 'Data quality';
  if (offPlan >= 40 && delivery < 45) return 'Scope and proof';
  if (proof < 40) return 'Evidence gap';
  if (delivery < 30 && asNum(insight.sprintPulse?.committed, 0) > 0) return 'Delivery recovery';
  if (offPlan >= 35) return 'Behind sprint commitment';
  if (proof < 55) return 'Proof confidence';
  return 'Monitoring';
}

function squadExplanation(insight = {}, delivery = 0, offPlan = 0, proof = 0, openCases = 0) {
  const name = squadDisplayName(insight);
  if (!insight.boardResolved) {
    return `${name}: Squad data is partial — refresh or check board mapping before deciding.`;
  }
  const committed = asNum(insight.sprintPulse?.committed, 0);
  if (delivery <= 5 && committed > 0) {
    return `${name}: Delivery cannot be confirmed. ${openCases || 'Several'} actions are open, proof confidence is ${proof}%, and scope may be incomplete.`;
  }
  if (delivery <= 5 && proof < 50) {
    return `${name}: Delivery cannot be confirmed yet. Proof confidence is ${proof}%${openCases ? ` and ${openCases} governance gap${openCases === 1 ? '' : 's'} remain` : ''}.`;
  }
  if (offPlan >= 40 && delivery < 45) {
    return `${name}: High behind-commitment work (${offPlan}%) and weak proof (${proof}%) are driving low delivery.`;
  }
  if (delivery >= 65 && proof >= 60) {
    return `${name}: Delivery and evidence are improving. This squad may be ready to scale.`;
  }
  if (proof >= 48 && proof < 65) {
    return `${name}: Delivery cannot be confirmed yet, but proof confidence is ${proof}% and fewer governance gaps remain.`;
  }
  if (offPlan >= 35) {
    return `${name}: Behind-commitment work is high (${offPlan}%) and committed delivery remains ${delivery}%.`;
  }
  if (proof < 50) {
    return `${name}: Evidence quality (${proof}%) still limits confidence in delivery claims.`;
  }
  return `${name}: Delivery is steady at ${delivery}% — monitor scope drift and proof freshness.`;
}

function cardDecisionNeeded(insight = {}, delivery = 0, proof = 0) {
  if (!insight.boardResolved) return 'Resolve board mapping';
  if (proof < 40) return 'Confirm scope and proof';
  if (delivery < 40) return 'Validate delivery recovery';
  return 'Continue monitoring';
}

function cardNextAction(insight = {}, nudgesForSquad = 0) {
  if (nudgesForSquad > 0) return `Review ${nudgesForSquad} prepared nudge${nudgesForSquad === 1 ? '' : 's'}`;
  if (!insight.boardResolved) return 'Refresh squad data';
  return 'Monitor next checkpoint';
}

/**
 * @param {object} args
 * @param {object} args.decision PortfolioDecision contract
 * @param {object} args.brief governance brief
 * @param {Array} [args.insights] squad insights
 * @param {Array} [args.cases] compact intervention cases
 */
export function buildPortfolioComparisonCards({
  decision = {},
  brief = {},
  insights = [],
  cases = [],
} = {}) {
  const anchor = String(decision.anchorProject || '').toUpperCase();
  const compare = (decision.compareProjects || []).map((p) => String(p).toUpperCase());
  const order = [anchor, ...compare.filter((p) => p !== anchor)];
  const seen = new Set();
  const cards = [];
  const readinessList = [];
  for (const key of order) {
    if (!key || key === '__ALL__' || seen.has(key)) continue;
    seen.add(key);
    const insight = insights.find((i) => i.projectKey === key) || { projectKey: key };
    const readiness = resolveSquadReadinessStage({
      projectKey: key,
      brief,
      baselineMode: decision.baselineMode || brief.meta?.baselineMode || 'pi-baseline',
      squadName: squadDisplayName(insight),
    });
    readinessList.push(readiness);
    const delivery = deliveryPct(insight);
    const offPlan = offPlanPct(insight);
    const proof = proofConfidencePct(insight, brief);
    const piCommitted = asNum(insight.piCommitted, 0);
    const sprintCommitted = asNum(insight.sprintPulse?.committed, 0);
    const squadCases = cases.filter((c) => c.project === key);
    const squadCommitments = buildAffectedCommitments({
      anchor: insight,
      cases: squadCases,
      brief,
      periodKey: decision.periodKey,
    });
    const commitments = piCommitted > 0 ? piCommitted : Math.max(squadCommitments.length, sprintCommitted);
    const tier = key === anchor ? decision.earlyWarningTier : EARLY_WARNING_TIERS.EARLY;
    const nudgesForSquad = squadCases.filter((c) => c.needsApproval).length;
    const isAnchor = key === anchor;
    const gated = readiness.gated;
    cards.push({
      projectKey: key,
      squadName: squadDisplayName(insight),
      selected: isAnchor,
      status: gated ? readiness.label : statusLabel(tier, insight.verdictTier),
      statusClass: gated
        ? (readiness.stage === READINESS_STAGES.UPLOAD_SLIDE ? 'gate-critical' : 'gate-watch')
        : statusClass(tier, insight.verdictTier),
      readiness,
      metrics: gated
        ? { delivered: null, offPlanLoad: null, proofConfidence: null, commitments }
        : {
          delivered: delivery,
          offPlanLoad: offPlan,
          proofConfidence: proof,
          commitments,
        },
      mainIssue: gated ? readiness.reason : squadMainIssue(insight, delivery, offPlan, proof),
      affectedCommitmentCount: squadCommitments.length || commitments,
      decisionNeeded: gated ? readiness.cta : cardDecisionNeeded(insight, delivery, proof),
      nextAction: gated ? readiness.cta : cardNextAction(insight, nudgesForSquad),
      explanation: gated ? readiness.reason : squadExplanation(insight, delivery, offPlan, proof, squadCases.length),
      proofDetail: gated
        ? readiness.reason
        : `Delivered ${delivery}% · Behind commitment ${offPlan}% · Proof ${proof}% · ${commitments} commitment${commitments === 1 ? '' : 's'}`,
      hidePrimaryCta: isAnchor && (decision.preparedActions?.totalReady || 0) > 0,
      viewSquadHref: `/current-sprint?projects=${encodeURIComponent(key)}&period=${encodeURIComponent(decision.periodKey || '')}`,
    });
  }
  const maxVisible = 5;
  return {
    cards: cards.slice(0, maxVisible),
    overflowCount: Math.max(0, cards.length - maxVisible),
    readinessSummary: summarizeReadinessAcrossSquads(readinessList),
    actionsStrip: {
      nudgesReady: decision.trust?.nudgesReady || 0,
      pending: decision.trust?.pending || 0,
      proofLevel: decision.trust?.proofLevel || 'Medium',
    },
  };
}

export function recommendationActionLabel(recommendationId = '') {
  switch (recommendationId) {
    case PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE:
      return 'Review scope';
    case PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT:
      return 'Review investment';
    case PORTFOLIO_RECOMMENDATIONS.CONTINUE_SCALE:
      return 'Scale';
    case PORTFOLIO_RECOMMENDATIONS.MOVE_CAPACITY:
      return 'Move capacity';
    default:
      return 'Continue & improve';
  }
}
