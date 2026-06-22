import { createHash } from 'crypto';

export const INTERVENTION_STATES = Object.freeze({
  DETECTED: 'detected',
  EVIDENCE_CHECKED: 'evidence-checked',
  CLARIFICATION_REQUIRED: 'clarification-required',
  CLARIFICATION_SENT: 'clarification-sent',
  RESPONSE_RECEIVED: 'response-received',
  DECISION_REQUIRED: 'decision-required',
  DECISION_APPROVED: 'decision-approved',
  ACTION_RUNNING: 'action-running',
  CHECKPOINT_REACHED: 'checkpoint-reached',
  VERIFIED: 'verified',
  CLOSED: 'closed',
  ESCALATION_REQUIRED: 'escalation-required',
  FALSE_POSITIVE: 'false-positive',
  EXPIRED: 'expired',
});

export const OPEN_INTERVENTION_STATES = new Set([
  INTERVENTION_STATES.DETECTED,
  INTERVENTION_STATES.EVIDENCE_CHECKED,
  INTERVENTION_STATES.CLARIFICATION_REQUIRED,
  INTERVENTION_STATES.CLARIFICATION_SENT,
  INTERVENTION_STATES.RESPONSE_RECEIVED,
  INTERVENTION_STATES.DECISION_REQUIRED,
  INTERVENTION_STATES.DECISION_APPROVED,
  INTERVENTION_STATES.ACTION_RUNNING,
  INTERVENTION_STATES.CHECKPOINT_REACHED,
  INTERVENTION_STATES.ESCALATION_REQUIRED,
]);

const TRANSITIONS = Object.freeze({
  [INTERVENTION_STATES.DETECTED]: [
    INTERVENTION_STATES.EVIDENCE_CHECKED,
    INTERVENTION_STATES.FALSE_POSITIVE,
    INTERVENTION_STATES.EXPIRED,
  ],
  [INTERVENTION_STATES.EVIDENCE_CHECKED]: [
    INTERVENTION_STATES.CLARIFICATION_REQUIRED,
    INTERVENTION_STATES.DECISION_REQUIRED,
    INTERVENTION_STATES.VERIFIED,
    INTERVENTION_STATES.FALSE_POSITIVE,
  ],
  [INTERVENTION_STATES.CLARIFICATION_REQUIRED]: [
    INTERVENTION_STATES.CLARIFICATION_SENT,
    INTERVENTION_STATES.ESCALATION_REQUIRED,
    INTERVENTION_STATES.FALSE_POSITIVE,
  ],
  [INTERVENTION_STATES.CLARIFICATION_SENT]: [
    INTERVENTION_STATES.RESPONSE_RECEIVED,
    INTERVENTION_STATES.ESCALATION_REQUIRED,
    INTERVENTION_STATES.FALSE_POSITIVE,
    INTERVENTION_STATES.EXPIRED,
  ],
  [INTERVENTION_STATES.RESPONSE_RECEIVED]: [
    INTERVENTION_STATES.DECISION_REQUIRED,
    INTERVENTION_STATES.DECISION_APPROVED,
    INTERVENTION_STATES.FALSE_POSITIVE,
  ],
  [INTERVENTION_STATES.DECISION_REQUIRED]: [
    INTERVENTION_STATES.DECISION_APPROVED,
    INTERVENTION_STATES.ESCALATION_REQUIRED,
    INTERVENTION_STATES.FALSE_POSITIVE,
    INTERVENTION_STATES.EXPIRED,
  ],
  [INTERVENTION_STATES.DECISION_APPROVED]: [INTERVENTION_STATES.ACTION_RUNNING, INTERVENTION_STATES.FALSE_POSITIVE],
  [INTERVENTION_STATES.ACTION_RUNNING]: [
    INTERVENTION_STATES.CHECKPOINT_REACHED,
    INTERVENTION_STATES.ESCALATION_REQUIRED,
    INTERVENTION_STATES.FALSE_POSITIVE,
  ],
  [INTERVENTION_STATES.CHECKPOINT_REACHED]: [
    INTERVENTION_STATES.VERIFIED,
    INTERVENTION_STATES.ESCALATION_REQUIRED,
    INTERVENTION_STATES.FALSE_POSITIVE,
  ],
  [INTERVENTION_STATES.VERIFIED]: [INTERVENTION_STATES.CLOSED],
  [INTERVENTION_STATES.ESCALATION_REQUIRED]: [
    INTERVENTION_STATES.DECISION_APPROVED,
    INTERVENTION_STATES.ACTION_RUNNING,
    INTERVENTION_STATES.CLOSED,
  ],
  [INTERVENTION_STATES.FALSE_POSITIVE]: [INTERVENTION_STATES.CLOSED],
  [INTERVENTION_STATES.EXPIRED]: [INTERVENTION_STATES.CLOSED],
  [INTERVENTION_STATES.CLOSED]: [],
});

