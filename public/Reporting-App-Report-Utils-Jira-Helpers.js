function normalizeJiraHost(host) {
  if (!host) return '';
  const trimmed = String(host).trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function getResolvedJiraHostFromMeta(meta) {
  return normalizeJiraHost(
    (meta && (meta.jiraHostResolved || meta.jiraHost || meta.host)) || ''
  );
}

export function hasResolvedJiraHost(meta) {
  return getResolvedJiraHostFromMeta(meta) !== '';
}

export function getJiraLinkAvailability(meta) {
  const host = getResolvedJiraHostFromMeta(meta);
  const fromCache = !!meta?.fromCache;
  const mismatch = !!meta?.jiraHostMismatch;
  return {
    enabled: host !== '',
    host,
    fromCache,
    mismatch,
  };
}

export function buildJiraIssueUrl(host, issueKey) {
  if (!host || !issueKey) return '';
  return `${normalizeJiraHost(host)}/browse/${issueKey}`;
}

/** Returns true if the key looks like a real Jira issue key (e.g. PROJECT-123), not a synthetic label like AD-HOC or *-ad-hoc. */
export function isJiraIssueKey(key) {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  if (k === 'AD-HOC' || k.endsWith('-ad-hoc')) return false;
  return /^[A-Z][A-Z0-9]*-\d+$/i.test(k);
}

export function getEpicStoryItems(epic, rows) {
  if (Array.isArray(epic.storyItems) && epic.storyItems.length > 0) {
    return epic.storyItems;
  }
  const previewItems = Array.isArray(rows) ? rows.filter(row => row.epicKey === epic.epicKey) : [];
  if (!previewItems.length) return [];
  const mapped = previewItems
    .map(row => ({
      key: row.issueKey,
      summary: row.issueSummary,
      type: row.issueType,
      status: row.issueStatus,
      storyPoints: row.storyPoints,
      created: row.created,
      resolved: row.resolutionDate,
      subtaskTimeSpentHours: row.subtaskTimeSpentHours,
    }))
    .filter(item => item.key);
  return mapped;
}
