/**
 * Unified surface state SSOT — consolidates loading, error, and empty states
 * across all Delivera surfaces (governance, current-sprint, actions, report).
 *
 * Replaces the fragmented patterns:
 *   - showInlineToast (ephemeral inline toast)
 *   - showErrorView/showLoadingView (status view helpers)
 *   - showError/showLoading (current-sprint page state machine)
 *   - renderEmptyStateHtml (empty state helpers)
 *   - Inline gov-baseline-loading strings
 *
 * Usage:
 *   import { renderSurfaceState, showSurfaceError, showSurfaceLoading, showSurfaceToast } from './Delivera-Shared-Surface-State-01SSOT.js';
 *   renderSurfaceState(mountEl, { variant: 'loading', message: 'Reading slide…' });
 *   renderSurfaceState(mountEl, { variant: 'error', message: 'Could not load', retry: () => reload() });
 *   renderSurfaceState(mountEl, { variant: 'empty', title: 'No data', message: 'Upload a slide', ctaLabel: 'Upload', ctaAction: () => open() });
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

/**
 * Render a unified surface state (loading / error / empty / skeleton) into a host element.
 * @param {HTMLElement} host - The mount element to render into.
 * @param {{ variant: 'loading'|'error'|'empty'|'skeleton', message?: string, title?: string, hint?: string, ctaLabel?: string, ctaHref?: string, ctaAction?: Function, retry?: Function, compact?: boolean }} opts
 */
export function renderSurfaceState(host, opts = {}) {
  if (!host) return;
  const { variant = 'loading' } = opts;
  host.innerHTML = renderSurfaceStateHtml(opts);
  bindSurfaceStateActions(host, opts);
}

/**
 * Render the HTML for a surface state without binding (for template strings).
 * @returns {string} HTML string.
 */
export function renderSurfaceStateHtml(opts = {}) {
  const { variant = 'loading', compact = false } = opts;
  switch (variant) {
    case 'loading':
    case 'skeleton':
      return renderLoadingHtml(opts);
    case 'error':
      return renderErrorHtml(opts);
    case 'empty':
      return renderEmptyHtml(opts);
    default:
      return renderLoadingHtml(opts);
  }
}

/**
 * Show an ephemeral inline toast on a host element (replaces showInlineToast).
 * @param {HTMLElement} host
 * @param {string} message
 * @param {'error'|'success'|'info'|'warning'} kind
 */