export function normalizeProjectKey(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24) || 'PORTFOLIO';
}

export function normalizePeriodKey(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32) || 'CURRENT';
}

export function normalizeIssueKeys(issueKeys = []) {
  return Array.from(new Set((Array.isArray(issueKeys) ? issueKeys : [])
    .map((key) => String(key || '').trim().toUpperCase())
    .filter((key) => /^[A-Z][A-Z0-9]+-\d+$/.test(key))))
    .sort();
}

export function interventionFingerprint({ project = '', periodKey = '', triggerType = '', issueKeys = [] } = {}) {
  const payload = {
    project: normalizeProjectKey(project),
    periodKey: normalizePeriodKey(periodKey),
    triggerType: String(triggerType || 'delivery-risk').trim().toLowerCase().slice(0, 80),
    issueKeys: normalizeIssueKeys(issueKeys),
  };
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  return `${payload.project}:${payload.periodKey}:${payload.triggerType}:${hash}`;
}

export function canTransitionInterventionCase(fromState, toState) {
  const from = String(fromState || INTERVENTION_STATES.DETECTED);
  const to = String(toState || '');
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertInterventionTransition(fromState, toState) {
  if (!canTransitionInterventionCase(fromState, toState)) {
    const error = new Error(`Illegal intervention transition: ${fromState} -> ${toState}`);
    error.code = 'INTERVENTION_ILLEGAL_TRANSITION';
    throw error;
  }
}

export function buildInterventionCaseId({ project = '', periodKey = '', seq = 1, now = new Date() } = {}) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${normalizeProjectKey(project)}-${normalizePeriodKey(periodKey)}-${date}-${String(seq).padStart(2, '0')}`;
}

export function normalizeInterventionCase(input = {}, { seq = 1, now = new Date() } = {}) {
  const project = normalizeProjectKey(input.project || input.projectKey);
  const periodKey = normalizePeriodKey(input.periodKey || input.quarter || input.period);
  const issueKeys = normalizeIssueKeys(input.issueKeys || input.triggerIssueKeys || [input.issueKey].filter(Boolean));
  const triggerType = String(input.triggerType || input.riskType || 'delivery-risk').trim().toLowerCase();
  const fingerprint = input.fingerprint || interventionFingerprint({ project, periodKey, triggerType, issueKeys });
  const createdAt = input.createdAt || now.toISOString();
  return {
    id: input.id || buildInterventionCaseId({ project, periodKey, seq, now }),
    fingerprint,
    project,
    periodKey,
    title: String(input.title || `${project} needs a decision`).trim().slice(0, 180),
    state: input.state || INTERVENTION_STATES.DETECTED,
    triggerType,
    trigger: input.trigger || {},
    facts: Array.isArray(input.facts) ? input.facts : [],
    unknowns: Array.isArray(input.unknowns) ? input.unknowns : [],
    diagnosis: input.diagnosis || {},
    decisionOwners: Array.isArray(input.decisionOwners) ? input.decisionOwners : [],
    recoveryOptions: Array.isArray(input.recoveryOptions) ? input.recoveryOptions : [],
    actions: Array.isArray(input.actions) ? input.actions : [],
    checkpoints: Array.isArray(input.checkpoints) ? input.checkpoints : [],
    verification: input.verification || { status: 'not-checked', evidence: [] },
    history: Array.isArray(input.history) ? input.history : [{ at: createdAt, event: 'case-detected', state: input.state || INTERVENTION_STATES.DETECTED }],
    sourceSystemRefs: Array.isArray(input.sourceSystemRefs) ? input.sourceSystemRefs : [],
    issueKeys,
    createdAt,
    updatedAt: input.updatedAt || createdAt,
  };
}

export function isOpenInterventionCase(caseRow = {}) {
  return OPEN_INTERVENTION_STATES.has(String(caseRow.state || ''));
}

export function compactCaseForUi(caseRow = {}) {
  const primaryAction = caseRow.actions?.find((a) => a.status !== 'done') || caseRow.actions?.[0] || null;
  return {
    id: caseRow.id,
    project: caseRow.project,
    periodKey: caseRow.periodKey,
    title: caseRow.title,
    state: caseRow.state,
    triggerType: caseRow.triggerType,
    issueKeys: caseRow.issueKeys || [],
    factCount: caseRow.facts?.length || 0,
    unknownCount: caseRow.unknowns?.length || 0,
    decisionOwner: caseRow.decisionOwners?.[0] || null,
    primaryAction,
    needsApproval: Boolean(primaryAction?.approvalRequired),
    updatedAt: caseRow.updatedAt,
  };
}
