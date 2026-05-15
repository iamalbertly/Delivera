/**
 * SSOT: sprint team roster from Jira issue assignees/reporters (for @mention UI).
 */

function addUser(map, user) {
  if (!user || typeof user !== 'object') return;
  const accountId = String(user.accountId || '').trim();
  const displayName = String(user.displayName || user.name || '').trim();
  if (!displayName && !accountId) return;
  const key = accountId || displayName.toLowerCase();
  if (map.has(key)) return;
  map.set(key, {
    accountId,
    displayName,
    emailAddress: String(user.emailAddress || '').trim(),
  });
}

/**
 * @param {Array<object>} issues Raw Jira issues from sprint fetch
 * @returns {Array<{ accountId: string, displayName: string, emailAddress: string }>}
 */
export function collectTeamRosterFromSprintIssues(issues = []) {
  const map = new Map();
  for (const issue of issues) {
    const fields = issue?.fields;
    if (!fields) continue;
    addUser(map, fields.assignee);
    addUser(map, fields.reporter);
    const subtasks = fields.subtasks;
    if (Array.isArray(subtasks)) {
      for (const st of subtasks) {
        addUser(map, st?.fields?.assignee);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}
