/**
 * Portfolio scope filters — Selected / Compare / Timeframe / Baseline (command surface SSOT).
 */
import {
  PROJECTS_SSOT_KEY,
  GOVERNANCE_QUARTER_KEY,
  PORTFOLIO_ANCHOR_KEY,
  PORTFOLIO_BASELINE_MODE_KEY,
  readSharedProjectsCsv,
} from './Delivera-Shared-Storage-Keys.js';
import { notifyScopeChanged } from './Delivera-Shared-Scope-Notify-01Bridge.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { fetchQuartersListMemo } from './Delivera-Shared-Quarters-List-01Fetch-Memo.js';
import { resolveProjectDisplay, ensureProjectCatalogLoaded } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import { catalogProjectKeys, unionProjectKeys } from './Delivera-Shared-ProjectScope-01Picker.js';
import { defaultSelectedKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';

const BASELINE_OPTIONS = [
  { id: 'pi-baseline', label: 'PI baseline' },
  { id: 'none', label: 'No baseline' },
];

function readProjects() {
  const list = readSharedProjectsCsv();
  return list.length ? list : defaultSelectedKeys();
}

function readAnchor(projects = []) {
  try {
    const stored = String(localStorage.getItem(PORTFOLIO_ANCHOR_KEY) || '').trim().toUpperCase();
    if (stored && projects.some((p) => String(p).toUpperCase() === stored)) return stored;
  } catch (_) { /* ignore */ }
  return projects[0] || '';
}

function writeAnchor(anchor) {
  try { localStorage.setItem(PORTFOLIO_ANCHOR_KEY, String(anchor || '').toUpperCase()); } catch (_) { /* ignore */ }
}

function writeProjectsCsv(anchor, compare = []) {
  const A = String(anchor || '').trim().toUpperCase();
  const csv = [A, ...compare.filter((p) => String(p).toUpperCase() !== A)]
    .map((p) => String(p).trim().toUpperCase())
    .filter(Boolean)
    .join(',');
  try { localStorage.setItem(PROJECTS_SSOT_KEY, csv); } catch (_) { /* ignore */ }
  notifyScopeChanged();
}

function displayName(key) {
  return resolveProjectDisplay(key).primary || key;
}

/**
 * @param {object} opts
 */
export function mountPortfolioScopeBar({ mount, onRefresh, onScopeChange } = {}) {
  if (!mount) {
    return {
      getProjects: () => [],
      getQuarterLabel: () => '',
      getPeriodWindow: () => 'pi',
    };
  }

  let projects = readProjects();
  let anchor = readAnchor(projects);
  let compare = projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
  let quarters = [];
  let activeQuarter = '';
  let baselineMode = 'pi-baseline';
  let statusTier = 'watch';
  let catalogKeys = unionProjectKeys(catalogProjectKeys(), projects);

  try {
    activeQuarter = String(localStorage.getItem(GOVERNANCE_QUARTER_KEY) || '').trim();
    baselineMode = String(localStorage.getItem(PORTFOLIO_BASELINE_MODE_KEY) || 'pi-baseline').trim();
  } catch (_) { /* ignore */ }

  function commitScope({ reload = true } = {}) {
    writeAnchor(anchor);
    writeProjectsCsv(anchor, compare);
    projects = [anchor, ...compare];
    if (reload) {
      onScopeChange?.(projects);
      onRefresh?.();
    }
  }

  function render() {
    catalogKeys = unionProjectKeys(catalogProjectKeys(), [anchor, ...compare]);
    const allOptions = catalogKeys.length ? catalogKeys : projects;
    const compareTags = compare.map((pk) => `
      <span class="portfolio-scope-tag" data-compare-key="${escapeHtml(pk)}">
        ${escapeHtml(displayName(pk))}
        <button type="button" class="portfolio-scope-tag-remove" data-compare-remove="${escapeHtml(pk)}" aria-label="Remove ${escapeHtml(displayName(pk))}">×</button>
      </span>`).join('');
    const availableToAdd = allOptions.filter((k) => {
      const U = String(k).toUpperCase();
      return U !== String(anchor).toUpperCase() && !compare.some((c) => String(c).toUpperCase() === U);
    });

    mount.innerHTML = `
      <div class="portfolio-scope-filters" data-portfolio-scope-filters>
        <label class="portfolio-scope-field">
          <span class="portfolio-scope-field-label">Selected</span>
          <span class="portfolio-scope-select-wrap">
            <span class="portfolio-scope-status-dot portfolio-scope-status-dot--${escapeHtml(statusTier)}" aria-hidden="true"></span>
            <select id="portfolio-scope-selected" class="portfolio-scope-select" aria-label="Selected squad">
              ${allOptions.map((pk) => `<option value="${escapeHtml(pk)}"${String(pk).toUpperCase() === String(anchor).toUpperCase() ? ' selected' : ''}>${escapeHtml(displayName(pk))}</option>`).join('')}
            </select>
          </span>
        </label>
        <div class="portfolio-scope-field portfolio-scope-field--compare">
          <span class="portfolio-scope-field-label">Compare with</span>
          <div class="portfolio-scope-compare-row">
            ${compareTags}
            <select id="portfolio-scope-add" class="portfolio-scope-add" aria-label="Add squad to compare">
              <option value="">+ Add squad</option>
              ${availableToAdd.map((pk) => `<option value="${escapeHtml(pk)}">${escapeHtml(displayName(pk))}</option>`).join('')}
            </select>
          </div>
        </div>
        <label class="portfolio-scope-field">
          <span class="portfolio-scope-field-label">Timeframe</span>
          <select id="portfolio-scope-quarter" class="portfolio-scope-select" aria-label="Timeframe">
            ${(quarters.length ? quarters : [{ label: activeQuarter || 'Current' }]).map((q) => `
              <option value="${escapeHtml(q.label)}"${q.label === activeQuarter ? ' selected' : ''}>${escapeHtml(q.label)}</option>`).join('')}
          </select>
        </label>
        <label class="portfolio-scope-field">
          <span class="portfolio-scope-field-label">Baseline</span>
          <select id="portfolio-scope-baseline" class="portfolio-scope-select" aria-label="Baseline">
            ${BASELINE_OPTIONS.map((b) => `
              <option value="${escapeHtml(b.id)}"${b.id === baselineMode ? ' selected' : ''}>${escapeHtml(b.label)}</option>`).join('')}
          </select>
        </label>
        <button type="button" id="portfolio-scope-refresh" class="btn btn-primary btn-compact portfolio-scope-refresh">Refresh</button>
        <span id="portfolio-scope-ai-mount" class="portfolio-scope-ai-mount"></span>
      </div>`;
    mount.dataset.portfolioScope = '1';

    mount.querySelector('#portfolio-scope-selected')?.addEventListener('change', (ev) => {
      const next = ev.target.value;
      if (!next || String(next).toUpperCase() === String(anchor).toUpperCase()) return;
      compare = [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(next).toUpperCase())];
      anchor = next;
      compare = compare.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
      commitScope();
      render();
    });

    mount.querySelector('#portfolio-scope-add')?.addEventListener('change', (ev) => {
      const pk = ev.target.value;
      ev.target.value = '';
      if (!pk || compare.some((c) => String(c).toUpperCase() === String(pk).toUpperCase())) return;
      compare.push(pk);
      if (!projects.some((p) => String(p).toUpperCase() === String(pk).toUpperCase())) projects.push(pk);
      commitScope();
      render();
    });

    mount.querySelectorAll('[data-compare-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pk = btn.getAttribute('data-compare-remove');
        compare = compare.filter((p) => String(p).toUpperCase() !== String(pk).toUpperCase());
        commitScope();
        render();
      });
    });

    mount.querySelector('#portfolio-scope-quarter')?.addEventListener('change', (ev) => {
      activeQuarter = ev.target.value;
      try { localStorage.setItem(GOVERNANCE_QUARTER_KEY, activeQuarter); } catch (_) { /* ignore */ }
      onScopeChange?.([anchor, ...compare]);
      onRefresh?.();
    });

    mount.querySelector('#portfolio-scope-baseline')?.addEventListener('change', (ev) => {
      baselineMode = ev.target.value;
      try { localStorage.setItem(PORTFOLIO_BASELINE_MODE_KEY, baselineMode); } catch (_) { /* ignore */ }
      onRefresh?.();
    });

    mount.querySelector('#portfolio-scope-refresh')?.addEventListener('click', () => onRefresh?.({ force: true }));
  }

  ensureProjectCatalogLoaded().then(() => render());
  fetchQuartersListMemo(8, { includeCached: true })
    .then((data) => {
      quarters = Array.isArray(data?.quarters) ? data.quarters : [];
      const current = quarters.find((q) => q.isCurrent);
      if (!activeQuarter && current?.label) activeQuarter = current.label;
      render();
    })
    .catch(() => render());

  window.addEventListener('storage', (ev) => {
    if (ev.key !== PROJECTS_SSOT_KEY && ev.key !== PORTFOLIO_ANCHOR_KEY) return;
    projects = readProjects();
    anchor = readAnchor(projects);
    compare = projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
    render();
  });

  render();

  return {
    getProjects: () => [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase())],
    getQuarterLabel: () => activeQuarter,
    getPeriodWindow: () => 'pi',
    refreshCapsule: () => render(),
    updateStatus(tier) {
      statusTier = tier || 'watch';
      render();
    },
    setAdvancedWarnCount: () => {},
    focusScopeBar: () => mount.querySelector('#portfolio-scope-selected')?.focus(),
    addToCompare(pk) {
      if (!pk || String(pk).toUpperCase() === String(anchor).toUpperCase()) return;
      if (compare.some((c) => String(c).toUpperCase() === String(pk).toUpperCase())) return;
      compare.push(pk);
      commitScope();
      render();
    },
    openPiBaselineWizard: () => {},
    openBaselineWizard: () => {},
    setAnchor(nextAnchor) {
      if (!nextAnchor) return;
      compare = [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(nextAnchor).toUpperCase())];
      anchor = nextAnchor;
      compare = compare.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
      commitScope({ reload: false });
      render();
    },
  };
}
