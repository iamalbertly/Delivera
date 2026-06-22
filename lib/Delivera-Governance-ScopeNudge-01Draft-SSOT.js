import { riskTypeLabel } from './Delivera-Governance-Grammar-01Rules-SSOT.js';

export const SCOPE_DECISIONS = Object.freeze(['keep-in-pi', 'move-to-support', 'remove-from-pi', 'needs-discussion']);

export function isScopeConfirmationTrigger(risk = {}) {
  const type = String(risk.riskType || '').toLowerCase();
  const text = `${risk.summary || ''} ${risk.evidence || ''} ${risk.recommendedAction || ''}`.toLowerCase();
  return type === 'late-scope'
    || type === 'po-decision-needed'
    || /\b(scope|pi|baseline|quarter|commitment|acceptance|priority)\b/.test(text);
}

export function buildScopeNudgeDraft({ caseRow = {}, risk = {}, role = {} } = {}) {
  const issueKey = risk.issueKey || caseRow.issueKeys?.[0] || 'this item';
  const roleName = role.displayName || role.role || 'Product Owner';
  const action = risk.recommendedAction || 'confirm whether this work remains in the committed scope, moves to support, or needs discussion.';
  const simple = `Please confirm scope for ${issueKey}: keep in PI, move to support, remove from PI, or discuss today.`;
  return {
    issueKey,
    recipient: roleName,
    safeToSend: Boolean(role.displayName || role.accountId),
    approvalRequired: true,
    reason: riskTypeLabel(risk.riskType),
    text: [
      `Hi ${roleName}, Delivera detected a scope decision needed on ${issueKey}.`,
      `Observed risk: ${risk.summary || risk.displayTitle || risk.evidence || 'scope or priority is unclear'}.`,
      `Requested decision: ${action}`,
      `Please reply with one option: keep-in-pi, move-to-support, remove-from-pi, or needs-discussion.`,
    ].join('\n'),
    simple,
    swahiliLabel: `Tafadhali thibitisha upeo wa ${issueKey}`,
    buttons: SCOPE_DECISIONS,
  };
}

export function buildGovernanceNudgeDraft({ caseRow = {}, risk = {}, role = {} } = {}) {
  if (isScopeConfirmationTrigger(risk)) {
    return buildScopeNudgeDraft({ caseRow, risk, role });
  }
  const issueKey = risk.issueKey || caseRow.issueKeys?.[0] || 'this item';
  const roleName = role.displayName || role.role || risk.decisionNeededFrom || 'delivery owner';
  const action = risk.recommendedAction || risk.action || 'confirm the owner, blocker state and next delivery action.';
  return {
    issueKey,
    recipient: roleName,
    safeToSend: Boolean(role.displayName || role.accountId),
    approvalRequired: true,
    reason: riskTypeLabel(risk.riskType),
    text: [
      `Hi ${roleName}, Delivera detected a delivery decision needed on ${issueKey}.`,
      `Observed risk: ${risk.summary || risk.displayTitle || risk.evidence || 'the work needs confirmation'}.`,
      `Requested action: ${action}`,
      'Please reply with one option: confirmed, partly-confirmed, or needs-correction.',
    ].join('\n'),
    simple: `Please confirm ${issueKey}: owner, blocker state, and next action.`,
    swahiliLabel: `Tafadhali thibitisha hatua inayofuata ya ${issueKey}`,
    buttons: ['confirmed', 'partly-confirmed', 'needs-correction'],
  };
}
