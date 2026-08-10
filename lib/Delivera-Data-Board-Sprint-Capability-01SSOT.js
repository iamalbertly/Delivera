/**
 * SSOT: which Jira boards support sprint APIs (scrum) vs kanban/simple.
 * Prefer registry boardMapping when present, then scrum boards for sprint ops.
 */

/**
 * @param {unknown} board
 * @returns {boolean}
 */
export function isSprintCapableBoard(board) {
  if (!board || typeof board !== 'object') return false;
  const type = String(/** @type {{ type?: string }} */ (board).type || '').trim().toLowerCase();
  // Unknown type: allow (legacy caches may omit type) — negative cache handles 400s.
  if (!type) return true;
  return type === 'scrum';
}

/**
 * @param {unknown[]} boards
 * @returns {object[]}
 */
export function filterSprintCapableBoards(boards) {
  const list = Array.isArray(boards) ? boards : [];
  return list.filter((board) => isSprintCapableBoard(board));
}

/**
 * Boards that are known not sprint-capable (kanban/simple).
 * @param {unknown[]} boards
 * @returns {object[]}
 */
export function filterNonSprintCapableBoards(boards) {
  const list = Array.isArray(boards) ? boards : [];
  return list.filter((board) => board && !isSprintCapableBoard(board));
}

/**
 * Preferred board IDs from organization registry squad boardMapping.
 * @param {object|null|undefined} registry
 * @param {string[]} projectKeys
 * @returns {Set<number>}
 */
export function preferredBoardIdsFromRegistry(registry, projectKeys = []) {
  const preferred = new Set();
  const squads = Array.isArray(registry?.squads) ? registry.squads : [];
  const keys = (Array.isArray(projectKeys) ? projectKeys : [])
    .map((k) => String(k || '').trim().toUpperCase())
    .filter(Boolean);
  for (const project of keys) {
    const entry = squads.find((item) => String(item?.squadKey || '').toUpperCase() === project);
    for (const id of (entry?.boardMapping || [])) {
      const n = Number(id);
      if (Number.isFinite(n) && n > 0) preferred.add(n);
    }
  }
  return preferred;
}

/**
 * Select boards for sprint operations: registry priority, then scrum-capable.
 * @param {unknown[]} boards
 * @param {{ projectKeys?: string[], registry?: object|null, preferScrumOnly?: boolean }} [opts]
 * @returns {{ boards: object[], skipped: object[], preferredApplied: boolean }}
 */
export function selectBoardsForSprintOps(boards, opts = {}) {
  const list = Array.isArray(boards) ? boards.filter(Boolean) : [];
  const projectKeys = opts.projectKeys || [];
  const preferScrumOnly = opts.preferScrumOnly !== false;
  const preferredIds = preferredBoardIdsFromRegistry(opts.registry, projectKeys);

  let working = list;
  let preferredApplied = false;
  if (preferredIds.size) {
    const prioritized = list.filter((board) => preferredIds.has(Number(board.id)));
    if (prioritized.length) {
      working = prioritized;
      preferredApplied = true;
    }
  }

  if (!preferScrumOnly) {
    return { boards: working, skipped: [], preferredApplied };
  }

  const capable = filterSprintCapableBoards(working);
  const skipped = working.filter((b) => !isSprintCapableBoard(b));
  // If registry preferred a kanban-only set, fall back to scrum boards from full list.
  if (!capable.length && preferredApplied) {
    const fallback = filterSprintCapableBoards(list);
    const fallbackSkipped = filterNonSprintCapableBoards(list);
    return { boards: fallback, skipped: fallbackSkipped, preferredApplied: false };
  }
  return { boards: capable, skipped, preferredApplied };
}

/**
 * Pick primary backlog board for a project (scrum preferred).
 * Replaces routes/api.js pickPrimaryBacklogBoard.
 * @param {unknown[]} boards
 * @param {string} projectKey
 * @returns {object|null}
 */
export function pickPrimaryBacklogBoard(boards, projectKey) {
  const normalizedProjectKey = String(projectKey || '').trim().toUpperCase();
  const list = Array.isArray(boards) ? boards : [];
  return list.find((board) => (
    String(board?.location?.projectKey || '').toUpperCase() === normalizedProjectKey
    && String(board?.type || '').toLowerCase() === 'scrum'
  ))
    || list.find((board) => String(board?.location?.projectKey || '').toUpperCase() === normalizedProjectKey)
    || list.find((board) => String(board?.type || '').toLowerCase() === 'scrum')
    || list[0]
    || null;
}

export function nonSprintBoardCacheKey(boardId) {
  return `nonSprintBoard:${Number(boardId) || 0}`;
}

export const NON_SPRINT_BOARD_TTL_MS = 24 * 60 * 60 * 1000;
export const NON_SPRINT_BOARD_ERROR_TTL_MS = 15 * 60 * 1000;
