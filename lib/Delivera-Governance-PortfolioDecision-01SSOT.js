/**
 * SSOT: Portfolio Decision Contract — deterministic metrics + recommendation.
 * OpenRouter may explain; it must not set recommendation or metric inputs.
 */
import { buildSquadInsights } from './Delivera-Governance-Executive-01View-SSOT.js';

export const PORTFOLIO_RECOMMENDATIONS = Object.freeze({
  CONTINUE_SCALE: 'continue-and-scale',
  CONTINUE_IMPROVE: 'continue-and-improve',
  REVIEW_SCOPE: 'review-scope',
  REVIEW_INVESTMENT: 'review-investment',
  MOVE_CAPACITY: 'move-capacity',
  ESCALATE_DECISION: 'escalate-decision',
  INSUFFICIENT_EVIDENCE: 'insufficient-evidence',
});

export const EARLY_WARNING_TIERS = Object.freeze({
  EARLY: 'early-signal',
  NEEDS_DECISION: 'needs-decision',
  CRITICAL: 'critical',
});

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function median(values = []) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}

function deliveryPct(insight = {}) {
  const pulse = insight.sprintPulse || {};
  const committed = asNum(pulse.committed, 0);
  const done = asNum(pulse.done, 0);
  return committed > 0 ? Math.round((done / committed) * 100) : asNum(pulse.pct, 0);
}

function offPlanPct(insight = {}) {
  const hours = asNum(insight.offPlanHours, 0);
  const committed = asNum(insight.sprintPulse?.committed, 0);
  if (committed <= 0) return hours > 0 ? 100 : 0;
  return Math.min(100, Math.round((hours / Math.max(committed * 4, 1)) * 100));
}

function proofConfidencePct(insight = {}, brief = {}) {
  const freshness = String(brief?.freshness?.confidenceLimit || 'live').toLowerCase();
  let base = 72;
  if (insight.verdictTier === 'blocked') base = 28;
  else if (insight.verdictTier === 'watch') base = 48;
  else if (insight.verdictTier === 'onTrack') base = 74;
  const risks = asNum(insight.cardRisks?.length, 0);
  base -= risks * 6;
  if (!insight.boardResolved) base = Math.min(base, 35);
  if (freshness === 'stale') base = Math.min(base, 40);
  return Math.max(8, Math.min(95, base));
}

function squadDisplayName(insight = {}) {
  return insight.boardName || insight.projectKey || 'Squad';
}

function resolveRecommendation(anchor = {}, peers = [], cases = [], baselineMissing = false) {
  if (!anchor.boardResolved && !anchor.projectKey) {
    return { id: PORTFOLIO_RECOMMENDATIONS.INSUFFICIENT_EVIDENCE, label: 'Insufficient evidence', confidence: 'low' };
  }
  if (baselineMissing && deliveryPct(anchor) < 40) {
    return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE, label: 'Review scope', confidence: 'medium' };
  }
  const delivery = deliveryPct(anchor);
  const offPlan = offPlanPct(anchor);
  const proof = proofConfidencePct(anchor);
  const openCases = cases.filter((c) => c.project === anchor.projectKey).length;
  if (openCases > 0 && (offPlan >= 35 || delivery < 40)) {
    return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT, label: 'Review investment', confidence: 'high' };
  }
  if (offPlan >= 40 && delivery < 45) {
    return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE, label: 'Review scope', confidence: 'high' };
  }
  if (delivery >= 70 && proof >= 65) {
    return { id: PORTFOLIO_RECOMMENDATIONS.CONTINUE_SCALE, label: 'Continue and scale', confidence: 'high' };
  }
  if (delivery >= 45) {
    return { id: PORTFOLIO_RECOMMENDATIONS.CONTINUE_IMPROVE, label: 'Continue and improve', confidence: 'medium' };
  }
  if (peers.some((p) => deliveryPct(p) - delivery >= 25)) {
    return { id: PORTFOLIO_RECOMMENDATIONS.MOVE_CAPACITY, label: 'Move capacity', confidence: 'medium' };
  }
  return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT, label: 'Review investment', confidence: 'medium' };
}

