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

const STATE_LABELS = Object.freeze({
  [GOVERNANCE_STATES.VERIFIED]: 'Verified',
  [GOVERNANCE_STATES.PARTIALLY_SUPPORTED]: 'Partially supported',
  [GOVERNANCE_STATES.UNSUPPORTED]: 'Unsupported',
  [GOVERNANCE_STATES.EXTRACTION_UNCERTAIN]: 'Extraction uncertain',
  [GOVERNANCE_STATES.DONE_UNPROVEN]: 'Work marked Done · acceptance unproven',
  [GOVERNANCE_STATES.CANNOT_VERIFY]: 'Cannot verify',
  [GOVERNANCE_STATES.EVIDENCE_STALE]: 'Evidence stale',
});

const ATTENTION_LABELS = Object.freeze({
  [ATTENTION_STATES.DECISION_REQUIRED]: 'Decision required',
  [ATTENTION_STATES.PROOF_REQUIRED]: 'Proof required',
  [ATTENTION_STATES.OFF_PLAN]: 'Off-plan',
  [ATTENTION_STATES.CANNOT_VERIFY]: 'Cannot verify',
  [ATTENTION_STATES.NO_ACTION]: 'No action',
  [ATTENTION_STATES.COMPLETE]: 'Complete',
});

export function governanceStateLabel(state = '') {
  return STATE_LABELS[state] || STATE_LABELS[GOVERNANCE_STATES.CANNOT_VERIFY];
}

export function attentionStateLabel(state = '') {
  return ATTENTION_LABELS[state] || ATTENTION_LABELS[ATTENTION_STATES.NO_ACTION];
}

export function formatPromiseCount({ supported = 0, total = 0, verb = 'lack delivery proof' } = {}) {
  const t = Number(total) || 0;
  const s = Number(supported) || 0;
  const gap = Math.max(0, t - s);
  if (t <= 0) return 'No promises mapped';
  if (gap <= 0) return `All ${t} promise${t === 1 ? '' : 's'} verified`;
  return `${gap} of ${t} promise${t === 1 ? '' : 's'} ${verb}`;
}

export function formatAlignedCount({ linked = 0, total = 0 } = {}) {
  const t = Number(total) || 0;
  const l = Number(linked) || 0;
  if (t <= 0) return '0 promises';
  return `${l} of ${t} aligned`;
}

export function mapVerdictToAttention({ verdictTier = '', gapPrimary = '', baselineMissing = false, boardResolved = true, unsupportedCount = 0, openCases = 0 } = {}) {
  if (!boardResolved || baselineMissing) return ATTENTION_STATES.CANNOT_VERIFY;
  if (verdictTier === 'blocked' || gapPrimary === 'delivery') return ATTENTION_STATES.OFF_PLAN;
  if (openCases > 0 || unsupportedCount > 0) return ATTENTION_STATES.DECISION_REQUIRED;
  if (gapPrimary === 'evidence' || verdictTier === 'watch') return ATTENTION_STATES.PROOF_REQUIRED;
  if (verdictTier === 'onTrack') return ATTENTION_STATES.NO_ACTION;
  return ATTENTION_STATES.PROOF_REQUIRED;
}
