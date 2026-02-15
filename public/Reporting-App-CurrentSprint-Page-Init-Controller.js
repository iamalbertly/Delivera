import { currentSprintDom, currentSprintKeys } from './Reporting-App-CurrentSprint-Page-Context.js';
import { renderNotificationDock } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { updateNotificationStore } from './Reporting-App-CurrentSprint-Notifications-Helpers.js';
import { showLoading, showError, showContent } from './Reporting-App-CurrentSprint-Page-Status.js';
import { loadBoards, loadCurrentSprint } from './Reporting-App-CurrentSprint-Page-Data-Loaders.js';
import { renderCurrentSprintPage } from './Reporting-App-CurrentSprint-Render-Page.js';
import { wireDynamicHandlers } from './Reporting-App-CurrentSprint-Page-Handlers.js';
// New redesign component handlers
import { wireHeaderBarHandlers } from './Reporting-App-CurrentSprint-Header-Bar.js';
import { wireHealthDashboardHandlers } from './Reporting-App-CurrentSprint-Health-Dashboard.js';
import { wireAlertBannerHandlers } from './Reporting-App-CurrentSprint-Alert-Banner.js';
import { wireRisksAndInsightsHandlers } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { wireCapacityAllocationHandlers } from './Reporting-App-CurrentSprint-Capacity-Allocation.js';
import { wireSprintCarouselHandlers } from './Reporting-App-CurrentSprint-Navigation-Carousel.js';
import { wireCountdownTimerHandlers } from './Reporting-App-CurrentSprint-Countdown-Timer.js';
import { wireSubtasksShowMoreHandlers } from './Reporting-App-CurrentSprint-Render-Subtasks.js';
import { wireProgressShowMoreHandlers } from './Reporting-App-CurrentSprint-Render-Progress.js';
import { wireExportHandlers } from './Reporting-App-CurrentSprint-Export-Dashboard.js';
import {
  getProjectsParam,
  getStoredProjects,
  syncProjectsSelect,
  persistProjectsSelection,
  describeCurrentSprintProjectMode,
  getPreferredBoardId,
  getPreferredSprintId,
  persistSelection,
} from './Reporting-App-CurrentSprint-Page-Storage.js';

function addLoginLink() {
  const { errorEl } = currentSprintDom;
  if (!errorEl || errorEl.querySelector('a.nav-link')) return;
  const link = document.createElement('a');
  link.href = '/?redirect=/current-sprint';
  link.className = 'nav-link';
  link.textContent = 'Sign in';
  link.style.marginLeft = '8px';
  errorEl.appendChild(document.createTextNode(' '));
  errorEl.appendChild(link);
}

/**
 * Wire all new redesign component handlers
 */
function wireRedesignHandlers(data) {
  // Wire all new components
  wireHeaderBarHandlers();
  wireHealthDashboardHandlers();
  wireAlertBannerHandlers();
  wireRisksAndInsightsHandlers();
  wireCapacityAllocationHandlers();
  wireCountdownTimerHandlers();
  // Wire show-more handlers for large tables to reduce initial DOM node count
  wireSubtasksShowMoreHandlers();
  wireProgressShowMoreHandlers();
  
  // Wire carousel with sprint selection callback
  wireSprintCarouselHandlers((sprintId) => {
    initHandlers.selectSprintById(sprintId);
  });
  
  // Wire export handlers
  wireExportHandlers(data);
  collapseMobileDetailsSections();

}

function collapseMobileDetailsSections() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    document.querySelectorAll('details[data-mobile-collapse="true"]').forEach((el) => {
      el.open = false;
    });
  } catch (_) {}
}

