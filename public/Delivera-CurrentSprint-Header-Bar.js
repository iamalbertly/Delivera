/**
 * Fixed Header Bar Component — filter/session wiring facade.
 * Markup builders absorbed into Delivera-CurrentSprint-Header-Bar-01Markup-Builders.js.
 */

import { deriveSprintVerdict } from './Delivera-CurrentSprint-Alert-Banner.js';
import { renderSidebarContextCard } from './Delivera-Shared-Context-From-Storage.js';
import {
  deriveUseCaseFromRiskTags,
  getCurrentSprintPayload,
  isSprintCommentSendAllowed,
  showSprintActionToast,
} from './Delivera-CurrentSprint-Action-Bridge.js';
import { openJiraNudgeReviewSheet } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';
import { resolvePrimaryBlockerKey } from './Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';
import { SPRINT_COPY } from './Delivera-CurrentSprint-Copy.js';
import { buildHeaderBarMarkup } from './Delivera-CurrentSprint-Header-Bar-01Markup-Builders.js';
const headerFilterUiState = {
  roleMode: 'all',
  riskTags: [],
  dayKey: '',
};

/** Incremented each time wireHeaderBarHandlers completes a full bind (not early-return). Second+ wires must not reset risk tags from role presets â€” that clobbered Take action / verdict filters after progressive full render. */
let headerBarWireSessionCount = 0;
const headerMiniModeState = {
  activeHeader: null,
  rafPending: false,
  listenersBound: false,
  lastMode: null,
};

function renderHeaderActiveFilterLabel() {
  const activeEls = document.querySelectorAll('#current-sprint-content .current-sprint-header-bar [data-header-active-filter-value]');
  const fallbackEls = activeEls.length
    ? []
    : document.querySelectorAll('.current-sprint-header-bar [data-header-active-filter-value]');
  const chipEls = document.querySelectorAll('[data-header-active-filter-chip]');
  const nodes = activeEls.length ? Array.from(activeEls) : Array.from(fallbackEls);
  if (!nodes.length) return;
  const role = headerFilterUiState.roleMode || 'all';
  const tags = Array.isArray(headerFilterUiState.riskTags) ? headerFilterUiState.riskTags : [];
  const day = headerFilterUiState.dayKey || '';

  let roleLabel = SPRINT_COPY.allWorkDefault;
  if (role === 'developer') roleLabel = SPRINT_COPY.lensDev;
  else if (role === 'scrum-master') roleLabel = SPRINT_COPY.lensSM;
  else if (role === 'product-owner') roleLabel = SPRINT_COPY.lensPO;
  else if (role === 'line-manager') roleLabel = SPRINT_COPY.lensLeads;

  let label = roleLabel;
  if (tags.length) label += ' | ' + tags.join(', ');
  if (day) label += ' | ' + day;

  nodes.forEach((activeStateValueEl) => {
    activeStateValueEl.textContent = label;
  });
  const filterActive = tags.length > 0 || !!day || role !== 'all';
  chipEls.forEach((chipEl) => {
    chipEl.textContent = label;
    chipEl.hidden = !filterActive;
    chipEl.classList.toggle('is-visible', filterActive);
  });
  const headerBars = document.querySelectorAll('#current-sprint-content .current-sprint-header-bar');
  const headerBarList = headerBars.length ? Array.from(headerBars) : Array.from(document.querySelectorAll('.current-sprint-header-bar'));
  headerBarList.forEach((headerBar) => {
    headerBar.classList.add('header-active-filter-state-highlight');
    window.setTimeout(() => headerBar.classList.remove('header-active-filter-state-highlight'), 900);
  });
}

export function renderHeaderBar(data, options = {}) {
  return buildHeaderBarMarkup(data, options);
}

export function relocateSprintScopeIntoHeaderBar() {
  const headerBar = document.querySelector('#current-sprint-content .current-sprint-header-bar')
    || document.querySelector('.current-sprint-header-bar');
  const mount = headerBar?.querySelector('#current-sprint-scope-mount');
  const scopeStack = document.querySelector('.current-sprint-scope-stack');
  if (!mount || !scopeStack || scopeStack.dataset.relocated === '1') return;
  mount.appendChild(scopeStack);
  scopeStack.dataset.relocated = '1';
  const pageHeader = document.querySelector('body.current-sprint-page > .container > header');
  if (pageHeader) pageHeader.classList.add('current-sprint-header-sr-only');
  document.body.classList.add('current-sprint-scope-in-hud');
  window.dispatchEvent(new CustomEvent('delivera:currentSprintScopeRelocated'));
}