export function showSurfaceToast(host, message, kind = 'error') {
  if (!host) return;
  let el = host.querySelector('.delivera-surface-toast');
  if (!el) {
    el = document.createElement('p');
    el.className = `delivera-surface-toast delivera-surface-toast--${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    host.prepend(el);
  }
  el.textContent = message;
  el.hidden = false;
  el.classList.remove('delivera-surface-toast--fade');
  // Trigger reflow for animation
  void el.offsetWidth;
  el.classList.add('delivera-surface-toast--visible');
  window.setTimeout(() => {
    el.classList.remove('delivera-surface-toast--visible');
    el.classList.add('delivera-surface-toast--fade');
    window.setTimeout(() => { el.hidden = true; }, 300);
  }, 4000);
}

/**
 * Show a loading state on a host element.
 */
export function showSurfaceLoading(host, message = 'Loading…', opts = {}) {
  renderSurfaceState(host, { ...opts, variant: 'loading', message });
}

/**
 * @deprecated Prefer showSurfaceLoading / renderSurfaceStateHtml — kept for API compat.
 */
export function renderSharedLoadingState(opts = {}) {
  return renderSurfaceStateHtml({
    variant: opts.variant === 'skeleton' ? 'skeleton' : 'loading',
    message: opts.message || 'Loading...',
    compact: opts.compact,
  });
}

/**
 * @deprecated Prefer showSurfaceLoading.
 */
export function setSharedLoadingState(host, opts = {}) {
  showSurfaceLoading(host, opts.message || 'Loading...', opts);
}

/**
 * Show an error state on a host element with optional retry.
 */
export function showSurfaceError(host, message, opts = {}) {
  renderSurfaceState(host, { ...opts, variant: 'error', message });
}

/**
 * Show an empty state on a host element with optional CTA.
 */
export function showSurfaceEmpty(host, opts = {}) {
  renderSurfaceState(host, { ...opts, variant: 'empty' });
}

/**
 * Show a 3-action launchpad empty state — every empty state is a launchpad, not a dead-end.
 * @param {HTMLElement} host
 * @param {{ title: string, message?: string, hint?: string, whyMatters?: string, actions: Array<{label: string, href?: string, action?: Function, primary?: boolean}> }} opts
 */
export function showSurfaceEmptyLaunchpad(host, opts = {}) {
  renderSurfaceState(host, { ...opts, variant: 'empty' });
}

// ─── Internal renderers ──────────────────────────────────────────────────────

function renderLoadingHtml({ message = 'Loading…', variant = 'loading', compact = false }) {
  const cls = [
    'delivera-surface-state',
    `delivera-surface-state--${variant}`,
    compact ? 'delivera-surface-state--compact' : '',
  ].filter(Boolean).join(' ');
  const lines = variant === 'skeleton'
    ? '<span class="delivera-surface-skeleton-line"></span><span class="delivera-surface-skeleton-line"></span><span class="delivera-surface-skeleton-line"></span>'
    : '<i class="delivera-surface-spinner" aria-hidden="true"></i>';
  return `
    <div class="${escapeHtml(cls)}" aria-busy="true" role="status" data-delivera-surface-state="loading">
      ${lines}
      <p>${escapeHtml(message)}</p>
    </div>`;
}

function renderErrorHtml({ message = 'Something went wrong', retry = null, compact = false }) {
  const cls = [
    'delivera-surface-state',
    'delivera-surface-state--error',
    compact ? 'delivera-surface-state--compact' : '',
  ].filter(Boolean).join(' ');
  const retryHtml = retry
    ? `<button type="button" class="btn btn-secondary btn-compact" data-surface-retry>Retry</button>`
    : '';
  return `
    <div class="${escapeHtml(cls)}" role="alert" data-delivera-surface-state="error">
      <p>${escapeHtml(message)}</p>
      ${retryHtml}
    </div>`;
}

function renderEmptyHtml({ title = 'Nothing here yet', message = '', hint = '', ctaLabel = '', ctaHref = '', ctaAction = null, compact = false, actions = [], whyMatters = '' }) {
  const cls = [
    'delivera-surface-state',
    'delivera-surface-state--empty',
    compact ? 'delivera-surface-state--compact' : '',
  ].filter(Boolean).join(' ');
  const hintHtml = hint ? `<p class="delivera-surface-empty-hint"><small>${escapeHtml(hint)}</small></p>` : '';
  const whyHtml = whyMatters ? `<p class="delivera-surface-empty-why"><small>${escapeHtml(whyMatters)}</small></p>` : '';
  let ctaHtml = '';
  if (ctaLabel) {
    if (ctaHref) {
      ctaHtml = `<p><a href="${escapeHtml(ctaHref)}" class="btn btn-primary btn-compact">${escapeHtml(ctaLabel)}</a></p>`;
    } else if (ctaAction) {
      ctaHtml = `<p><button type="button" class="btn btn-primary btn-compact" data-surface-cta>${escapeHtml(ctaLabel)}</button></p>`;
    }
  }
  // 3-action launchpad: render additional action buttons
  let actionsHtml = '';
  if (Array.isArray(actions) && actions.length > 0) {
    const buttons = actions.map((act, i) => {
      if (!act || !act.label) return '';
      if (act.href) {
        return `<a href="${escapeHtml(act.href)}" class="btn ${act.primary ? 'btn-primary' : 'btn-secondary'} btn-compact" data-surface-action="${i}">${escapeHtml(act.label)}</a>`;
      }
      return `<button type="button" class="btn ${act.primary ? 'btn-primary' : 'btn-secondary'} btn-compact" data-surface-action="${i}">${escapeHtml(act.label)}</button>`;
    }).filter(Boolean).join(' ');
    actionsHtml = buttons ? `<p class="delivera-surface-empty-actions">${buttons}</p>` : '';
  }
  return `
    <div class="${escapeHtml(cls)}" data-delivera-surface-state="empty">
      <p><strong>${escapeHtml(title)}</strong></p>
      ${message ? `<p>${escapeHtml(message)}</p>` : ''}
      ${hintHtml}
      ${whyHtml}
      ${ctaHtml}
      ${actionsHtml}
    </div>`;
}

function bindSurfaceStateActions(host, opts) {
  if (!host) return;
  host.querySelector('[data-surface-retry]')?.addEventListener('click', () => {
    if (typeof opts.retry === 'function') opts.retry();
  });
  host.querySelector('[data-surface-cta]')?.addEventListener('click', () => {
    if (typeof opts.ctaAction === 'function') opts.ctaAction();
  });
  // Bind 3-action launchpad buttons
  if (Array.isArray(opts.actions)) {
    opts.actions.forEach((act, i) => {
      if (!act || !act.action) return;
      const btn = host.querySelector(`[data-surface-action="${i}"]`);
      if (btn) btn.addEventListener('click', () => { if (typeof act.action === 'function') act.action(); });
    });
  }
}
