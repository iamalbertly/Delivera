import { currentSprintDom, currentSprintKeys } from './Delivera-CurrentSprint-Page-Context.js';
import { showLoading, showError, clearError } from './Delivera-CurrentSprint-Page-Status.js';
import { loadBoards, loadCurrentSprint } from './Delivera-CurrentSprint-Page-Data-Loaders.js';
import { getProjectsParam, getStoredProjects, syncProjectsSelect, persistProjectsSelection, getPreferredBoardId, getPreferredSprintId, persistSelection } from './Delivera-CurrentSprint-Page-Storage.js';
import { initSharedPageIdentityObserver, initSharedTableScrollIndicators } from './Delivera-Shared-Page-Identity-Scroll-Helpers.js';
import { appendCurrentSprintLoginLink, showCurrentSprintRenderedContent } from './Delivera-CurrentSprint-Page-Rendered-Content-Wiring-Helpers.js';
import { initWorkDraftDrawer as initGlobalOutcomeModal } from './Delivera-Work-Draft-Canvas.js';
import { readCurrentSprintSnapshot, saveCurrentSprintSnapshot, clearCurrentSprintSnapshot } from './Delivera-CurrentSprint-Page-Snapshot.js';
import { markPerf, resetPerfMarks } from './Delivera-Shared-Perf-Marks.js';
import { hydrateCurrentSprintProjectsSelect } from './Delivera-CurrentSprint-Projects-Catalog-01Hydrate.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { rewriteContinuityUrl } from './Delivera-Shared-Continuity-Link-01Build.js';

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

function getRequestedSquadFromUrl() {
  try {
    return String(new URL(window.location.href).searchParams.get('squad') || '').trim().toUpperCase().split(',')[0];
  } catch (_) {
    return '';
  }
}

function boardProjectKey(board) {
  return String(board?.projectKey || board?.location?.projectKey || '').trim().toUpperCase();
}

function findBoardIdForSquad(boards, squadKey) {
  const key = String(squadKey || '').trim().toUpperCase();
  if (!key || !Array.isArray(boards)) return '';
  const match = boards.find((board) => boardProjectKey(board) === key);
  return match ? String(match.id) : '';
}

function applySquadAuthoritativeScope(requestedSquad) {
  if (!requestedSquad) return getProjectsParam();
  syncProjectsSelect(requestedSquad);
  persistProjectsSelection(requestedSquad);
  rewriteContinuityUrl({ squad: requestedSquad, projects: requestedSquad });
  return requestedSquad;
}

