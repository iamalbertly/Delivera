/**
 * Governance Brief scope bar — persistent projects, period pills, refresh.
 */
import { PROJECTS_SSOT_KEY, GOVERNANCE_QUARTER_KEY, readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { notifyScopeChanged } from './Delivera-Shared-Scope-Notify-01Bridge.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { govPage } from './Delivera-Governance-Brief-Page-01Context.js';
import { setLoadBriefForce } from './Delivera-Governance-Brief-Page-03Load-Controller.js?v=20260719e';
import { invalidateBriefCacheEntry, normalizeProjectsCsv } from './Delivera-Shared-Brief-Client-Cache-01Bridge.js';
import { defaultSelectedKeys, readCatalogKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';
import { mountPIBaselineWizard } from './Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js';
import { COPY, isSimpleMode, simpleStatusLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { sendReadinessBadge } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { fetchQuartersListMemo } from './Delivera-Shared-Quarters-List-01Fetch-Memo.js';
import { openRightDrawer, closeAllGovernanceOverlays } from './Delivera-App-Shared-RightDrawer-01UI.js';
import {
  catalogProjectKeys,
  unionProjectKeys,
  renderExpandedSelectors,
} from './Delivera-Shared-ProjectScope-01Picker.js';

const LAST_VERDICT_KEY = 'delivera_lastVerdictTier';
const GOV_PERIOD_WINDOW_KEY = 'gov-period-window';
const PERIOD_OPTIONS = [
  { id: '14d', label: COPY.period14d },
  { id: '28d', label: COPY.period28d },
  { id: 'pi', label: COPY.periodPi },
];

function readProjects() {
  try {
    const direct = new URLSearchParams(window.location.search).get('projects');
    if (direct) return direct.split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
    if (document.body?.classList?.contains('governance-page')) return readCatalogKeys();
  } catch (_) { /* server/tests */ }
  try {
    if (localStorage.getItem(PROJECTS_SSOT_KEY) === '') return [];
  } catch (_) { /* ignore */ }
  const list = readSharedProjectsCsv();
  return list.length ? list : defaultSelectedKeys();
}

function writeProjects(list) {
  const csv = (Array.isArray(list) ? list : [])
    .map((p) => String(p ?? '').trim().toUpperCase())
    .filter((p) => p && p !== 'UNDEFINED')
    .join(',');
  try { localStorage.setItem(PROJECTS_SSOT_KEY, csv); } catch (_) { /* ignore */ }
  notifyScopeChanged();
}

function briefMatchesSelected(projects = readProjects()) {
  const brief = govPage.lastBrief;
  if (!brief?.projects?.length) return true;
  const selectedCsv = normalizeProjectsCsv(projects.join(','));
  const briefCsv = normalizeProjectsCsv(brief.projects.join(','));
  return selectedCsv === briefCsv;
}

/**
 * @param {object} opts
 */
export function mountGovernanceScopeBar({ mount, quarterLabel = '', onRefresh, onScopeChange, onOpenDrawer, getScopeCounts }) {
  if (!mount) return { getProjects: readProjects, setQuarter: () => {}, getQuarterLabel: () => '' };

  let selected = readProjects();
  let quarters = [];
  let activeQuarter = quarterLabel || '';
  try {
    const storedQ = String(localStorage.getItem(GOVERNANCE_QUARTER_KEY) || '').trim();
    if (storedQ) activeQuarter = storedQ;
  } catch (_) { /* ignore */ }
  let baselineWizard = null;
  let statusTier = 'watch';
  let inboxTotal = 0;
  let confirmCount = 0;
  let sinceDelta = '';
  let advancedWarnCount = 0;
  let projectKeys = unionProjectKeys(catalogProjectKeys(), selected);
  let accessByKey = {};
  let boardsWarn = '';
  let loadBriefSeq = 0;
  let validateTimer = null;
  let periodWindow = '28d';
  try {
    periodWindow = String(sessionStorage.getItem(GOV_PERIOD_WINDOW_KEY) || '28d').toLowerCase();
  } catch (_) { periodWindow = '28d'; }

  let scopeChangeTimer = null;
  let scopeDrawerClose = null;
  let compareHintTimer = null;
  let scopeExpandedOpen = false;
  let refreshLocked = false;
  let mobileTapApplyTimer = null;

  function isMobileScopeLayout() {
    return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)')?.matches;
  }

  function showCompareHint() {
    if (compareHintTimer) clearTimeout(compareHintTimer);
    showInlineToast(mount, 'Use + chips below the squad banner to compare squads.', 'info');
    compareHintTimer = setTimeout(() => { compareHintTimer = null; }, 2200);
  }

  function buildMobileDrawerSelectorsHtml() {
    const periodChips = PERIOD_OPTIONS.map((p) => (
      `<button type="button" class="gov-period-chip${periodWindow === p.id ? ' is-on' : ''}" data-period-chip="${escapeHtml(p.id)}">${escapeHtml(p.label)}</button>`
    )).join('');
    const showInvestment = isSimpleMode() || selected.length > 1;
    const investmentChip = showInvestment
      ? `<button type="button" class="gov-investment-chip btn btn-link btn-compact" data-investment-open="1">${escapeHtml(COPY.investmentLens)}</button>`
      : '';
    const advLabel = advancedWarnCount > 0 ? `Advanced scope (${advancedWarnCount})` : 'Advanced scope';
    return renderExpandedSelectors({
      projectKeys,
      selected,
      quarters,
      activeQuarter,
      advancedLabel: advLabel,
      advancedWarnCount,
      boardsWarn,
      accessByKey,
      periodWindowChips: periodChips,
      investmentChip,
      periodWindow,
      mobileDrawer: true,
    });
  }

  function refreshMobileDrawerBody(panelEl) {
    const body = panelEl?.closest?.('.gov-right-drawer-body') || panelEl;
    if (!body) return;
    body.innerHTML = `${buildMobileDrawerSelectorsHtml()}
      <div class="gov-scope-sheet-apply-row">
        <button type="button" class="btn btn-primary gov-scope-sheet-apply" data-scope-sheet-apply="1">Apply scope</button>
      </div>`;
    bindScopePanelInteractions(body, { deferApply: true });
    body.querySelector('[data-scope-sheet-apply]')?.addEventListener('click', () => {
      closeAllGovernanceOverlays();
      render();
      debouncedScopeChange();
      scheduleValidateSelected(true);
      setLoadBriefForce(true);
      onRefresh?.({ force: true });
    });
  }

  function bindScopePanelInteractions(panelEl, { closeDrawer, deferApply } = {}) {
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
          if (prev.length === 1 && prev[0] !== pk) showCompareHint();
          selected = [pk];
        } else if (selected.includes(pk)) {
          selected = selected.filter((p) => p !== pk);
          if (!selected.length) selected = [pk];
        } else {
          selected = [...selected, pk].sort();
        }
        writeProjects(selected);
        if (deferApply) {
          refreshMobileDrawerBody(panelEl);
          return;
        }
        render();
        commitScopeChange();
        closeDrawer?.();
      });
    });
    root.querySelectorAll('[data-quarter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeQuarter = btn.getAttribute('data-quarter') || '';
        try { localStorage.setItem(GOVERNANCE_QUARTER_KEY, activeQuarter); } catch (_) { /* ignore */ }
        notifyScopeChanged();
        if (deferApply) {
          refreshMobileDrawerBody(panelEl);
          return;
        }
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
        writeProjects(selected);
        if (deferApply) {
          refreshMobileDrawerBody(panelEl);
          if (mobileTapApplyTimer) clearTimeout(mobileTapApplyTimer);
          mobileTapApplyTimer = setTimeout(() => {
            mobileTapApplyTimer = null;
            closeAllGovernanceOverlays();
            render();
            debouncedScopeChange();
            scheduleValidateSelected(true);
            setLoadBriefForce(true);
            onRefresh?.({ force: true });
          }, 700);
          return;
        }
        render();
        commitScopeChange();
      });
    });
    const mobileQuarter = root.querySelector('.gov-scope-mobile-quarter');
    if (mobileQuarter) {
      mobileQuarter.addEventListener('change', () => {
        activeQuarter = mobileQuarter.value || '';
        try { localStorage.setItem(GOVERNANCE_QUARTER_KEY, activeQuarter); } catch (_) { /* ignore */ }
        notifyScopeChanged();
        render();
        onRefresh?.();
        closeDrawer?.();
      });
    }
    root.querySelector('#gov-scope-advanced')?.addEventListener('click', () => {
      closeDrawer?.();
      onOpenDrawer?.();
    });
    root.querySelectorAll('[data-period-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-period-chip') || '28d';
        if (next === periodWindow && !deferApply) return;
        periodWindow = next;
        try { sessionStorage.setItem(GOV_PERIOD_WINDOW_KEY, periodWindow); } catch (_) { /* ignore */ }
        invalidateBriefCacheEntry(normalizeProjectsCsv(selected.join(',')), activeQuarter, periodWindow);
        if (deferApply) {
          refreshMobileDrawerBody(panelEl);
          return;
        }
        render();
        setLoadBriefForce(true);
        onRefresh?.({ force: true });
        closeDrawer?.();
      });
    });
    root.querySelector('[data-period-preset="pi-quarter"]')?.addEventListener('click', () => {
      if (periodWindow === 'pi' && !deferApply) return;
      periodWindow = 'pi';
      try { sessionStorage.setItem(GOV_PERIOD_WINDOW_KEY, periodWindow); } catch (_) { /* ignore */ }
      invalidateBriefCacheEntry(normalizeProjectsCsv(selected.join(',')), activeQuarter, periodWindow);
      if (deferApply) {
        refreshMobileDrawerBody(panelEl);
        return;
      }
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

  function openMobileScopeSheet() {
    closeAllGovernanceOverlays();
    const bodyHtml = `${buildMobileDrawerSelectorsHtml()}
      <div class="gov-scope-sheet-apply-row">
        <button type="button" class="btn btn-primary gov-scope-sheet-apply" data-scope-sheet-apply="1">Apply scope</button>
      </div>`;
    const { close, el } = openRightDrawer({
      title: 'Brief scope',
      bodyHtml,
      panelClass: 'scope-sheet',
    });
    scopeDrawerClose = close;
    const body = el.querySelector('.gov-right-drawer-body');
    bindScopePanelInteractions(body, { deferApply: true });
    body?.querySelector('[data-scope-sheet-apply]')?.addEventListener('click', () => {
      closeAllGovernanceOverlays();
      render();
      debouncedScopeChange();
      scheduleValidateSelected(true);
      setLoadBriefForce(true);
      onRefresh?.({ force: true });
    });
  }

  function debouncedScopeChange() {
    if (scopeChangeTimer) clearTimeout(scopeChangeTimer);
    scopeChangeTimer = setTimeout(() => onScopeChange?.(selected), 300);
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
    writeProjects(selected);
    render();
    debouncedScopeChange();
    scheduleValidateSelected();
  }

  try {
    statusTier = localStorage.getItem(LAST_VERDICT_KEY) || 'watch';
  } catch (_) { /* ignore */ }

  function periodWindowLabel() {
    const opt = PERIOD_OPTIONS.find((p) => p.id === periodWindow);
    return opt?.label || periodWindow;
  }

  function formatScopeProjects(list) {
    if (!list.length) return '—';
    if (list.length <= 3) return list.join(' + ');
    return `${list.slice(0, 2).join(' + ')} +${list.length - 2}`;
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
    const statusActionAttr = '';
    const advLabel = advancedWarnCount > 0 ? `Advanced scope (${advancedWarnCount})` : 'Advanced scope';
    const mobileLayout = isMobileScopeLayout();
    const expandedHidden = mobileLayout ? true : !scopeExpandedOpen;
    const scopeExpandedVisible = !expandedHidden && !mobileLayout;
    const accessKeys = Object.keys(accessByKey);
    const allInaccessible = accessKeys.length > 0 && accessKeys.every((k) => accessByKey[k] === false);
    const accessBanner = allInaccessible
      ? '<p class="gov-scope-access-banner" role="status">Jira access not confirmed for any catalog project — selections kept locally.</p>'
      : '';

    const periodChips = PERIOD_OPTIONS.map((p) => (
      `<button type="button" class="gov-period-chip${periodWindow === p.id ? ' is-on' : ''}" data-period-chip="${escapeHtml(p.id)}">${escapeHtml(p.label)}</button>`
    )).join('');
    const showInvestment = (isSimpleMode() || squadCount > 1) && scopeExpandedVisible;
    const investmentChip = showInvestment
      ? `<button type="button" class="gov-investment-chip btn btn-link btn-compact" data-investment-open="1">${escapeHtml(COPY.investmentLens)}</button>`
      : '';

    const readiness = govPage.lastBrief ? sendReadinessBadge(govPage.lastBrief) : null;
    const readinessPill = readiness
      ? `<span id="gov-send-readiness-pill" class="gov-send-badge gov-send-badge--${escapeHtml(readiness.tier)}" data-send-readiness-ssot="1" title="Send readiness">${escapeHtml(readiness.label)}</span>`
      : '';

    const capsuleText = scopeExpandedVisible
      ? `${squadCount} squad${squadCount === 1 ? '' : 's'}${escapeHtml(intelLine)}`
      : `Scope: <strong>${escapeHtml(formatScopeProjects(selected))}</strong> | Period: <strong>${escapeHtml(periodLabel)} · ${escapeHtml(periodWindowLabel())}</strong> | ${squadCount} squad${squadCount === 1 ? '' : 's'}${escapeHtml(intelLine)}`;
    const changeLabel = mobileLayout ? 'Change scope' : (expandedHidden ? 'Change' : 'Hide scope');
    const changeBtn = `<button type="button" id="gov-scope-change" class="btn btn-link btn-compact">${changeLabel}</button>`;

    const statusChipEl = `<button type="button" class="gov-scope-status-chip gov-scope-status-chip--${escapeHtml(statusTier)}" data-scope-status-action="1" title="Jump to actions">${escapeHtml(statusLabel)}${deltaPart}</button>`;

    mount.innerHTML = `
      ${accessBanner}
      <p id="gov-extension-trust-hint" class="gov-extension-trust-hint" role="status" hidden>Browser extension noise detected — Delivera data is unaffected.</p>
      <div class="gov-scope-capsule" aria-label="Brief scope"${scopeExpandedVisible ? ' data-scope-capsule-compact="1"' : ''}>
        <span class="gov-scope-capsule-text">${capsuleText}</span>
        ${readinessPill}
        ${statusChipEl}
        <div class="gov-scope-actions" role="group" aria-label="Scope actions">
          ${changeBtn}
          <button type="button" id="gov-copy-answer-scope" class="btn btn-secondary btn-compact">Copy answer</button>
          <button type="button" id="gov-scope-refresh" class="btn btn-primary btn-compact">Refresh</button>
        </div>
      </div>
      <div id="gov-scope-expanded" class="gov-scope-expanded${mobileLayout ? ' gov-scope-expanded--mobile-hidden' : ''}" data-project-select-mode="${selected.length > 1 ? 'compare' : 'exclusive'}"${scopeExpandedVisible ? ' data-scope-expanded-visible="1"' : ''}${expandedHidden ? ' hidden' : ''}>
        ${renderExpandedSelectors({ projectKeys, selected, quarters, activeQuarter, advancedLabel: advLabel, advancedWarnCount, boardsWarn, accessByKey, periodWindowChips: periodChips, investmentChip, periodWindow })}
      </div>`;

    bindScopePanelInteractions(mount.querySelector('#gov-scope-expanded'));
    mount.querySelector('[data-scope-status-action]')?.addEventListener('click', async () => {
      const { executeFirstClusterNudge, scrollToFirstClusterNudge } = await import('./Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js');
      if (statusTier === 'onTrack' || statusTier === 'on-track') {
        scrollToFirstClusterNudge();
        return;
      }
      executeFirstClusterNudge();
    });
    mount.querySelector('#gov-copy-answer-scope')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('delivera-gov-copy-answer'));
    });
    mount.querySelector('#gov-freshness-review')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      govPage.inboxApi?.openQueueTab?.('confirm');
    });
    mount.querySelector('#gov-scope-change')?.addEventListener('click', () => {
      if (isMobileScopeLayout()) {
        openMobileScopeSheet();
        return;
      }
      scopeExpandedOpen = !scopeExpandedOpen;
      render();
    });
    mount.querySelector('#gov-scope-refresh')?.addEventListener('click', () => {
      if (refreshLocked) return;
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
  }

  function scheduleValidateSelected(immediate = false) {
    if (validateTimer) clearTimeout(validateTimer);
    validateTimer = setTimeout(() => validateSelectedBoards(), immediate ? 0 : 600);
  }

  async function loadCatalogAccess() {
    try {
      const data = await fetchJson('/api/projects-catalog.json', {}, 'projects-catalog');
      projectKeys = unionProjectKeys(catalogProjectKeys(), selected, readSharedProjectsCsv());
      accessByKey = {};
      for (const row of data?.projects || []) {
        if (row?.key) accessByKey[row.key] = row.accessible;
      }
      if (!Object.values(accessByKey).some((v) => v === true) && !Object.values(accessByKey).some((v) => v === false)) {
        boardsWarn = '';
      }
    } catch (_) {
      projectKeys = unionProjectKeys(catalogProjectKeys(), selected, readSharedProjectsCsv());
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
      if (fromBoards.length) {
        boardsWarn = '';
      } else {
        const names = selected.filter((pk) => accessByKey[pk] === false).join(', ');
        boardsWarn = names
          ? `No boards returned for ${names} — check catalog access or Jira permissions.`
          : 'No boards returned for selected projects — check catalog access.';
      }
    } catch (_) {
      boardsWarn = 'Could not validate selected boards.';
    }
    render();
  }

  loadCatalogAccess();
  scheduleValidateSelected(true);

  fetchQuartersListMemo(8, { includeCached: true })
    .then((data) => {
      quarters = Array.isArray(data?.quarters) ? data.quarters : [];
      const current = quarters.find((q) => q.isCurrent);
      if (!activeQuarter && current?.label) activeQuarter = current.label;
      render();
    })
    .catch(() => render());

  baselineWizard = mountPIBaselineWizard({
    getProjectsCsv: () => selected.join(','),
    getQuarterLabel: () => activeQuarter,
    onSaved: () => onRefresh?.(),
  });

  window.addEventListener('storage', (ev) => {
    if (ev.key !== PROJECTS_SSOT_KEY) return;
    const next = readProjects();
    const csv = next.join(',');
    if (csv === selected.join(',')) return;
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
    openBaselineWizard: (squad = '') => baselineWizard?.open(false, squad),
    openPiBaselineWizard: (squad = '') => baselineWizard?.open(false, squad),
    expandScopePanel: () => {
      scopeExpandedOpen = true;
      const panel = mount.querySelector('#gov-scope-expanded');
      if (panel) panel.removeAttribute('hidden');
      mount.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      render();
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
