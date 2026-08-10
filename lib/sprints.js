import { cache, CACHE_TTL, CACHE_KEYS } from './cache.js';
import { logger } from './Delivera-Server-Logging-Utility.js';
import { paginateJira } from './Delivera-Data-JiraAPI-Pagination-Helper.js';
import {
  isSprintCapableBoard,
  nonSprintBoardCacheKey,
  NON_SPRINT_BOARD_TTL_MS,
  NON_SPRINT_BOARD_ERROR_TTL_MS,
} from './Delivera-Data-Board-Sprint-Capability-01SSOT.js';

/**
 * Fetches all sprints for a board with pagination.
 * Skips known non-sprint boards (kanban) and negative-caches 400 responses.
 * @param {number} boardId - Board ID
 * @param {AgileClient} agileClient - Jira Agile client
 * @param {{ board?: object }} [options]
 * @returns {Promise<Array>} - Array of sprint objects
 */
export async function fetchSprintsForBoard(boardId, agileClient, options = {}) {
  const board = options.board || null;
  const boardType = String(board?.type || '').toLowerCase();
  const projectKey = board?.location?.projectKey || null;

  if (board && !isSprintCapableBoard(board)) {
    logger.debug(`Skipping sprint fetch for non-scrum board ${boardId}`, { boardId, boardType, projectKey });
    await cache.set(nonSprintBoardCacheKey(boardId), { reason: 'non-scrum', boardType }, NON_SPRINT_BOARD_TTL_MS, { namespace: 'boards' });
    return [];
  }

  const negative = await cache.get(nonSprintBoardCacheKey(boardId), { namespace: 'boards' });
  if (negative?.value || negative) {
    logger.debug(`Skipping sprint fetch for negatively-cached board ${boardId}`, { boardId });
    return [];
  }

  const cacheKey = CACHE_KEYS.sprintsByBoard(boardId);
  const cached = await cache.get(cacheKey, { namespace: 'sprints' });
  const cachedSprints = cached?.value || cached;

  if (Array.isArray(cachedSprints) && cachedSprints.length > 0) {
    return cachedSprints;
  }

  let allSprints;
  let stoppedByMaxPages = false;
  try {
    const result = await paginateJira((startAt, maxResults) => {
      logger.debug(`Fetching sprints for board ${boardId} (startAt: ${startAt})`);
      return agileClient.board.getAllSprints({ boardId, startAt, maxResults }).then((r) => {
        if (Array.isArray(r)) return { values: r, isLast: true };
        return r;
      });
    }, { maxPages: 100 });
    allSprints = result.items;
    stoppedByMaxPages = result.stoppedByMaxPages;
  } catch (error) {
    const msg = String(error?.message || '');
    const is400 = /status code\s*400|\b400\b/i.test(msg);
    if (is400) {
      logger.warn(`Sprint API rejected board ${boardId} (likely non-scrum)`, {
        boardId,
        boardType: boardType || 'unknown',
        projectKey,
        error: msg,
      });
      await cache.set(
        nonSprintBoardCacheKey(boardId),
        { reason: 'jira-400', boardType: boardType || 'unknown' },
        boardType && boardType !== 'scrum' ? NON_SPRINT_BOARD_TTL_MS : NON_SPRINT_BOARD_ERROR_TTL_MS,
        { namespace: 'boards' },
      );
      return [];
    }
    logger.warn(`Failed to fetch sprints for board ${boardId}`, {
      error: msg,
      boardId,
      boardType: boardType || 'unknown',
      projectKey,
    });
    throw new Error(`Failed to fetch sprints for board ${boardId}: ${msg}`);
  }

  if (allSprints.length > 0) {
    logger.debug(`Board ${boardId}: fetched ${allSprints.length} sprints`);
  }
  const pageCount = Math.ceil(allSprints.length / 50);
  if (stoppedByMaxPages) {
    logger.warn(`Board ${boardId}: Reached maximum page limit (100) when fetching sprints`, {
      totalSprints: allSprints.length,
    });
  }

  logger.info(`Board ${boardId}: Completed fetching sprints`, {
    totalSprints: allSprints.length,
    pagesFetched: pageCount,
  });

  await cache.set(cacheKey, allSprints, CACHE_TTL.SPRINTS, { namespace: 'sprints' });
  return allSprints;
}

/**
 * Filters sprints by date window overlap and validates dates
 * @param {Array} sprints - Array of sprint objects
 * @param {string} windowStart - ISO date string (UTC)
 * @param {string} windowEnd - ISO date string (UTC)
 * @param {boolean} includeActiveOrMissingEndDate - If true, use completeDate as endDate fallback
 * @returns {Object} - {included: Array, unusable: Array}
 */
export function filterSprintsByOverlap(sprints, windowStart, windowEnd, includeActiveOrMissingEndDate = false) {
  const windowStartTime = new Date(windowStart).getTime();
  const windowEndTime = new Date(windowEnd).getTime();

  const included = [];
  const unusable = [];

  for (const sprint of sprints) {
    const startDate = sprint.startDate ? new Date(sprint.startDate).getTime() : null;
    let endDate = sprint.endDate ? new Date(sprint.endDate).getTime() : null;

    // Handle missing startDate
    if (!startDate) {
      unusable.push({
        ...sprint,
        reason: 'Missing startDate',
      });
      continue;
    }

    // Handle missing endDate
    if (!endDate) {
      if (includeActiveOrMissingEndDate && sprint.completeDate) {
        endDate = new Date(sprint.completeDate).getTime();
      } else {
        unusable.push({
          ...sprint,
          reason: 'Missing endDate',
        });
        continue;
      }
    }

    // Check overlap: sprintStart <= windowEnd AND sprintEnd >= windowStart
    const overlaps = startDate <= windowEndTime && endDate >= windowStartTime;

    if (overlaps) {
      included.push(sprint);
    }
  }

  return { included, unusable };
}

/**
 * Returns the active sprint for a board, or null if none.
 * @param {number} boardId - Board ID
 * @param {AgileClient} agileClient - Jira Agile client
 * @returns {Promise<Object|null>} - Active sprint object or null
 */
export async function getActiveSprintForBoard(boardId, agileClient) {
  const sprints = await fetchSprintsForBoard(boardId, agileClient);
  const active = sprints.find(s => (s.state || '').toLowerCase() === 'active');
  return active || null;
}

/**
 * Returns the most recent closed sprint whose endDate is within the last N days (for "just finished" view).
 * @param {number} boardId - Board ID
 * @param {AgileClient} agileClient - Jira Agile client
 * @param {number} withinDays - Consider sprints ended within this many days (default 14)
 * @returns {Promise<Object|null>} - Most recent closed sprint or null
 */
export async function getRecentClosedSprintForBoard(boardId, agileClient, withinDays = 14) {
  const sprints = await fetchSprintsForBoard(boardId, agileClient);
  const closed = sprints.filter(s => (s.state || '').toLowerCase() === 'closed');
  if (closed.length === 0) return null;
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  const recent = closed
    .filter(s => s.endDate && new Date(s.endDate).getTime() >= cutoff)
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  return recent[0] || null;
}