function earlyWarningTier(anchor = {}, cases = []) {
  const delivery = deliveryPct(anchor);
  const offPlan = offPlanPct(anchor);
  const caseCount = cases.filter((c) => c.project === anchor.projectKey).length;
  if (delivery < 25 && offPlan >= 45) return EARLY_WARNING_TIERS.CRITICAL;
  if (caseCount > 0 && offPlan >= 30) return EARLY_WARNING_TIERS.NEEDS_DECISION;
  if (offPlan >= 20 || delivery < 50) return EARLY_WARNING_TIERS.EARLY;
  return EARLY_WARNING_TIERS.EARLY;
}

function buildHeadline(anchor = {}, recommendation = {}, cases = []) {
  const name = squadDisplayName(anchor);
  const nudges = cases.filter((c) => c.project === anchor.projectKey && c.needsApproval).length;
  if (recommendation.id === PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE) {
    return `Review ${name} scope now`;
  }
  if (recommendation.id === PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT) {
    return `Review ${name} scope now`;
  }
  if (nudges > 0) return `Review ${name} scope now`;
  return `${name} portfolio signal`;
}

function buildSummary(anchor = {}, peers = [], cases = []) {
  const name = squadDisplayName(anchor);
  const delivery = deliveryPct(anchor);
  const peerMedian = median(peers.map(deliveryPct));
  const offPlan = offPlanPct(anchor);
  const nudges = cases.filter((c) => c.project === anchor.projectKey).length;
  const parts = [];
  if (delivery < peerMedian - 10) parts.push(`${name} is behind peer squads`);
  if (offPlan >= 30) parts.push('has high off-plan work');
  if (nudges > 0) parts.push(`${nudges} early nudge${nudges === 1 ? '' : 's'} ready before PI confidence drops further`);
  if (!parts.length) parts.push('monitoring continues with no urgent portfolio decision');
  return `${name} ${parts.join(', ')}.`.replace(/\s+\./g, '.');
}

function buildDrivers(anchor = {}, peers = [], brief = {}) {
  const delivery = deliveryPct(anchor);
  const peerMedian = median(peers.map(deliveryPct));
  const offPlan = offPlanPct(anchor);
  const proof = proofConfidencePct(anchor, brief);
  const name = squadDisplayName(anchor);
  return [
    {
      id: 'promised-impact',
      title: 'Promised impact',
      summary: `${name} is delivering less than peer squads.`,
      detail: `${name} delivery: ${delivery}% · Peer median: ${peerMedian}% · Difference: ${delivery - peerMedian} points`,
    },
    {
      id: 'capacity-drag',
      title: 'Capacity drag',
      summary: 'High off-plan load reduces committed delivery.',
      detail: `Off-plan load: ${offPlan}% · Committed items: ${asNum(anchor.sprintPulse?.committed, 0)}`,
    },
    {
      id: 'proof-gap',
      title: 'Proof gap',
      summary: 'Weak evidence reduces confidence in leadership decisions.',
      detail: `Proof confidence: ${proof}% · Board resolved: ${anchor.boardResolved ? 'yes' : 'no'}`,
    },
  ];
}

function proofLevel(pct = 50) {
  if (pct >= 65) return 'High';
  if (pct >= 40) return 'Medium';
  return 'Low';
}

/**
 * @param {object} args
 * @param {object} args.brief governance brief contract
 * @param {string} args.anchorProject selected squad key
 * @param {string[]} args.compareProjects peer squad keys
 * @param {Array} [args.cases] compact intervention cases
 * @param {boolean} [args.baselineMissing]
 * @param {string} [args.baselineMode]
 */
