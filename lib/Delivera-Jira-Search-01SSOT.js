/**
 * SSOT: Jira issue search — 410-safe (enhanced JQL POST) with GET-by-key fallback.
 * Legacy searchForIssuesUsingJql returns 410 on many Cloud tenants; use enhanced search first.
 */
import { logger } from './Delivera-Server-Logging-Utility.js';

function isGoneError(err) {
  const status = err?.response?.status || err?.statusCode || err?.status;
  return status === 410 || String(err?.message || '').includes('410');
}

function normalizeIssues(res = {}) {
  return Array.isArray(res?.issues) ? res.issues : [];
}

/**
 * @param {import('jira.js').Version3Client} version3Client
 */
export async function searchIssuesJql(version3Client, {
  jql = '',
  maxResults = 50,
  startAt = 0,
  fields = ['summary', 'status'],
} = {}) {
  const trimmed = String(jql || '').trim();
  if (!version3Client || !trimmed) return { issues: [], method: 'none', total: 0 };

  const params = { jql: trimmed, maxResults, fields };
  if (startAt > 0) params.startAt = startAt;

  try {
    const res = await version3Client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost(params);
    return { issues: normalizeIssues(res), method: 'enhanced-post', total: res?.total };
  } catch (err) {
    if (!isGoneError(err)) {
      logger.warn('Jira enhanced search failed', { jql: trimmed.slice(0, 80), error: err?.message });
    }
  }

  try {
    const res = await version3Client.issueSearch.searchForIssuesUsingJqlPost(params);
    return { issues: normalizeIssues(res), method: 'legacy-post', total: res?.total };
  } catch (err) {
    if (!isGoneError(err)) {
      logger.warn('Jira legacy POST search failed', { jql: trimmed.slice(0, 80), error: err?.message });
    }
  }

  return { issues: [], method: 'failed', total: 0 };
}

/**
 * @param {import('jira.js').Version3Client} version3Client
 */
export async function getIssueByKey(version3Client, issueKey, fields = ['summary', 'status']) {
  const key = String(issueKey || '').trim().toUpperCase();
  if (!version3Client || !key) return null;
  try {
    return await version3Client.issues.getIssue({ issueIdOrKey: key, fields });
  } catch (_) {
    return null;
  }
}

/**
 * Summary text search within a project (no issuetype=Epic — broken on enhanced API for some tenants).
 */
export async function searchProjectBySummary(version3Client, projectKey, phrase, options = {}) {
  const pk = String(projectKey || '').trim().toUpperCase();
  const escaped = String(phrase || '').replace(/["\\]/g, '\\$&').slice(0, 60);
  if (!pk || escaped.length < 2) return [];
  const jql = `project = ${pk} AND summary ~ "${escaped}" ORDER BY updated DESC`;
  const { issues } = await searchIssuesJql(version3Client, {
    jql,
    maxResults: options.maxResults || 12,
    fields: options.fields || ['summary', 'status', 'issuetype'],
  });
  return issues;
}
