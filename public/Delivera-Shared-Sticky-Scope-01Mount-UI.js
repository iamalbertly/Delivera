/**
 * Shared sticky scope tray — same squad/quarter SSOT as governance portfolio bar.
 * Profiles: full (compare+baseline), compact (squad+quarter), pi (squad+quarter+baseline).
 * Never writes __ALL__ into Jira-facing project lists; offers Brief escape hatch instead.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { resolveProjectDisplay, ensureProjectCatalogLoaded } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import {
  readScopeProjects,
  readStoredQuarter,
  writeStoredQuarter,
  readPortfolioAnchor,
  writePortfolioAnchor,
  writePortfolioProjectsCsv,
  loadQuartersList,
  bindProjectsStorageSync,
  ensurePortfolioDefaultScope,
  readPortfolioBaselineMode,
  writePortfolioBaselineMode,
  PORTFOLIO_ALL,
  PORTFOLIO_ALL_LABEL,
} from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';
import { notifyScopeChanged } from './Delivera-Shared-Scope-Notify-01Bridge.js';
import { resolveEffectiveSquad, isPortfolioAllKey } from './Delivera-Governance-EffectiveSquad-01Resolve-SSOT.js';

function displayName(key) {
  return resolveProjectDisplay(key, { displayMode: 'both', context: 'summary' }).full || key;
}

/**
 * @param {object} opts
 * @param {HTMLElement|string} opts.mount — element or selector
 * @param {'full'|'compact'|'pi'} [opts.profile]
 * @param {() => void} [opts.onRefresh]
 * @param {(projects: string[]) => void} [opts.onScopeChange]
 */
