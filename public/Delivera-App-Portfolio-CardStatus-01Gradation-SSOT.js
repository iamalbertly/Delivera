/**
 * Portfolio card status grammar — SSOT for bento cards + verdict band.
 * Prevents CRITICAL vs "on track" contradictions across surfaces.
 */

export const GOVERNANCE_DISPLACEMENT_LINE =
  'Power BI charts history · Rovo explains a ticket · Delivera closes the owner + evidence decision in one place.';

export const GOVERNANCE_DISPLACEMENT_LINE_SHORT =
  'Charts show history · Delivera closes the decision — owner, evidence, next sentence.';

export function clampDeliveryPct(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

/** Gradate bento / verdict status — not binary "At risk". */
export function gradateCardStatus(card = {}, delivered, proof) {
  const deliveredPct = clampDeliveryPct(delivered);
  const proofPct = clampDeliveryPct(proof);
  const backendStatus = String(card.statusClass || '').toLowerCase();
  if (backendStatus === 'blocked') {
    return { statusClass: 'blocked', statusLabel: '⛔ Blocked' };
  }
  const commitments = Number(card.metrics?.commitments) || 0;
  if (commitments === 0 && deliveredPct === 0) {
    return { statusClass: 'unassessable', statusLabel: '○ Not assessable' };
  }
  if (deliveredPct === 0 && proofPct === 0 && commitments > 0) {
    return { statusClass: 'data-check', statusLabel: '🔵 Data check' };
  }
  if (deliveredPct >= 80 && proofPct >= 40) {
    return { statusClass: 'on-track', statusLabel: '✓ On track' };
  }
  if (deliveredPct < 50) {
    return { statusClass: 'critical', statusLabel: '🔴 Critical' };
  }
  return { statusClass: 'watch', statusLabel: '● Watch' };
}

export function buildCommitmentSummary(card = {}, squadCommitments = [], statusClass = '') {
  const m = card.metrics || {};
  const totalFromCard = Number(m.commitments) || 0;
  const atRiskFromRows = squadCommitments.filter((r) => {
    const reality = String(r.reality || r.governanceState || '').toLowerCase();
    if (!reality) return true;
    if (reality === 'done' || reality === 'delivered' || reality === 'verified') return false;
    if (reality === 'unassessable' || reality === 'not assessable') return false;
    return true;
  }).length;
  const atRiskFromMetrics = Number(m.atRisk) || Number(m.commitmentsAtRisk) || 0;
  const status = String(statusClass || card.statusClass || '').toLowerCase();
  const unhealthyStatus = /critical|blocked|watch|data-check|stalled/.test(status);
  let atRisk = Math.max(atRiskFromRows, atRiskFromMetrics);
  if (unhealthyStatus && atRisk === 0 && totalFromCard > 0) {
    atRisk = totalFromCard;
  }
  atRisk = Math.min(atRisk, totalFromCard || atRisk);
  const total = totalFromCard || squadCommitments.length || 0;
  if (total === 0) return 'No commitments baseline';
  if (atRisk > 0) return `${total} commitment${total === 1 ? '' : 's'} · ${atRisk} at risk`;
  return `${total} commitment${total === 1 ? '' : 's'} · on track`;
}

export function buildBentoDecisionLabel(card = {}, delivered = 0, proof = 0) {
  const nextAction = card.decisionNeeded || card.nextAction || '';
  if (nextAction && !/confirm scope and proof/i.test(nextAction)) {
    return nextAction;
  }
  const deliveredPct = clampDeliveryPct(delivered);
  const proofPct = clampDeliveryPct(proof);
  const commitments = Number(card.metrics?.commitments) || 0;
  if (deliveredPct === 0 && proofPct === 0 && commitments === 0) {
    return 'Board not connected — link a Jira board';
  }
  if (deliveredPct === 0) return '0% delivered — sprint stalled or not started';
  if (deliveredPct < 50) return `${deliveredPct}% delivered — behind on commitments`;
  if (proofPct < 40) return `${deliveredPct}% delivered but ${proofPct}% proof — evidence gap`;
  return `${deliveredPct}% delivered — on track`;
}

export function buildTrendLabel(card = {}) {
  if (card.trend) return String(card.trend);
  const movement = String(card.movement || card.movementHealth || '').toLowerCase();
  if (movement.includes('declin')) return 'Declining';
  if (movement.includes('stall')) return 'Stalled';
  if (movement.includes('recover')) return 'Recovering';
  if (movement.includes('healthy') || movement.includes('stable')) return 'Stable';
  const delivered = Number(card.metrics?.delivered) || 0;
  if (delivered === 0) return 'Declining';
  if (delivered >= 80) return 'Stable';
  return 'Watch';
}

export function buildDiagnosisLabel(card = {}, delivered = 0, proof = 0) {
  const deliveredPct = clampDeliveryPct(delivered);
  const proofPct = clampDeliveryPct(proof);
  const commitments = Number(card.metrics?.commitments) || 0;
  if (commitments === 0 && deliveredPct === 0 && proofPct === 0) {
    return 'Not assessable — no commitment baseline';
  }
  if (deliveredPct === 0 && proofPct === 0 && commitments > 0) {
    return 'Likely cause: Jira board not connected or stalled';
  }
  if (deliveredPct === 0 && proofPct < 20) {
    return 'Likely cause: Jira flow missing or stalled';
  }
  if (deliveredPct < 50 && proofPct < 40) {
    return 'Likely cause: Delivery stalled, evidence incomplete';
  }
  if (proofPct < 40) {
    return 'Likely cause: Evidence gap — work may be done but unproven';
  }
  if (deliveredPct >= 80) return 'Likely cause: On track — no intervention needed';
  return 'Likely cause: Behind on delivery — monitor closely';
}

export function buildWhyText(card = {}, delivered = 0, proof = 0) {
  const parts = [];
  const m = card.metrics || {};
  const deliveredPct = clampDeliveryPct(delivered);
  const proofPct = clampDeliveryPct(proof);
  const commitments = Number(m.commitments) || 0;
  const offPlan = Number(m.offPlanLoad) || 0;
  parts.push(deliveredPct === 0 ? '0% delivered' : `${deliveredPct}% delivered`);
  if (commitments > 0) parts.push(`${commitments} open commitments`);
  if (card.daysRemaining != null) {
    parts.push(card.daysRemaining > 0 ? `${card.daysRemaining}d left in sprint` : 'sprint ended');
  }
  if (proofPct > 0 && proofPct < 40) {
    parts.push(`${proofPct}% proof confidence`);
    if (card.linkedCount != null && card.totalCommitments && card.linkedCount === card.totalCommitments) {
      parts.push('all commitments linked but completion evidence absent');
    }
  }
  if (offPlan > 0) parts.push(`${offPlan}% off-plan load`);
  if (card.linkedCount != null && card.totalCommitments) {
    parts.push(`${card.linkedCount}/${card.totalCommitments} Jira linked`);
  }
  return parts.join(' · ') || 'No data available';
}
