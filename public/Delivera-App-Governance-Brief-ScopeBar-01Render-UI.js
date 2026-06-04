/**
 * Governance Brief scope bar — persistent projects, period pills, refresh.
 */
import { PROJECTS_SSOT_KEY, readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { mountPIBaselineWizard } from './Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js';

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
export function mountGovernanceScopeBar({ mount, quarterLabel = '', onRefresh, onScopeChange, onOpenDrawer }) {
  if (!mount) return { getProjects: readProjects, setQuarter: () => {}, getQuarterLabel: () => '' };

  let selected = readProjects();
  let quarters = [];
  let activeQuarter = quarterLabel || '';
  let baselineWizard = null;

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

    mount.innerHTML = `
      <div class="gov-scope-bar-inner">
        <span class="gov-scope-label">Scope</span>
        <div class="gov-scope-chips" role="group" aria-label="Projects">${chips}</div>
        <div class="gov-scope-period" role="group" aria-label="Period">
          <span class="gov-scope-label">Period</span>
          <div class="gov-scope-quarter-strip">${quarterPills}</div>
        </div>
        <button type="button" id="gov-scope-refresh" class="btn btn-primary btn-compact">Refresh</button>
        <button type="button" id="gov-scope-baseline" class="btn btn-secondary btn-compact">Set PI baseline</button>
        <button type="button" id="gov-scope-advanced" class="btn btn-link btn-compact">Scope settings</button>
      </div>
      <p id="gov-scope-meta" class="gov-scope-meta-line" aria-live="polite">Projects: ${escapeHtml(selected.join(' + '))}</p>`;

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
  };
}
