/**
 * Delivera Instant Shell — standardized loading skeleton + stale-while-revalidate.
 *
 * Principle: users never see a blank white page. Prefer last-known HTML from
 * sessionStorage; fall back to a layout-mirroring shimmer that states what is loading.
 * Markup SSOT: this module. HTML pages use thin empty mounts + paintInstantShell().
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { GOVERNANCE_DISPLACEMENT_LINE_SHORT } from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';

const CACHE_PREFIX = 'delivera:last-shell:v1:';

const SURFACE_LABELS = Object.freeze({
  governance: 'Portfolio Brief',
  portfolio: 'Portfolio Brief',
  'current-sprint': 'Today',
  actions: 'Actions',
  settings: 'Settings',
  report: 'Proof',
  leadership: 'Leadership',
  evidence: 'Evidence',
  home: 'Dashboard',
});

function cacheKey(pageType, scopeLabel = '') {
  return `${CACHE_PREFIX}${pageType}:${String(scopeLabel || '').toUpperCase()}`;
}

/**
 * Persist last good content HTML for instant return visits / scope refresh.
 */
export function rememberSurfaceHtml(pageType, html, opts = {}) {
  if (!pageType || !html || String(html).length < 80) return;
  try {
    sessionStorage.setItem(cacheKey(pageType, opts.scopeLabel || ''), JSON.stringify({
      html: String(html).slice(0, 180000),
      savedAt: Date.now(),
      scopeLabel: opts.scopeLabel || '',
    }));
  } catch (_) { /* quota */ }
}

