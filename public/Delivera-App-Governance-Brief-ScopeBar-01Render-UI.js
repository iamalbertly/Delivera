/**
 * Governance Brief scope bar — persistent projects, period pills, refresh.
 */
import { PROJECTS_SSOT_KEY, readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { defaultSelectedKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';
import { mountPIBaselineWizard } from './Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js';
import { simpleStatusLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import {
  catalogProjectKeys,
  unionProjectKeys,
  renderExpandedSelectors,
} from './Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js';

const LAST_VERDICT_KEY = 'delivera_lastVerdictTier';

function readProjects() {
  const list = readSharedProjectsCsv();
  return list.length ? list : defaultSelectedKeys();
}

function writeProjects(list) {
  const csv = (Array.isArray(list) ? list : []).map((p) => String(p).trim().toUpperCase()).filter(Boolean).join(',');
  try { localStorage.setItem(PROJECTS_SSOT_KEY, csv); } catch (_) { /* ignore */ }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * @param {object} opts
 */
export function mountGovernanceScopeBar({ mount, quarterLabel = '', onRefresh, onScopeChange, onOpenDrawer, getScopeCounts }) {
  if (!mount) return { getProjects: readProjects, setQuarter: () => {}, getQuarterLabel: () => '' };

  let selected = readProjects();
  let quarters = [];
  let activeQuarter = quarterLabel || '';
  let baselineWizard = null;
  let statusTier = 'watch';
  let inboxTotal = 0;
  let sinceDelta = '';
  let advancedWarnCount = 0;
  let projectKeys = unionProjectKeys(catalogProjectKeys(), selected);
  let accessByKey = {};
  let boardsWarn = '';
  let loadBriefSeq = 0;
  let validateTimer = null;

  try {
    statusTier = localStorage.getItem(LAST_VERDICT_KEY) || 'watch';
  } catch (_) { /* ignore */ }

  function render() {
    const periodLabel = activeQuarter || 'Current';
    const squadCount = selected.length;
    const counts = getScopeCounts?.() || {};
    const intelLine = counts.available != null
      ? ` · ${counts.available} available · ${counts.noSprint || 0} no sprint · ${counts.piCommitted || 0} PI`
      : '';
    const statusLabel = simpleStatusLabel(statusTier, true);
    const queuePart = inboxTotal > 0 ? ` (${inboxTotal} pending)` : '';
    const deltaPart = sinceDelta ? ` · ${escapeHtml(sinceDelta.slice(0, 48))}` : '';
    const advLabel = advancedWarnCount > 0 ? `Advanced scope (${advancedWarnCount})` : 'Advanced scope';
    const expandedHidden = mount.querySelector('#gov-scope-expanded')?.hasAttribute('hidden') !== false;

    mount.innerHTML = `
      <div class="gov-scope-capsule" aria-label="Brief scope">
        <span class="gov-scope-capsule-text">Scope: <strong>${escapeHtml(selected.join(' + '))}</strong> | Period: <strong>${escapeHtml(periodLabel)}</strong> | ${squadCount} squad${squadCount === 1 ? '' : 's'}${escapeHtml(intelLine)}</span>
        <span class="gov-scope-status-chip gov-scope-status-chip--${escapeHtml(statusTier)}" title="Delivery status">${escapeHtml(statusLabel)}${escapeHtml(queuePart)}${deltaPart}</span>
        <button type="button" id="gov-scope-change" class="btn btn-link btn-compact">Change</button>
        <button type="button" id="gov-scope-refresh" class="btn btn-primary btn-compact">Refresh</button>
      </div>
      <div id="gov-scope-expanded" class="gov-scope-expanded"${expandedHidden ? ' hidden' : ''}>
        ${renderExpandedSelectors({ projectKeys, selected, quarters, activeQuarter, advancedLabel: advLabel, boardsWarn, accessByKey })}
      </div>`;

    mount.querySelectorAll('[data-project]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pk = btn.getAttribute('data-project');
        if (!pk) return;
        if (selected.includes(pk)) selected = selected.filter((p) => p !== pk);
        else selected = [...selected, pk].sort();
        if (!selected.length) selected = [defaultSelectedKeys()[0] || 'MPSA'];
        writeProjects(selected);
        render();
        onScopeChange?.(selected);
        scheduleValidateSelected();
      });
    });
    mount.querySelectorAll('[data-quarter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeQuarter = btn.getAttribute('data-quarter') || '';
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
        render();
        onRefresh?.();
      });
    }
    mount.querySelector('#gov-scope-change')?.addEventListener('click', () => {
      const panel = mount.querySelector('#gov-scope-expanded');
      if (panel) panel.toggleAttribute('hidden');
    });
    mount.querySelector('#gov-scope-refresh')?.addEventListener('click', () => {
      onRefresh?.();
      scheduleValidateSelected(true);
    });
    mount.querySelector('#gov-scope-advanced')?.addEventListener('click', () => onOpenDrawer?.());
    mount.querySelector('#gov-scope-baseline')?.addEventListener('click', () => baselineWizard?.open());
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
      boardsWarn = fromBoards.length ? '' : 'Jira access limited for selected projects.';
    } catch (_) {
      boardsWarn = 'Could not validate selected boards.';
    }
    render();
  }

  loadCatalogAccess();
  scheduleValidateSelected(true);

  fetchJson('/api/quarters-list?count=20&includeCached=1')
    .then((data) => {
      quarters = Array.isArray(data?.quarters) ? data.quarters : [];
      const current = quarters.find((q) => q.isCurrent);
      if (!activeQuarter && current?.label) activeQuarter = current.label;
      render();
    })
    .catch(() => render());

  baselineWizard = mountPIBaselineWizard({
    getProjectsCsv: () => selected.join(','),
    onSaved: () => onRefresh?.(),
  });

  render();
  return {
    getProjects: () => [...selected],
    getQuarterLabel: () => activeQuarter,
    refreshCapsule: () => render(),
    openBaselineWizard: () => baselineWizard?.open(),
    expandScopePanel: () => {
      const panel = mount.querySelector('#gov-scope-expanded');
      if (panel) panel.removeAttribute('hidden');
      mount.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    },
    updateStatus(tier, queue = 0, sinceSummary = '') {
      statusTier = tier || 'watch';
      inboxTotal = Number(queue) || 0;
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