export function buildPortfolioDecision({
  brief = {},
  anchorProject = '',
  compareProjects = [],
  cases = [],
  baselineMissing = false,
  baselineMode = 'pi-baseline',
  wordingSource = 'template',
  claimsVerified = true,
  partialSquads = 0,
} = {}) {
  const projects = Array.isArray(brief.projects) ? brief.projects : [];
  const boardPayloads = brief._boardPayloads || [];
  const insights = brief.squadInsights?.length
    ? brief.squadInsights
    : buildSquadInsights(brief, boardPayloads, brief.evidencePack || {}, brief._squadInsightOpts || {});
  const anchorKey = String(anchorProject || projects[0] || '').trim().toUpperCase();
  const compareKeys = (compareProjects.length ? compareProjects : projects.filter((p) => p !== anchorKey))
    .map((p) => String(p).trim().toUpperCase());
  const anchor = insights.find((i) => i.projectKey === anchorKey) || insights[0] || { projectKey: anchorKey };
  const peers = insights.filter((i) => compareKeys.includes(i.projectKey));
  const recommendation = resolveRecommendation(anchor, peers, cases, baselineMissing);
  const delivery = deliveryPct(anchor);
  const offPlan = offPlanPct(anchor);
  const proof = proofConfidencePct(anchor, brief);
  const peerDelivery = median(peers.map(deliveryPct));
  const peerOffPlan = median(peers.map(offPlanPct));
  const peerProof = median(peers.map((p) => proofConfidencePct(p, brief)));
  const liveCases = cases.filter((c) => c.project === anchor.projectKey).length;
  const nudgesReady = cases.filter((c) => c.project === anchor.projectKey && c.needsApproval).length;
  const pending = cases.filter((c) => c.project === anchor.projectKey && c.state?.includes('clarification')).length;

  return {
    generatedAt: new Date().toISOString(),
    anchorProject: anchor.projectKey || anchorKey,
    compareProjects: compareKeys,
    periodKey: brief.meta?.quarter || '',
    baselineMode,
    baselineMissing,
    partialSquads,
    headline: buildHeadline(anchor, recommendation, cases),
    summary: buildSummary(anchor, peers, cases),
    recommendation,
    earlyWarningTier: earlyWarningTier(anchor, cases),
    metrics: {
      delivery: { value: delivery, peerMedian: peerDelivery, unit: '%' },
      offPlanLoad: { value: offPlan, peerMedian: peerOffPlan, unit: '%' },
      proofConfidence: { value: proof, peerMedian: peerProof, unit: '%' },
    },
    trust: {
      liveCases,
      nudgesReady,
      pending,
      proofLevel: proofLevel(proof),
      lastScanAt: brief.generatedAt || brief.freshness?.asOf || new Date().toISOString(),
      wordingSource,
      claimsVerified,
    },
    drivers: buildDrivers(anchor, peers, brief),
    decisionOptions: buildDecisionOptions(recommendation),
    monitoring: {
      squadCount: insights.length,
      commitmentCount: insights.reduce((sum, i) => sum + asNum(i.piCommitted, asNum(i.sprintPulse?.committed, 0)), 0),
    },
  };
}

function buildDecisionOptions(recommendation = {}) {
  const all = [
    { id: 'keep-funding', label: 'Keep funding', hint: 'Continue as planned' },
    { id: 'review-investment', label: 'Review investment', hint: 'Fix issues and revalidate outcomes' },
    { id: 'move-capacity', label: 'Move capacity', hint: 'Reallocate to higher impact' },
    { id: 'review-scope', label: 'Review scope', hint: 'Confirm PI commitment alignment' },
    { id: 'request-evidence', label: 'Request evidence', hint: 'Strengthen proof before deciding' },
    { id: 'defer-decision', label: 'Defer decision', hint: 'Monitor and revisit' },
  ];
  const preferred = recommendation.id || PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT;
  const priority = new Set([
    preferred === PORTFOLIO_RECOMMENDATIONS.CONTINUE_SCALE ? 'keep-funding' : '',
    preferred === PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT ? 'review-investment' : '',
    preferred === PORTFOLIO_RECOMMENDATIONS.MOVE_CAPACITY ? 'move-capacity' : '',
    preferred === PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE ? 'review-scope' : '',
    preferred === PORTFOLIO_RECOMMENDATIONS.INSUFFICIENT_EVIDENCE ? 'request-evidence' : '',
    'keep-funding',
    'review-investment',
    'move-capacity',
  ].filter(Boolean));
  return all.filter((o) => priority.has(o.id)).slice(0, 3);
}

export { deliveryPct, offPlanPct, proofConfidencePct, squadDisplayName };