export function wireHeaderBarHandlers() {
  const headerBar = document.querySelector('#current-sprint-content .current-sprint-header-bar')
    || document.querySelector('.current-sprint-header-bar');
  if (!headerBar) return;
  relocateSprintScopeIntoHeaderBar();
  // Remove duplicate header bars if multiple instances rendered (dedupe visual chrome)
  try {
    const headerBarsAll = Array.from(document.querySelectorAll('#current-sprint-content .current-sprint-header-bar, .current-sprint-header-bar'));
    if (headerBarsAll.length > 1) {
      headerBarsAll.slice(1).forEach((hb) => { try { hb.remove(); } catch (_) {} });
    }
  } catch (_) {}
  try {
    renderSidebarContextCard();
  } catch (_) {}
  if (headerBar.dataset.headerBarHandlersWired === '1') return;
  headerBar.dataset.headerBarHandlersWired = '1';

  headerBar.querySelectorAll('details.header-view-drawer summary').forEach((summaryEl) => {
    if (summaryEl.dataset.drawerSummaryBound === '1') return;
    summaryEl.dataset.drawerSummaryBound = '1';
    summaryEl.addEventListener('click', () => {
      const details = summaryEl.closest('details');
      if (details && !details.open) {
        window.requestAnimationFrame(() => { details.open = true; });
      }
    });
  });

  const isFirstWire = headerBarWireSessionCount === 0;
  headerBarWireSessionCount += 1;

  const roleButtons = Array.from(document.querySelectorAll('[data-work-risk-role-mode]'));
  const availableRoleModes = new Set(['all', ...roleButtons.map((button) => String(button.getAttribute('data-work-risk-role-mode') || '').trim()).filter(Boolean)]);

  function setRiskTagsState(tags) {
    headerFilterUiState.riskTags = Array.isArray(tags) ? tags.map((t) => String(t || '').trim()).filter(Boolean) : [];
    renderHeaderActiveFilterLabel();
  }

  function applyHeaderRiskAction(preferredTags, source) {
    const candidates = Array.isArray(preferredTags) ? preferredTags : [];
    if (source === 'header-take-action') {
      const selected = candidates.length ? candidates : ['blocker', 'missing-estimate', 'no-log', 'unassigned'];
      setRiskTagsState(selected);
      try {
        window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
          detail: { riskTags: selected, source: source || 'header-action' }
        }));
      } catch (_) {}
      try {
        const scrollTarget = document.getElementById('stuck-card') || document.getElementById('stories-card');
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(scrollTarget);
        else scrollTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
      return;
    }
    const tagsByPriority = [candidates, ['no-log'], ['missing-estimate'], ['scope'], []];
    let selected = [];
    for (const option of tagsByPriority) {
      if (!option.length) {
        selected = [];
        break;
      }
      selected = option;
      break;
    }
    setRiskTagsState(selected);
    try {
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
        detail: { riskTags: selected, source: source || 'header-action' }
      }));
    } catch (_) {}
    try {
      const scrollTarget = document.getElementById('stuck-card') || document.getElementById('stories-card');
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(scrollTarget);
      else scrollTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
  }

  function handleInterventionClick(target, event) {
    const raw = target || event?.target;
    const el = raw && raw.nodeType === 1 ? raw : raw?.parentElement;
    if (!el) return false;
    const bar = el.closest('.current-sprint-header-bar');
    if (!bar) return false;
    if (event) event.preventDefault();
    const focusRemediation = el.closest?.('[data-header-action="focus-remediation"]');
    if (focusRemediation) {
      if (focusRemediation.disabled) {
        showSprintActionToast(SPRINT_COPY.historical, 'error');
        return true;
      }
      try {
        const payload = getCurrentSprintPayload();
        const blockerKey = resolvePrimaryBlockerKey(payload || {});
        const rowSelector = blockerKey
          ? `#work-risks-table tbody tr[data-issue-key="${blockerKey}"], #stories-table tbody tr[data-issue-key="${blockerKey}"], #stuck-card tbody tr[data-issue-key="${blockerKey}"], .story-value-card[data-parent-key="${blockerKey}"]`
          : '#work-risks-table tbody .work-risk-parent-row, #stories-table tbody tr[data-issue-key], #stuck-card tbody tr[data-issue-key]';
        const row = document.querySelector(rowSelector);
        if (row) {
          const link = row.querySelector('a[href*="/browse/"]');
          const key = blockerKey || (link ? (link.textContent || '').trim() : (row.getAttribute('data-issue-key') || row.getAttribute('data-parent-key') || ''));
          const url = link ? link.href : '';
          const summaryCell = row.querySelector('.story-summary-cell, td.subtask-child-summary, td[data-label="Summary"]');
          const statusCell = row.querySelector('.story-status-cell, td[data-label="Status"]');
          const summary = summaryCell ? (summaryCell.textContent || '').trim() : '';
          const status = statusCell ? (statusCell.textContent || '').trim() : '';
          if (key) {
            const payload = getCurrentSprintPayload();
            const riskTags = String(row.getAttribute('data-risk-tags') || '').split(/\s+/).filter(Boolean);
            const staleHours = Number(row.getAttribute('data-hours-in-status') || 0) || null;
            openJiraNudgeReviewSheet({
              issueKey: key,
              issueSummary: summary,
              issueStatus: status,
              issueUrl: url,
              useCase: deriveUseCaseFromRiskTags(riskTags),
              staleHours,
              readOnly: !isSprintCommentSendAllowed(payload?.meta, payload?.sprint),
              meta: payload?.meta,
              sprint: payload?.sprint,
            });
            row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            return true;
          }
        }
      } catch (err) {
        showSprintActionToast(err?.message || 'Could not post comment.', 'error');
      }
      applyHeaderRiskAction(['no-log', 'missing-estimate', 'unassigned', 'blocker'], 'header-take-action');
      return true;
    }
    const shortlistRemediation = el.closest?.('[data-header-action="focus-remediation-shortlist"]');
    if (shortlistRemediation) {
      const tags = String(shortlistRemediation.getAttribute('data-risk-tags') || '')
        .split(/\s+/)
        .filter(Boolean);
      applyHeaderRiskAction(tags, 'header-shortlist');
      return true;
    }
    const interventionTarget = el.closest?.('.sprint-intervention-item');
    if (interventionTarget) {
      const tags = String(interventionTarget.getAttribute('data-risk-tags') || '').split(/\s+/).filter(Boolean);
      applyHeaderRiskAction(tags, 'header-intervention');
      return true;
    }
    return false;
  }

  function handleVerdictPillClick(target, event) {
    const raw = target || event?.target;
    const el = raw && raw.nodeType === 1 ? raw : raw?.parentElement;
    const pill = el?.matches?.('.verdict-pill') ? el : el?.closest?.('.verdict-pill');
    const bar = pill?.closest?.('.current-sprint-header-bar');
    if (!pill || !bar) return false;
    if (event) event.preventDefault();
    const riskTagsAttr = pill.getAttribute('data-risk-tags') || '';
    const riskTags = riskTagsAttr.split(/\s+/).filter(Boolean);
    setRiskTagsState(riskTags);
    try {
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'header-verdict' } }));
    } catch (_) {}
    try {
      const scrollTarget = document.getElementById('stuck-card') || document.getElementById('stories-card');
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(scrollTarget);
      else scrollTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
    return true;
  }

  const contentRoot = document.getElementById('current-sprint-content');
  const delegationHost = contentRoot || headerBar;
  if (delegationHost.dataset.headerBarActionDelegationWired !== '1') {
    delegationHost.dataset.headerBarActionDelegationWired = '1';
    delegationHost.addEventListener('click', (event) => {
      const raw = event.target;
      const el = raw && raw.nodeType === 1 ? raw : raw?.parentElement;
      if (!el) return;
      const bar = el.closest('.current-sprint-header-bar');
      if (!bar) return;
      const showMore = el.closest('[data-action="show-more-roles"]');
      if (showMore && bar.contains(showMore)) {
        event.preventDefault();
        try {
          const parent = showMore.closest('.header-role-modes');
          if (parent) {
            const list = parent.querySelector('.role-mode-more-list');
            const expanded = showMore.getAttribute('aria-expanded') === 'true';
            showMore.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            if (list) list.style.display = expanded ? 'none' : 'block';
          }
        } catch (_) {}
        return;
      }
      const leadershipLink = el.closest('[data-header-action="open-leadership-trend"]');
      if (leadershipLink && bar.contains(leadershipLink)) {
        try {
          const url = new URL(leadershipLink.href, window.location.origin);
          window.localStorage.setItem('leadership_focus_context', JSON.stringify({
            project: url.searchParams.get('project') || '',
            board: url.searchParams.get('board') || '',
            source: 'current-sprint',
          }));
        } catch (_) {}
      }
      if (handleInterventionClick(el, event)) {
        return;
      }

      const resetFilters = el.closest('[data-header-action="reset-filters"]');
      if (resetFilters && bar.contains(resetFilters)) {
        event.preventDefault();
        setRiskTagsState([]);
        headerFilterUiState.dayKey = '';
        applyRoleMode('all');
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: [], source: 'header-reset-filters' } }));
        } catch (_) {}
        renderHeaderActiveFilterLabel();
        return;
      }

      const refreshContext = el.closest('[data-context-action="refresh-current-sprint-context"]');
      if (refreshContext && bar.contains(refreshContext)) {
        event.preventDefault();
        document.dispatchEvent(new Event('refreshSprint'));
        return;
      }

      const openReportContext = el.closest('[data-header-action="open-report-context"], [data-context-action="open-report-context"]');
      if (openReportContext && bar.contains(openReportContext)) {
        event.preventDefault();
        const href = openReportContext.getAttribute('href');
        window.location.href = href || '/report';
        return;
      }

    }, true);
  }

  if (!window.__currentSprintHeaderStateBridgeBound) {
    window.__currentSprintHeaderStateBridgeBound = true;
    try {
      window.addEventListener('currentSprint:applyWorkRiskFilter', (event) => {
        const detail = event?.detail || {};
        const riskTags = Array.isArray(detail.riskTags) ? detail.riskTags.map((t) => String(t || '').trim()).filter(Boolean) : [];
        const source = String(detail.source || '');
        if (source.startsWith('role-mode-')) {
          headerFilterUiState.roleMode = source.replace('role-mode-', '');
        }
        headerFilterUiState.riskTags = riskTags;
        renderHeaderActiveFilterLabel();
      });
      window.addEventListener('currentSprint:applyRoleMode', (event) => {
        const detail = event?.detail || {};
        applyRoleMode(String(detail.mode || 'all'));
      });
      window.addEventListener('currentSprint:storiesDayFilterChanged', (event) => {
        const activeHeader = document.querySelector('#current-sprint-content .current-sprint-header-bar');
        if (!activeHeader) return;
        const detail = event?.detail || {};
        const dayKey = String(detail.dayKey || '').trim();
        activeHeader.setAttribute('data-active-day-key', dayKey);
        headerFilterUiState.dayKey = dayKey;
        renderHeaderActiveFilterLabel();
      });
    } catch (_) {}
  }

  /** Mini collapse: tablets/desktop only. Use one shared listener + hysteresis to avoid threshold flicker. */
  function applyMiniMode(headerEl) {
    if (!headerEl || !headerEl.isConnected) return;
    const miniStrip = headerEl.querySelector('.header-mini-strip');
    if (window.innerWidth <= 720) {
      headerEl.classList.remove('header-mini-mode');
      headerMiniModeState.lastMode = false;
      if (miniStrip) miniStrip.setAttribute('aria-hidden', 'true');
      return;
    }
    const baseThreshold = Math.max(120, (headerEl.offsetTop || 0) + 72);
    const enterThreshold = baseThreshold + 18;
    const exitThreshold = baseThreshold - 18;
    const scrollY = window.scrollY || 0;
    const currentMode = headerMiniModeState.lastMode === true;
    const nextMode = currentMode ? (scrollY > exitThreshold) : (scrollY > enterThreshold);
    if (nextMode !== currentMode) {
      headerEl.classList.toggle('header-mini-mode', nextMode);
      headerMiniModeState.lastMode = nextMode;
      if (miniStrip) miniStrip.setAttribute('aria-hidden', nextMode ? 'false' : 'true');
    }
  }

  function scheduleMiniModeSync() {
    if (headerMiniModeState.rafPending) return;
    headerMiniModeState.rafPending = true;
    window.requestAnimationFrame(() => {
      headerMiniModeState.rafPending = false;
      applyMiniMode(headerMiniModeState.activeHeader);
    });
  }

  headerMiniModeState.activeHeader = headerBar;
  headerMiniModeState.lastMode = null;
  applyMiniMode(headerBar);
  if (!headerMiniModeState.listenersBound) {
    headerMiniModeState.listenersBound = true;
    window.addEventListener('scroll', scheduleMiniModeSync, { passive: true });
    window.addEventListener('resize', scheduleMiniModeSync, { passive: true });
  }

  const sprintName = headerBar.querySelector('.header-sprint-name');
  if (sprintName) {
    sprintName.style.cursor = 'pointer';
    sprintName.addEventListener('click', () => {
      const switcher = document.querySelector('.sprint-switcher-card, .sprint-hud-details');
      if (switcher) {
        switcher.open = true;
      }
      const carousel = document.querySelector('.sprint-hud-carousel-inline, .sprint-carousel, .sprint-switcher-card');
      if (carousel) {
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(carousel);
        else carousel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  const verdictLine = headerBar.querySelector('.sprint-verdict-line');
  if (verdictLine) {
    verdictLine.addEventListener('click', (event) => {
      handleVerdictPillClick(event.target, event);
    });
  }

  headerBar.querySelectorAll('.sprint-intervention-item').forEach((button) => {
    if (button.dataset.headerActionBound === '1') return;
    button.dataset.headerActionBound = '1';
    button.addEventListener('click', (event) => {
      handleInterventionClick(button, event);
    });
  });

  headerBar.querySelectorAll('.verdict-pill').forEach((button) => {
    if (button.dataset.headerVerdictBound === '1') return;
    button.dataset.headerVerdictBound = '1';
    button.addEventListener('click', (event) => {
      handleVerdictPillClick(button, event);
    });
  });

  const roleModeKey = 'current_sprint_role_mode';

  function applyRoleMode(mode, options = {}) {
    const silent = options.silent === true;
    const applyPresetFromRole = options.applyPreset !== false;
    let active = mode || 'all';
    if (!availableRoleModes.has(active)) {
      active = 'all';
    }
    roleButtons.forEach((button) => {
      button.classList.toggle('is-active', button.getAttribute('data-work-risk-role-mode') === active);
      button.setAttribute('aria-pressed', button.classList.contains('is-active') ? 'true' : 'false');
    });
    headerFilterUiState.roleMode = active;
    if (silent && !applyPresetFromRole) {
      renderHeaderActiveFilterLabel();
      return;
    }
    const presetMap = {
      all: [],
      developer: ['no-log', 'missing-estimate'],
      'scrum-master': ['blocker'],
      'product-owner': ['scope', 'blocker'],
      'line-manager': ['unassigned', 'blocker'],
    };
    const riskTags = presetMap[active] || [];
    setRiskTagsState(riskTags);
    try {
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'role-mode-' + active } }));
    } catch (_) {}
    renderHeaderActiveFilterLabel();
    if (!silent) {
      try {
        const stories = document.getElementById('stories-card') || document.getElementById('stuck-card');
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(stories);
        else stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
    }
  }

  let initialMode = 'all';
  try {
    const stored = window.localStorage.getItem(roleModeKey);
    if (stored) initialMode = stored;
  } catch (_) {}
  if (isFirstWire) {
    applyRoleMode(initialMode, { silent: true, applyPreset: true });
  } else {
    applyRoleMode(headerFilterUiState.roleMode || initialMode, { silent: true, applyPreset: false });
  }

  roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.getAttribute('data-work-risk-role-mode') || 'all';
      try {
        window.localStorage.setItem(roleModeKey, mode);
      } catch (_) {}
      applyRoleMode(mode);
    });
  });

  try {
    const payload = getCurrentSprintPayload();
    const autoKey = 'delivera.sprint.autoBlocker.v1';
    const autoVerdict = deriveSprintVerdict(payload || {});
    const autoBlocked = String(autoVerdict?.verdict || '').toLowerCase().includes('blocked')
      || Number((payload?.stuckCandidates || []).length || 0) > 0;
    if (autoBlocked && sessionStorage.getItem(autoKey) !== '1') {
      sessionStorage.setItem(autoKey, '1');
      setRiskTagsState(['blocker']);
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
        detail: { riskTags: ['blocker'], source: 'auto-blocked-verdict' },
      }));
      window.setTimeout(() => {
        const stories = document.getElementById('stories-card') || document.getElementById('stories-card-wrap');
        if (stories && typeof window.currentSprintScrollToTarget === 'function') {
          window.currentSprintScrollToTarget(stories);
        } else {
          stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        }
      }, 120);
    }
  } catch (_) {}

  renderHeaderActiveFilterLabel();
}
