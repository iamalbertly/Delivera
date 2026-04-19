import { currentSprintDom, currentSprintKeys } from './Delivera-CurrentSprint-Page-Context.js';
import { showLoading, showError, clearError } from './Delivera-CurrentSprint-Page-Status.js';
import { loadBoards, loadCurrentSprint } from './Delivera-CurrentSprint-Page-Data-Loaders.js';
import { getProjectsParam, getStoredProjects, syncProjectsSelect, persistProjectsSelection, getPreferredBoardId, getPreferredSprintId, persistSelection } from './Delivera-CurrentSprint-Page-Storage.js';
import { initSharedPageIdentityObserver, initSharedTableScrollIndicators } from './Delivera-Shared-Page-Identity-Scroll-Helpers.js';
import { appendCurrentSprintLoginLink, showCurrentSprintRenderedContent } from './Delivera-CurrentSprint-Page-Rendered-Content-Wiring-Helpers.js';
import { initGlobalOutcomeModal } from './Delivera-Shared-Outcome-Modal.js';
import { readCurrentSprintSnapshot, saveCurrentSprintSnapshot, clearCurrentSprintSnapshot } from './Delivera-CurrentSprint-Page-Snapshot.js';
import { markPerf, resetPerfMarks } from './Delivera-Shared-Perf-Marks.js';

function showRenderedContent(data) {
  showCurrentSprintRenderedContent(data, (sprintId) => initHandlers.selectSprintById(sprintId));
}

let currentBoardId = null;
let currentSprintId = null;
let lastBoardsRefreshRequestId = 0;
let currentSprintLoadRequestId = 0;
let retryLastIntent = () => {};

function showRibbon(message, state = 'info') {
  const ribbonEl = currentSprintDom.ribbonEl;
  if (!ribbonEl) return;
  const shouldShow = !!message && state !== 'fresh';
  ribbonEl.textContent = message || '';
  ribbonEl.setAttribute('data-state', state);
  ribbonEl.style.display = shouldShow ? '' : 'none';
}

function buildLoadingContext(boardLabel = '', sprintLabel = '') {
  const parts = [];
  if (boardLabel) parts.push('Board: ' + boardLabel);
  if (sprintLabel) parts.push('Sprint: ' + sprintLabel);
  return parts.join(' | ');
}

function loadCurrentSprintWithGuard(boardId, sprintId, onStale) {
  const requestId = ++currentSprintLoadRequestId;
  return loadCurrentSprint(boardId, sprintId).then((data) => {
    if (requestId !== currentSprintLoadRequestId) {
      if (typeof onStale === 'function') onStale();
      return null;
    }
    return data;
  });
}

function setBoardSelectCouldntLoad() {
  const { boardSelect } = currentSprintDom;
  if (!boardSelect) return;
  boardSelect.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = "Couldn't load boards";
  boardSelect.appendChild(opt);
}

function showBoardsLoadError(message, preferredBoardId = null, preferredSprintId = null) {
  const { loadingEl, contentEl } = currentSprintDom;
  if (loadingEl) loadingEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'none';
  showError({
    title: 'Could not load boards.',
    message: String(message || 'Please retry or adjust project filters.'),
    primaryLabel: 'Retry boards',
    primaryAction: 'retry-last-intent',
    secondaryHref: '/report',
    secondaryLabel: 'Open report',
  });
  retryLastIntent = () => refreshBoards(preferredBoardId, preferredSprintId);
}