function showRenderedContent(data) {
  showContent(renderCurrentSprintPage(data));
  const summary = updateNotificationStore(data);
  renderNotificationDock({ summary, pageContext: 'current-sprint' });
  wireDynamicHandlers(data);
  wireRedesignHandlers(data);
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
      if ((msg || '').includes('Session expired')) addLoginLink();
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
  retryLastIntent = () => onBoardChange();
  loadCurrentSprintWithGuard(boardId)
    .then((data) => {
      if (!data) return;
      currentSprintId = data?.sprint?.id || null;
      persistSelection(currentBoardId, currentSprintId);
      showRenderedContent(data);
    })
    .catch((err) => {
      const msg = err.message || 'Failed to load current sprint.';
      showError({
        title: 'Could not load sprint.',
        message: msg,
        primaryLabel: 'Retry sprint',
        primaryAction: 'retry-last-intent',
      });
      if ((msg || '').includes('Session expired')) addLoginLink();
    });
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
  showLoading('Loading sprint...');
  retryLastIntent = () => selectSprintById(sprintId);
  loadCurrentSprintWithGuard(currentBoardId, sprintId)
    .then((data) => {
      if (!data) return;
      showRenderedContent(data);
    })
    .catch((err) => {
      showError({
        title: 'Could not load sprint.',
        message: err.message || 'Failed to load sprint.',
        primaryLabel: 'Retry sprint',
        primaryAction: 'retry-last-intent',
      });
    });
}

function handleRefreshSprint() {
  if (!currentBoardId) return;
  const refreshBtn = document.querySelector('.header-refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
  }
  showLoading('Refreshing sprint...');
  retryLastIntent = () => handleRefreshSprint();
  loadCurrentSprintWithGuard(currentBoardId, currentSprintId)
    .then((data) => {
      if (!data) return;
      currentSprintId = data?.sprint?.id || null;
      persistSelection(currentBoardId, currentSprintId);
      showRenderedContent(data);
    })
    .catch((err) => {
      showError({
        title: 'Could not refresh sprint.',
        message: err.message || 'Failed to refresh sprint.',
        primaryLabel: 'Retry refresh',
        primaryAction: 'retry-last-intent',
      });
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
  showLoading('Loading sprint...');
  retryLastIntent = () => selectSprintById(sprintId);
  loadCurrentSprintWithGuard(currentBoardId, sprintId)
    .then((data) => {
      if (!data) return;
      showRenderedContent(data);
    })
    .catch((err) => {
      showError({
        title: 'Could not load sprint.',
        message: err.message || 'Failed to load sprint.',
        primaryLabel: 'Retry sprint',
        primaryAction: 'retry-last-intent',
      });
    });
}

const initHandlers = {
  refreshBoards,
  onBoardChange,
  updateProjectHint,
  onProjectsChange,
  onSprintTabClick,
  handleRefreshSprint,
  selectSprintById,
};

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
      const btn = event.target?.closest?.('[data-action="retry-last-intent"]');
      if (!btn) return;
      try {
        retryLastIntent();
      } catch (err) {
        showError(err.message || 'Failed to retry last action.');
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

// M2: Scroll-aware page identity — inject compact header subtitle when h1 scrolls off (X.com pattern)
function initSprintPageIdentityObserver() {
  try {
    const h1 = document.querySelector('header h1, .header-sprint-name');
    if (!h1 || typeof IntersectionObserver === 'undefined') return;
    const headerRow = document.querySelector('header .header-row') || document.querySelector('header');
    if (!headerRow) return;
    let ctxSpan = document.querySelector('.header-page-context');
    if (!ctxSpan) {
      ctxSpan = document.createElement('span');
      ctxSpan.className = 'header-page-context';
      ctxSpan.setAttribute('aria-hidden', 'true');
      headerRow.appendChild(ctxSpan);
    }
    ctxSpan.textContent = 'Sprint';
    const obs = new IntersectionObserver((entries) => {
      ctxSpan.classList.toggle('visible', !entries[0].isIntersecting);
    }, { threshold: 0 });
    obs.observe(h1);
  } catch (_) {}
}

// M11: Bidirectional scroll fade — capture-phase delegation so dynamically-rendered wrappers are covered
function initSprintTableScrollIndicators() {
  try {
    document.addEventListener('scroll', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('data-table-scroll-wrap')) {
        e.target.classList.toggle('scrolled-right', e.target.scrollLeft > 8);
      }
    }, { passive: true, capture: true });
  } catch (_) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { init(); initSprintPageIdentityObserver(); initSprintTableScrollIndicators(); });
} else {
  init();
  initSprintPageIdentityObserver();
  initSprintTableScrollIndicators();
}
