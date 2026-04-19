/**
 * Sprint issues pagination and field list for Jira API.
 * SSOT for paginateSprintIssues and buildSprintIssueFields. Used by lib/issues.js.
 */

import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { paginateJira } from './JiraReporting-Data-JiraAPI-Pagination-Helper.js';

/**
 * Shared pagination helper for fetching sprint issues
 * @param {number} sprintId - Sprint ID
 * @param {AgileClient} agileClient - Jira Agile client
 * @param {string} logPrefix - Prefix for log messages (e.g. "sprint" or "bugs for sprint")
 * @param {number} maxPages - Maximum number of pages to fetch (default: 100)
 * @param {string[]|null} fields - Optional field list
 * @returns {Promise<{issues: Array, pageCount: number, reachedMaxPages: boolean}>}
 */
export async function paginateSprintIssues(sprintId, agileClient, logPrefix = 'sprint', maxPages = 100, fields = null) {
  let result;
  try {
    result = await paginateJira((startAt, maxResults) => {
      logger.debug(`Fetching ${logPrefix} ${sprintId} issues (startAt: ${startAt})`);
      return agileClient.sprint.getIssuesForSprint({
        sprintId,
        startAt,
        maxResults,
        ...(fields ? { fields } : {}),
      });
    }, { maxPages });
  } catch (error) {
    logger.error(`Error fetching ${logPrefix} ${sprintId} issues`, {
      error: error.message,
      sprintId,
    });
    throw new Error(`Failed to fetch ${logPrefix} ${sprintId} issues: ${error.message}`);
  }

  const allIssues = result.items;
  const pageCount = Math.ceil(allIssues.length / 50);
  if (result.stoppedByMaxPages) {
    logger.warn(`${logPrefix.charAt(0).toUpperCase() + logPrefix.slice(1)} ${sprintId}: Reached maximum page limit (${maxPages}), stopping pagination`, {
      totalIssues: allIssues.length,
    });
  }
  logger.info(`${logPrefix.charAt(0).toUpperCase() + logPrefix.slice(1)} ${sprintId}: Completed fetching issues`, {
    totalIssues: allIssues.length,
    pagesFetched: pageCount,
  });
  return { issues: allIssues, pageCount, reachedMaxPages: result.stoppedByMaxPages };
}

/**
 * Build list of field IDs/names for sprint issue requests
 * @param {Object|null} fieldIds - { storyPointsFieldId, epicLinkFieldId, ebmFieldIds }
 * @returns {string[]}
 */
export function buildSprintIssueFields(fieldIds) {
  const coreFields = [
    'summary',
    'status',
    'statuscategorychangedate',
    'issuetype',
    'assignee',
    'created',
    'updated',
    'resolutiondate',
    'project',
    'parent',
    'subtasks',
    'labels',
    'components',
    'fixVersions',
    'priority',
    'reporter',
    'timetracking',
    'timeoriginalestimate',
    'timespent',
    'timeestimate',
    'aggregatetimeoriginalestimate',
    'aggregatetimespent',
    'aggregatetimeestimate',
  ];

  if (fieldIds?.storyPointsFieldId) {
    coreFields.push(fieldIds.storyPointsFieldId);
  }
  if (fieldIds?.epicLinkFieldId) {
    coreFields.push(fieldIds.epicLinkFieldId);
  }
  if (fieldIds?.ebmFieldIds) {
    Object.values(fieldIds.ebmFieldIds).forEach(fieldId => {
      if (fieldId) {
        coreFields.push(fieldId);
      }
    });
  }

  return coreFields;
}
