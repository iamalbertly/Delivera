export function buildJiraIssueUrl(host, issueKey) {
  const normalizedHost = String(host || '').trim().replace(/\/+$/, '');
  const normalizedKey = String(issueKey || '').trim();
  if (!normalizedHost || !normalizedKey) return '';
  return `${normalizedHost}/browse/${normalizedKey}`;
}

/**
 * Server-side HTML escaper — kept in sync with public/Delivera-Shared-Dom-Escape-Helpers.js.
 * Single quote escaped for attribute safety. Do not diverge.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
