/**
 * SSOT: Vodacom Delivery Grammar.
 *
 * The local operating model that Jira AI cannot copy: thresholds, risk types,
 * confidence bands, and escalation rules that turn raw Jira signals into
 * Vodacom delivery-governance judgments. Every downstream governance module
 * (fact contract, evidence pack, decision-owner, PO readiness, narrator) reads
 * its rules from here so behaviour is tunable in one place.
 *
 * Pure data + pure functions. No Jira calls, no IO.
 */

/** Canonical risk types used across the brief, evidence pack, and decision-owner map. */
export const RISK_TYPES = Object.freeze({
  STALE_IN_PROGRESS: 'stale-in-progress',
  LATE_SCOPE: 'late-scope',
  MISSING_OWNER: 'missing-owner',
  PO_DECISION_NEEDED: 'po-decision-needed',
  DEPENDENCY: 'dependency',
  NO_ACTIVE_SPRINT: 'no-active-sprint',
  MISSING_ESTIMATE: 'missing-estimate',
  NO_LOG: 'no-log',
  CARRYOVER: 'carryover',
  DATA_CONFIDENCE_GAP: 'data-confidence-gap',
  INSUFFICIENT_DELIVERY: 'insufficient-delivery-evidence',
});

/** Tunable thresholds. Hours unless the name says otherwise. */
export const GOVERNANCE_THRESHOLDS = Object.freeze({
  staleInProgressHours: 24,
  staleEscalateHours: 48,
  staleCriticalHours: 72,
  lateScopeAfterSprintStartHours: 0, // anything created after sprint start counts as late scope
  poDecisionStaleHours: 48,
  blockerEscalateHours: 48,
  noRecentCommentHours: 72,
  backlogNoMovementHours: 168, // 7 days
  lowCompletionPct: 45,
  riskBriefTopN: 5,
});

/** Confidence bands, ordered from strongest to weakest. */
export const CONFIDENCE_BANDS = Object.freeze(['high', 'medium', 'low']);

/** Freshness states, ordered from strongest to weakest. */
export const FRESHNESS_STATES = Object.freeze(['live', 'cached', 'partial', 'stale']);

/** Escalation levels in increasing severity. */
export const ESCALATION_LEVELS = Object.freeze(['watch', 'act-today', 'escalate']);

function asNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Map a data freshness state to the maximum confidence it can support.
 * Stale data can never claim high confidence.
 * @param {string} freshness one of FRESHNESS_STATES
 * @returns {string} one of CONFIDENCE_BANDS
 */
export function maxConfidenceForFreshness(freshness) {
  switch (String(freshness || '').toLowerCase()) {
    case 'live':
      return 'high';
    case 'cached':
      return 'medium';
    case 'partial':
      return 'low';
    case 'stale':
      return 'low';
    default:
      return 'low';
  }
}

/**
 * Derive a freshness state from cache metadata.
 * @param {object} meta { stale?: boolean, partial?: boolean, fromCache?: boolean, fromSnapshot?: boolean }
 * @returns {string} one of FRESHNESS_STATES
 */
export function deriveFreshnessState(meta = {}) {
  if (meta.stale === true) return 'stale';
  if (meta.partial === true) return 'partial';
  if (meta.fromCache === true || meta.fromSnapshot === true) return 'cached';
  return 'live';
}

/**
 * Clamp a proposed confidence band so it never exceeds what freshness allows.
 * @param {string} proposed one of CONFIDENCE_BANDS
 * @param {string} freshness one of FRESHNESS_STATES
 * @returns {string} the safe confidence band
 */
export function clampConfidenceToFreshness(proposed, freshness) {
  const ceiling = maxConfidenceForFreshness(freshness);
  const order = CONFIDENCE_BANDS; // high(0) > medium(1) > low(2)
  const pIdx = order.indexOf(String(proposed || '').toLowerCase());
  const cIdx = order.indexOf(ceiling);
  if (pIdx < 0) return ceiling;
  // Higher band = lower index. We may not go below (numerically above) the ceiling.
  return pIdx >= cIdx ? order[pIdx] : ceiling;
}

