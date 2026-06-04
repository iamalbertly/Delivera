/**
 * Governance Brief scope bar — persistent projects, period pills, refresh.
 */
import { PROJECTS_SSOT_KEY, readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { mountPIBaselineWizard } from './Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js';
import { simpleStatusLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

const LAST_VERDICT_KEY = 'delivera_lastVerdictTier';

const KNOWN_PROJECTS = ['MPSA', 'MAS', 'RPA', 'SD'];

function readProjects() {
  const list = readSharedProjectsCsv();
  return list.length ? list : ['MPSA', 'MAS'];
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

  try {
    statusTier = localStorage.getItem(LAST_VERDICT_KEY) || 'watch';
  } catch (_) { /* ignore */ }

  function render() {
    const chips = KNOWN_PROJECTS.map((pk) => {
      const on = selected.includes(pk);
      return `<button type="button" class="gov-scope-chip${on ? ' is-on' : ''}" data-project="${pk}" aria-pressed="${on}">${pk}</button>`;
    }).join('');
    const quarterPills = quarters.length
      ? quarters.map((q) => {
        const label = q.label || q.period || '';
        const on = label === activeQuarter || (!activeQuarter && q.isCurrent);
        return `<button type="button" class="gov-scope-quarter-pill${on ? ' is-on' : ''}" data-quarter="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
      }).join('')
      : '<span class="gov-scope-quarter-pill is-on">Current</span>';
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

    mount.innerHTML = `
      <div class="gov-scope-capsule" aria-label="Brief scope">
        <span class="gov-scope-capsule-text">Scope: <strong>${escapeHtml(selected.join(' + '))}</strong> | Period: <strong>${escapeHtml(periodLabel)}</strong> | ${squadCount} squad${squadCount === 1 ? '' : 's'}${escapeHtml(intelLine)}</span>
        <span class="gov-scope-status-chip gov-scope-status-chip--${escapeHtml(statusTier)}" title="Delivery status">${escapeHtml(statusLabel)}${escapeHtml(queuePart)}${deltaPart}</span>
        <button type="button" id="gov-scope-change" class="btn btn-link btn-compact">Change</button>
        <button type="button" id="gov-scope-refresh" class="btn btn-primary btn-compact">Refresh</button>
      </div>
      <div id="gov-scope-expanded" class="gov-scope-expanded" hidden>
        <div class="gov-scope-bar-inner">
          <span class="gov-scope-label">Projects</span>
          <div class="gov-scope-chips" role="group" aria-label="Projects">${chips}</div>
          <div class="gov-scope-period" role="group" aria-label="Period">
            <span class="gov-scope-label">Period</span>
            <div class="gov-scope-quarter-strip">${quarterPills}</div>
          </div>
          <button type="button" id="gov-scope-baseline" class="btn btn-secondary btn-compact">Set PI baseline</button>
          <button type="button" id="gov-scope-advanced" class="btn btn-link btn-compact">${escapeHtml(advLabel)}</button>
        </div>
      </div>`;

    mount.querySelectorAll('[data-project]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pk = btn.getAttribute('data-project');
        if (!pk) return;
        if (selected.includes(pk)) selected = selected.filter((p) => p !== pk);
        else selected = [...selected, pk].sort();
        if (!selected.length) selected = ['MPSA'];
        writeProjects(selected);
        render();
        onScopeChange?.(selected);
      });
    });
    mount.querySelectorAll('[data-quarter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeQuarter = btn.getAttribute('data-quarter') || '';
        render();
        onRefresh?.();
      });
    });
    mount.querySelector('#gov-scope-change')?.addEventListener('click', () => {
      const panel = mount.querySelector('#gov-scope-expanded');
      if (panel) panel.toggleAttribute('hidden');
    });
    mount.querySelector('#gov-scope-refresh')?.addEventListener('click', () => onRefresh?.());
    mount.querySelector('#gov-scope-advanced')?.addEventListener('click', () => onOpenDrawer?.());
    mount.querySelector('#gov-scope-baseline')?.addEventListener('click', () => baselineWizard?.open());
  }

  fetch('/api/quarters-list?count=8')
    .then((r) => (r.ok ? r.json() : { quarters: [] }))
    .then((data) => {
      quarters = Array.isArray(data?.quarters) ? data.quarters : [];
      const current = quarters.find((q) => q.isCurrent);
      if (!activeQuarter && current?.label) activeQuarter = current.label;
      render();
    })
    .catch(() => render());

  baselineWizard = mountPIBaselineWizard({
    anchor: mount,
    getProjectsCsv: () => selected.join(','),
    onSaved: () => onRefresh?.(),
  });

  render();
  return {
    getProjects: () => [...selected],
    getQuarterLabel: () => activeQuarter,
    refreshCapsule: () => render(),
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
