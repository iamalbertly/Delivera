import { currentSprintDom, currentSprintKeys } from './Reporting-App-CurrentSprint-Page-Context.js';
import { showLoading, showError, clearError } from './Reporting-App-CurrentSprint-Page-Status.js';
import { loadBoards, loadCurrentSprint } from './Reporting-App-CurrentSprint-Page-Data-Loaders.js';
import { getProjectsParam, getStoredProjects, syncProjectsSelect, persistProjectsSelection, describeCurrentSprintProjectMode, getPreferredBoardId, getPreferredSprintId, persistSelection } from './Reporting-App-CurrentSprint-Page-Storage.js';
import { initSharedPageIdentityObserver, initSharedTableScrollIndicators } from './Reporting-App-Shared-Page-Identity-Scroll-Helpers.js';
import { appendCurrentSprintLoginLink, showCurrentSprintRenderedContent } from './Reporting-App-CurrentSprint-Page-Rendered-Content-Wiring-Helpers.js';

function showRenderedContent(data) {
  showCurrentSprintRenderedContent(data, (sprintId) => initHandlers.selectSprintById(sprintId));
}

let currentBoardId = null;
let currentSprintId = null;
let lastBoardsRefreshRequestId = 0;
let currentSprintLoadRequestId = 0;
let retryLastIntent = () => {};

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
  showLoading('Loading boards for project ' + getProjectsParam() + '...');
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
      if (preferredId && !preferredStillExists) {
        try { localStorage.removeItem(currentSprintKeys.boardKey); } catch (_) {}
        try { localStorage.removeItem(currentSprintKeys.sprintKey); } catch (_) {}
        preferredSprintId = null;
        const boardName = boards.find(b => String(b.id) === boardId)?.name || boardId;
        const hint = document.getElementById('current-sprint-single-project-hint');
        if (hint) hint.textContent = 'Previously saved board is no longer available. Switched to ' + boardName + '.';
      }
      showLoading('Loading current sprint...');
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
    showLoading('Choose projects above; boards load for those projects. Then pick a board.');
    return;
  }
  currentBoardId = boardId;
  currentSprintId = null;
  persistSelection(boardId, null);
  showLoading('Loading current sprint...');
  // M9: Show board name in loading context so user knows which board is loading
  try {
    const ctxEl = document.getElementById('sprint-loading-context');
    if (ctxEl) {
      const boardSelect = currentSprintDom.boardSelect;
      const boardLabel = boardSelect ? (boardSelect.options[boardSelect.selectedIndex]?.text || '') : '';
      ctxEl.textContent = boardLabel ? 'Loading: ' + boardLabel : '';
    }
  } catch (_) {}
  loadAndRenderSprint({ boardId, sprintId: null, loadingText: null, retryFactory: () => onBoardChange() });
}

function updateProjectHint() {
  try {
    const hint = document.getElementById('current-sprint-single-project-hint');
    if (!hint) return;
    hint.textContent = describeCurrentSprintProjectMode(getStoredProjects() || getProjectsParam());
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
    refreshBtn.textContent = 'Refreshing...';
  }
  loadAndRenderSprint({
    boardId: currentBoardId,
    sprintId: currentSprintId,
    loadingText: 'Refreshing sprint...',
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
  if (loadingText) showLoading(loadingText);
  retryLastIntent = typeof retryFactory === 'function' ? retryFactory : (() => {});
  return loadCurrentSprintWithGuard(boardId, sprintId)
    .then((data) => {
      if (!data) return null;
      currentSprintId = data?.sprint?.id || sprintId || null;
      persistSelection(currentBoardId, currentSprintId);
      showRenderedContent(data);
      return data;
    })
    .catch((err) => {
      const msg = err.message || 'Failed to load sprint.';
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

function init() {
  const { boardSelect, contentEl, projectsSelect, errorEl } = currentSprintDom;
  const preferredId = getPreferredBoardId();
  const preferredSprintId = getPreferredSprintId();
  syncProjectsSelect(getStoredProjects());
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
      syncProjectsSelect(event.newValue || '');
      initHandlers.onProjectsChange();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initSharedPageIdentityObserver({
      titleSelector: 'header h1, .header-sprint-name',
      headerSelector: 'header .header-row',
      fallbackHeaderSelector: 'header',
      contextText: 'Sprint',
    });
    initSharedTableScrollIndicators();
  });
} else {
  init();
  initSharedPageIdentityObserver({
    titleSelector: 'header h1, .header-sprint-name',
    headerSelector: 'header .header-row',
    fallbackHeaderSelector: 'header',
    contextText: 'Sprint',
  });
  initSharedTableScrollIndicators();
}
