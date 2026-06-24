/**
 * Portfolio scope filters — Selected / Compare / Timeframe / Baseline.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { resolveProjectDisplay, ensureProjectCatalogLoaded } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import {
  readScopeProjects,
  readStoredQuarter,
  writeStoredQuarter,
  readPortfolioAnchor,
  writePortfolioAnchor,
  readPortfolioBaselineMode,
  writePortfolioBaselineMode,
  writePortfolioProjectsCsv,
  unionScopeProjectKeys,
  loadQuartersList,
  bindProjectsStorageSync,
} from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';

const BASELINE_OPTIONS = [
  { id: 'pi-baseline', label: 'PI baseline' },
  { id: 'none', label: 'No baseline' },
];

function displayName(key) {
  return resolveProjectDisplay(key).primary || key;
}

/**
 * @param {object} opts
 */
export function mountPortfolioScopeBarMode({ mount, onRefresh, onScopeChange } = {}) {
  if (!mount) {
    return {
      getProjects: () => [],
      getQuarterLabel: () => '',
      getPeriodWindow: () => 'pi',
    };
  }

  let projects = readScopeProjects();
  let anchor = readPortfolioAnchor(projects);
  let compare = projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
  let quarters = [];
  let activeQuarter = readStoredQuarter();
  let baselineMode = readPortfolioBaselineMode();
  let statusTier = 'watch';
  let catalogKeys = unionScopeProjectKeys([anchor, ...compare]);

  function commitScope({ reload = true } = {}) {
    writePortfolioAnchor(anchor);
    writePortfolioProjectsCsv(anchor, compare);
    projects = [anchor, ...compare];
    if (reload) {
      onScopeChange?.(projects);
      onRefresh?.();
    }
  }

  function render() {
    catalogKeys = unionScopeProjectKeys([anchor, ...compare]);
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
      writeStoredQuarter(activeQuarter);
      onScopeChange?.([anchor, ...compare]);
      onRefresh?.();
    });

    mount.querySelector('#portfolio-scope-baseline')?.addEventListener('change', (ev) => {
      baselineMode = ev.target.value;
      writePortfolioBaselineMode(baselineMode);
      onRefresh?.();
    });

    mount.querySelector('#portfolio-scope-refresh')?.addEventListener('click', () => onRefresh?.({ force: true }));
  }

  ensureProjectCatalogLoaded().then(() => render());
  loadQuartersList(
    (q, currentLabel) => {
      quarters = q;
      if (!activeQuarter && currentLabel) activeQuarter = currentLabel;
      render();
    },
    () => render(),
  );

  bindProjectsStorageSync(() => {
    projects = readScopeProjects();
    anchor = readPortfolioAnchor(projects);
    compare = projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
    render();
  });

  render();

  return {
    getProjects: () => [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase())],
    getQuarterLabel: () => activeQuarter,
    getPeriodWindow: () => 'pi',
    getBaselineMode: () => baselineMode,
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