function refreshBoards(preferredId, preferredSprintId) {
  retryLastIntent = () => refreshBoards(preferredId, preferredSprintId);
  const requestId = ++lastBoardsRefreshRequestId;
  const { boardSelect } = currentSprintDom;
  showRibbon('', 'fresh');
  showLoading('Loading boards for ' + getProjectsParam() + '...');
  return loadBoards()
    .then((res) => {
      if (requestId !== lastBoardsRefreshRequestId) return null;
      const boards = res.boards || [];
      if (!boardSelect) return null;
      boardSelect.innerHTML = '';
      boardSelect.appendChild(document.createElement('option'));
      const opt0 = boardSelect.querySelector('option');
      opt0.value = '';
      opt0.textContent = '- Select board -';
      boards.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = String(b.id);
        opt.textContent = (b.name || 'Board ' + b.id) + (b.projectKey ? ' (' + b.projectKey + ')' : '');
        boardSelect.appendChild(opt);
      });
      if (!boards.length) {
        setBoardSelectCouldntLoad();
        showBoardsLoadError('No boards found for selected projects. Check project filters or run Report preview.', preferredId, preferredSprintId);
        return null;
      }
      const boardIds = boards.map((b) => String(b.id));
      const preferredStillExists = preferredId && boardIds.includes(preferredId);
      const boardId = preferredStillExists ? preferredId : boardIds[0];
      boardSelect.value = boardId;
      currentBoardId = boardId;
      const cachedSnapshot = readCurrentSprintSnapshot(getProjectsParam(), boardId);
      if (cachedSnapshot?.data) {
        currentSprintId = cachedSnapshot.data?.sprint?.id || preferredSprintId || null;
        persistSelection(currentBoardId, currentSprintId);
        showCurrentSprintRenderedContent(cachedSnapshot.data, (sprintId) => initHandlers.selectSprintById(sprintId), { source: 'snapshot' });
      }
      if (preferredId && !preferredStillExists) {
        try { localStorage.removeItem(currentSprintKeys.boardKey); } catch (_) {}
        try { localStorage.removeItem(currentSprintKeys.sprintKey); } catch (_) {}
        clearCurrentSprintSnapshot(getProjectsParam(), preferredId);
        preferredSprintId = null;
        const boardName = boards.find(b => String(b.id) === boardId)?.name || boardId;
        const hint = document.getElementById('current-sprint-single-project-hint');
        if (hint) hint.textContent = 'Switched to ' + boardName + '.';
      }
      if (!cachedSnapshot?.data) {
        const loadingContext = buildLoadingContext(boardSelect?.options?.[boardSelect.selectedIndex]?.text || '');
        showLoading(loadingContext ? ('Loading ' + loadingContext) : 'Loading current sprint...');
      }
      const sprintRequestId = ++lastBoardsRefreshRequestId;
      return loadCurrentSprintWithGuard(boardId, preferredSprintId)
        .catch((err) => {
          if (!preferredSprintId) throw err;
          return loadCurrentSprintWithGuard(boardId);
        })
        .then((data) => {
          if (!data) return null;
          if (sprintRequestId !== lastBoardsRefreshRequestId) return null;
          currentSprintId = data?.sprint?.id || null;
          persistSelection(currentBoardId, currentSprintId);
          saveCurrentSprintSnapshot(getProjectsParam(), currentBoardId, data);
          if (data?.meta?.noActiveSprintFallback) {
            showRibbon(data.meta.explanatoryLine || 'No active sprint - showing last completed sprint.', 'closest');
          } else if (data?.meta?.partialPermissions) {
            showRibbon('Some Jira fields are hidden by permissions. Showing the data that is still available.', 'closest');
          }
          showRenderedContent(data);
          return null;
        });
    })
    .catch((err) => {
      const msg = err.message || 'Failed to load boards.';
      setBoardSelectCouldntLoad();
      showBoardsLoadError(msg || "Couldn't load boards.", preferredId, preferredSprintId);
      if ((msg || '').includes('Session expired')) appendCurrentSprintLoginLink(currentSprintDom.errorEl);
      return null;
    });
}

function onBoardChange() {
  const { boardSelect } = currentSprintDom;
  const boardId = boardSelect?.value || '';
  if (!boardId) {
    showLoading('Choose a board to see sprint health.');
    return;
  }
  currentBoardId = boardId;
  currentSprintId = null;
  persistSelection(boardId, null);
  const boardLabel = boardSelect?.options?.[boardSelect.selectedIndex]?.text || 'board';
  showLoading('Loading: ' + boardLabel);
  loadAndRenderSprint({ boardId, sprintId: null, loadingText: null, retryFactory: () => onBoardChange() });
}

function updateProjectHint() {
  try {
    const hint = document.getElementById('current-sprint-single-project-hint');
    if (!hint) return;
    hint.textContent = 'Using single-project mode';
  } catch (_) {}
}

