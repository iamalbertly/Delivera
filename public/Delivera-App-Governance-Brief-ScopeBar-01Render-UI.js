/**
 * Governance Brief scope bar — persistent projects, period pills, refresh.
 */
import { PROJECTS_SSOT_KEY, GOVERNANCE_QUARTER_KEY, readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { notifyScopeChanged } from './Delivera-Shared-Scope-Notify-01Bridge.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { govPage } from './Delivera-Governance-Brief-Page-01Context.js';
import { setLoadBriefForce } from './Delivera-Governance-Brief-Page-03Load-Controller.js';
import { invalidateBriefCacheEntry, normalizeProjectsCsv } from './Delivera-Shared-Brief-Client-Cache-01Bridge.js';
import { defaultSelectedKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';
import { mountPIBaselineWizard } from './Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js';
import { COPY, isSimpleMode, simpleStatusLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { fetchQuartersListMemo } from './Delivera-Shared-Quarters-List-01Fetch-Memo.js';
import {
  catalogProjectKeys,
  unionProjectKeys,
  renderExpandedSelectors,
} from './Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js';

const LAST_VERDICT_KEY = 'delivera_lastVerdictTier';
const GOV_PERIOD_WINDOW_KEY = 'gov-period-window';
const PERIOD_OPTIONS = [
  { id: '14d', label: COPY.period14d },
  { id: '28d', label: COPY.period28d },
  { id: 'pi', label: COPY.periodPi },
];

function readProjects() {
  const list = readSharedProjectsCsv();
  return list.length ? list : defaultSelectedKeys();
}

function writeProjects(list) {
  const csv = (Array.isArray(list) ? list : []).map((p) => String(p).trim().toUpperCase()).filter(Boolean).join(',');
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

  try {
    statusTier = localStorage.getItem(LAST_VERDICT_KEY) || 'watch';
  } catch (_) { /* ignore */ }

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
    const queuePart = inboxTotal > 0 ? ` (${inboxTotal} pending)` : '';
    const deltaPart = sinceDelta ? ` · ${escapeHtml(sinceDelta.slice(0, 48))}` : '';
    const reviewPart = confirmCount > 0
      ? ` · <button type="button" class="gov-freshness-review-link" id="gov-freshness-review">${confirmCount} claim${confirmCount > 1 ? 's' : ''} to review</button>`
      : '';
    const statusActionAttr = inboxTotal > 0 ? ' data-scope-status-action="inbox" role="button" tabindex="0"' : '';
    const advLabel = advancedWarnCount > 0 ? `Advanced scope (${advancedWarnCount})` : 'Advanced scope';
    const desktopWide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)')?.matches;
    const expandedHidden = desktopWide && selected.length <= 3
      ? false
      : mount.querySelector('#gov-scope-expanded')?.hasAttribute('hidden') !== false;
    const scopeExpandedVisible = !expandedHidden;
    const accessKeys = Object.keys(accessByKey);
    const allInaccessible = accessKeys.length > 0 && accessKeys.every((k) => accessByKey[k] === false);
    const accessBanner = allInaccessible
      ? '<p class="gov-scope-access-banner" role="status">Jira access not confirmed for any catalog project — selections kept locally.</p>'
      : '';

    const periodChips = PERIOD_OPTIONS.map((p) => (
      `<button type="button" class="gov-period-chip${periodWindow === p.id ? ' is-on' : ''}" data-period-chip="${escapeHtml(p.id)}">${escapeHtml(p.label)}</button>`
    )).join('');
    const showInvestment = isSimpleMode() || squadCount > 1;
    const investmentChip = showInvestment
      ? `<button type="button" class="gov-investment-chip btn btn-link btn-compact" data-investment-open="1">${escapeHtml(COPY.investmentLens)}</button>`
      : '';

    const capsuleText = scopeExpandedVisible
      ? `${squadCount} squad${squadCount === 1 ? '' : 's'}${escapeHtml(intelLine)}`
      : `Scope: <strong>${escapeHtml(formatScopeProjects(selected))}</strong> | Period: <strong>${escapeHtml(periodLabel)}</strong> | ${squadCount} squad${squadCount === 1 ? '' : 's'}${escapeHtml(intelLine)}`;
    const changeBtn = (desktopWide && scopeExpandedVisible)
      ? ''
      : '<button type="button" id="gov-scope-change" class="btn btn-link btn-compact">Change</button>';

    mount.innerHTML = `
      ${accessBanner}
      <p id="gov-extension-trust-hint" class="gov-extension-trust-hint" role="status" hidden>Browser extension noise detected — Delivera data is unaffected.</p>
      <div class="gov-scope-period-row" role="group" aria-label="Period window">${periodChips}${investmentChip}
      </div>
      <div class="gov-scope-capsule" aria-label="Brief scope"${scopeExpandedVisible ? ' data-scope-capsule-compact="1"' : ''}>
        <span class="gov-scope-capsule-text">${capsuleText}</span>
        <span class="gov-scope-status-chip gov-scope-status-chip--${escapeHtml(statusTier)}${inboxTotal > 0 ? ' gov-scope-status-chip--actionable' : ''}" title="Delivery status${inboxTotal > 0 ? ' — open agent queue' : ''}"${statusActionAttr}>${escapeHtml(statusLabel)}${escapeHtml(queuePart)}${deltaPart}${reviewPart}</span>
        <div class="gov-scope-actions" role="group" aria-label="Scope actions">
          ${changeBtn}
          <button type="button" id="gov-scope-refresh" class="btn btn-primary btn-compact">Refresh</button>
        </div>
      </div>
      <div id="gov-scope-expanded" class="gov-scope-expanded" data-project-select-mode="exclusive"${scopeExpandedVisible ? ' data-scope-expanded-visible="1"' : ''}${expandedHidden ? ' hidden' : ''}>
        ${renderExpandedSelectors({ projectKeys, selected, quarters, activeQuarter, advancedLabel: advLabel, boardsWarn, accessByKey })}
      </div>`;

    mount.querySelectorAll('[data-project]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        const pk = btn.getAttribute('data-project');
        if (!pk) return;
        const multi = ev.shiftKey || ev.ctrlKey || ev.metaKey;
        if (!multi) {
          selected = [pk];
        } else if (selected.includes(pk)) {
          selected = selected.filter((p) => p !== pk);
          if (!selected.length) selected = [pk];
        } else {
          selected = [...selected, pk].sort();
        }
        writeProjects(selected);
        render();
        onScopeChange?.(selected);
        scheduleValidateSelected();
      });
    });
    mount.querySelectorAll('[data-quarter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeQuarter = btn.getAttribute('data-quarter') || '';
        try { localStorage.setItem(GOVERNANCE_QUARTER_KEY, activeQuarter); } catch (_) { /* ignore */ }
        notifyScopeChanged();
        const seq = ++loadBriefSeq;
        render();
        Promise.resolve(onRefresh?.()).then(() => {
          if (seq !== loadBriefSeq) return;
        });
      });
    });
    mount.querySelectorAll('.gov-scope-mobile-project-check').forEach((inp) => {
      inp.addEventListener('change', () => {
        const pk = String(inp.value || '').trim().toUpperCase();
        if (!pk) return;
        if (inp.checked) selected = [...new Set([...selected, pk])].sort();
        else selected = selected.filter((p) => p !== pk);
        if (!selected.length) selected = [pk];
        writeProjects(selected);
        render();
        onScopeChange?.(selected);
        scheduleValidateSelected();
      });
    });
    const mobileQuarter = mount.querySelector('.gov-scope-mobile-quarter');
    if (mobileQuarter) {
      mobileQuarter.addEventListener('change', () => {
        activeQuarter = mobileQuarter.value || '';
        try { localStorage.setItem(GOVERNANCE_QUARTER_KEY, activeQuarter); } catch (_) { /* ignore */ }
        notifyScopeChanged();
        render();
        onRefresh?.();
      });
    }
    mount.querySelector('#gov-freshness-review')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      govPage.inboxApi?.openQueueTab?.('confirm');
    });
    const statusChip = mount.querySelector('.gov-scope-status-chip[data-scope-status-action="inbox"]');
    if (statusChip) {
      const openInbox = () => govPage.inboxApi?.openQueueTab?.('doNow');
      statusChip.addEventListener('click', (ev) => {
        if (ev.target.closest('.gov-freshness-review-link')) return;
        openInbox();
      });
      statusChip.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openInbox();
        }
      });
    }
    mount.querySelector('#gov-scope-change')?.addEventListener('click', () => {
      const panel = mount.querySelector('#gov-scope-expanded');
      if (panel) panel.toggleAttribute('hidden');
    });
    mount.querySelector('#gov-scope-refresh')?.addEventListener('click', () => {
      setLoadBriefForce(true);
      onRefresh?.({ force: true });
      scheduleValidateSelected(true);
    });
    mount.querySelector('#gov-scope-advanced')?.addEventListener('click', () => onOpenDrawer?.());
    mount.querySelectorAll('[data-period-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        periodWindow = btn.getAttribute('data-period-chip') || '28d';
        try { sessionStorage.setItem(GOV_PERIOD_WINDOW_KEY, periodWindow); } catch (_) { /* ignore */ }
        invalidateBriefCacheEntry(normalizeProjectsCsv(selected.join(',')), activeQuarter);
        render();
        setLoadBriefForce(true);
        onRefresh?.({ force: true });
      });
    });
    mount.querySelector('[data-investment-open]')?.addEventListener('click', () => {
      openEvidenceDrawer(govPage.lastBrief, [], { initialTab: 'investment' });
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
    openBaselineWizard: () => baselineWizard?.open(),
    openPiBaselineWizard: () => baselineWizard?.open(),
    expandScopePanel: () => {
      const panel = mount.querySelector('#gov-scope-expanded');
      if (panel) panel.removeAttribute('hidden');
      mount.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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
  };
}