async function revealPreparedSprintTruth(projects) {
  try {
    const response = await fetch(`/api/current-sprint/truth.json?projects=${encodeURIComponent(projects)}`, { credentials: 'same-origin' });
    if (!response.ok || projects !== getProjectsParam()) return;
    const body = await response.json();
    const truth = body?.records?.[0];
    const loadingEl = currentSprintDom.loadingEl;
    if (!truth || !loadingEl || currentSprintDom.contentEl?.style.display === 'block') return;
    loadingEl.innerHTML = '';
    const mission = document.createElement('section');
    mission.className = 'current-sprint-prepared-mission';
    mission.setAttribute('aria-live', 'polite');
    const label = document.createElement('span');
    label.textContent = 'Last verified sprint';
    const title = document.createElement('strong');
    title.textContent = truth.sprintName || truth.state || 'Sprint evidence';
    const copy = document.createElement('p');
    copy.textContent = truth.copy || 'Refreshing the selected board quietly.';
    const status = document.createElement('small');
    status.textContent = 'Refreshing Jira details quietly…';
    mission.append(label, title, copy, status);
    loadingEl.appendChild(mission);
    loadingEl.classList.remove('current-sprint-loading-with-spinner');
  } catch (_) {
    // The standard honest loading/recovery state remains visible.
  }
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
  const requestedSquad = getRequestedSquadFromUrl();
  // Squad URL token is authoritative: force project scope before boards load so we never
  // resolve SD against an MPSA-only board list and silently fall back to the wrong squad.
  const scopedProjects = applySquadAuthoritativeScope(requestedSquad) || getProjectsParam();
  showRibbon('', 'fresh');
  showLoading('Loading boards for ' + scopedProjects + '...');
  void revealPreparedSprintTruth(scopedProjects);
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
      if (Array.isArray(res.jiraErrors) && res.jiraErrors.length) {
        const keys = res.jiraErrors.map((e) => e.projectKey).filter(Boolean).join(', ');
        showRibbon(
          keys
            ? `Some projects could not load from Jira (${keys}). Deselect them in Report or fix Jira access.`
            : 'Some projects could not load from Jira. Deselect them in Report or fix Jira access.',
          'warning'
        );
      }
      if (!boards.length) {
        setBoardSelectCouldntLoad();
        showBoardsLoadError(
          requestedSquad
            ? `No ${requestedSquad} board in scope. Change scope or open Answer to pick another squad.`
            : 'No boards found for selected projects. Check project filters or run Report preview.',
          preferredId,
          preferredSprintId
        );
        return null;
      }
      const boardSelectEl = document.getElementById('board-select');
      if (boardSelectEl?.parentElement && boards.length === 1 && document.body?.classList?.contains('has-top-chrome')) {
        boardSelectEl.parentElement.style.display = 'none';
      } else if (boardSelectEl?.parentElement) {
        boardSelectEl.parentElement.style.display = '';
      }
      const boardIds = boards.map((b) => String(b.id));
      const squadBoardId = findBoardIdForSquad(boards, requestedSquad);
      if (requestedSquad && !squadBoardId) {
        setBoardSelectCouldntLoad();
        showBoardsLoadError(
          `No ${requestedSquad} board in scope — Change scope. Delivera will not show another squad's backlog.`,
          preferredId,
          preferredSprintId
        );
        return null;
      }
      const preferredStillExists = preferredId && boardIds.includes(preferredId);
      // When squad is present, ignore stale boardId even if it exists in the list from a prior scope.
      const boardId = squadBoardId
        ? squadBoardId
        : (preferredStillExists ? preferredId : boardIds[0]);
      const selectedBoard = boards.find((b) => String(b.id) === String(boardId));
      const selectedProjectKey = boardProjectKey(selectedBoard) || scopedProjects;
      boardSelect.value = boardId;
      currentBoardId = boardId;
      rewriteContinuityUrl({
        squad: requestedSquad || selectedProjectKey,
        projects: selectedProjectKey,
        boardId,
        sprintId: preferredSprintId || '',
      });
      if (selectedProjectKey) {
        syncProjectsSelect(selectedProjectKey);
        persistProjectsSelection(selectedProjectKey);
      }
      const cachedSnapshot = readCurrentSprintSnapshot(getProjectsParam(), boardId);
      const snapshotProject = String(cachedSnapshot?.data?.board?.projectKey || cachedSnapshot?.data?.meta?.projects || '')
        .trim()
        .toUpperCase()
        .split(',')[0];
      const snapshotMatchesSquad = !requestedSquad || !snapshotProject || snapshotProject === requestedSquad;
      if (cachedSnapshot?.data && snapshotMatchesSquad) {
        currentSprintId = cachedSnapshot.data?.sprint?.id || preferredSprintId || null;
        persistSelection(currentBoardId, currentSprintId);
        showCurrentSprintRenderedContent(cachedSnapshot.data, (sprintId) => initHandlers.selectSprintById(sprintId), { source: 'snapshot' });
      }
      if (preferredId && (!preferredStillExists || (squadBoardId && String(preferredId) !== String(squadBoardId)))) {
        try { localStorage.removeItem(currentSprintKeys.boardKey); } catch (_) {}
        try { localStorage.removeItem(currentSprintKeys.sprintKey); } catch (_) {}
        clearCurrentSprintSnapshot(getProjectsParam(), preferredId);
        preferredSprintId = null;
        const boardName = selectedBoard?.name || boardId;
        const hint = document.getElementById('current-sprint-single-project-hint');
        if (hint) hint.textContent = 'Switched to ' + boardName + '.';
      }
      if (!(cachedSnapshot?.data && snapshotMatchesSquad)) {
        const loadingContext = buildLoadingContext(boardSelect?.options?.[boardSelect.selectedIndex]?.text || '');
        showLoading(loadingContext ? ('Loading ' + loadingContext) : 'Loading current sprint...');
      }
      // Drop stale sprintId when squad forced a different board than the URL preferred.
      const sprintToLoad = (squadBoardId && preferredId && String(squadBoardId) !== String(preferredId))
        ? null
        : preferredSprintId;
      const sprintRequestId = ++lastBoardsRefreshRequestId;
      return loadCurrentSprintWithGuard(boardId, sprintToLoad)
        .catch((err) => {
          if (!sprintToLoad) throw err;
          return loadCurrentSprintWithGuard(boardId);
        })
        .then((data) => {
          if (!data) return null;
          if (sprintRequestId !== lastBoardsRefreshRequestId) return null;
          const loadedProject = String(data?.board?.projectKey || data?.meta?.projects || '')
            .trim()
            .toUpperCase()
            .split(',')[0];
          if (requestedSquad && loadedProject && loadedProject !== requestedSquad) {
            showBoardsLoadError(
              `Requested ${requestedSquad} but loaded ${loadedProject}. Retry boards or change scope.`,
              boardId,
              null
            );
            return null;
          }
          currentSprintId = data?.sprint?.id || null;
          persistSelection(currentBoardId, currentSprintId);
          rewriteContinuityUrl({
            squad: requestedSquad || loadedProject,
            projects: loadedProject || getProjectsParam(),
            boardId: currentBoardId,
            sprintId: currentSprintId,
          });
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
      const msg = String(err?.message || err || 'Failed to load boards.');
      // Render/wire ReferenceErrors must not masquerade as board fetch failures when
      // sprint content already painted from snapshot or a successful load.
      const isRenderBug = /is not defined|ReferenceError/i.test(msg);
      const contentVisible = currentSprintDom.contentEl
        && currentSprintDom.contentEl.style.display !== 'none'
        && String(currentSprintDom.contentEl.innerHTML || '').trim().length > 80;
      if (isRenderBug && contentVisible) {
        console.warn('[current-sprint] Non-fatal render error after boards load:', msg);
        return null;
      }
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

function updateScopeInheritChip() {
  try {
    const chip = document.getElementById('current-sprint-scope-chip');
    const label = document.getElementById('current-sprint-scope-chip-label');
    const projectsInline = document.querySelector('.current-sprint-scope-inline');
    const projectsSelect = document.getElementById('current-sprint-projects');
    const boardControls = document.getElementById('current-sprint-board-controls');
    const hasTopChrome = document.body?.classList?.contains('has-top-chrome');
    const desktopWide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)')?.matches;
    const projects = readSharedProjectsCsv().join(', ') || getProjectsParam();
    const headerBarActive = Boolean(document.querySelector('.current-sprint-header-bar[data-context-bar="true"]'));
    if (chip && label) {
      label.textContent = projects ? `Scope: ${projects}` : 'Scope from Answer';
      chip.hidden = !(hasTopChrome && desktopWide) || headerBarActive;
    }
    if (projectsInline) {
      projectsInline.style.display = (hasTopChrome && desktopWide) ? 'none' : '';
    }
    if (projectsSelect && hasTopChrome && desktopWide) {
      projectsSelect.setAttribute('aria-hidden', 'true');
      projectsSelect.tabIndex = -1;
    } else if (projectsSelect) {
      projectsSelect.removeAttribute('aria-hidden');
      projectsSelect.tabIndex = 0;
    }
    if (boardControls && hasTopChrome) {
      boardControls.classList.add('current-sprint-board-controls--inherit');
    }
  } catch (_) {}
}

function updateProjectHint() {
  updateScopeInheritChip();
}

function applyIssueJumpFromUrl() {
  try {
    const issue = new URLSearchParams(window.location.search).get('issue');
    if (!issue) return;
    const jump = document.getElementById('issue-jump-input');
    if (!jump) return;
    jump.value = issue;
    jump.dispatchEvent(new Event('input', { bubbles: true }));
    jump.focus();
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

const initHandlers = { refreshBoards, onBoardChange, updateProjectHint, updateScopeInheritChip, onProjectsChange, onSprintTabClick, handleRefreshSprint, selectSprintById };

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
      console.warn('Current Sprint init failed', error);
    } catch (_) {}
    const message = (error && error.message) ? error.message : 'Unexpected error during Current Sprint setup.';
    showError('Could not initialise Current Sprint view: ' + message);
  }
}

function init() {
  const { boardSelect, contentEl, projectsSelect, errorEl } = currentSprintDom;
  hydrateCurrentSprintProjectsSelect();
  resetPerfMarks('current-sprint');
  try {
    if (window.history && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  } catch (_) {}
  const preferredId = getPreferredBoardId();
  const preferredSprintId = getPreferredSprintId();
  const requestedSquad = getRequestedSquadFromUrl();
  if (requestedSquad) {
    applySquadAuthoritativeScope(requestedSquad);
  } else {
    syncProjectsSelect(getStoredProjects());
  }
  // Prefer a snapshot that matches the authoritative squad/board, not a stale MPSA cache.
  const snapshotBoardId = (() => {
    if (!requestedSquad) return preferredId;
    // Until boards load we may not know SD's board id; skip cross-squad snapshot paint.
    return preferredId;
  })();
  const initialSnapshot = readCurrentSprintSnapshot(getProjectsParam(), snapshotBoardId);
  // Only show snapshot if it matches the URL-specified sprint (prevents stale data flash
  // when user navigates to /current-sprint?boardId=X&sprintId=Y with explicit params)
  const urlParams = new URLSearchParams(window.location.search);
  const urlHasBoardOrSprint = urlParams.has('boardId') || urlParams.has('sprintId');
  const snapshotSprintId = String(initialSnapshot?.data?.sprint?.id || '');
  const snapshotMatchesUrl = !urlHasBoardOrSprint
    || (!preferredSprintId || snapshotSprintId === String(preferredSprintId));
  const snapshotProject = String(initialSnapshot?.data?.board?.projectKey || initialSnapshot?.data?.meta?.projects || '')
    .trim()
    .toUpperCase()
    .split(',')[0];
  const snapshotMatchesSquad = !requestedSquad || !snapshotProject || snapshotProject === requestedSquad;
  // When squad disagrees with preferred boardId, never paint the stale board snapshot.
  const preferredLikelyWrongSquad = Boolean(
    requestedSquad
    && preferredId
    && snapshotProject
    && snapshotProject !== requestedSquad
  );
  if (initialSnapshot?.data && snapshotMatchesUrl && snapshotMatchesSquad && !preferredLikelyWrongSquad) {
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
  applyIssueJumpFromUrl();
  window.addEventListener('delivera:scope-changed', () => {
    syncProjectsSelect(readSharedProjectsCsv().join(','));
    updateScopeInheritChip();
    showRibbon('Scope updated on Answer — refreshing sprint…', 'info');
    initHandlers.refreshBoards(getPreferredBoardId(), getPreferredSprintId());
  });
  if (boardSelect) boardSelect.addEventListener('change', initHandlers.onBoardChange);
  if (contentEl) contentEl.addEventListener('click', initHandlers.onSprintTabClick);
  // Squad selector: switch board (focused squad) from the current-sprint header
  document.addEventListener('change', (event) => {
    const squadSelect = event.target?.closest?.('[data-squad-select]');
    if (!squadSelect) return;
    const boardId = squadSelect.value;
    if (!boardId) return;
    const selectedOpt = squadSelect.selectedOptions?.[0];
    const projectKey = String(selectedOpt?.getAttribute('data-project-key') || '').trim().toUpperCase();
    if (projectKey) {
      syncProjectsSelect(projectKey);
      persistProjectsSelection(projectKey);
      rewriteContinuityUrl({ squad: projectKey, projects: projectKey, boardId });
    } else {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('boardId', boardId);
        url.searchParams.delete('sprintId');
        url.searchParams.delete('squad');
        window.history.replaceState({}, '', url.toString());
      } catch (_) {}
    }
    persistSelection(boardId, null);
    initHandlers.refreshBoards(boardId, null);
  });
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
      return;
    }
    if (event.key === 'delivera:registry-version') {
      showRibbon('Organization settings changed — refreshing sprint truth…', 'info');
      initHandlers.refreshBoards(getPreferredBoardId(), getPreferredSprintId());
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
