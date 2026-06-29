/**
 * Portfolio scope filters - Selected / Compare / Timeframe / Baseline.
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
import { mountPIBaselineWizard } from './Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js';
import { renderTimeboxChip, renderSinceLastCheckChip } from './Delivera-App-Portfolio-Signal-01Render-UI.js';
import { simpleStatusLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

const BASELINE_OPTIONS = [
  { id: 'pi-baseline', label: 'PI baseline' },
  { id: 'none', label: 'No baseline' },
];

/** Labeled status pill — color + glyph + word (accessible, not color-only). */
const STATUS_GLYPH = { blocked: '✕', watch: '●', onTrack: '✓', setup: '○' };
function renderStatusPill(tier) {
  const label = simpleStatusLabel(tier, true);
  const glyph = STATUS_GLYPH[tier] || '●';
  return `<button type="button" class="gov-scope-status-chip gov-scope-status-chip--${escapeHtml(tier)}" data-scope-status-action="1" title="Jump to actions">${glyph} ${escapeHtml(label)}</button>`;
}

function displayName(key) {
  return resolveProjectDisplay(key).primary || key;
}

export function mountPortfolioScopeBarMode({ mount, onRefresh, onScopeChange, getBrief, getLastDecision } = {}) {
  if (!mount) {
    return { getProjects: () => [], getQuarterLabel: () => '', getPeriodWindow: () => 'pi' };
  }

  let projects = readScopeProjects();
  let anchor = readPortfolioAnchor(projects);
  let compare = projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
  let quarters = [];
  let activeQuarter = readStoredQuarter();
  let baselineMode = readPortfolioBaselineMode();
  let statusTier = 'watch';
  let cacheFresh = false;
  let cacheUpdating = false;
  let scopeCollapsed = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
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
    const compareSummary = compare.length
      ? `<span class="portfolio-scope-tag portfolio-scope-tag--summary" title="${escapeHtml(compare.map(displayName).join(', '))}">+${compare.length} Squad${compare.length === 1 ? '' : 's'}</span>`
      : '<span class="portfolio-scope-tag portfolio-scope-tag--empty">No comparison</span>';
    const availableToAdd = allOptions.filter((k) => {
      const U = String(k).toUpperCase();
      return U !== String(anchor).toUpperCase() && !compare.some((c) => String(c).toUpperCase() === U);
    });

    mount.innerHTML = `
      <div class="portfolio-scope-filters${scopeCollapsed ? ' portfolio-scope-filters--collapsed' : ''}" data-portfolio-scope-filters>
        <div class="portfolio-scope-summary-strip" data-portfolio-scope-summary>
          ${renderTimeboxChip(getLastDecision?.() || {}, getBrief?.() || {})}
          ${renderSinceLastCheckChip(getBrief?.() || {})}
          ${renderStatusPill(statusTier)}
        </div>
        <button type="button" class="portfolio-scope-collapse-toggle btn btn-link btn-compact" data-portfolio-scope-toggle aria-expanded="${scopeCollapsed ? 'false' : 'true'}">
          ${scopeCollapsed ? `Filters: ${escapeHtml(displayName(anchor))} / ${escapeHtml(activeQuarter || 'Current')}` : 'Close filters'}
        </button>
        <div class="portfolio-scope-filters-body" data-portfolio-scope-body${scopeCollapsed ? ' hidden' : ''}>
          <label class="portfolio-scope-field">
            <span class="portfolio-scope-select-wrap">
              <select id="portfolio-scope-selected" class="portfolio-scope-select" aria-label="Selected squad">
                ${allOptions.map((pk) => `<option value="${escapeHtml(pk)}"${String(pk).toUpperCase() === String(anchor).toUpperCase() ? ' selected' : ''}>${escapeHtml(displayName(pk))}</option>`).join('')}
              </select>
            </span>
          </label>
          <div class="portfolio-scope-field portfolio-scope-field--compare">
            <span class="portfolio-scope-field-label">Compare</span>
            <div class="portfolio-scope-compare-row">
              ${compareSummary}
              <select id="portfolio-scope-add" class="portfolio-scope-add" aria-label="Add squad to compare">
                <option value="">+ Add comparison</option>
                ${availableToAdd.map((pk) => `<option value="${escapeHtml(pk)}">${escapeHtml(displayName(pk))}</option>`).join('')}
              </select>
            </div>
          </div>
          <label class="portfolio-scope-field">
            <span class="portfolio-scope-field-label">Timeframe</span>
            <select id="portfolio-scope-quarter" class="portfolio-scope-select" aria-label="Timeframe">
              ${(quarters.length ? quarters : [{ label: activeQuarter || 'Current' }]).map((q) => `<option value="${escapeHtml(q.label)}"${q.label === activeQuarter ? ' selected' : ''}>${escapeHtml(q.label)}</option>`).join('')}
            </select>
          </label>
          <label class="portfolio-scope-field">
            <span class="portfolio-scope-field-label">Baseline</span>
            <select id="portfolio-scope-baseline" class="portfolio-scope-select" aria-label="Baseline">
              ${BASELINE_OPTIONS.map((b) => `<option value="${escapeHtml(b.id)}"${b.id === baselineMode ? ' selected' : ''}>${escapeHtml(b.label)}</option>`).join('')}
            </select>
          </label>
          <span class="portfolio-scope-updating" id="portfolio-scope-updating"${cacheUpdating ? '' : ' hidden'} aria-live="polite">Updating...</span>
        </div>
      </div>`;
    mount.dataset.portfolioScope = '1';

    // Auto-refresh on focus-return if data older than 5 min (replaces manual Refresh button).
    if (!mount._autoRefreshBound) {
      mount._autoRefreshBound = true;
      let lastVisibleAt = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { lastVisibleAt = Date.now(); return; }
        const hiddenFor = Date.now() - lastVisibleAt;
        if (hiddenFor < 2000) return; // debounce devtools open/close
        // Defer if a drawer/modal is open (user is mid-action).
        if (document.querySelector('.gov-right-drawer-panel:not([hidden]), dialog[data-outcome-modal]:not([hidden])')) return;
        onRefresh?.({ force: true });
      });
    }

    mount.querySelector('#portfolio-scope-selected')?.addEventListener('change', (ev) => {
      const next = ev.target.value;
      if (!next || String(next).toUpperCase() === String(anchor).toUpperCase()) return;
      compare = [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(next).toUpperCase())]
        .filter((p) => String(p).toUpperCase() !== String(next).toUpperCase());
      anchor = next;
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
    mount.querySelector('[data-portfolio-scope-toggle]')?.addEventListener('click', () => {
      scopeCollapsed = !scopeCollapsed;
      render();
    });
    mount.dataset.mobileScopeInit = scopeCollapsed ? 'tray' : 'inline';
  }

  ensureProjectCatalogLoaded().then(() => render());
  loadQuartersList((q, currentLabel) => {
    quarters = q;
    if (!activeQuarter && currentLabel) activeQuarter = currentLabel;
    render();
  }, () => render());
  bindProjectsStorageSync(() => {
    projects = readScopeProjects();
    anchor = readPortfolioAnchor(projects);
    compare = projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
    render();
  });
  render();

  const baselineWizard = mountPIBaselineWizard({
    getProjectsCsv: () => [anchor, ...compare].join(','),
    getQuarterLabel: () => activeQuarter,
    onSaved: () => onRefresh?.({ force: true }),
  });

  return {
    getProjects: () => [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase())],
    getQuarterLabel: () => activeQuarter,
    getPeriodWindow: () => 'pi',
    getBaselineMode: () => baselineMode,
    refreshCapsule: () => render(),
    updateStatus(tier) { statusTier = tier || 'watch'; render(); },
    setCacheUxState({ fresh = false, updating = false } = {}) {
      cacheFresh = Boolean(fresh);
      cacheUpdating = Boolean(updating);
      const updatingChip = mount.querySelector('#portfolio-scope-updating');
      if (updatingChip) updatingChip.hidden = !cacheUpdating;
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
    openPiBaselineWizard: () => baselineWizard?.open(),
    openBaselineWizard: () => baselineWizard?.open(),
    setAnchor(nextAnchor) {
      if (!nextAnchor) return;
      compare = [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(nextAnchor).toUpperCase())]
        .filter((p) => String(p).toUpperCase() !== String(nextAnchor).toUpperCase());
      anchor = nextAnchor;
      commitScope({ reload: false });
      render();
    },
  };
}
