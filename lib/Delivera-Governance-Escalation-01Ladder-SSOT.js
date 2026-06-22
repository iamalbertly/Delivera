export const ESCALATION_LEVELS = Object.freeze([
  { level: 1, key: 'reminder', afterHours: 2, audience: 'current action owner' },
  { level: 2, key: 'coordination', afterHours: 8, audience: 'Scrum Master / Tech Lead' },
  { level: 3, key: 'decision', afterHours: 24, audience: 'Product Owner / Business Owner' },
  { level: 4, key: 'leadership', afterHours: 48, audience: 'PI Lead / HOD' },
]);

export function resolveEscalationLevel({ dueAt = '', now = new Date(), exposesOutcome = false } = {}) {
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) {
    return { ...ESCALATION_LEVELS[0], confidence: 'limited', reason: 'target date missing' };
  }
  const overdueHours = Math.max(0, (now.getTime() - due) / 3600000);
  let selected = ESCALATION_LEVELS[0];
  for (const level of ESCALATION_LEVELS) {
    if (overdueHours >= level.afterHours) selected = level;
  }
  if (exposesOutcome && selected.level < 3) selected = ESCALATION_LEVELS[2];
  return { ...selected, overdueHours: Math.round(overdueHours), confidence: 'bounded' };
}

export function buildEscalationDraft({ caseRow = {}, action = {}, level = null } = {}) {
  const resolved = level || resolveEscalationLevel({ dueAt: action.dueAt });
  const issuePart = (caseRow.issueKeys || []).join(', ') || 'the affected work';
  return {
    level: resolved.level,
    key: resolved.key,
    audience: resolved.audience,
    approvalRequired: true,
    text: [
      `Escalation ${resolved.level}: ${caseRow.title || 'Delivery intervention'} requires follow-through.`,
      `Affected work: ${issuePart}.`,
      `Open action: ${action.action || 'Confirm decision or unblock the work'}.`,
      `Evidence only: ${caseRow.facts?.slice(0, 3).map((f) => f.value || f.label).join('; ') || 'facts are attached in Delivera'}.`,
      'Please confirm the decision owner and next action.',
    ].join('\n'),
  };
}