export function mountSharedStickyScope(opts = {}) {
  const mount = typeof opts.mount === 'string'
    ? document.querySelector(opts.mount)
    : opts.mount;
  if (!mount) return null;

  const profile = opts.profile || 'compact';
  const onRefresh = opts.onRefresh;
  const onScopeChange = opts.onScopeChange;

  ensurePortfolioDefaultScope();
  let projects = readScopeProjects().filter((p) => !isPortfolioAllKey(p));
  let rawAnchor = readPortfolioAnchor(projects);
  let allProjectsMode = isPortfolioAllKey(rawAnchor);
  let anchor = resolveEffectiveSquad({
    anchor: rawAnchor,
    projects,
  }) || projects[0] || 'SD';
  let quarters = [];
  let activeQuarter = readStoredQuarter();
  let baselineMode = readPortfolioBaselineMode();

  function commit() {
    const peers = projects.filter((p) => String(p).toUpperCase() !== String(anchor).toUpperCase());
    // Kernel expects (anchor, compare[]) — never a joined CSV string.
    writePortfolioProjectsCsv(anchor, peers);
    writePortfolioAnchor(anchor);
    const list = [anchor, ...peers];
    notifyScopeChanged({ projects: list, source: 'shared-sticky-scope' });
    onScopeChange?.(list);
  }

  function render() {
    const catalog = projects.length ? projects : [anchor || 'SD'];
    const squadOpts = catalog.map((pk) => {
      const selected = String(pk).toUpperCase() === String(anchor).toUpperCase() ? ' selected' : '';
      return `<option value="${escapeHtml(pk)}"${selected}>${escapeHtml(displayName(pk))}</option>`;
    }).join('');
    const quarterOpts = (quarters.length ? quarters : [{ label: activeQuarter || 'FY27 Q2' }]).map((q) => {
      const label = q.label || q;
      const selected = String(label) === String(activeQuarter) ? ' selected' : '';
      return `<option value="${escapeHtml(label)}"${selected}>${escapeHtml(label)}</option>`;
    }).join('');
    const showBaseline = profile === 'full' || profile === 'pi';
    const showCompareHint = profile === 'full';
    const allBanner = allProjectsMode
      ? `<p class="shared-sticky-scope-all-hint" data-testid="shared-sticky-all-hint">${escapeHtml(PORTFOLIO_ALL_LABEL)} on Brief — this page uses <strong>${escapeHtml(displayName(anchor))}</strong>. <a href="/governance">Open Brief for all</a></p>`
      : '';
    mount.innerHTML = `
      <div class="shared-sticky-scope portfolio-scope-bar" data-testid="shared-sticky-scope" data-scope-profile="${escapeHtml(profile)}">
        ${allBanner}
        <label class="shared-sticky-scope-field">
          <span class="shared-sticky-scope-label">Squad</span>
          <select id="shared-sticky-scope-squad" data-testid="shared-sticky-scope-squad" aria-label="Selected squad">${squadOpts}</select>
        </label>
        <label class="shared-sticky-scope-field">
          <span class="shared-sticky-scope-label">Quarter</span>
          <select id="shared-sticky-scope-quarter" data-testid="shared-sticky-scope-quarter" aria-label="Quarter">${quarterOpts}</select>
        </label>
        ${showBaseline ? `
        <label class="shared-sticky-scope-field">
          <span class="shared-sticky-scope-label">Baseline</span>
          <select id="shared-sticky-scope-baseline" data-testid="shared-sticky-scope-baseline" aria-label="Baseline mode">
            <option value="pi-baseline"${baselineMode === 'pi-baseline' ? ' selected' : ''}>PI baseline</option>
            <option value="none"${baselineMode === 'none' ? ' selected' : ''}>No baseline</option>
          </select>
        </label>` : ''}
        ${showCompareHint ? `<a class="shared-sticky-scope-link btn btn-secondary btn-compact" href="/governance" data-testid="shared-sticky-scope-compare">Compare on Brief</a>` : ''}
        <a class="shared-sticky-scope-link btn btn-link btn-compact" href="/governance" data-testid="shared-sticky-scope-brief">Open Brief</a>
      </div>`;

    mount.querySelector('#shared-sticky-scope-squad')?.addEventListener('change', (ev) => {
      anchor = String(ev.target.value || '').toUpperCase();
      allProjectsMode = false;
      if (!projects.some((p) => String(p).toUpperCase() === anchor)) {
        projects = [anchor, ...projects];
      }
      commit();
      onRefresh?.();
    });
    mount.querySelector('#shared-sticky-scope-quarter')?.addEventListener('change', (ev) => {
      activeQuarter = ev.target.value;
      writeStoredQuarter(activeQuarter);
      onRefresh?.();
    });
    mount.querySelector('#shared-sticky-scope-baseline')?.addEventListener('change', (ev) => {
      baselineMode = ev.target.value;
      writePortfolioBaselineMode(baselineMode);
      onRefresh?.();
    });
  }

  ensureProjectCatalogLoaded().then(() => {
    projects = readScopeProjects().filter((p) => !isPortfolioAllKey(p));
    rawAnchor = readPortfolioAnchor(projects);
    allProjectsMode = isPortfolioAllKey(rawAnchor);
    anchor = resolveEffectiveSquad({ anchor: rawAnchor, projects }) || projects[0] || anchor;
    render();
  }).catch(() => render());

  loadQuartersList((list) => {
    quarters = list || [];
    render();
  }, () => render());

  bindProjectsStorageSync(() => {
    projects = readScopeProjects().filter((p) => !isPortfolioAllKey(p));
    rawAnchor = readPortfolioAnchor(projects);
    allProjectsMode = isPortfolioAllKey(rawAnchor);
    anchor = resolveEffectiveSquad({ anchor: rawAnchor, projects }) || projects[0] || anchor;
    render();
  });

  render();
  return { remount: render, getAnchor: () => anchor };
}

export function ensureSharedStickyScopeMount(nearEl) {
  let mount = document.getElementById('shared-sticky-scope-mount');
  if (mount) return mount;
  mount = document.createElement('div');
  mount.id = 'shared-sticky-scope-mount';
  mount.className = 'shared-sticky-scope-mount';
  mount.setAttribute('data-testid', 'shared-sticky-scope-mount');
  const host = nearEl?.closest?.('header') || nearEl || document.getElementById('main-content');
  if (host?.prepend) host.prepend(mount);
  else document.body.prepend(mount);
  return mount;
}

void PORTFOLIO_ALL;
