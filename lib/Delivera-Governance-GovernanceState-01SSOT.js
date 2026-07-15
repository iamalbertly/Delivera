/**
 * SSOT: Discrete governance states — no fake precision in primary viewport.
 */
export const GOVERNANCE_STATES = Object.freeze({
  VERIFIED: 'verified',
  PARTIALLY_SUPPORTED: 'partially-supported',
  UNSUPPORTED: 'unsupported',
  EXTRACTION_UNCERTAIN: 'extraction-uncertain',
  DONE_UNPROVEN: 'done-unproven',
  CANNOT_VERIFY: 'cannot-verify',
  EVIDENCE_STALE: 'evidence-stale',
});

export const ATTENTION_STATES = Object.freeze({
  DECISION_REQUIRED: 'decision-required',
  PROOF_REQUIRED: 'proof-required',
  OFF_PLAN: 'off-plan',
  CANNOT_VERIFY: 'cannot-verify',
  NO_ACTION: 'no-action',
  COMPLETE: 'complete',
});

export const DATA_TRUST = Object.freeze({
  PLAN_BACKED: 'plan-backed',
  BOARD_HEALTH_ONLY: 'board-health-only',
  CANNOT_JUDGE: 'cannot-judge',
});

const STATE_LABELS = Object.freeze({
  [GOVERNANCE_STATES.VERIFIED]: 'Verified',
  [GOVERNANCE_STATES.PARTIALLY_SUPPORTED]: 'Linked · in progress',
  [GOVERNANCE_STATES.UNSUPPORTED]: 'Unsupported',
  [GOVERNANCE_STATES.EXTRACTION_UNCERTAIN]: 'Extraction uncertain',
  [GOVERNANCE_STATES.DONE_UNPROVEN]: 'Work marked Done · acceptance unproven',
  [GOVERNANCE_STATES.CANNOT_VERIFY]: 'Cannot verify',
  [GOVERNANCE_STATES.EVIDENCE_STALE]: 'Evidence stale',
});

const ATTENTION_LABELS = Object.freeze({
  [ATTENTION_STATES.DECISION_REQUIRED]: 'Decision required',
  [ATTENTION_STATES.PROOF_REQUIRED]: 'Proof required',
  [ATTENTION_STATES.OFF_PLAN]: 'Behind sprint commitment',
  [ATTENTION_STATES.CANNOT_VERIFY]: 'Cannot verify',
  [ATTENTION_STATES.NO_ACTION]: 'No action',
  [ATTENTION_STATES.COMPLETE]: 'Complete',
});

/** One-line skim hints under attention pills (≤1s read). */
const ATTENTION_HINTS = Object.freeze({
  [ATTENTION_STATES.DECISION_REQUIRED]: 'Sponsor or PO must record a decision',
  [ATTENTION_STATES.PROOF_REQUIRED]: 'Acceptance evidence still needed',
  [ATTENTION_STATES.OFF_PLAN]: 'Plan-backed squad is behind agreed sprint delivery',
  [ATTENTION_STATES.CANNOT_VERIFY]: 'Upload this squad’s PI slide to judge plan',
  [ATTENTION_STATES.NO_ACTION]: 'No governance action required',
  [ATTENTION_STATES.COMPLETE]: 'Commitments verified',
});

const DATA_TRUST_LABELS = Object.freeze({
  [DATA_TRUST.PLAN_BACKED]: 'Plan-backed',
  [DATA_TRUST.BOARD_HEALTH_ONLY]: 'Board health only',
  [DATA_TRUST.CANNOT_JUDGE]: 'Cannot judge',
});

const DATA_TRUST_HINTS = Object.freeze({
  [DATA_TRUST.PLAN_BACKED]: 'Plan-backed = this squad’s PI slide is on file',
  [DATA_TRUST.BOARD_HEALTH_ONLY]: 'Sprint signals only — no quarter plan on file',
  [DATA_TRUST.CANNOT_JUDGE]: 'Board or plan data is incomplete',
});

export function governanceStateLabel(state = '') {
  return STATE_LABELS[state] || STATE_LABELS[GOVERNANCE_STATES.CANNOT_VERIFY];
}

