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
  ensurePortfolioDefaultScope,
  resolveDefaultCompare,
  resolveAllProjectsRanked,
  readGovViewMode,
  writeGovViewMode,
  clearGovViewMode,
  PORTFOLIO_ALL,
  PORTFOLIO_ALL_LABEL,
  isPortfolioAllAnchor,
} from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';
import { densityFromBrief, portfolioHasNoBaselines } from './Delivera-Governance-Portfolio-Scope-Rank-01SSOT.js';
import { mountPIBaselineWizard } from './Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js';
import { renderSinceLastCheckChip, renderTimeboxChip } from './Delivera-App-Portfolio-Signal-01Render-UI.js';
import { renderScopeCadenceLine } from './Delivera-App-Governance-Cadence-01Pack-Render-UI.js';
import { simpleStatusLabel, COPY, formatHumanAge } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

const BASELINE_OPTIONS = [
  { id: 'pi-baseline', label: 'PI baseline' },
  { id: 'none', label: 'No baseline' },
];
const SCOPE_SEEN_KEY = 'delivera:portfolio-scope-seen';

function readScopeSeen() {
  try { return localStorage.getItem(SCOPE_SEEN_KEY) === '1'; } catch (_) { return false; }
}

function writeScopeSeen() {
  try { localStorage.setItem(SCOPE_SEEN_KEY, '1'); } catch (_) { /* ignore */ }
}

function baselineOptionsForBrief(brief = {}) {
  if (brief?.meta?.piFocus?.synergy === 'low') return BASELINE_OPTIONS;
  const gaps = brief?.meta?.setupGaps || [];
  const missing = gaps.some((g) => g.action === 'set-baseline');
  if (!missing) return BASELINE_OPTIONS;
  return [
    { id: 'pi-baseline', label: COPY.piBaselineSetupLabel },
    { id: 'none', label: 'No baseline' },
  ];
}

/** Labeled status pill — color + glyph + word (accessible, not color-only). */
const STATUS_GLYPH = { blocked: '✕', watch: '●', onTrack: '✓', setup: '○', loading: '…' };
function renderStatusPill(tier) {
  if (tier === 'loading') {
    return `<button type="button" class="gov-scope-status-chip gov-scope-status-chip--setup" data-scope-status-loading="1" disabled aria-busy="true" title="Loading portfolio status">… Loading</button>`;
  }
  const label = simpleStatusLabel(tier, false);
  const glyph = STATUS_GLYPH[tier] || '●';
  return `<button type="button" class="gov-scope-status-chip gov-scope-status-chip--${escapeHtml(tier)}" data-scope-status-action="1" title="Jump to decision">${glyph} ${escapeHtml(label)}</button>`;
}

function displayName(key) {
  return resolveProjectDisplay(key, { displayMode: 'both', context: 'summary' }).full || key;
}

