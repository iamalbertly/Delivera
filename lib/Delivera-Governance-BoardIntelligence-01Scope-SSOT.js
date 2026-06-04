/**
 * SSOT: Scope intelligence — board cards, filters, saved-view metadata.
 * Pure functions; Jira fetch happens in routes via discoverBoardsWithCache.
 */

function asNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function projectKeyFromBoard(board) {
  return String(board?.projectKey || board?.location?.projectKey || '').trim().toUpperCase();
}

function sprintState(boardPayload) {
  const state = String(boardPayload?.sprint?.state || '').toLowerCase();
  const activeCount = asNum(boardPayload?.meta?.activeSprintCount, 0);
  if (state === 'active' || activeCount > 0) return 'active';
  if (state === 'closed') return 'closed';
  return 'none';
}

/**
 * Build scope intelligence summary for capsule + drawer.
 * @param {object} opts
 * @param {Array} opts.boards - from discoverBoardsWithCache
 * @param {Array} opts.boardPayloads - { board, payload } from brief assembly
 * @param {string[]} opts.selectedProjects
 * @param {object[]} [opts.projectErrors]
 */
export function buildScopeIntelligence({
  boards = [],
  boardPayloads = [],
  selectedProjects = [],
  projectErrors = [],
} = {}) {
  const selected = new Set((selectedProjects || []).map((p) => String(p).trim().toUpperCase()));
  const payloadByPk = new Map();
  for (const entry of boardPayloads) {
    const pk = projectKeyFromBoard(entry?.board);
    if (pk) payloadByPk.set(pk, entry.payload);
  }

  const cards = (boards || []).map((b) => {
    const pk = projectKeyFromBoard(b);
    const payload = payloadByPk.get(pk);
    const sprint = sprintState(payload);
    const stories = Array.isArray(payload?.stories) ? payload.stories : [];
    const epicKeys = new Set(stories.map((s) => String(s.epicKey || '').toUpperCase()).filter(Boolean));
    const blockers = asNum(payload?.summary?.blockedStories, 0)
      || (Array.isArray(payload?.stuckCandidates) ? payload.stuckCandidates.length : 0);
    const noPiLink = stories.filter((s) => !s.epicKey && !s.epicLink).length;
    const isSelected = selected.has(pk);
    let health = 'onTrack';
    if (sprint === 'none') health = 'setup';
    else if (blockers > 0) health = 'blocked';
    else if (noPiLink > stories.length * 0.3) health = 'watch';

    return {
      boardId: b.id,
      projectKey: pk,
      name: b.name || pk,
      sprint,
      health,
      epicCount: epicKeys.size,
      blockerCount: blockers,
      adHocSignal: noPiLink,
      isSelected,
      label: sprint === 'none'
        ? 'no sprint'
        : blockers > 0
          ? `${blockers} blocked`
          : epicKeys.size > 0
            ? `${epicKeys.size} epics`
            : 'active',
    };
  });

  const noSprint = cards.filter((c) => c.sprint === 'none').length;
  const piCommitted = cards.filter((c) => c.epicCount > 0).length;
  const blocked = cards.filter((c) => c.health === 'blocked').length;

  return {
    available: cards.length,
    selected: selected.size,
    noSprint,
    piCommitted,
    blocked,
    failedProjects: (projectErrors || []).length,
    projectErrors: projectErrors || [],
    cards: cards.sort((a, b) => {
      const order = { blocked: 0, setup: 1, watch: 2, onTrack: 3 };
      return (order[a.health] ?? 4) - (order[b.health] ?? 4);
    }),
    capsuleLine: `Scope: ${[...selected].join(' + ') || 'none'} · ${cards.length} available · ${noSprint} no sprint · ${piCommitted} PI committed`,
  };
}

export const SCOPE_FILTER_PRESETS = Object.freeze([
  { id: 'all', label: 'All squads' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'no-sprint', label: 'No active sprint' },
  { id: 'pi-committed', label: 'PI committed' },
  { id: 'setup', label: 'Setup risk' },
]);