function onProjectsChange() {
  persistProjectsSelection(getProjectsParam());
  updateProjectHint();
  currentBoardId = null;
  currentSprintId = null;
  retryLastIntent = () => onProjectsChange();
  return refreshBoards(getPreferredBoardId(), getPreferredSprintId());
}

function onSprintTabClick(event) {
  const target = event.target.closest('[data-sprint-id]');
  if (!target || !currentBoardId) return;
  const sprintId = target.getAttribute('data-sprint-id');
  if (!sprintId) return;
  currentSprintId = sprintId;
  persistSelection(currentBoardId, sprintId);
  loadAndRenderSprint({
    boardId: currentBoardId,
    sprintId,
    loadingText: 'Loading sprint...',
    retryFactory: () => selectSprintById(sprintId),
  });
}

function handleRefreshSprint() {
  if (!currentBoardId) return;
  const refreshBtn = document.querySelector('.header-refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing sprint...';
  }
  loadAndRenderSprint({
    boardId: currentBoardId,
    sprintId: currentSprintId,
    loadingText: 'Refreshing current sprint...',
    retryFactory: () => handleRefreshSprint(),
    errorTitle: 'Could not refresh sprint.',
    errorPrimaryLabel: 'Retry refresh',
  })
    .finally(() => {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh';
      }
    });
}

function selectSprintById(sprintId) {
  if (!currentBoardId || !sprintId) return;
  currentSprintId = sprintId;
  persistSelection(currentBoardId, sprintId);
  loadAndRenderSprint({
    boardId: currentBoardId,
    sprintId,
    loadingText: 'Loading sprint...',
    retryFactory: () => selectSprintById(sprintId),
  });
}

function loadAndRenderSprint({
  boardId,
  sprintId,
  loadingText,
  retryFactory,
  errorTitle = 'Could not load sprint.',
  errorPrimaryLabel = 'Retry sprint',
}) {
  if (!boardId) return Promise.resolve();
  if (loadingText) {
    const boardLabel = currentSprintDom.boardSelect?.options?.[currentSprintDom.boardSelect.selectedIndex]?.text || '';
    const loadingContext = buildLoadingContext(boardLabel, sprintId ? ('Sprint ' + sprintId) : '');
    showLoading(loadingText + (loadingContext ? (' | ' + loadingContext) : ''));
  }
  showRibbon('', 'fresh');
  retryLastIntent = typeof retryFactory === 'function' ? retryFactory : (() => {});
  return loadCurrentSprintWithGuard(boardId, sprintId)
    .then((data) => {
      if (!data) return null;
      try {
        const urlHasSprintId = new URLSearchParams(window.location.search).has('sprintId');
        const selectedState = String(data?.sprint?.state || '').toLowerCase();
        const activeAlternative = Array.isArray(data?.recentSprints)
          ? data.recentSprints.find((s) => String(s?.state || '').toLowerCase() === 'active' && String(s?.id || '') !== String(data?.sprint?.id || ''))
          : null;
        if (!urlHasSprintId && sprintId && selectedState !== 'active' && activeAlternative?.id) {
          const hint = document.getElementById('current-sprint-single-project-hint');
          if (hint) hint.textContent = 'Active sprint';
          currentSprintId = String(activeAlternative.id);
          persistSelection(currentBoardId, currentSprintId);
          return loadAndRenderSprint({
            boardId,
            sprintId: currentSprintId,
            loadingText: 'Loading active sprint...',
            retryFactory,
            errorTitle,
            errorPrimaryLabel,
          });
        }
      } catch (_) {}
      currentSprintId = data?.sprint?.id || sprintId || null;
      persistSelection(currentBoardId, currentSprintId);
      saveCurrentSprintSnapshot(getProjectsParam(), boardId, data);
      if (data?.meta?.noActiveSprintFallback) {
        showRibbon(data.meta.explanatoryLine || 'No active sprint - showing last completed sprint.', 'closest');
      } else if (data?.meta?.partialPermissions) {
        showRibbon('Some Jira fields are hidden by permissions. Showing the data that is still available.', 'closest');
      }
      showRenderedContent(data);
      return data;
    })
    .catch((err) => {
      const msg = err.message || 'Failed to load sprint.';
      if (err?.code === 'SESSION_EXPIRED' || err?.code === 'AUTH_REQUIRED') {
        showRibbon('Session expired. Sign in again to restore this sprint context.', 'warning');
      } else if (err?.code === 'JIRA_RECONNECT_REQUIRED' || err?.code === 'JIRA_ACCESS_DENIED') {
        showRibbon('Jira needs reconnection. Showing your last safe context where possible.', 'warning');
      } else if (err?.code === 'JIRA_RATE_LIMITED') {
        showRibbon('Jira is rate limiting requests. Retry in a moment.', 'closest');
      }
      showError({
        title: errorTitle,
        message: msg,
        primaryLabel: errorPrimaryLabel,
        primaryAction: 'retry-last-intent',
      });
      if ((msg || '').includes('Session expired')) appendCurrentSprintLoginLink(currentSprintDom.errorEl);
      return null;
    });
}