export function mountPortfolioScopeBarMode({ mount, onRefresh, onScopeChange, getBrief, getLastDecision } = {}) {
  if (!mount) {
    return { getProjects: () => [], getQuarterLabel: () => '', getPeriodWindow: () => 'pi' };
  }

  let projects = readScopeProjects();
  ensurePortfolioDefaultScope();
  projects = readScopeProjects();
  let anchor = readPortfolioAnchor(projects);
  let compare = isPortfolioAllAnchor(anchor)
    ? [...projects]
    : projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
  if (isPortfolioAllAnchor(anchor)) writeGovViewMode('compare');
  let quarters = [];
  let activeQuarter = readStoredQuarter();
  let baselineMode = readPortfolioBaselineMode();
  let statusTier = 'loading';
  let cacheCachedAt = '';
  let cacheFresh = false;
  let cacheUpdating = false;
  const priorityBriefPage = typeof document !== 'undefined'
    && document.body?.classList?.contains('governance-priority-brief-page');
  let scopeCollapsed = readScopeSeen() || priorityBriefPage;
  let catalogKeys = unionScopeProjectKeys(isPortfolioAllAnchor(anchor) ? projects : [anchor, ...compare]);
  // Audit fix: track pre-drill scope so "Back to comparison" can restore it.
  let preDrillScope = null;

  function commitScope({ reload = true } = {}) {
    writeScopeSeen();
    writePortfolioAnchor(anchor);
    if (isPortfolioAllAnchor(anchor)) {
      writeGovViewMode('compare');
      const brief = getBrief?.() || {};
      const ranked = resolveAllProjectsRanked(densityFromBrief(brief));
      writePortfolioProjectsCsv(PORTFOLIO_ALL, ranked);
      projects = ranked;
      compare = ranked;
    } else {
      writePortfolioProjectsCsv(anchor, compare);
      projects = [anchor, ...compare];
    }
    if (reload) {
      onScopeChange?.(projects);
      onRefresh?.();
    }
  }

  function render() {
    catalogKeys = unionScopeProjectKeys([...(isPortfolioAllAnchor(anchor) ? [] : [anchor]), ...compare]);
    const allOptions = catalogKeys.length ? catalogKeys : projects;
    const allMode = isPortfolioAllAnchor(anchor);
    const compareSummary = allMode
      ? `<span class="portfolio-scope-tag portfolio-scope-tag--all" data-testid="portfolio-scope-all-mode">${escapeHtml(PORTFOLIO_ALL_LABEL)} · ${escapeHtml(String(projects.length))} squads</span>`
      : (compare.length
        ? `<span class="portfolio-scope-compare-tags" data-testid="portfolio-scope-compare-tags">${compare.map((pk) => `<span class="portfolio-scope-tag" title="${escapeHtml(displayName(pk))}">${escapeHtml(displayName(pk))}</span>`).join('')}</span>`
        : '<span class="portfolio-scope-tag portfolio-scope-tag--empty">No comparison</span>');
    // "Compare all" button: one click adds all squads as peers. Reuses
    // resolveDefaultCompare to get all catalog keys minus the anchor.
    // (Audit finding: user requested "a way for the user to click and add
    // comparison all of them by default".)
    const compareAllBtn = allMode
      ? ''
      : `<button type="button" class="btn btn-link btn-compact portfolio-scope-compare-all" data-portfolio-compare-all title="Compare all squads at once">Compare all</button>`;
    const availableToAdd = allMode ? [] : allOptions.filter((k) => {
      const U = String(k).toUpperCase();
      return U !== String(anchor).toUpperCase() && !compare.some((c) => String(c).toUpperCase() === U);
    });

    const cadenceHtml = renderScopeCadenceLine(getLastDecision?.() || {}, getBrief?.() || {});
    const timeboxChip = renderTimeboxChip(getLastDecision?.() || {}, getBrief?.() || {});
    // P1 FIX: When the cadence line is present, it already includes the timebox
    // info (e.g. "FY27 Q2 · Day 45/90 · Sprint stalled…"). Showing the timebox
    // chip next to it creates contradictory signals ("Sprint stalled" vs "50%
    // time elapsed"). Suppress the timebox chip when the cadence line is present.
    const showTimeboxChip = !cadenceHtml.trim() && timeboxChip.trim();
    const hideTimeframeDup = Boolean(cadenceHtml.trim() || timeboxChip.trim());
    const breadcrumb = hideTimeframeDup
      ? ''
      : `<span class="portfolio-scope-breadcrumb" data-testid="portfolio-scope-breadcrumb">Portfolio / ${escapeHtml(allMode ? PORTFOLIO_ALL_LABEL : displayName(anchor))} / Compare</span>`;
    const baselineOptions = baselineOptionsForBrief(getBrief?.() || {});
    const hideCompareSelect = allMode || (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
      && Boolean(document.querySelector('[data-portfolio-carousel]')));
    const briefNow = getBrief?.() || {};
    const noBaselineChip = allMode && portfolioHasNoBaselines(briefNow, projects)
      ? `<span class="gov-scope-status-chip gov-scope-status-chip--setup" data-testid="portfolio-no-pi-slides" title="Upload PI plan slides in Alignment Studio">No PI slides confirmed this quarter</span>`
      : '';
    const selectedOptions = [
      `<option value="${PORTFOLIO_ALL}"${allMode ? ' selected' : ''}>${escapeHtml(PORTFOLIO_ALL_LABEL)}</option>`,
      ...allOptions.map((pk) => `<option value="${escapeHtml(pk)}"${!allMode && String(pk).toUpperCase() === String(anchor).toUpperCase() ? ' selected' : ''}>${escapeHtml(displayName(pk))}</option>`),
    ].join('');

    mount.innerHTML = `
      <div class="portfolio-scope-filters${scopeCollapsed ? ' portfolio-scope-filters--collapsed' : ''}" data-portfolio-scope-filters>
        <div class="portfolio-scope-summary-strip" data-portfolio-scope-summary>
          ${breadcrumb}
          ${cadenceHtml}
          ${showTimeboxChip ? timeboxChip : ''}
          <span class="gov-scope-since-wrap">${renderSinceLastCheckChip(getBrief?.() || {})}</span>
          ${noBaselineChip}
          ${renderStatusPill(statusTier)}
        </div>
        <button type="button" class="portfolio-scope-collapse-toggle btn btn-link btn-compact" data-portfolio-scope-toggle aria-expanded="${scopeCollapsed ? 'false' : 'true'}">
          ${scopeCollapsed ? `Filters: ${escapeHtml(allMode ? PORTFOLIO_ALL_LABEL : displayName(anchor))} / ${escapeHtml(activeQuarter || 'Current')}` : 'Close filters'}
        </button>
        <div class="portfolio-scope-filters-body" data-portfolio-scope-body${scopeCollapsed ? ' hidden' : ''}>
          <label class="portfolio-scope-field">
            <span class="portfolio-scope-select-wrap">
              <select id="portfolio-scope-selected" class="portfolio-scope-select" aria-label="Selected scope">
                ${selectedOptions}
              </select>
            </span>
          </label>
          <div class="portfolio-scope-field portfolio-scope-field--compare"${allMode ? ' hidden' : ''}>
            <span class="portfolio-scope-field-label">Compare</span>
            <div class="portfolio-scope-compare-row">
              ${compareSummary}
              ${compareAllBtn}
              <select id="portfolio-scope-add" class="portfolio-scope-add" aria-label="Add squad to compare"${hideCompareSelect ? ' hidden' : ''}>
                <option value="">+ Add comparison</option>
                ${availableToAdd.map((pk) => `<option value="${escapeHtml(pk)}">${escapeHtml(displayName(pk))}</option>`).join('')}
              </select>
            </div>
          </div>
          <label class="portfolio-scope-field"${hideTimeframeDup ? ' hidden' : ''}>
            <span class="portfolio-scope-field-label">Timeframe</span>
            <select id="portfolio-scope-quarter" class="portfolio-scope-select" aria-label="Timeframe">
              ${(quarters.length ? quarters : [{ label: activeQuarter || 'Current' }]).map((q) => `<option value="${escapeHtml(q.label)}"${q.label === activeQuarter ? ' selected' : ''}>${escapeHtml(q.label)}</option>`).join('')}
            </select>
          </label>
          <label class="portfolio-scope-field">
            <span class="portfolio-scope-field-label">Baseline</span>
            <select id="portfolio-scope-baseline" class="portfolio-scope-select" aria-label="Baseline">
              ${baselineOptions.map((b) => `<option value="${escapeHtml(b.id)}"${b.id === baselineMode ? ' selected' : ''}>${escapeHtml(b.label)}</option>`).join('')}
            </select>
          </label>
          <span class="portfolio-scope-updating" id="portfolio-scope-updating"${cacheUpdating || cacheFresh ? '' : ' hidden'} aria-live="polite">${cacheUpdating && cacheFresh ? 'Showing cached · refreshing…' : cacheUpdating ? 'Updating…' : 'Cached view'}</span>
        </div>
      </div>`;
    mount.dataset.portfolioScope = '1';
    mount.dataset.portfolioAll = allMode ? '1' : '0';

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
      if (isPortfolioAllAnchor(next)) {
        anchor = PORTFOLIO_ALL;
        compare = resolveAllProjectsRanked(densityFromBrief(getBrief?.() || {}));
        writeGovViewMode('compare');
        commitScope();
        render();
        return;
      }
      const prevAll = isPortfolioAllAnchor(anchor);
      if (prevAll) {
        anchor = next;
        compare = resolveDefaultCompare(next);
        writeGovViewMode('drill');
      } else {
        compare = [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(next).toUpperCase())]
          .filter((p) => String(p).toUpperCase() !== String(next).toUpperCase() && !isPortfolioAllAnchor(p));
        anchor = next;
        writeGovViewMode('drill');
      }
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

    // "Compare all" button: one click adds all squads as peers.
    mount.querySelector('[data-portfolio-compare-all]')?.addEventListener('click', () => {
      compare = resolveDefaultCompare(anchor);
      clearGovViewMode();
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
    mount.querySelector('[data-scope-status-action]')?.addEventListener('click', () => {
      document.querySelector('[data-testid="governance-primary-action"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        || document.querySelector('[data-testid="governance-priority-brief"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    mount.querySelector('.gov-scope-cadence-line')?.addEventListener('click', () => {
      if (scopeCollapsed) {
        scopeCollapsed = false;
        render();
        mount.querySelector('#portfolio-scope-quarter')?.focus();
      }
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
    compare = isPortfolioAllAnchor(anchor)
      ? [...projects]
      : projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
    render();
  });
  render();

  const baselineWizard = mountPIBaselineWizard({
    getProjectsCsv: () => (isPortfolioAllAnchor(anchor) ? projects : [anchor, ...compare]).join(','),
    getAnchorProject: () => (isPortfolioAllAnchor(anchor) ? (projects[0] || 'SD') : anchor),
    getQuarterLabel: () => activeQuarter,
    getCachedDetailRows: () => getLastDecision?.()?.priorityBrief?.detailRows || [],
    onSaved: () => onRefresh?.({ force: true }),
  });

  return {
    // In drill mode (single squad), only send the anchor to the brief API.
    // Sending all compare peers causes cross-squad contamination — the
    // drilled squad's H1 and evidence list gets polluted with other squads'
    // stories. (Audit 2026-07-15: "clicking DMS details shouldn't confuse
    // it with other squads".) Compare peers are for the carousel, not the
    // brief API.
    getProjects: () => (isPortfolioAllAnchor(anchor) ? [...projects] : [anchor]),
    getAnchor: () => anchor,
    isAllProjects: () => isPortfolioAllAnchor(anchor),
    getQuarterLabel: () => activeQuarter,
    getPeriodWindow: () => 'pi',
    getBaselineMode: () => baselineMode,
    refreshCapsule: () => render(),
    updateStatus(tier) { statusTier = tier || 'watch'; render(); },
    setCacheUxState({ fresh = false, updating = false, cachedAt = '' } = {}) {
      cacheFresh = Boolean(fresh);
      cacheUpdating = Boolean(updating);
      if (cachedAt) cacheCachedAt = cachedAt;
      const updatingChip = mount.querySelector('#portfolio-scope-updating');
      if (updatingChip) {
        const show = cacheUpdating || !cacheFresh;
        updatingChip.hidden = !show;
        const age = formatHumanAge(cacheCachedAt);
        // P2 FIX: Make the cached chip show age AND be clickable to refresh.
        const ageLabel = age ? `Cached · ${age}` : 'Cached view';
        updatingChip.textContent = cacheUpdating && !cacheFresh
          ? (age ? `Cached · ${age} · refreshing…` : 'Showing cached · refreshing…')
          : cacheUpdating
            ? 'Updating…'
            : ageLabel;
        // Add refresh action if not already bound.
        if (!updatingChip.dataset.refreshBound) {
          updatingChip.dataset.refreshBound = '1';
          updatingChip.style.cursor = 'pointer';
          updatingChip.title = 'Click to refresh';
          updatingChip.addEventListener('click', () => {
            onRefresh?.({ force: true });
          });
        }
      }
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
    openPiBaselineWizard: (opts) => baselineWizard?.open(false, opts),
    openBaselineWizard: (opts) => baselineWizard?.open(false, opts),
    setAnchor(nextAnchor) {
      if (!nextAnchor) return;
      if (isPortfolioAllAnchor(nextAnchor)) {
        anchor = PORTFOLIO_ALL;
        compare = resolveAllProjectsRanked(densityFromBrief(getBrief?.() || {}));
        writeGovViewMode('compare');
        commitScope({ reload: false });
        render();
        return;
      }
      if (isPortfolioAllAnchor(anchor)) {
        anchor = nextAnchor;
        compare = resolveDefaultCompare(nextAnchor);
        writeGovViewMode('drill');
        commitScope({ reload: false });
        render();
        return;
      }
      compare = [anchor, ...compare.filter((p) => String(p).toUpperCase() !== String(nextAnchor).toUpperCase())]
        .filter((p) => String(p).toUpperCase() !== String(nextAnchor).toUpperCase() && !isPortfolioAllAnchor(p));
      anchor = nextAnchor;
      commitScope({ reload: false });
      render();
    },
    /**
     * Drill into a single squad — collapses scope to just that squad so the
     * user gets a true deep-dive view instead of a multi-squad comparison
     * with the anchor swapped. Stores the pre-drill scope so it can be
     * restored. Closes audit finding: "DMS drill-down still shows multi-squad
     * compare and mixed cases (e.g. MPSA under SD scope)".
     */
    drillIntoSquad(squadKey) {
      if (!squadKey) return;
      const target = String(squadKey).toUpperCase();
      // Remember the pre-drill scope (only if not already drilling).
      if (!preDrillScope) {
        preDrillScope = { anchor, compare: [...compare] };
      }
      anchor = squadKey;
      compare = [];
      writeGovViewMode('drill');
      commitScope({ reload: true });
      render();
    },
    /**
     * Restore the pre-drill multi-squad comparison scope.
     * Falls back to All Projects if preDrillScope is null (e.g. after
     * a page reload that restored a drilled scope from cache). Never leaves
     * the user stranded in single-squad view with no escape.
     * (Audit finding: "Back to comparison" did nothing — preDrillScope was null.)
     */
    restoreComparison() {
      if (preDrillScope) {
        anchor = preDrillScope.anchor;
        compare = [...preDrillScope.compare];
        preDrillScope = null;
      } else {
        anchor = PORTFOLIO_ALL;
        compare = resolveAllProjectsRanked(densityFromBrief(getBrief?.() || {}));
      }
      clearGovViewMode();
      writeGovViewMode('compare');
      commitScope({ reload: true });
      render();
    },
    isDrilledDown() {
      return Boolean(preDrillScope) && compare.length === 0;
    },
  };
}
