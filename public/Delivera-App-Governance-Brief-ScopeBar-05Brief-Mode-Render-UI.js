/**
 * Governance Brief scope bar — projects, period pills, refresh (non-portfolio mode).
 */
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { notifyScopeChanged } from './Delivera-Shared-Scope-Notify-01Bridge.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { govPage } from './Delivera-Governance-Brief-Page-01Context.js';
import { setLoadBriefForce } from './Delivera-Governance-Brief-Page-03Load-Controller.js';
import { invalidateBriefCacheEntry, normalizeProjectsCsv } from './Delivera-Shared-Brief-Client-Cache-01Bridge.js';
import { mountPIBaselineWizard } from './Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js';
import { COPY, isSimpleMode, simpleStatusLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { sendReadinessBadge } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { seedProjectCatalogCache, summarizeProjectKeys } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import { mountScopeIntelligenceInline } from './Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js';
import { closeAllGovernanceOverlays } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { renderExpandedSelectors } from './Delivera-Shared-ProjectScope-01Picker.js';
import {
  readScopeProjects,
  writeScopeProjects,
  readStoredQuarter,
  writeStoredQuarter,
  readPeriodWindow,
  writePeriodWindow,
  unionScopeProjectKeys,
  loadQuartersList,
  bindProjectsStorageSync,
  GOV_PERIOD_WINDOW_KEY,
  SCOPE_COLLAPSE_KEY,
  LAST_VERDICT_KEY,
} from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';

const PERIOD_OPTIONS = [
  { id: '14d', label: COPY.period14d },
  { id: '28d', label: COPY.period28d },
  { id: 'pi', label: COPY.periodPi },
];

function briefMatchesSelected(projects = readScopeProjects()) {
  const brief = govPage.lastBrief;
  if (!brief?.projects?.length) return true;
  return normalizeProjectsCsv(projects.join(',')) === normalizeProjectsCsv(brief.projects.join(','));
}

/**
 * @param {object} opts
 */
export function mountBriefScopeBarMode({ mount, quarterLabel = '', onRefresh, onScopeChange, onOpenDrawer, getScopeCounts }) {
  if (!mount) return { getProjects: readScopeProjects, setQuarter: () => {}, getQuarterLabel: () => '' };

  let selected = readScopeProjects();
  let quarters = [];
  let activeQuarter = readStoredQuarter(quarterLabel || '');
  let baselineWizard = null;
  let statusTier = 'watch';
  let inboxTotal = 0;
  let confirmCount = 0;
  let sinceDelta = '';
  let advancedWarnCount = 0;
  let projectKeys = unionScopeProjectKeys(selected);
  let accessByKey = {};
  let boardsWarn = '';
  let validateTimer = null;
  let periodWindow = readPeriodWindow('28d');
  let scopeChangeTimer = null;
  let compareHintTimer = null;
  let refreshLocked = false;
  let scopeCollapsed = true;
  try {
    if (sessionStorage.getItem(SCOPE_COLLAPSE_KEY) === '0') scopeCollapsed = false;
  } catch (_) { /* ignore */ }

  function isMobileScopeViewport() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  function shouldCollapseScopeExpanded() {
    return scopeCollapsed && isMobileScopeViewport();
  }

  function syncScopeCollapseState() {
    if (!isMobileScopeViewport()) {
      mount.removeAttribute('data-scope-collapsed');
      return;
    }
    mount.dataset.scopeCollapsed = scopeCollapsed ? '1' : '0';
    try { sessionStorage.setItem(SCOPE_COLLAPSE_KEY, scopeCollapsed ? '1' : '0'); } catch (_) { /* ignore */ }
  }

  function debouncedScopeChange() {
    if (scopeChangeTimer) clearTimeout(scopeChangeTimer);
    scopeChangeTimer = setTimeout(() => onScopeChange?.(selected), 300);
  }

  function bindScopePanelInteractions(panelEl, { closeDrawer } = {}) {
    if (!panelEl) return;
    const root = panelEl.querySelector('.gov-scope-bar-inner') || panelEl;

    function commitScopeChange({ refreshBrief = false } = {}) {
      debouncedScopeChange();
      scheduleValidateSelected();
      if (refreshBrief) {
        setLoadBriefForce(true);
        onRefresh?.({ force: true });
      }
    }

    root.querySelectorAll('[data-project]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        closeAllGovernanceOverlays();
        const pk = btn.getAttribute('data-project');
        if (!pk) return;
        const multi = ev.shiftKey || ev.ctrlKey || ev.metaKey;
        const prev = [...selected];
        if (!multi) {
          if (prev.length === 1 && prev[0] !== pk) {
            addToCompare(pk);
            closeDrawer?.();
            return;
          }
          selected = [pk];
        } else if (selected.includes(pk)) {
          selected = selected.filter((p) => p !== pk);
          if (!selected.length) selected = [pk];
        } else {
          selected = [...selected, pk].sort();
        }
        writeScopeProjects(selected);
        render();
        commitScopeChange();
        closeDrawer?.();
      });
    });
    root.querySelectorAll('[data-quarter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeQuarter = btn.getAttribute('data-quarter') || '';
        writeStoredQuarter(activeQuarter);
        render();
        setLoadBriefForce(true);
        onRefresh?.({ force: true });
        closeDrawer?.();
      });
    });
    root.querySelectorAll('.gov-scope-mobile-project-check').forEach((inp) => {
      inp.addEventListener('change', () => {
        const pk = String(inp.value || '').trim().toUpperCase();
        if (!pk) return;
        if (inp.checked) selected = [...new Set([...selected, pk])].sort();
        else selected = selected.filter((p) => p !== pk);
        if (!selected.length) selected = [pk];
        writeScopeProjects(selected);
        render();
        commitScopeChange();
      });
    });
    const mobileQuarter = root.querySelector('.gov-scope-mobile-quarter');
    if (mobileQuarter) {
      mobileQuarter.addEventListener('change', () => {
        activeQuarter = mobileQuarter.value || '';
        writeStoredQuarter(activeQuarter);
        render();
        onRefresh?.();
        closeDrawer?.();
      });
    }
    root.querySelectorAll('[data-period-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-period-chip') || '28d';
        if (next === periodWindow) return;
        periodWindow = next;
        writePeriodWindow(periodWindow);
        invalidateBriefCacheEntry(normalizeProjectsCsv(selected.join(',')), activeQuarter, periodWindow);
        render();
        setLoadBriefForce(true);
        onRefresh?.({ force: true });
        closeDrawer?.();
      });
    });
    root.querySelector('[data-period-preset="pi-quarter"]')?.addEventListener('click', () => {
      if (periodWindow === 'pi') return;
      periodWindow = 'pi';
      writePeriodWindow(periodWindow);
      invalidateBriefCacheEntry(normalizeProjectsCsv(selected.join(',')), activeQuarter, periodWindow);
      render();
      setLoadBriefForce(true);
      onRefresh?.({ force: true });
      closeDrawer?.();
    });
    root.querySelector('[data-investment-open]')?.addEventListener('click', () => {
      closeDrawer?.();
      openEvidenceDrawer(govPage.lastBrief, [], { initialTab: 'investment' });
    });
  }

  function addToCompare(pk) {
    closeAllGovernanceOverlays();
    const normalized = String(pk || '').trim().toUpperCase();
    if (!normalized) return;
    if (selected.includes(normalized)) {
      if (selected.length > 1) selected = selected.filter((p) => p !== normalized);
    } else {
      selected = [...selected, normalized].sort();
    }
    writeScopeProjects(selected);
    render();
    debouncedScopeChange();
    scheduleValidateSelected();
  }

  try {
    statusTier = localStorage.getItem(LAST_VERDICT_KEY) || 'watch';
  } catch (_) { /* ignore */ }

  function periodWindowLabel() {
    return PERIOD_OPTIONS.find((p) => p.id === periodWindow)?.label || periodWindow;
  }

  function formatScopeProjects(list) {
    if (!list.length) return '—';
    return summarizeProjectKeys(list, { context: 'chip' }).full;
  }

  function render() {
    const periodLabel = activeQuarter || 'Current';
    const squadCount = selected.length;
    const counts = briefMatchesSelected(selected) ? (getScopeCounts?.() || {}) : {};
    const intelStale = !briefMatchesSelected(selected);
    const intelLine = intelStale
      ? ' · updating…'
      : (counts.available != null
        ? ` · ${counts.available} available · ${counts.noSprint || 0} no sprint · ${counts.piCommitted || 0} with epics`
        : '');
    const statusLabel = simpleStatusLabel(statusTier, true);
    const deltaPart = sinceDelta ? ` · ${escapeHtml(sinceDelta.slice(0, 48))}` : '';
    const advLabel = advancedWarnCount > 0 ? `Advanced scope (${advancedWarnCount})` : 'Advanced scope';
    const accessKeys = Object.keys(accessByKey);
    const allInaccessible = accessKeys.length > 0 && accessKeys.every((k) => accessByKey[k] === false);
    const accessBanner = allInaccessible
      ? '<p class="gov-scope-access-banner" role="status">Jira access not confirmed for any catalog project — selections kept locally.</p>'
      : '';
    const periodChips = PERIOD_OPTIONS.map((p) => (
      `<button type="button" class="gov-period-chip${periodWindow === p.id ? ' is-on' : ''}" data-period-chip="${escapeHtml(p.id)}">${escapeHtml(p.label)}</button>`
    )).join('');
    const showInvestment = isSimpleMode() || squadCount > 1
      || !!(govPage.lastBrief?.meta?.boardSummaries && Object.keys(govPage.lastBrief.meta.boardSummaries).length);
    const investmentChip = showInvestment
      ? `<button type="button" class="gov-investment-chip btn btn-link btn-compact" data-investment-open="1">${escapeHtml(COPY.investmentLens)}</button>`
      : '';
    const readiness = govPage.lastBrief ? sendReadinessBadge(govPage.lastBrief) : null;
    const readinessPill = readiness
      ? `<span id="gov-send-readiness-pill" class="gov-send-badge gov-send-badge--${escapeHtml(readiness.tier)}" data-send-readiness-ssot="1" title="Send readiness">${escapeHtml(readiness.label)}</span>`
      : '';
    const capsuleText = `${squadCount} squad${squadCount === 1 ? '' : 's'} · <strong>${escapeHtml(formatScopeProjects(selected))}</strong> · ${escapeHtml(periodLabel)} · ${escapeHtml(periodWindowLabel())}${escapeHtml(intelLine)}`;
    const statusChipEl = `<button type="button" class="gov-scope-status-chip gov-scope-status-chip--${escapeHtml(statusTier)}" data-scope-status-action="1" title="Jump to actions">${escapeHtml(statusLabel)}${deltaPart}</button>`;
    const scopeToggleBtn = isMobileScopeViewport()
      ? `<button type="button" id="gov-scope-toggle" class="btn btn-link btn-compact gov-scope-mobile-only" aria-expanded="${scopeCollapsed ? 'false' : 'true'}" aria-controls="gov-scope-expanded">${scopeCollapsed ? 'Change scope' : 'Hide scope'}</button>`
      : '';

    syncScopeCollapseState();

    mount.innerHTML = `
      ${accessBanner}
      <p id="gov-extension-trust-hint" class="gov-extension-trust-hint" role="status" hidden>Browser extension noise detected — Delivera data is unaffected.</p>
      <div class="gov-scope-flat-row" aria-label="Brief scope">
        <div class="gov-scope-summary-strip">
          <span class="gov-scope-capsule-text">${capsuleText}</span>
          ${readinessPill}
          ${statusChipEl}
          ${scopeToggleBtn}
          <div class="gov-scope-actions" role="group" aria-label="Scope actions">
            <button type="button" id="gov-scope-save-default" class="btn btn-link btn-compact">Save as my default</button>
            <button type="button" id="gov-copy-answer-scope" class="btn btn-secondary btn-compact">Copy answer</button>
            <button type="button" id="gov-scope-refresh" class="btn btn-primary btn-compact">Refresh</button>
          </div>
        </div>
        <div id="gov-scope-expanded" class="gov-scope-expanded" data-project-select-mode="${selected.length > 1 ? 'compare' : 'exclusive'}" data-scope-expanded-visible="${shouldCollapseScopeExpanded() ? '0' : '1'}"${shouldCollapseScopeExpanded() ? ' hidden' : ''}>
          ${renderExpandedSelectors({ projectKeys, selected, quarters, activeQuarter, advancedLabel: advLabel, advancedWarnCount, boardsWarn, accessByKey, periodWindowChips: periodChips, investmentChip, periodWindow, openAdvancedScope: !isMobileScopeViewport() })}
        </div>
      </div>`;

    mount.querySelector('#gov-scope-toggle')?.addEventListener('click', () => {
      scopeCollapsed = !scopeCollapsed;
      render();
    });
    bindScopePanelInteractions(mount.querySelector('#gov-scope-expanded'));
    mount.querySelector('[data-scope-status-action]')?.addEventListener('click', async () => {
      const chip = mount.querySelector('[data-scope-status-action]');
      chip?.setAttribute('data-scope-status-active', '1');
      setTimeout(() => chip?.removeAttribute('data-scope-status-active'), 1200);
      const { focusFirstClusterNudge } = await import('./Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js');
      focusFirstClusterNudge();
    });
    mount.querySelector('#gov-scope-save-default')?.addEventListener('click', () => {
      writeScopeProjects(selected);
      if (activeQuarter) writeStoredQuarter(activeQuarter);
      showInlineToast(mount, 'Saved as your default scope.', 'success');
    });
    mount.querySelector('#gov-copy-answer-scope')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('delivera-gov-copy-answer'));
    });
    mount.querySelector('#gov-freshness-review')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      govPage.inboxApi?.openQueueTab?.('confirm');
    });
    mount.querySelector('#gov-scope-refresh')?.addEventListener('click', () => {
      if (refreshLocked) return;
      closeAllGovernanceOverlays();
      refreshLocked = true;
      const refreshBtn = mount.querySelector('#gov-scope-refresh');
      refreshBtn?.setAttribute('disabled', 'disabled');
      refreshBtn?.setAttribute('aria-busy', 'true');
      setLoadBriefForce(true);
      onRefresh?.({ force: true });
      scheduleValidateSelected(true);
      setTimeout(() => {
        refreshLocked = false;
        refreshBtn?.removeAttribute('disabled');
        refreshBtn?.removeAttribute('aria-busy');
      }, 1000);
    });
    if (govPage.lastBrief && !(scopeCollapsed && isMobileScopeViewport())) {
      mountScopeIntelligenceInline(govPage.lastBrief);
    }
  }

  function scheduleValidateSelected(immediate = false) {
    if (validateTimer) clearTimeout(validateTimer);
    validateTimer = setTimeout(() => validateSelectedBoards(), immediate ? 0 : 600);
  }

  async function loadCatalogAccess() {
    try {
      const data = await fetchJson('/api/projects-catalog.json', {}, 'projects-catalog');
      seedProjectCatalogCache(data);
      projectKeys = unionScopeProjectKeys(selected);
      accessByKey = {};
      for (const row of data?.projects || []) {
        if (row?.key) accessByKey[row.key] = row.accessible;
      }
      if (!Object.values(accessByKey).some((v) => v === true) && !Object.values(accessByKey).some((v) => v === false)) {
        boardsWarn = '';
      }
    } catch (_) {
      projectKeys = unionScopeProjectKeys(selected);
      boardsWarn = 'Could not load project catalog.';
    }
    render();
  }

  async function validateSelectedBoards() {
    if (!selected.length) return;
    const probe = selected.join(',');
    try {
      const data = await fetchJson(`/api/boards.json?projects=${encodeURIComponent(probe)}`, {}, 'boards-validate');
      const fromBoards = (data?.boards || []).map((b) => b.projectKey).filter(Boolean);
      const fromErrors = (data?.projectErrors || []).map((e) => e.project).filter(Boolean);
      for (const pk of [...fromBoards, ...fromErrors]) {
        accessByKey[pk] = fromBoards.includes(pk);
      }
      boardsWarn = fromBoards.length
        ? ''
        : (selected.filter((pk) => accessByKey[pk] === false).join(', ')
          ? `No boards returned for ${selected.filter((pk) => accessByKey[pk] === false).join(', ')} — check catalog access or Jira permissions.`
          : 'No boards returned for selected projects — check catalog access.');
    } catch (_) {
      boardsWarn = 'Could not validate selected boards.';
    }
    render();
  }

  loadCatalogAccess();
  scheduleValidateSelected(true);
  loadQuartersList(
    (q, currentLabel) => {
      quarters = q;
      if (!activeQuarter && currentLabel) activeQuarter = currentLabel;
      render();
    },
    () => render(),
  );

  baselineWizard = mountPIBaselineWizard({
    getProjectsCsv: () => selected.join(','),
    getAnchorProject: () => selected[0] || '',
    getQuarterLabel: () => activeQuarter,
    onSaved: () => onRefresh?.(),
  });

  bindProjectsStorageSync(() => {
    const next = readScopeProjects();
    if (next.join(',') === selected.join(',')) return;
    selected = next;
    render();
    notifyScopeChanged();
    onScopeChange?.(selected);
    onRefresh?.();
  });

  render();
  return {
    getProjects: () => [...selected],
    getQuarterLabel: () => activeQuarter,
    getPeriodWindow: () => periodWindow,
    refreshCapsule: () => render(),
    openPiBaselineWizard: (opts) => baselineWizard?.open(false, opts),
    openBaselineWizard: (opts) => baselineWizard?.open(false, opts),
    focusScopeBar: () => {
      const target = mount.querySelector('#gov-scope-expanded [data-project], #gov-scope-expanded .gov-scope-mobile-project-check')
        || mount.querySelector('.gov-scope-capsule-text');
      target?.focus?.({ preventScroll: true });
    },
    updateStatus(tier, queue = 0, sinceSummary = '', confirms = 0) {
      statusTier = tier || 'watch';
      inboxTotal = Number(queue) || 0;
      confirmCount = Math.max(0, Number(confirms) || 0);
      sinceDelta = sinceSummary || '';
      try { localStorage.setItem(LAST_VERDICT_KEY, statusTier); } catch (_) { /* ignore */ }
      render();
    },
    setAdvancedWarnCount(n) {
      advancedWarnCount = Math.max(0, Number(n) || 0);
      render();
    },
    addToCompare,
  };
}
