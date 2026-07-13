/**
 * Delivera Instant Shell — standardized loading skeleton + stale-while-revalidate.
 *
 * Principle: users never see a blank white page. Prefer last-known HTML from
 * sessionStorage; fall back to a layout-mirroring shimmer that states what is loading.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { GOVERNANCE_DISPLACEMENT_LINE_SHORT } from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';

const CACHE_PREFIX = 'delivera:last-shell:v1:';

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
 * @param {'governance'|'current-sprint'|'actions'|'settings'|'report'|'leadership'} pageType
 * @param {object} [opts] — { scopeLabel?: string }
 */
export function paintInstantShell(pageType, opts = {}) {
  const main = document.getElementById('main-content') || document.querySelector('main');
  if (!main) return;

  if (main.querySelector('[data-gov-priority-rendered], [data-current-sprint-content], [data-actions-content], .settings-section-card:not(.instant-shell *)')) {
    return;
  }
  if (main.getAttribute('data-instant-shell') === pageType
    && main.querySelector('[data-testid="instant-shell"], [data-testid="instant-shell-stale"]')) {
    return;
  }
  main.setAttribute('data-instant-shell', pageType);

  const scopeLabel = opts.scopeLabel || '';
  const remembered = readRememberedSurface(pageType, { scopeLabel });
  const targetMount =
    document.getElementById('governance-priority-surface-mount') ||
    document.getElementById('current-sprint-content') ||
    document.getElementById('actions-list') ||
    document.querySelector('.settings-hub-panels') ||
    main;

  if (remembered?.html) {
    const ageMin = Math.max(1, Math.round((Date.now() - remembered.savedAt) / 60000));
    targetMount.innerHTML = `
      <div class="instant-shell instant-shell--stale" data-testid="instant-shell-stale" aria-busy="true" role="status">
        <p class="instant-shell-stale-banner" data-testid="instant-shell-refresh-chip">
          Showing last view · ${ageMin}m ago · <strong>Refreshing…</strong>
        </p>
        <div class="instant-shell-stale-body" data-scope-stale="true">${remembered.html}</div>
      </div>`;
    document.body?.classList?.add('delivera-instant-shell-active');
    return;
  }

  targetMount.innerHTML = renderShell(pageType, scopeLabel);
  document.body?.classList?.add('delivera-instant-shell-active');
}

function renderShell(pageType, scopeLabel) {
  const scopeChip = scopeLabel
    ? `<span class="instant-shell-scope">${escapeHtml(scopeLabel)}</span>`
    : '';
  switch (pageType) {
    case 'governance':
    case 'portfolio':
      return renderGovernanceShell(scopeChip);
    case 'current-sprint':
      return renderCurrentSprintShell(scopeChip);
    case 'actions':
      return renderActionsShell(scopeChip);
    case 'settings':
      return renderSettingsShell();
    default:
      return renderGenericShell();
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

function renderGovernanceShell(scopeChip) {
  return `
    <div class="instant-shell instant-shell--governance" data-testid="instant-shell" aria-busy="true" role="status">
      <p class="instant-shell-value-line">${escapeHtml(GOVERNANCE_DISPLACEMENT_LINE_SHORT)}</p>
      <div class="instant-shell-scope-bar">${scopeChip}${shimmerRow('40%')}</div>
      <div class="instant-shell-cockpit-grid">
        <div class="instant-shell-main">
          <div class="instant-shell-hero">
            ${shimmerRow('60%')}
            ${shimmerRow('90%')}
            ${shimmerRow('45%')}
            <div class="instant-shell-metrics-row">
              <div class="instant-shell-metric-card">${shimmerRow('50%')}${shimmerRow('80%')}</div>
              <div class="instant-shell-metric-card">${shimmerRow('50%')}${shimmerRow('80%')}</div>
              <div class="instant-shell-metric-card">${shimmerRow('50%')}${shimmerRow('80%')}</div>
            </div>
          </div>
          <div class="instant-shell-evidence">
            ${shimmerRows(2, ['70%', '50%'])}
          </div>
        </div>
        <aside class="instant-shell-rail">
          <div class="instant-shell-rail-card">${shimmerRows(3, ['60%', '90%', '40%'])}</div>
          <div class="instant-shell-rail-card">${shimmerRows(2, ['50%', '70%'])}</div>
        </aside>
      </div>
      <p class="instant-shell-label">Loading portfolio signal…</p>
    </div>`;
}

function renderCurrentSprintShell(scopeChip) {
  return `
    <div class="instant-shell instant-shell--current-sprint" data-testid="instant-shell" aria-busy="true" role="status">
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
      <p class="instant-shell-label">Loading sprint health…</p>
    </div>`;
}

function renderActionsShell(scopeChip) {
  return `
    <div class="instant-shell instant-shell--actions" data-testid="instant-shell" aria-busy="true" role="status">
      <div class="instant-shell-header-bar">${scopeChip}${shimmerRow('30%')}</div>
      <div class="instant-shell-tabs">${shimmerRow('20%')}${shimmerRow('20%')}</div>
      <div class="instant-shell-cases">
        ${Array.from({ length: 3 }, () => `<div class="instant-shell-case-card">${shimmerRow('40%')}${shimmerRow('80%')}${shimmerRow('50%')}</div>`).join('')}
      </div>
      <p class="instant-shell-label">Loading action queue…</p>
    </div>`;
}

function renderSettingsShell() {
  return `
    <div class="instant-shell instant-shell--settings" data-testid="instant-shell" aria-busy="true" role="status">
      ${Array.from({ length: 3 }, () => `<div class="instant-shell-settings-card">${shimmerRow('30%')}${shimmerRows(3, ['90%', '70%', '50%'])}</div>`).join('')}
      <p class="instant-shell-label">Loading settings…</p>
    </div>`;
}

function renderGenericShell() {
  return `
    <div class="instant-shell instant-shell--generic" data-testid="instant-shell" aria-busy="true" role="status">
      ${shimmerRows(5, ['60%', '90%', '70%', '50%', '80%'])}
      <p class="instant-shell-label">Loading…</p>
    </div>`;
}

export function clearInstantShell() {
  const main = document.getElementById('main-content') || document.querySelector('main');
  if (main?.getAttribute('data-instant-shell')) {
    main.removeAttribute('data-instant-shell');
  }
  document.body?.classList?.remove('delivera-instant-shell-active');
  document.querySelectorAll('[data-testid="instant-shell"], [data-testid="instant-shell-stale"]').forEach((el) => {
    const parent = el.parentElement;
    if (!parent) {
      el.remove();
      return;
    }
    // Drop shell once real surface content is present beside or under it.
    const hasReal = parent.querySelector(
      '[data-testid="governance-priority-brief"], [data-portfolio-signal], [data-portfolio-bento-card], [data-testid="portfolio-bento-card"], .actions-case-card, [data-current-sprint-content], .settings-section-card:not(.instant-shell *), .current-sprint-signal-strip, .gov-priority-surface'
    );
    if (hasReal || parent.children.length > 1) {
      el.remove();
    }
  });
}
