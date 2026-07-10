/**
 * Governance brief loading state — uses Surface-State SSOT.
 */
import { showLoadingView, clearErrorView } from './Delivera-Shared-Status-View-Helpers.js';
import { renderSurfaceStateHtml } from './Delivera-Shared-Surface-State-01SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function getDom() {
  return {
    loadingEl: document.getElementById('gov-loading'),
    errorEl: document.getElementById('gov-error'),
    contentEl: document.getElementById('gov-brief-content'),
  };
}

export function hasGovernanceBriefContent() {
  const signalMount = document.getElementById('portfolio-signal-mount');
  if (signalMount?.querySelector('[data-portfolio-signal]')) return true;
  if (signalMount?.querySelector('[data-portfolio-signal-skeleton]')) return false;
  const el = document.getElementById('gov-brief-content');
  if (!el) return false;
  return Boolean(el.querySelector('.gov-command-answer, .gov-owner-cluster, .governance-empty'));
}

export function showGovernanceLoading(msg = 'Loading your delivery answer…', options = {}) {
  const { loadingEl, errorEl, contentEl } = getDom();
  if (errorEl) errorEl.hidden = true;
  const preserve = options.preserveContent === true && hasGovernanceBriefContent();
  if (loadingEl) {
    if (preserve) {
      loadingEl.innerHTML = `<p class="gov-loading-msg delivera-surface-loading-copy" aria-live="polite">${escapeHtml(msg || 'Refreshing… showing previous answer until live data arrives.')}</p>`;
      loadingEl.classList.remove('current-sprint-loading-with-spinner');
    } else {
      loadingEl.innerHTML = renderSurfaceStateHtml({ variant: 'loading', message: msg || 'Preparing portfolio signal…', compact: false });
      loadingEl.classList.add('current-sprint-loading-with-spinner');
    }
    loadingEl.style.display = 'block';
    loadingEl.removeAttribute('hidden');
  }
  if (contentEl) {
    if (preserve) {
      setScopeStaleOverlay(true, msg || 'Updating scope…');
      contentEl.style.display = 'block';
    } else {
      clearScopeStaleOverlay();
      contentEl.style.display = 'none';
    }
  }
  document.body?.classList?.add('gov-brief-loading');
}

export function hideGovernanceLoading() {
  const { loadingEl, contentEl } = getDom();
  const signalMount = document.getElementById('portfolio-signal-mount');
  if (loadingEl) {
    loadingEl.style.display = 'none';
    loadingEl.setAttribute('hidden', '');
    loadingEl.classList.remove('current-sprint-loading-with-spinner');
  }
  if (signalMount) {
    const skeleton = signalMount.querySelector('[data-portfolio-signal-skeleton]');
    if (skeleton && !signalMount.querySelector('[data-portfolio-signal]')) {
      skeleton.remove();
    }
  }
  if (contentEl) {
    clearScopeStaleOverlay();
    const isPortfolio = Boolean(signalMount);
    if (isPortfolio) {
      contentEl.style.display = 'none';
      contentEl.setAttribute('hidden', '');
    } else {
      contentEl.style.display = 'block';
      contentEl.removeAttribute('hidden');
    }
  }
  document.body?.classList?.remove('gov-brief-loading');
  clearErrorView(getDom());
}

export function setScopeStaleOverlay(active, message = '') {
  const briefContent = document.getElementById('gov-brief-content');
  const portfolioLayout = document.getElementById('portfolio-layout');
  const isPortfolio = Boolean(document.getElementById('portfolio-signal-mount'));
  const overlayHost = isPortfolio
    ? (document.getElementById('main-content') || portfolioLayout || briefContent)
    : (briefContent || portfolioLayout);
  if (!overlayHost) return;
  if (active) {
    briefContent?.setAttribute('data-scope-stale', 'true');
    let overlay = overlayHost.querySelector(':scope > .gov-scope-stale-overlay')
      || overlayHost.querySelector('.gov-scope-stale-overlay');
    if (!overlay) {
      overlay = document.createElement('p');
      overlay.className = 'gov-scope-stale-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlayHost.prepend(overlay);
    }
    overlay.textContent = message || 'Updating scope…';
  } else {
    clearScopeStaleOverlay();
  }
}

export function clearScopeStaleOverlay() {
  const briefContent = document.getElementById('gov-brief-content');
  briefContent?.removeAttribute('data-scope-stale');
  document.querySelectorAll('.gov-scope-stale-overlay').forEach((el) => el.remove());
}

export function showPortfolioLoading(msg = 'AI agent is learning from your squad data…', options = {}) {
  const signalMount = document.getElementById('portfolio-signal-mount');
  const preserve = options.preserveContent === true && hasGovernanceBriefContent();
  if (signalMount && !preserve) {
    signalMount.innerHTML = `
      <div class="portfolio-signal-skeleton" data-portfolio-signal-skeleton aria-busy="true" aria-label="${escapeHtml(msg)}">
        ${renderSurfaceStateHtml({ variant: 'skeleton', message: msg, compact: true })}
      </div>`;
  } else if (preserve) {
    setScopeStaleOverlay(true, msg || 'Refreshing…');
  }
  const contentEl = document.getElementById('gov-brief-content');
  if (contentEl) {
    contentEl.style.display = 'none';
    contentEl.setAttribute('hidden', '');
  }
  const loadingEl = document.getElementById('gov-loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
    loadingEl.setAttribute('hidden', '');
  }
  document.getElementById('portfolio-layout')?.removeAttribute('hidden');
  document.body?.classList?.add('gov-brief-loading');
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'loading');
}

export function hidePortfolioLoading() {
  hideGovernanceLoading();
}
