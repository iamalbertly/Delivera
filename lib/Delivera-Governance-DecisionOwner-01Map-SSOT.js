/**
 * SSOT: Decision-Owner Engine.
 *
 * Maps a governance risk to the correct accountability lane and a concrete
 * recommended action. Not every problem belongs to developers: unclear
 * priority is a PO decision, a cross-team dependency is an SM escalation, etc.
 * This is what stops Delivera being seen as the "Scrum butler" and makes the
 * brief actionable.
 *
 * Pure functions. No Jira/IO.
 */
import { RISK_TYPES, escalationLevel } from './Delivera-Governance-Grammar-01Rules-SSOT.js';

/** Accountability lanes. */
export const DECISION_LANES = Object.freeze({
  PO: 'Product Owner',
  TECH_LEAD: 'Tech Lead',
  SM: 'Scrum Master',
  BUSINESS_OWNER: 'Business Owner',
  LEADERSHIP: 'Leadership',
  PMO: 'PMO',
});

/** Default lane per risk type. */
const LANE_BY_RISK = Object.freeze({
  [RISK_TYPES.STALE_IN_PROGRESS]: DECISION_LANES.TECH_LEAD,
  [RISK_TYPES.LATE_SCOPE]: DECISION_LANES.PO,
  [RISK_TYPES.MISSING_OWNER]: DECISION_LANES.SM,
  [RISK_TYPES.PO_DECISION_NEEDED]: DECISION_LANES.PO,
  [RISK_TYPES.DEPENDENCY]: DECISION_LANES.SM,
  [RISK_TYPES.NO_ACTIVE_SPRINT]: DECISION_LANES.SM,
  [RISK_TYPES.MISSING_ESTIMATE]: DECISION_LANES.TECH_LEAD,
  [RISK_TYPES.NO_LOG]: DECISION_LANES.TECH_LEAD,
  [RISK_TYPES.CARRYOVER]: DECISION_LANES.PO,
  [RISK_TYPES.DATA_CONFIDENCE_GAP]: DECISION_LANES.SM,
  [RISK_TYPES.INSUFFICIENT_DELIVERY]: DECISION_LANES.PO,
});

function firstName(owner) {
  const name = String(owner || '').trim();
  if (!name) return '';
  return name.split(/\s+/)[0];
}

/**
 * Resolve the accountability lane for a risk.
 * Critical/aged items escalate one lane up toward Leadership.
 * @param {object} risk { riskType, ageHours }
 * @returns {string} a DECISION_LANES value
 */
export function resolveDecisionLane(risk = {}) {
  const base = LANE_BY_RISK[risk.riskType] || DECISION_LANES.SM;
  if (escalationLevel(risk.ageHours) === 'escalate' && base !== DECISION_LANES.LEADERSHIP) {
    // Sustained, unresolved risk becomes a leadership-visible escalation.
    return DECISION_LANES.LEADERSHIP;
  }
  return base;
}

/**
 * Build a concrete, evidence-aware recommended action for a risk.
 * @param {object} risk { riskType, issueKey, owner, status, ageHours }
 * @returns {string}
 */
export function recommendedActionFor(risk = {}) {
  const key = String(risk.issueKey || '').trim() || 'this item';
  const owner = firstName(risk.owner);
  switch (risk.riskType) {
    case RISK_TYPES.LATE_SCOPE:
      return `Confirm with PO whether ${key} stays in this sprint, is split, or deferred.`;
    case RISK_TYPES.MISSING_OWNER:
      return `Assign an owner to ${key} and agree the next step before stand-up.`;
    case RISK_TYPES.PO_DECISION_NEEDED:
      return `PO confirms priority and acceptance criteria for ${key}.`;
    case RISK_TYPES.DEPENDENCY:
      return `SM escalates the dependency on ${key} to the owning team for a date.`;
    case RISK_TYPES.NO_ACTIVE_SPRINT:
      return `Start the planned sprint or confirm the board owner for ${key}.`;
    case RISK_TYPES.MISSING_ESTIMATE:
      return `Add an estimate to ${key} or split it so capacity is plannable.`;
    case RISK_TYPES.NO_LOG:
      return `Log work on ${key} or correct the estimate so progress is visible.`;
    case RISK_TYPES.CARRYOVER:
      return `Review ${key} with PO: re-commit, re-scope, or return to backlog.`;
    case RISK_TYPES.DATA_CONFIDENCE_GAP:
      return `Confirm SP field mapping for ${risk.squad || 'this board'} or mark SP metrics unavailable for this portfolio.`;
    case RISK_TYPES.INSUFFICIENT_DELIVERY:
      return `Confirm whether ${risk.squad || 'this squad'} board, project, or sprint scope is correct for this period.`;
    case RISK_TYPES.STALE_IN_PROGRESS:
    default:
      return owner
        ? `Ping ${owner} on ${key}: unblock or cut scope before the next check-in.`
        : `Review ${key}: confirm blocker vs normal work-in-progress and assign next step.`;
  }
}

/**
 * Enrich a risk in place-style (returns a new object) with its lane and action.
 * @param {object} risk
 * @returns {object} { ...risk, decisionNeededFrom, recommendedAction }
 */
export function assignDecisionOwner(risk = {}) {
  return {
    ...risk,
    decisionNeededFrom: resolveDecisionLane(risk),
    recommendedAction: risk.recommendedAction || recommendedActionFor(risk),
  };
}

/** Enrich a list of risks with decision owners and actions. */
export function assignDecisionOwners(risks = []) {
  return (Array.isArray(risks) ? risks : []).map((r) => assignDecisionOwner(r));
}
