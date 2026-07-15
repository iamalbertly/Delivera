/**
 * SSOT: Event-specific scope and commitment language — never generic "Confirm scope" post-planning.
 */
import { GOVERNANCE_STATES } from './Delivera-Governance-GovernanceState-01SSOT.js';

function isPostPlanningScope(risk = {}, brief = {}) {
  const type = String(risk.riskType || '').toLowerCase();
  if (!type.includes('late') && !type.includes('scope')) return false;
  const keys = risk.issueKeys || (risk.issueKey ? [risk.issueKey] : []);
  const lateKeys = new Set((brief?.deliveryTruthKeys?.lateAdded || []).map((k) => String(k).toUpperCase()));
  return keys.some((k) => lateKeys.has(String(k).toUpperCase()));
}

export function scopeDecisionCopy({
  risk = {},
  commitment = {},
  brief = {},
  matchScore = null,
  hasJiraMatch = true,
  owner = '',
  verdict = '',
} = {}) {
  if (isPostPlanningScope(risk, brief) || commitment.scopeAfterPlanning) {
    return 'Accept the recorded scope change, or require a recovery plan';
  }
  const v = String(verdict || commitment.verdict || '').toLowerCase();
  if (v === 'removed') {
    return 'Record who approved removing this promise from the quarter';
  }
  if (v === 'not-planned' || commitment.lifecycleStage === 'not-planned') {
    return 'Nudge squad to plan stories under this epic';
  }
  if (matchScore != null && Number(matchScore) < 55) {
    return 'Confirm whether this extracted statement was a quarter commitment';
  }
  if (!hasJiraMatch) {
    return 'Identify the Jira work supporting this promise';
  }
  if (!owner) {
    return 'Assign an accountable owner for this commitment';
  }
  if (commitment.governanceState === GOVERNANCE_STATES.EXTRACTION_UNCERTAIN) {
    return 'Review uncertain baseline match';
  }
  if (commitment.governanceState === GOVERNANCE_STATES.DONE_UNPROVEN) {
    return 'Review missing acceptance evidence';
  }
  return 'Review commitment evidence and next step';
}

export function nextDecisionActionLabel(ctx = {}) {
  const copy = scopeDecisionCopy(ctx);
  if (copy.includes('scope change')) return 'Record scope decision';
  if (copy.includes('extracted')) return 'Confirm extracted commitment';
  if (copy.includes('plan stories')) return 'Nudge squad to plan stories';
  if (copy.includes('Jira work')) return 'Link promise to Jira work';
  if (copy.includes('owner')) return 'Assign commitment owner';
  if (copy.includes('acceptance')) return 'Review missing acceptance evidence';
  if (copy.includes('removing')) return 'Record removal approval';
  return 'Record governance decision';
}
