import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { cache, CACHE_TTL, CACHE_KEYS } from './cache.js';
import { paginateSprintIssues, buildSprintIssueFields } from './Jira-Reporting-App-Data-Issues-Pagination-Fields.js';
import { buildDrillDownRow } from './Jira-Reporting-App-Data-Issues-DrillDown-Row.js';
import { fetchSubtaskTimeTotals } from './Jira-Reporting-App-Data-Issues-Subtask-Time-Totals.js';
import {
  WORK_ITEM_FILTER_TOKEN,
  DELIVERABLE_WORK_ITEM_FILTER_TOKEN,
  isWorkItemTypeName,
} from './Jira-Reporting-App-Data-IssueType-Classification.js';

export { buildDrillDownRow };

function shouldIncludeIssueType(issueTypeName, allowedIssueTypes = []) {
  const typeName = String(issueTypeName || '').trim();
  if (!typeName) return false;
  const normalizedAllowed = Array.isArray(allowedIssueTypes)
    ? allowedIssueTypes.map((type) => String(type || '').trim()).filter(Boolean)
    : [];
  if (!normalizedAllowed.length) {
    return isWorkItemTypeName(typeName);
  }
  if (normalizedAllowed.includes(WORK_ITEM_FILTER_TOKEN)) {
    return isWorkItemTypeName(typeName, { includeBugs: true });
  }
  if (normalizedAllowed.includes(DELIVERABLE_WORK_ITEM_FILTER_TOKEN)) {
    return isWorkItemTypeName(typeName, { includeBugs: false });
  }
  return normalizedAllowed.includes(typeName);
}

export function buildSprintIssuesCacheKey({
  sprintId,
  selectedProjects,
  requireResolvedBySprintEnd = false,
  sprintEndDate = null,
  allowedIssueTypes = ['Story'],
  includeSubtaskTotals = false,
  fieldIds = null,
} = {}) {
  return CACHE_KEYS.sprintIssues({
    sprintId,
    selectedProjects,
    requireResolvedBySprintEnd,
    sprintEndDate,
    allowedIssueTypes,
    includeSubtaskTotals,
    fieldIds,
  });
}

export async function readCachedSprintIssues(cacheKey) {
  if (!cacheKey) return null;
  const cached = await cache.get(cacheKey, { namespace: 'sprintIssues' });
  return cached?.value || cached || null;
}

