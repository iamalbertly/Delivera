import { currentSprintDom, currentSprintKeys } from './Reporting-App-CurrentSprint-Page-Context.js';

function normalizeForCurrentSprint(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[0] || '';
}

export function describeCurrentSprintProjectMode(value) {
  const raw = (value || '').trim();
  if (!raw) return 'Current Sprint runs in single-project mode for accuracy.';
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return 'Current Sprint runs in single-project mode for accuracy.';
  return 'Using ' + parts[0] + ' from shared project context (' + parts.length + ' selected).';
}

export function getProjectsParam() {
  const { projectsSelect } = currentSprintDom;
  const selection = normalizeForCurrentSprint(projectsSelect?.value || '');
  if (selection) return selection;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = normalizeForCurrentSprint(params.get('projects'));
    if (fromUrl) return fromUrl;
  } catch (_) {}
  try {
    const s = normalizeForCurrentSprint(localStorage.getItem(currentSprintKeys.projectsKey));
    if (s) return s;
  } catch (_) {}
  return 'MPSA';
}

export function getStoredProjects() {
  try {
    return localStorage.getItem(currentSprintKeys.projectsKey);
  } catch (_) {
    return null;
  }
}

export function syncProjectsSelect(value) {
  const { projectsSelect } = currentSprintDom;
  if (!projectsSelect) return false;
  const target = normalizeForCurrentSprint(value);
  if (!target) return false;
  const options = Array.from(projectsSelect.options || []);
  const match = options.find(opt => opt.value === target);
  if (match) {
    projectsSelect.value = target;
    return true;
  }
  const opt = document.createElement('option');
  opt.value = target;
  opt.textContent = 'Current: ' + target.replace(/,/g, ', ');
  projectsSelect.appendChild(opt);
  projectsSelect.value = target;
  return true;
}

export function persistProjectsSelection(value) {
  try {
    const cleaned = (value || '').trim();
    if (!cleaned) return;
    localStorage.setItem(currentSprintKeys.projectsKey, cleaned);
  } catch (_) {}
}

export function getPreferredBoardId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('boardId');
    if (fromUrl) return fromUrl.trim();
    return localStorage.getItem(currentSprintKeys.boardKey);
  } catch (_) {
    return null;
  }
}

export function getPreferredSprintId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('sprintId');
    if (fromUrl) return fromUrl.trim();
    const saved = localStorage.getItem(currentSprintKeys.sprintKey);
    const selectedAtRaw = localStorage.getItem(currentSprintKeys.sprintTsKey);
    if (!saved) return null;
    const selectedAt = selectedAtRaw ? Number(selectedAtRaw) : 0;
    const maxAgeMs = 12 * 60 * 60 * 1000;
    if (!Number.isFinite(selectedAt) || selectedAt <= 0 || (Date.now() - selectedAt) > maxAgeMs) {
      localStorage.removeItem(currentSprintKeys.sprintKey);
      localStorage.removeItem(currentSprintKeys.sprintTsKey);
      return null;
    }
    return saved;
  } catch (_) {
    return null;
  }
}

export function persistSelection(boardId, sprintId) {
  try {
    if (boardId) localStorage.setItem(currentSprintKeys.boardKey, boardId);
    if (sprintId) {
      localStorage.setItem(currentSprintKeys.sprintKey, sprintId);
      localStorage.setItem(currentSprintKeys.sprintTsKey, String(Date.now()));
    } else {
      localStorage.removeItem(currentSprintKeys.sprintKey);
      localStorage.removeItem(currentSprintKeys.sprintTsKey);
    }
  } catch (_) {}
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('boardId', boardId);
    if (sprintId) url.searchParams.set('sprintId', sprintId);
    else url.searchParams.delete('sprintId');
    window.history.replaceState({}, '', url.toString());
  } catch (_) {}
}
