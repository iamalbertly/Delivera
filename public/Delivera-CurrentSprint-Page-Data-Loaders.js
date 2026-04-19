import { getProjectsParam } from './Reporting-App-CurrentSprint-Page-Storage.js';
import { readWarmBoards, writeWarmBoards } from './Reporting-App-Shared-Journey-Warmup.js';

export function getErrorMessage(response, body, fallback) {
  if (response.status === 401) return 'Session expired. Sign in again to continue.';
  if (response.status === 429) return 'Data may be incomplete due to rate limits; try again later.';
  return (body && (body.message || body.error)) || response.statusText || fallback;
}

function buildLoaderError(response, body, fallback) {
  const error = new Error(getErrorMessage(response, body, fallback));
  error.code = body?.code || '';
  error.httpStatus = response.status;
  return error;
}

export async function loadBoards() {
  // Instrumentation for tests and reliability: track invocation counts on the window for debugging
  try {
    if (typeof window !== 'undefined') {
      window.__lastBoardsCall = (window.__lastBoardsCall || 0) + 1;
      window.__lastBoardsCallTime = Date.now();
    }
  } catch (_) {}

  const projects = encodeURIComponent(getProjectsParam());
  const warmed = readWarmBoards(getProjectsParam());
  if (warmed && Array.isArray(warmed.boards) && warmed.boards.length > 0) {
    return warmed;
  }
  const response = await fetch(`/api/boards.json?projects=${projects}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({}));
  try { if (typeof window !== 'undefined') window.__lastBoardsCallStatus = response.ok ? 'ok' : 'error'; } catch (_) {}
  if (!response.ok) {
    throw buildLoaderError(response, body, 'Failed to load boards');
  }
  writeWarmBoards(getProjectsParam(), body);
  return body;
}

export async function loadCurrentSprint(boardId, sprintId) {
  const params = new URLSearchParams();
  params.set('boardId', boardId);
  params.set('projects', getProjectsParam());
  if (sprintId) params.set('sprintId', sprintId);
  // Prefer live data for real-time accuracy; fall back to snapshot on failure
  params.set('live', 'true');
  try {
    const response = await fetch(`/api/current-sprint.json?${params.toString()}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw buildLoaderError(response, body, 'Failed to load current sprint');
    }
    return body;
  } catch (error) {
    params.delete('live');
    const response = await fetch(`/api/current-sprint.json?${params.toString()}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw buildLoaderError(response, body, 'Failed to load current sprint');
    }
    return body;
  }
}
