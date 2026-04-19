/**
 * Subtask time-tracking totals per parent issue (JQL search).
 * SSOT for fetchSubtaskTimeTotals. Used by lib/issues.js.
 */

import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { cache, CACHE_TTL, CACHE_KEYS } from './cache.js';
import { extractTimeTrackingSeconds } from './Jira-Reporting-App-Data-Issues-DrillDown-Row.js';

/**
 * Fetches subtask time totals (estimate/spent/remaining) per parent issue key
 * @param {string[]} parentKeys - Parent issue keys
 * @param {Object} version3Client - Jira Version3 client
 * @returns {Promise<Map<string, { originalEstimateSeconds, spentSeconds, remainingSeconds }>>}
 */
export async function fetchSubtaskTimeTotals(parentKeys, version3Client) {
  if (!version3Client || !parentKeys || parentKeys.length === 0) {
    return new Map();
  }

  const subtaskSupportFlag = await cache.get(CACHE_KEYS.subtaskTotalsUnsupportedFlag(), { namespace: 'subtaskTotals' });
  if (subtaskSupportFlag?.value) {
    return new Map();
  }

  const uniqueParents = [...new Set(parentKeys.filter(Boolean))];
  const totalsByParent = new Map();
  const pendingParents = [];

  for (const parentKey of uniqueParents) {
    const cached = await cache.get(CACHE_KEYS.subtaskTotalsByParent(parentKey), { namespace: 'subtaskTotals' });
    if (cached?.value) {
      totalsByParent.set(parentKey, cached.value);
    } else {
      pendingParents.push(parentKey);
    }
  }

  if (pendingParents.length === 0) {
    return totalsByParent;
  }

  const fields = [
    'parent',
    'timetracking',
    'timeoriginalestimate',
    'timespent',
    'timeestimate',
    'aggregatetimeoriginalestimate',
    'aggregatetimespent',
    'aggregatetimeestimate',
  ];

  const chunkSize = 30;
  for (let i = 0; i < pendingParents.length; i += chunkSize) {
    const chunk = pendingParents.slice(i, i + chunkSize);
    const jql = `parent in (${chunk.join(',')})`;
    let startAt = 0;
    const maxResults = 100;
    let total = null;

    do {
      let response = null;
      try {
        response = await version3Client.issueSearch.searchForIssuesUsingJqlPost({
          jql,
          startAt,
          maxResults,
          fields,
        });
      } catch (error) {
        const status = error?.response?.status;
        const message = error?.message || '';
        if (status === 410 || message.includes('410')) {
          logger.warn('Subtask time tracking endpoint not available, disabling subtasks time totals for this run', {
            error: message,
          });
          await cache.set(CACHE_KEYS.subtaskTotalsUnsupportedFlag(), true, CACHE_TTL.SPRINT_ISSUES, { namespace: 'subtaskTotals' });
          return new Map();
        }
        throw error;
      }

      const issues = response?.issues || [];
      if (total === null && typeof response?.total === 'number') {
        total = response.total;
      }

      for (const issue of issues) {
        const parentKey = issue.fields?.parent?.key;
        if (!parentKey) continue;
        const tracking = extractTimeTrackingSeconds(issue);
        const current = totalsByParent.get(parentKey) || {
          originalEstimateSeconds: 0,
          spentSeconds: 0,
          remainingSeconds: 0,
        };
        if (tracking.original != null) current.originalEstimateSeconds += Number(tracking.original) || 0;
        if (tracking.spent != null) current.spentSeconds += Number(tracking.spent) || 0;
        if (tracking.remaining != null) current.remainingSeconds += Number(tracking.remaining) || 0;
        totalsByParent.set(parentKey, current);
      }

      startAt += maxResults;
    } while (total !== null && startAt < total);
  }

  for (const parentKey of pendingParents) {
    const value = totalsByParent.get(parentKey) || {
      originalEstimateSeconds: 0,
      spentSeconds: 0,
      remainingSeconds: 0,
    };
    await cache.set(CACHE_KEYS.subtaskTotalsByParent(parentKey), value, CACHE_TTL.SUBTASK_ISSUES, { namespace: 'subtaskTotals' });
    totalsByParent.set(parentKey, value);
  }

  return totalsByParent;
}