/** True when an in-progress item has been static long enough to flag. */
export function isStaleInProgress(hoursInStatus, statusCategoryKey) {
  if (String(statusCategoryKey || '').toLowerCase() === 'done') return false;
  return asNum(hoursInStatus, 0) >= GOVERNANCE_THRESHOLDS.staleInProgressHours;
}

/** True when an item was created after the sprint started (late scope). */
export function isLateScope(createdIso, sprintStartIso) {
  const created = createdIso ? new Date(createdIso).getTime() : NaN;
  const start = sprintStartIso ? new Date(sprintStartIso).getTime() : NaN;
  if (!Number.isFinite(created) || !Number.isFinite(start)) return false;
  return created > start + GOVERNANCE_THRESHOLDS.lateScopeAfterSprintStartHours * 3600 * 1000;
}

/**
 * Escalation level for an aging item.
 * @param {number} hours hours in current status / since flagged
 * @returns {string} one of ESCALATION_LEVELS
 */
export function escalationLevel(hours) {
  const h = asNum(hours, 0);
  if (h >= GOVERNANCE_THRESHOLDS.staleCriticalHours) return 'escalate';
  if (h >= GOVERNANCE_THRESHOLDS.staleEscalateHours) return 'act-today';
  return 'watch';
}

/**
 * Overall portfolio confidence from delivery facts, before freshness clamping.
 * @param {object} facts { completionPct, blocked, staleInProgress, lateAdded }
 * @returns {string} one of CONFIDENCE_BANDS
 */
export function deriveDeliveryConfidence({ completionPct = 0, blocked = 0, staleInProgress = 0, lateAdded = 0 } = {}) {
  const score = (asNum(blocked) * 3) + (asNum(staleInProgress) * 2) + asNum(lateAdded)
    + (asNum(completionPct) < GOVERNANCE_THRESHOLDS.lowCompletionPct ? 4 : 0);
  if (score >= 10) return 'low';
  if (score >= 4) return 'medium';
  return 'high';
}

/** UI audience: delivery blockers vs measurement/config noise. */
export function classifyRiskAudience(riskType) {
  const t = String(riskType || '').toLowerCase();
  if (
    t === RISK_TYPES.DATA_CONFIDENCE_GAP
    || t === RISK_TYPES.INSUFFICIENT_DELIVERY
    || t === RISK_TYPES.NO_ACTIVE_SPRINT
  ) {
    return 'measurement';
  }
  return 'delivery';
}

/** Human-readable label for a risk type (jargon-free, travels across OpCos). */
export function riskTypeLabel(riskType) {
  switch (String(riskType || '').toLowerCase()) {
    case RISK_TYPES.STALE_IN_PROGRESS:
      return 'Stale in progress';
    case RISK_TYPES.LATE_SCOPE:
      return 'Added after sprint start';
    case RISK_TYPES.MISSING_OWNER:
      return 'No owner';
    case RISK_TYPES.PO_DECISION_NEEDED:
      return 'Product Owner decision needed';
    case RISK_TYPES.DEPENDENCY:
      return 'Cross-team dependency';
    case RISK_TYPES.NO_ACTIVE_SPRINT:
      return 'No active sprint';
    case RISK_TYPES.MISSING_ESTIMATE:
      return 'Missing estimate';
    case RISK_TYPES.NO_LOG:
      return 'No time logged';
    case RISK_TYPES.CARRYOVER:
      return 'Carryover from prior sprint';
    case RISK_TYPES.DATA_CONFIDENCE_GAP:
      return 'Data confidence gap';
    case RISK_TYPES.INSUFFICIENT_DELIVERY:
      return 'Insufficient delivery evidence';
    default:
      return 'Delivery risk';
  }
}