export function attentionStateLabel(state = '') {
  return ATTENTION_LABELS[state] || ATTENTION_LABELS[ATTENTION_STATES.NO_ACTION];
}

export function attentionStateHint(state = '') {
  return ATTENTION_HINTS[state] || '';
}

export function dataTrustLabel(trust = '') {
  return DATA_TRUST_LABELS[trust] || DATA_TRUST_LABELS[DATA_TRUST.CANNOT_JUDGE];
}

export function dataTrustHint(trust = '') {
  return DATA_TRUST_HINTS[trust] || '';
}

export function resolveDataTrust({ baselineMissing = false, boardResolved = true } = {}) {
  if (!boardResolved) return DATA_TRUST.CANNOT_JUDGE;
  if (baselineMissing) return DATA_TRUST.BOARD_HEALTH_ONLY;
  return DATA_TRUST.PLAN_BACKED;
}

/**
 * Format the promise count line. When total <= 0, show an honest message
 * about which squads are missing slides, not a blanket "No PI commitments."
 * (Audit 2026-07-15: 'No PI commitments on file' showed even when some
 * squads had data — should only show for squads actually missing slides.)
 */
export function formatPromiseCount({ supported = 0, total = 0, verb = 'lack delivery proof', linked = 0, needAttention = 0 } = {}) {
  const t = Number(total) || 0;
  const s = Number(supported) || 0;
  const l = Number(linked) || 0;
  const n = Number(needAttention) || 0;
  if (t <= 0) return 'No PI commitments on file';
  if (linked > 0 || needAttention > 0) {
    if (n <= 0) return `${l} of ${t} commitments have Jira evidence; confirm delivery outcome`;
    return `${n} of ${t} commitments need evidence action`;
  }
  const gap = Math.max(0, t - s);
  if (gap <= 0) return `All ${t} promise${t === 1 ? '' : 's'} verified`;
  return `${gap} of ${t} promise${t === 1 ? '' : 's'} ${verb}`;
}

/** Single metrics strip for hero + provenance (no conflicting counts). */
export function formatMetricsStrip({ linked = 0, total = 0, needAttention = 0 } = {}) {
  return formatPromiseCount({ linked, total, needAttention, supported: linked });
}

export function formatAlignedCount({ linked = 0, total = 0 } = {}) {
  const t = Number(total) || 0;
  const l = Number(linked) || 0;
  if (t <= 0) return '0 promises';
  return `${l} of ${t} aligned`;
}

/**
 * Map delivery/gap signals to attention. Off-plan / Decision required only when
 * the squad has its own PI baseline (baselineMissing === false).
 */
export function mapVerdictToAttention({
  verdictTier = '',
  gapPrimary = '',
  baselineMissing = false,
  boardResolved = true,
  unsupportedCount = 0,
  openCases = 0,
} = {}) {
  if (!boardResolved) return ATTENTION_STATES.CANNOT_VERIFY;
  // Squads with a resolved board but no PI slide should show BOARD_HEALTH_ONLY
  // (board health signals are available), not CANNOT_VERIFY. Only squads
  // with NO board AND no slide are truly unverifiable.
  // (Audit 2026-07-15: 'Cannot verify' showed for squads with Jira data.)
  if (baselineMissing) {
    if (verdictTier === 'blocked') return ATTENTION_STATES.OFF_PLAN;
    if (verdictTier === 'watch' || unsupportedCount > 0) return ATTENTION_STATES.PROOF_REQUIRED;
    return ATTENTION_STATES.CANNOT_VERIFY;
  }
  if (verdictTier === 'blocked' || gapPrimary === 'delivery') return ATTENTION_STATES.OFF_PLAN;
  if (openCases > 0 || unsupportedCount > 0) return ATTENTION_STATES.DECISION_REQUIRED;
  if (gapPrimary === 'evidence' || verdictTier === 'watch') return ATTENTION_STATES.PROOF_REQUIRED;
  if (verdictTier === 'onTrack') return ATTENTION_STATES.NO_ACTION;
  return ATTENTION_STATES.PROOF_REQUIRED;
}