export function readRememberedSurface(pageType, opts = {}) {
  try {
    const raw = sessionStorage.getItem(cacheKey(pageType, opts.scopeLabel || ''));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.html) return null;
    const ageMs = Date.now() - (Number(parsed.savedAt) || 0);
    if (ageMs > 1000 * 60 * 60 * 12) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

/**
 * Publish skim-ready surface / data-state attrs on body + main.
 * @param {string} surface
 * @param {'loading'|'live'|'stale'|'error'|'empty'} dataState
 * @param {object} [opts]
 */
export function setDeliveraSurfaceState(surface, dataState, opts = {}) {
  const main = document.getElementById('main-content') || document.querySelector('main');
  if (document.body) {
    if (surface) document.body.setAttribute('data-delivera-surface', surface);
    if (dataState) document.body.setAttribute('data-delivera-data-state', dataState);
    if (opts.scopeLabel != null) {
      document.body.setAttribute('data-delivera-scope-label', String(opts.scopeLabel));
    }
  }
  if (main) {
    if (surface) main.setAttribute('data-delivera-surface', surface);
    if (dataState) main.setAttribute('data-delivera-data-state', dataState);
    if (opts.scopeLabel != null) {
      main.setAttribute('data-delivera-scope-label', String(opts.scopeLabel));
    }
  }
}

function resolveMount(pageType) {
  const byAttr = document.querySelector(`[data-instant-shell-mount="${pageType}"]`);
  if (byAttr) return byAttr;
  const map = {
    governance: () => document.getElementById('governance-priority-surface-mount'),
    portfolio: () => document.getElementById('governance-priority-surface-mount'),
    'current-sprint': () => document.getElementById('current-sprint-loading')
      || document.getElementById('current-sprint-content'),
    actions: () => document.getElementById('actions-list'),
    settings: () => document.getElementById('settings-instant-shell-mount')
      || document.querySelector('[data-instant-shell-mount="settings"]')
      || document.querySelector('.settings-hub-panels'),
    report: () => document.getElementById('report-instant-shell-mount')
      || document.getElementById('preview-content'),
    leadership: () => document.getElementById('hud-grid'),
    evidence: () => document.getElementById('eos-loading')
      || document.getElementById('evidence-os-root'),
    home: () => document.querySelector('[data-instant-shell-mount="home"]'),
  };
  const finder = map[pageType];
  return (finder && finder())
    || document.getElementById('main-content')
    || document.querySelector('main');
}

function renderStateStrip(pageType, scopeLabel, subState) {
  const surface = SURFACE_LABELS[pageType] || 'Delivera';
  const scope = scopeLabel || (pageType === 'governance' || pageType === 'portfolio' ? 'All Projects' : 'Loading scope…');
  const defaults = {
    governance: 'Loading portfolio…',
    portfolio: 'Loading portfolio…',
    'current-sprint': 'Loading sprint…',
    actions: 'Loading actions…',
    settings: 'Loading settings…',
    report: 'Loading proof…',
    leadership: 'Loading leadership…',
    evidence: 'Loading evidence…',
    home: 'Loading dashboard…',
  };
  const sub = subState || defaults[pageType] || 'Reading live data…';
  return `
    <div class="instant-shell-state-strip" data-testid="instant-shell-state-strip">
      <span class="instant-shell-state-surface">${escapeHtml(surface)}</span>
      <span class="instant-shell-state-scope">${escapeHtml(scope)}</span>
      <span class="instant-shell-state-sub">${escapeHtml(sub)}</span>
    </div>`;
}

/**
 * @param {'governance'|'current-sprint'|'actions'|'settings'|'report'|'leadership'|'evidence'|'portfolio'} pageType
 * @param {object} [opts] — { scopeLabel?: string, message?: string }
 */
export function paintInstantShell(pageType, opts = {}) {
  const main = document.getElementById('main-content') || document.querySelector('main');
  if (!main && !document.querySelector(`[data-instant-shell-mount="${pageType}"]`)) return;

  if (main?.querySelector('[data-gov-priority-rendered], [data-current-sprint-content], [data-actions-content]')) {
    return;
  }
  const settingsReady = main?.querySelector('.settings-section-card:not(.instant-shell *):not([hidden])');
  if (settingsReady && settingsReady.children.length > 0 && settingsReady.id !== 'jira-activity') {
    return;
  }
  if (main?.getAttribute('data-instant-shell') === pageType
    && document.querySelector('[data-testid="instant-shell"], [data-testid="instant-shell-stale"]')) {
    return;
  }
  if (main) main.setAttribute('data-instant-shell', pageType);

  const scopeLabel = opts.scopeLabel || '';
  setDeliveraSurfaceState(pageType === 'portfolio' ? 'governance' : pageType, 'loading', { scopeLabel });

  const remembered = readRememberedSurface(pageType, { scopeLabel });
  const targetMount = resolveMount(pageType);
  if (!targetMount) return;

  if (remembered?.html) {
    const ageMin = Math.max(1, Math.round((Date.now() - remembered.savedAt) / 60000));
    setDeliveraSurfaceState(pageType === 'portfolio' ? 'governance' : pageType, 'stale', { scopeLabel });
    targetMount.innerHTML = `
      <div class="instant-shell instant-shell--stale" data-testid="instant-shell-stale" aria-busy="true" role="status">
        ${renderStateStrip(pageType, scopeLabel || remembered.scopeLabel, `Showing last view · refreshing`)}
        <p class="instant-shell-stale-banner" data-testid="instant-shell-refresh-chip">
          Showing last view · ${ageMin}m ago · <strong>Refreshing…</strong>
        </p>
        <div class="instant-shell-stale-body" data-scope-stale="true">${remembered.html}</div>
      </div>`;
    document.body?.classList?.add('delivera-instant-shell-active');
    return;
  }

  // Keep pre-JS cold shell if already present — only refresh stage label (no flash to empty).
  const cold = targetMount.querySelector('[data-instant-shell-cold="1"], [data-testid="instant-shell"]');
  if (cold && !targetMount.querySelector('[data-gov-priority-rendered], [data-current-sprint-content], [data-actions-content]')) {
    document.body?.classList?.add('delivera-instant-shell-active');
    if (opts.message) updateInstantShellLabel(opts.message);
    const scopeEl = cold.querySelector('.instant-shell-state-scope');
    if (scopeEl && scopeLabel) scopeEl.textContent = scopeLabel;
    return;
  }

  targetMount.innerHTML = renderShell(pageType, scopeLabel, opts.message);
  document.body?.classList?.add('delivera-instant-shell-active');
}

/**
 * Update the visible shell label without replacing the skeleton (cold-load progress).
 */
export function updateInstantShellLabel(message) {
  const label = document.querySelector('[data-testid="instant-shell"] .instant-shell-label');
  if (label && message) label.textContent = message;
  const sub = document.querySelector('[data-testid="instant-shell"] .instant-shell-state-sub');
  if (sub && message) sub.textContent = message;
}

function renderShell(pageType, scopeLabel, message) {
  const scopeChip = scopeLabel
    ? `<span class="instant-shell-scope">${escapeHtml(scopeLabel)}</span>`
    : '';
  switch (pageType) {
    case 'governance':
    case 'portfolio':
      return renderGovernanceShell(scopeChip, scopeLabel, message);
    case 'current-sprint':
      return renderCurrentSprintShell(scopeChip, scopeLabel, message);
    case 'actions':
      return renderActionsShell(scopeChip, scopeLabel, message);
    case 'settings':
      return renderSettingsShell(scopeLabel, message);
    case 'report':
      return renderReportShell(scopeChip, scopeLabel, message);
    case 'leadership':
      return renderLeadershipShell(scopeChip, scopeLabel, message);
    case 'evidence':
      return renderEvidenceShell(scopeChip, scopeLabel, message);
    case 'home':
      return renderGenericShell(scopeLabel, message || 'Loading dashboard…', 'home');
    default:
      return renderGenericShell(scopeLabel, message, pageType);
  }
}

function shimmerRow(width = '100%') {
  return `<div class="instant-shimmer" style="width:${width}"></div>`;
}

function shimmerRows(count = 3, widths = ['100%', '80%', '60%']) {
  return Array.from({ length: count }, (_, i) =>
    shimmerRow(widths[i] || '100%')
  ).join('');
}

function renderGovernanceShell(scopeChip, scopeLabel, message) {
  const label = message || 'Loading portfolio signal…';
  return `
    <div class="instant-shell instant-shell--governance" data-testid="instant-shell" aria-busy="true" role="status">
      ${renderStateStrip('governance', scopeLabel, label)}
      <p class="instant-shell-value-line">${escapeHtml(GOVERNANCE_DISPLACEMENT_LINE_SHORT)}</p>
      <div class="instant-shell-scope-bar">${scopeChip}${shimmerRow('40%')}</div>
      <div class="instant-shell-layout gov-priority-layout">
        <div class="instant-shell-main gov-priority-main">
          <div class="instant-shell-hero">
            ${shimmerRow('60%')}
            ${shimmerRow('90%')}
            ${shimmerRow('45%')}
          </div>
          <div class="instant-shell-compare" aria-label="Squad comparison loading">
            ${shimmerRow('40%')}
            ${shimmerRow('85%')}
            ${shimmerRow('70%')}
          </div>
        </div>
        <aside class="instant-shell-rail gov-priority-rail">
          <div class="instant-shell-rail-card">${shimmerRows(3, ['60%', '90%', '40%'])}</div>
          <div class="instant-shell-rail-card">${shimmerRows(2, ['50%', '70%'])}</div>
        </aside>
      </div>
      <p class="instant-shell-label">${escapeHtml(label)}</p>
    </div>`;
}

function renderCurrentSprintShell(scopeChip, scopeLabel, message) {
  const label = message || 'Loading sprint health…';
  return `
    <div class="instant-shell instant-shell--current-sprint" data-testid="instant-shell" aria-busy="true" role="status">
      ${renderStateStrip('current-sprint', scopeLabel, label)}
      <div class="instant-shell-header-bar">
        ${scopeChip}
        ${shimmerRow('30%')}
        ${shimmerRow('50%')}
      </div>
      <div class="instant-shell-sprint-grid">
        <div class="instant-shell-signal-row">
          <div class="instant-shell-signal-card">${shimmerRow('40%')}${shimmerRow('70%')}${shimmerRow('90%')}</div>
          <div class="instant-shell-signal-card">${shimmerRow('40%')}${shimmerRow('70%')}${shimmerRow('90%')}</div>
          <div class="instant-shell-signal-card">${shimmerRow('40%')}${shimmerRow('70%')}${shimmerRow('90%')}</div>
        </div>
        <div class="instant-shell-blockers">${shimmerRows(2, ['80%', '60%'])}</div>
        <div class="instant-shell-stories">
          ${Array.from({ length: 4 }, () => `<div class="instant-shell-story-row">${shimmerRow('15%')}${shimmerRow('60%')}${shimmerRow('10%')}</div>`).join('')}
        </div>
      </div>
      <p class="instant-shell-label">${escapeHtml(label)}</p>
    </div>`;
}

function renderActionsShell(scopeChip, scopeLabel, message) {
  const label = message || 'Loading action queue…';
  return `
    <div class="instant-shell instant-shell--actions" data-testid="instant-shell" aria-busy="true" role="status">
      ${renderStateStrip('actions', scopeLabel, label)}
      <div class="instant-shell-header-bar">${scopeChip}${shimmerRow('30%')}</div>
      <div class="instant-shell-tabs">${shimmerRow('20%')}${shimmerRow('20%')}</div>
      <div class="instant-shell-cases">
        ${Array.from({ length: 3 }, () => `<div class="instant-shell-case-card">${shimmerRow('40%')}${shimmerRow('80%')}${shimmerRow('50%')}</div>`).join('')}
      </div>
      <p class="instant-shell-label">${escapeHtml(label)}</p>
    </div>`;
}

function renderSettingsShell(scopeLabel, message) {
  const label = message || 'Loading workspace settings…';
  return `
    <div class="instant-shell instant-shell--settings" data-testid="instant-shell" aria-busy="true" role="status">
      ${renderStateStrip('settings', scopeLabel, label)}
      <div class="instant-shell-settings-grid">
        <div class="instant-shell-settings-nav">${shimmerRows(4, ['90%', '80%', '85%', '70%'])}</div>
        <div class="instant-shell-settings-content">
          ${Array.from({ length: 3 }, () => `<div class="instant-shell-settings-card">${shimmerRow('30%')}${shimmerRows(3, ['90%', '70%', '50%'])}</div>`).join('')}
        </div>
      </div>
      <p class="instant-shell-label">${escapeHtml(label)}</p>
    </div>`;
}

function renderReportShell(scopeChip, scopeLabel, message) {
  const label = message || 'Loading proof preview…';
  return `
    <div class="instant-shell instant-shell--report" data-testid="instant-shell" aria-busy="true" role="status">
      ${renderStateStrip('report', scopeLabel, label)}
      <div class="instant-shell-header-bar">${scopeChip}${shimmerRow('40%')}</div>
      <div class="instant-shell-preview-grid">
        ${shimmerRows(6, ['100%', '95%', '100%', '80%', '100%', '70%'])}
      </div>
      <p class="instant-shell-label">${escapeHtml(label)}</p>
    </div>`;
}

function renderLeadershipShell(scopeChip, scopeLabel, message) {
  const label = message || 'Loading portfolio story…';
  return `
    <div class="instant-shell instant-shell--leadership" data-testid="instant-shell" aria-busy="true" role="status">
      ${renderStateStrip('leadership', scopeLabel, label)}
      <div class="instant-shell-header-bar">${scopeChip}${shimmerRow('35%')}</div>
      <div class="instant-shell-hud-grid">
        <div class="instant-shell-hud-card">${shimmerRows(3, ['50%', '90%', '60%'])}</div>
        <div class="instant-shell-hud-card">${shimmerRows(3, ['50%', '90%', '60%'])}</div>
        <div class="instant-shell-hud-card">${shimmerRows(3, ['50%', '90%', '60%'])}</div>
      </div>
      <p class="instant-shell-label">${escapeHtml(label)}</p>
    </div>`;
}

function renderEvidenceShell(scopeChip, scopeLabel, message) {
  const label = message || 'Loading evidence timeline…';
  return `
    <div class="instant-shell instant-shell--evidence" data-testid="instant-shell" aria-busy="true" role="status">
      ${renderStateStrip('evidence', scopeLabel, label)}
      <div class="instant-shell-header-bar">${scopeChip}${shimmerRow('30%')}</div>
      <div class="instant-shell-timeline">
        ${Array.from({ length: 5 }, () => `<div class="instant-shell-story-row">${shimmerRow('20%')}${shimmerRow('70%')}</div>`).join('')}
      </div>
      <p class="instant-shell-label">${escapeHtml(label)}</p>
    </div>`;
}

function renderGenericShell(scopeLabel, message, pageType = 'home') {
  const label = message || 'Loading…';
  return `
    <div class="instant-shell instant-shell--generic" data-testid="instant-shell" aria-busy="true" role="status">
      ${renderStateStrip(pageType, scopeLabel, label)}
      ${shimmerRows(5, ['60%', '90%', '70%', '50%', '80%'])}
      <p class="instant-shell-label">${escapeHtml(label)}</p>
    </div>`;
}

/**
 * Bonus: labeled compare-band skeleton — keeps under-hero area filled until live carousel paints.
 * Used by Priority Surface first paint and portfolio cache/refresh paths.
 */
export function renderSquadCompareSkeletonHtml(opts = {}) {
  const label = opts.label || 'Squad comparison';
  const sub = opts.sub || 'Matching boards to PI baselines…';
  return `
    <div class="portfolio-carousel-cache-placeholder gov-compare-skeleton" data-testid="portfolio-carousel-cache-placeholder" aria-label="${escapeHtml(label)} loading" aria-busy="true">
      <p class="gov-compare-skeleton-label">${escapeHtml(label)}</p>
      <p class="gov-compare-skeleton-sub">${escapeHtml(sub)}</p>
      <div class="instant-shimmer" style="width:70%;height:.7rem;margin:.35rem 0"></div>
      <div class="instant-shimmer" style="width:90%;height:.7rem;margin:.35rem 0"></div>
      <div class="instant-shimmer" style="width:55%;height:.7rem;margin:.35rem 0"></div>
    </div>`;
}

export function clearInstantShell() {
  const main = document.getElementById('main-content') || document.querySelector('main');
  if (main?.getAttribute('data-instant-shell')) {
    main.removeAttribute('data-instant-shell');
  }
  document.body?.classList?.remove('delivera-instant-shell-active');
  // Drop 52vh loading void — mount must not stay aria-busy after live content.
  document.querySelectorAll('[data-instant-shell-mount][aria-busy="true"]').forEach((mount) => {
    mount.removeAttribute('aria-busy');
    mount.setAttribute('aria-busy', 'false');
  });
  document.querySelectorAll('[data-testid="instant-shell"], [data-testid="instant-shell-stale"]').forEach((el) => {
    const parent = el.parentElement;
    if (!parent) {
      el.remove();
      return;
    }
    const hasReal = parent.querySelector(
      '[data-testid="governance-priority-brief"], [data-portfolio-signal], [data-portfolio-bento-card], [data-testid="portfolio-bento-card"], .actions-case-card, [data-current-sprint-content], .settings-section-card:not(.instant-shell *), .current-sprint-signal-strip, .gov-priority-surface, .hud-card, .evidence-os-row, .preview-ready, #home-live-surface'
    );
    if (hasReal || parent.children.length > 1) {
      el.remove();
    }
  });
  // Bonus: never leave a cleared mount as an empty white rectangle.
  document.querySelectorAll('[data-instant-shell-mount]').forEach((mount) => {
    if (mount.children.length) mount.classList.remove('instant-shell-mount--reserve');
    else mount.classList.add('instant-shell-mount--reserve');
  });
}
