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
  if (tier === EARLY_WARNING_TIERS.CRITICAL || verdictTier === 'blocked') return 'at-risk';
  if (verdictTier === 'onTrack') return 'improving';
  return 'watch';
}

function squadExplanation(insight = {}, delivery = 0, offPlan = 0, proof = 0) {
  const name = squadDisplayName(insight);
  if (!insight.boardResolved) {
    return `${name}: Squad data is partial — refresh or check board mapping before deciding.`;
  }
  if (offPlan >= 40 && delivery < 45) {
    return `${name}: High off-plan work and weak proof are driving low delivery.`;
  }
  if (delivery >= 65 && proof >= 60) {
    return `${name}: Delivery and evidence are improving. This squad may be ready to scale.`;
  }
  if (offPlan >= 35) {
    return `${name}: Off-plan work is high and committed delivery remains low.`;
  }
  if (proof < 50) {
    return `${name}: Delivery is moderate, but evidence quality still limits confidence.`;
  }
  return `${name}: Delivery is steady — monitor scope drift and proof freshness.`;
}

function cardAction(insight = {}, delivery = 0, offPlan = 0) {
  if (offPlan >= 35 || delivery < 40) {
    return { id: 'review-scope', label: 'Review scope' };
  }
  if (delivery >= 65) {
    return { id: 'scale', label: 'Scale' };
  }
  return { id: 'continue-improve', label: 'Continue & improve' };
}

/**
 * @param {object} args
 * @param {object} args.decision PortfolioDecision contract
 * @param {object} args.brief governance brief
 * @param {Array} [args.insights] squad insights
 */
export function buildPortfolioComparisonCards({
  decision = {},
  brief = {},
  insights = [],
} = {}) {
  const anchor = String(decision.anchorProject || '').toUpperCase();
  const compare = (decision.compareProjects || []).map((p) => String(p).toUpperCase());
  const order = [anchor, ...compare.filter((p) => p !== anchor)];
  const seen = new Set();
  const cards = [];
  for (const key of order) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const insight = insights.find((i) => i.projectKey === key) || { projectKey: key };
    const delivery = deliveryPct(insight);
    const offPlan = offPlanPct(insight);
    const proof = proofConfidencePct(insight, brief);
    const commitments = asNum(insight.piCommitted, asNum(insight.sprintPulse?.committed, 0));
    const tier = key === anchor ? decision.earlyWarningTier : EARLY_WARNING_TIERS.EARLY;
    const action = cardAction(insight, delivery, offPlan);
    cards.push({
      projectKey: key,
      squadName: squadDisplayName(insight),
      selected: key === anchor,
      status: statusLabel(tier, insight.verdictTier),
      statusClass: statusClass(tier, insight.verdictTier),
      metrics: {
        delivered: delivery,
        offPlanLoad: offPlan,
        proofConfidence: proof,
        commitments,
      },
      explanation: squadExplanation(insight, delivery, offPlan, proof),
      action,
      viewSquadHref: `/current-sprint?projects=${encodeURIComponent(key)}&period=${encodeURIComponent(decision.periodKey || '')}`,
    });
  }
  const maxVisible = 5;
  return {
    cards: cards.slice(0, maxVisible),
    overflowCount: Math.max(0, cards.length - maxVisible),
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
