/* Shared Header Renderer
 * Ensures consistent header layout and shared context bar (report wires feedback after header actions are built).
 */
import {
  getContextDisplayString,
  getLastMetaFreshnessInfo,
  getContextStateBadgeInfo,
} from './Delivera-Shared-Context-From-Storage.js';

function getPathnameSafe() {
  try {
    return window.location && window.location.pathname ? window.location.pathname : '';
  } catch (_) {
    return '';
  }
}

function ensureExecutiveHeader(path) {
  if (path === '/login' || path.endsWith('/login')) return;
  if (document.querySelector('header')) return;
  if (!document.body?.classList?.contains('executive-surface-page')) return;
  const container = document.querySelector('.container');
  if (!container) return;
  const main = container.querySelector('main');
  const pageTitle = document.body.getAttribute('data-surface-name') || 'Delivery';
  const hasInlineCreateWork = !!document.querySelector('[data-open-outcome-modal]');
  const header = document.createElement('header');
  header.className = 'executive-shared-header';
  header.innerHTML = ''
    + '<div class="header-row executive-shared-header-row">'
    + '<div class="executive-shared-header-title-block">'
    + `<h1>${pageTitle}</h1>`
    + '<p class="subtitle">Consistent context and direct actions across pages.</p>'
    + '</div>'
    + '<div id="executive-shared-header-actions" class="report-header-actions" role="group" aria-label="Page actions">'
    + '<button type="button" class="btn btn-primary btn-compact" data-shared-action="refresh-page">Refresh</button>'
    + (hasInlineCreateWork ? '' : `<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-context="Create work from ${pageTitle} context.">Create work</button>`)
    + '<details class="report-header-more-menu">'
    + '<summary class="btn btn-secondary btn-compact">Actions</summary>'
    + '<div class="report-header-more-panel">'
    + '<a href="/report" class="btn btn-secondary btn-compact">Delivery</a>'
    + '<a href="/current-sprint" class="btn btn-secondary btn-compact">Current sprint</a>'
    + '<a href="/leadership" class="btn btn-secondary btn-compact">Leadership</a>'
    + '</div>'
    + '</details>'
    + '</div>'
    + '</div>';
  if (main) container.insertBefore(header, main);
  else container.prepend(header);
}

function hasDedicatedContextSurface(path) {
  return path === '/report'
    || path.endsWith('/report')
    || path === '/current-sprint'
    || path.endsWith('/current-sprint')
    || path === '/leadership'
    || path.endsWith('/leadership')
    || path === '/sprint-leadership'
    || path.endsWith('/sprint-leadership');
}

function getContextActionTarget(path) {
  if (path === '/report' || path.endsWith('/report')) return 'report';
  if (path === '/current-sprint' || path.endsWith('/current-sprint')) return 'current-sprint';
  return 'none';
}

function findHeaderRow(header) {
  if (!header) return null;
  return header.querySelector('.header-row, .report-shell-top-row, .hud-header-top');
}

function ensureHeaderContract(header) {
  const row = findHeaderRow(header);
  header.classList.add('app-header', 'app-header-shell', 'app-mission-control-header');
  if (!row) return null;
  row.classList.add('app-header-row');
  const titleBlock = row.querySelector('.report-shell-title-block')
    || row.querySelector(':scope > div:first-child');
  if (titleBlock) {
    titleBlock.classList.add('app-header-title-block');
    titleBlock.setAttribute('data-header-slot', 'title');
  }
  const actionBlock = header.querySelector('#report-header-actions, #leadership-header-actions, .report-header-actions, .hud-actions-row');
  if (actionBlock) {
    actionBlock.classList.add('app-header-actions');
    actionBlock.setAttribute('data-header-slot', 'actions');
    actionBlock.setAttribute('role', actionBlock.getAttribute('role') || 'group');
  }
  header.setAttribute('data-shared-header-contract', 'true');
  return row;
}

function attachStaleHint(container, info, contextTarget) {
  const existing = container.querySelector('.context-stale-hint');
  existing?.remove();
  if (!info || !info.isStale || contextTarget === 'none') return;
  const hint = document.createElement('button');
  hint.type = 'button';
  hint.className = 'context-stale-hint';
  hint.textContent = 'Context may be stale - click to refresh';
  hint.addEventListener('click', () => {
    try {
      if (contextTarget === 'report') {
        const previewBtn = document.getElementById('preview-btn');
        if (previewBtn && !previewBtn.disabled) previewBtn.click();
      } else if (contextTarget === 'current-sprint') {
        document.dispatchEvent(new Event('refreshSprint'));
      }
    } catch (_) {}
  });
  container.appendChild(hint);
}

function renderContextBar(bar, contextTarget) {
  if (!bar) return;
  const text = getContextDisplayString();
  const state = getContextStateBadgeInfo();
  const freshnessInfo = getLastMetaFreshnessInfo();
  bar.innerHTML = '';
  const textSpan = document.createElement('span');
  textSpan.className = 'shared-context-bar-text';
  textSpan.textContent = text;
  bar.appendChild(textSpan);
  if (state) {
    const badge = document.createElement('span');
    badge.setAttribute('data-context-state-badge', 'true');
    badge.className = 'context-state-badge context-state-badge--' + state.kind;
    badge.textContent = ` ${state.label}`;
    bar.appendChild(badge);
  }
  attachStaleHint(bar, freshnessInfo, contextTarget);
}

export function ensureSharedHeader() {
  try {
    const path = getPathnameSafe();
    ensureExecutiveHeader(path);
    const header = document.querySelector('header');
    if (!header) return;

    ensureHeaderContract(header);
    const suppressContextBar = hasDedicatedContextSurface(path);
    const contextTarget = getContextActionTarget(path);

    let contextBar = header.querySelector('.shared-context-bar[data-context-bar]');
    if (suppressContextBar) {
      contextBar?.remove();
    } else if (!contextBar) {
      contextBar = document.createElement('div');
      contextBar.setAttribute('data-context-bar', 'true');
      contextBar.className = 'subtitle shared-context-bar';
      const row = findHeaderRow(header);
      if (row) row.after(contextBar);
      else header.appendChild(contextBar);
    }
    if (contextBar) {
      renderContextBar(contextBar, contextTarget);
    }

    window.__refreshReportingContextBar = function refreshContextBar() {
      const headerEl = document.querySelector('header');
      if (!headerEl) return;
      const bar = headerEl.querySelector('.shared-context-bar[data-context-bar]');
      if (!bar || suppressContextBar) return;
      renderContextBar(bar, contextTarget);
    };

    header.setAttribute('data-shared-header', 'true');
    header.style.setProperty('--shared-header-top', '0px');
    document.getElementById('feedback-corner')?.remove();
    if (!window.__sharedHeaderActionsBound) {
      window.__sharedHeaderActionsBound = true;
      document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-shared-action]');
        if (!trigger) return;
        const action = trigger.getAttribute('data-shared-action');
        if (action === 'refresh-page') {
          event.preventDefault();
          window.location.reload();
        }
      });
    }
  } catch (e) {
    // ignore; header enhancements are progressive
  }
}

// Auto-run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureSharedHeader);
} else {
  ensureSharedHeader();
}

window.addEventListener('storage', () => {
  if (typeof window.__refreshReportingContextBar === 'function') {
    window.__refreshReportingContextBar();
  }
});

window.addEventListener('hashchange', () => {
  ensureSharedHeader();
});

window.addEventListener('report-preview-shown', () => {
  if (typeof window.__refreshReportingContextBar === 'function') {
    window.__refreshReportingContextBar();
  }
});
