import { CURRENT_SPRINT_SNAPSHOT_KEY } from './Reporting-App-Shared-Storage-Keys.js';

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

function getSnapshotId(projectKey, boardId) {
  return [String(projectKey || '').trim(), String(boardId || '').trim()].filter(Boolean).join('::');
}

export function clearCurrentSprintSnapshot(projectKey, boardId) {
  const snapshotId = getSnapshotId(projectKey, boardId);
  if (!snapshotId) return;
  const store = readSnapshotStore();
  if (!store[snapshotId]) return;
  delete store[snapshotId];
  writeSnapshotStore(store);
}

export function readCurrentSprintSnapshot(projectKey, boardId) {
  const snapshotId = getSnapshotId(projectKey, boardId);
  if (!snapshotId) return null;
  const store = readSnapshotStore();
  const snapshot = store[snapshotId];
  if (!snapshot || typeof snapshot !== 'object') return null;
  const savedAt = Number(snapshot.savedAt || 0);
  if (!Number.isFinite(savedAt) || savedAt <= 0 || (Date.now() - savedAt) > SNAPSHOT_MAX_AGE_MS) {
    clearCurrentSprintSnapshot(projectKey, boardId);
    return null;
  }
  return snapshot;
}

export function saveCurrentSprintSnapshot(projectKey, boardId, data) {
  const snapshotId = getSnapshotId(projectKey, boardId);
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
  store[snapshotId] = {
    id: snapshotId,
    boardId: String(boardId || ''),
    projectKey: String(projectKey || ''),
    savedAt: Date.now(),
    data: compactData,
  };
  writeSnapshotStore(store);
}