const initHandlers = { refreshBoards, onBoardChange, updateProjectHint, onProjectsChange, onSprintTabClick, handleRefreshSprint, selectSprintById };

function safeInitBoot() {
  try {
    init();
    initSharedPageIdentityObserver({
      titleSelector: 'header h1, .header-sprint-name',
      headerSelector: 'header .header-row',
      fallbackHeaderSelector: 'header',
      contextText: 'Sprint',
    });
    initSharedTableScrollIndicators();
  } catch (error) {
    // Surface a clear, user-facing error instead of leaving the page stuck in a welcome state.
    try {
      // eslint-disable-next-line no-console
      console.error('Current Sprint init failed', error);
    } catch (_) {}
    const message = (error && error.message) ? error.message : 'Unexpected error during Current Sprint setup.';
    showError('Could not initialise Current Sprint view: ' + message);
  }
}

function init() {
  const { boardSelect, contentEl, projectsSelect, errorEl } = currentSprintDom;
  resetPerfMarks('current-sprint');
  try {
    if (window.history && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  } catch (_) {}
  const preferredId = getPreferredBoardId();
  const preferredSprintId = getPreferredSprintId();
  syncProjectsSelect(getStoredProjects());
  const initialSnapshot = readCurrentSprintSnapshot(getProjectsParam(), preferredId);
  if (initialSnapshot?.data) {
    showCurrentSprintRenderedContent(initialSnapshot.data, (sprintId) => initHandlers.selectSprintById(sprintId), { source: 'snapshot' });
  }
  initGlobalOutcomeModal({
    getSelectedProjects: () => {
      const selected = (getStoredProjects() || getProjectsParam() || '').split(',').map((value) => value.trim()).filter(Boolean);
      return selected.length ? selected : ['MPSA'];
    },
    getOutcomeDraftContext: () => {
      const { boardSelect } = currentSprintDom;
      const raw = boardSelect?.value || '';
      const n = Number(raw);
      return { boardId: Number.isFinite(n) ? n : null, quarterHint: '' };
    },
  });
  initHandlers.refreshBoards(preferredId, preferredSprintId)
    .catch((err) => {
      showError(err.message || 'Failed to load current sprint.');
    });

  initHandlers.updateProjectHint();
  if (boardSelect) boardSelect.addEventListener('change', initHandlers.onBoardChange);
  if (contentEl) contentEl.addEventListener('click', initHandlers.onSprintTabClick);
  if (errorEl) {
    errorEl.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-action]');
      if (!target) return;
      if (target.getAttribute('data-action') === 'dismiss-error') {
        clearError();
        return;
      }
      if (target.getAttribute('data-action') === 'retry-last-intent') {
        try {
          retryLastIntent();
        } catch (err) {
          showError(err.message || 'Failed to retry last action.');
        }
      }
    });
  }
  document.addEventListener('refreshSprint', initHandlers.handleRefreshSprint);
  if (projectsSelect) {
    projectsSelect.addEventListener('change', initHandlers.onProjectsChange);
  }
  const { projectsKey } = currentSprintKeys;
  window.addEventListener('storage', (event) => {
    if (event.key === projectsKey) {
      if ((event.newValue || '') === (projectsSelect?.value || '')) return;
      syncProjectsSelect(event.newValue || '');
      initHandlers.onProjectsChange();
    }
  });
  try {
    markPerf('current-sprint', 'bootReady');
  } catch (_) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInitBoot);
} else {
  safeInitBoot();
}
