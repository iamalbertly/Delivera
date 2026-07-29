import { CURRENT_SPRINT_SNAPSHOT_KEY } from './Delivera-Shared-Storage-Keys.js';

const SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

function readSnapshotStore() {
  try {
    const raw = localStorage.getItem(CURRENT_SPRINT_SNAPSHOT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeSnapshotStore(store) {
  try {
    localStorage.setItem(CURRENT_SPRINT_SNAPSHOT_KEY, JSON.stringify(store || {}));
  } catch (_) {}
}

function getSnapshotId(projectKey, boardId, data = null) {
  const context = data?.context || {};
  const meta = data?.meta || {};
  return [
    String(projectKey || '').trim().toUpperCase(),
    String(boardId || '').trim(),
    String(data?.sprint?.id || '').trim(),
    String(context.contractId || meta.contractId || '').trim(),
    String(context.organizationRevision || meta.registryVersion || '').trim(),
    String(context.truthHash || '').trim(),
    'flow-v2',
  ].join('::');
}

export function clearCurrentSprintSnapshot(projectKey, boardId) {
  const store = readSnapshotStore();
  const prefix = `${String(projectKey || '').trim().toUpperCase()}::${String(boardId || '').trim()}::`;
  const matches = Object.keys(store).filter((key) => key.startsWith(prefix));
  if (!matches.length) return;
  matches.forEach((key) => { delete store[key]; });
  writeSnapshotStore(store);
}

export function readCurrentSprintSnapshot(projectKey, boardId) {
  const prefix = [String(projectKey || '').trim().toUpperCase(), String(boardId || '').trim()].join('::');
  if (!prefix.replaceAll(':', '')) return null;
  const store = readSnapshotStore();
  const snapshot = Object.values(store)
    .filter((item) => String(item?.id || '').startsWith(`${prefix}::`))
    .sort((a, b) => Number(b?.savedAt || 0) - Number(a?.savedAt || 0))[0];
  if (!snapshot || typeof snapshot !== 'object') return null;
  const activeSquad = String(snapshot?.data?.context?.squadKey || snapshot?.data?.context?.squadId || projectKey || '').toUpperCase();
  if (activeSquad && activeSquad !== String(projectKey || '').toUpperCase()) return null;
  const savedAt = Number(snapshot.savedAt || 0);
  if (!Number.isFinite(savedAt) || savedAt <= 0 || (Date.now() - savedAt) > SNAPSHOT_MAX_AGE_MS) {
    delete store[snapshot.id];
    writeSnapshotStore(store);
    return null;
  }
  return snapshot;
}

export function saveCurrentSprintSnapshot(projectKey, boardId, data) {
  const snapshotId = getSnapshotId(projectKey, boardId, data);
  if (!snapshotId || !data || typeof data !== 'object') return;
  const summary = data.summary || {};
  const sprint = data.sprint || {};
  const board = data.board || {};
  const meta = data.meta || {};
  const compactData = {
    ...data,
    stories: Array.isArray(data.stories) ? [] : data.stories,
    stuckCandidates: Array.isArray(data.stuckCandidates) ? data.stuckCandidates.slice(0, 5) : [],
    subtaskTracking: {
      rows: Array.isArray(data?.subtaskTracking?.rows) ? data.subtaskTracking.rows.slice(0, 5) : [],
    },
    dailyCompletions: { stories: [] },
    remainingWorkByDay: [],
    scopeChanges: Array.isArray(data.scopeChanges) ? data.scopeChanges.slice(0, 5) : [],
    recentSprints: Array.isArray(data.recentSprints) ? data.recentSprints.slice(0, 8) : [],
    meta: {
      ...meta,
      fromSnapshot: true,
      snapshotAt: new Date().toISOString(),
      snapshotDetailState: 'summary-only',
    },
    sprint: {
      id: sprint.id || null,
      name: sprint.name || '',
      state: sprint.state || '',
      startDate: sprint.startDate || null,
      endDate: sprint.endDate || null,
    },
    board: {
      id: board.id || boardId,
      name: board.name || '',
      projectKeys: Array.isArray(board.projectKeys) ? board.projectKeys.slice(0, 3) : [projectKey].filter(Boolean),
    },
    summary: {
      totalStories: Number(summary.totalStories || 0),
      doneStories: Number(summary.doneStories || 0),
      totalSP: Number(summary.totalSP || 0),
      doneSP: Number(summary.doneSP || 0),
      percentDone: Number(summary.percentDone || 0),
      subtaskEstimatedHours: Number(summary.subtaskEstimatedHours || 0),
      subtaskLoggedHours: Number(summary.subtaskLoggedHours || 0),
    },
  };

  const store = readSnapshotStore();
  Object.keys(store).filter((key) => key.startsWith(`${String(projectKey || '').toUpperCase()}::${String(boardId || '')}::`))
    .forEach((key) => { delete store[key]; });
  store[snapshotId] = {
    id: snapshotId,
    boardId: String(boardId || ''),
    projectKey: String(projectKey || ''),
    savedAt: Date.now(),
    data: compactData,
  };
  writeSnapshotStore(store);
}
