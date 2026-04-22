export function buildJiraIssueUrl(host, issueKey) {
  const normalizedHost = String(host || '').trim().replace(/\/+$/, '');
  const normalizedKey = String(issueKey || '').trim();
  if (!normalizedHost || !normalizedKey) return '';
  return `${normalizedHost}/browse/${normalizedKey}`;
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