export async function fetchSprintIssues(sprintId, agileClient, selectedProjects, requireResolvedBySprintEnd = false, sprintEndDate = null, allowedIssueTypes = ['Story'], fieldIds = null, version3Client = null) {
  const includeSubtaskTotals = !!version3Client;
  const cacheKey = buildSprintIssuesCacheKey({
    sprintId,
    selectedProjects,
    requireResolvedBySprintEnd,
    sprintEndDate,
    allowedIssueTypes,
    includeSubtaskTotals,
    fieldIds,
  });
  const cached = await cache.get(cacheKey, { namespace: 'sprintIssues' });
  if (cached?.value) {
    logger.debug(`Cache hit for sprint issues ${sprintId}`, { cacheKey });
    return cached.value;
  }

  const fields = buildSprintIssueFields(fieldIds);
  const { issues: allIssues } = await paginateSprintIssues(sprintId, agileClient, 'sprint', 100, fields);

  // Filter issues
  const filtered = allIssues.filter(issue => {
    // Filter by project
    if (!selectedProjects.includes(issue.fields?.project?.key)) {
      return false;
    }

    // Filter by type (allow multiple issue types)
    const issueTypeName = issue.fields?.issuetype?.name;
    if (!shouldIncludeIssueType(issueTypeName, allowedIssueTypes)) {
      return false;
    }

    // Filter by status (done)
    if (issue.fields?.status?.statusCategory?.key !== 'done') {
      return false;
    }

    // Optional: filter by resolution date
    if (requireResolvedBySprintEnd && sprintEndDate) {
      const resolutionDate = issue.fields?.resolutiondate;
      if (!resolutionDate) {
        return false;
      }
      const resolutionTime = new Date(resolutionDate).getTime();
      const sprintEndTime = new Date(sprintEndDate).getTime();
      if (resolutionTime > sprintEndTime) {
        return false;
      }
    }

    return true;
  });

  // Log issue type distribution for debugging
  if (filtered.length > 0) {
    const typeCounts = {};
    filtered.forEach(issue => {
      const type = issue.fields?.issuetype?.name || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    logger.debug(`Sprint ${sprintId}: Filtered issues by type`, typeCounts);
  }

  if (includeSubtaskTotals) {
    const parentKeys = filtered
      .filter(issue => Array.isArray(issue.fields?.subtasks) && issue.fields.subtasks.length > 0)
      .map(issue => issue.key);

    if (parentKeys.length > 0) {
      try {
        const subtaskTotals = await fetchSubtaskTimeTotals(parentKeys, version3Client);
        for (const issue of filtered) {
          const totals = subtaskTotals.get(issue.key);
          issue.fields.subtaskTimeTracking = totals || {
            originalEstimateSeconds: 0,
            spentSeconds: 0,
            remainingSeconds: 0,
          };
        }
      } catch (error) {
        logger.warn('Failed to fetch subtask time tracking totals', { error: error.message });
        for (const issue of filtered) {
          issue.fields.subtaskTimeTracking = {
            originalEstimateSeconds: 0,
            spentSeconds: 0,
            remainingSeconds: 0,
          };
        }
      }
    }
  }

  await cache.set(cacheKey, filtered, CACHE_TTL.SPRINT_ISSUES, { namespace: 'sprintIssues' });
  return filtered;
}

/**
 * Fetches all issues in a sprint (done + in-progress) for current-sprint transparency view.
 * Does not filter by status category; used for observed work window and daily completion.
 * @param {number} sprintId - Sprint ID
 * @param {AgileClient} agileClient - Jira Agile client
 * @param {string[]} selectedProjects - Array of project keys to filter by
 * @param {string[]} allowedIssueTypes - Issue types to include (default ['Story', 'Bug'])
 * @param {Object} fieldIds - Field IDs (storyPointsFieldId, epicLinkFieldId, etc.)
 * @returns {Promise<Array>} - Array of issue objects (done and in-progress)
 */
export async function fetchSprintIssuesForTransparency(sprintId, agileClient, selectedProjects, allowedIssueTypes = [WORK_ITEM_FILTER_TOKEN], fieldIds = null) {
  const cacheKey = CACHE_KEYS.sprintIssuesTransparency({ sprintId, selectedProjects, allowedIssueTypes, fieldIds });
  const cached = await cache.get(cacheKey, { namespace: 'sprintIssuesTransparency' });
  if (cached?.value) {
    logger.debug(`Cache hit for sprint transparency issues ${sprintId}`, { cacheKey });
    return cached.value;
  }

  const fields = buildSprintIssueFields(fieldIds);
  const { issues: allIssues } = await paginateSprintIssues(sprintId, agileClient, 'sprint transparency', 100, fields);

  const filtered = allIssues.filter(issue => {
    if (!selectedProjects.includes(issue.fields?.project?.key)) return false;
    const issueTypeName = issue.fields?.issuetype?.name;
    if (!shouldIncludeIssueType(issueTypeName, allowedIssueTypes)) return false;
    return true;
  });

  await cache.set(cacheKey, filtered, CACHE_TTL.SPRINT_ISSUES, { namespace: 'sprintIssuesTransparency' });
  return filtered;
}

/**
 * Fetches bugs for multiple sprints (for rework ratio calculation)
 * @param {Array} sprintIds - Array of sprint IDs
 * @param {AgileClient} agileClient - Jira Agile client
 * @param {string[]} selectedProjects - Array of project keys to filter by
 * @param {number} concurrencyLimit - Maximum concurrent requests (default: 3)
 * @returns {Promise<Array>} - Array of bug issues
 */
export async function fetchBugsForSprints(sprintIds, agileClient, selectedProjects, concurrencyLimit = 3, fieldIds = null) {
  const allBugs = [];
  const fields = buildSprintIssueFields(fieldIds);

  // Process sprints in chunks to limit concurrency
  for (let i = 0; i < sprintIds.length; i += concurrencyLimit) {
    const chunk = sprintIds.slice(i, i + concurrencyLimit);

    const chunkPromises = chunk.map(async (sprintId) => {
      try {
        const cacheKey = CACHE_KEYS.bugIssues({ sprintId, selectedProjects, fieldIds });
        const cached = await cache.get(cacheKey, { namespace: 'bugIssues' });
        if (cached?.value) {
          return cached.value;
        }

        const { issues: allIssues } = await paginateSprintIssues(sprintId, agileClient, 'bugs for sprint', 100, fields);

        // Filter to bugs in selected projects
        const bugs = allIssues.filter(issue => {
          return selectedProjects.includes(issue.fields?.project?.key) &&
                 issue.fields?.issuetype?.name === 'Bug';
        });
        await cache.set(cacheKey, bugs, CACHE_TTL.BUG_ISSUES, { namespace: 'bugIssues' });
        return bugs;
      } catch (error) {
        logger.error(`Error fetching bugs for sprint ${sprintId}`, {
          error: error.message,
          stack: error.stack,
          sprintId,
        });
        return [];
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    allBugs.push(...chunkResults.flat());
  }

  return allBugs;
}

/**
 * Fetches Epic issues directly by their keys
 * @param {string[]} epicKeys - Array of Epic issue keys
 * @param {Version3Client} version3Client - Jira Version3 client
 * @param {number} concurrencyLimit - Maximum concurrent requests (default: 3)
 * @returns {Promise<Array>} - Array of Epic issue objects
 */
export async function fetchEpicIssues(epicKeys, version3Client, concurrencyLimit = 3) {
  if (!epicKeys || epicKeys.length === 0) {
    return [];
  }

  const uniqueEpicKeys = [...new Set(epicKeys.filter(Boolean))];
  const allEpics = [];

  // Process Epic keys in chunks to limit concurrency
  for (let i = 0; i < uniqueEpicKeys.length; i += concurrencyLimit) {
    const chunk = uniqueEpicKeys.slice(i, i + concurrencyLimit);

    const chunkPromises = chunk.map(async (epicKey) => {
      try {
        const cacheKey = CACHE_KEYS.epicIssue(epicKey);
        const cached = await cache.get(cacheKey, { namespace: 'epicIssues' });
        if (cached?.value) {
          return cached.value;
        }
        logger.debug(`Fetching Epic issue ${epicKey}`);
        const epic = await version3Client.issues.getIssue({
          issueIdOrKey: epicKey,
        });
        
        // Verify it's actually an Epic (allow custom Epic type names like "Epic (Feature)")
        const issueTypeName = epic.fields?.issuetype?.name || '';
        const isEpicType = issueTypeName === 'Epic' || issueTypeName.toLowerCase().includes('epic');
        if (isEpicType) {
          await cache.set(cacheKey, epic, CACHE_TTL.EPIC_ISSUES, { namespace: 'epicIssues' });
          return epic;
        } else {
          logger.warn(`Issue ${epicKey} is not an Epic (type: ${issueTypeName})`);
          await cache.set(cacheKey, { __nonEpic: true }, CACHE_TTL.EPIC_ISSUES, { namespace: 'epicIssues' });
          return null;
        }
      } catch (error) {
        // Distinguish between expected (404) and unexpected (500) errors
        if (error.statusCode === 404 || error.message?.toLowerCase().includes('not found')) {
          logger.debug(`Epic ${epicKey} not found, skipping`);
        } else {
          logger.error(`Failed to fetch Epic ${epicKey}: ${error.message}`, {
            error: error.stack,
            epicKey,
            statusCode: error.statusCode
          });
        }
        return null;
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    allEpics.push(...chunkResults.filter(Boolean));
  }

  logger.info(`Fetched ${allEpics.length} Epic issues out of ${uniqueEpicKeys.length} requested`);
  return allEpics;
}
