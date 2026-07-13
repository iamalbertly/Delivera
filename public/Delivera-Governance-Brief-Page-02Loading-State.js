/**
 * Governance brief loading state — uses Surface-State SSOT.
 */
import { showLoadingView, clearErrorView } from './Delivera-Shared-Status-View-Helpers.js';
import { renderSurfaceStateHtml } from './Delivera-Shared-Surface-State-01SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

function getDom() {
  return {
    loadingEl: document.getElementById('gov-loading'),
    errorEl: document.getElementById('gov-error'),
    contentEl: document.getElementById('gov-brief-content'),
  };
}

export function hasGovernanceBriefContent() {
  const priorityMount = document.getElementById('governance-priority-surface-mount');
  if (priorityMount?.querySelector('[data-testid="governance-priority-brief"]:not(.gov-priority-brief-hero--skeleton)')) return true;
  if (priorityMount?.querySelector('.gov-priority-surface--skeleton')) return false;
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
  const preserve = options.preserveContent !== false && hasGovernanceBriefContent();
  const priorityMount = document.getElementById('governance-priority-surface-mount');
  if (loadingEl) {
    if (preserve) {
      loadingEl.innerHTML = `<p class="gov-loading-msg delivera-surface-loading-copy" aria-live="polite">${escapeHtml(msg || 'Refreshing… showing previous answer until live data arrives.')}</p>`;
      loadingEl.classList.remove('current-sprint-loading-with-spinner');
      loadingEl.style.display = 'block';
      loadingEl.removeAttribute('hidden');
    } else {
      // Prefer visible instant shell / stale content over blank white #gov-loading.
      loadingEl.style.display = 'none';
      loadingEl.setAttribute('hidden', '');
      if (priorityMount && !priorityMount.querySelector('[data-testid="instant-shell"], [data-testid="instant-shell-stale"], [data-testid="governance-priority-brief"]')) {
        priorityMount.innerHTML = renderSurfaceStateHtml({
          variant: 'skeleton',
          message: msg || 'Preparing portfolio signal…',
          compact: false,
        });
      }
    }
  }
  if (contentEl) {
    if (preserve) {
      setScopeStaleOverlay(true, msg || 'Updating scope…');
      contentEl.style.display = 'block';
    } else {
      clearScopeStaleOverlay();
      // Keep content container in layout so the shell is not a white void.
      contentEl.style.display = 'block';
      contentEl.removeAttribute('hidden');
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

function compactRefreshLabel(message = '') {
  const raw = String(message || '').trim();
  if (!raw) return 'Refreshing live signal…';
  // Tone down "Switching to SD + MPSA + 10…" into a skim-friendly chip.
  const switchMatch = raw.match(/^Switching to\s+(.+?)(?:…|\.\.\.)?$/i);
  if (switchMatch) {
    const label = switchMatch[1].replace(/\s+\+\s+\d+\s*$/, '').trim();
    return label ? `Updating to ${label}…` : 'Updating scope…';
  }
  if (raw.length > 64) return `${raw.slice(0, 61)}…`;
  return raw;
}

export function setScopeStaleOverlay(active, message = '') {
  const briefContent = document.getElementById('gov-brief-content');
  const portfolioLayout = document.getElementById('portfolio-layout');
  const priorityMount = document.getElementById('governance-priority-surface-mount');
  const isPortfolio = Boolean(document.getElementById('portfolio-signal-mount'));
  // Prefer mounting inside the priority surface so the chip sits on content,
  // not as a big empty banner above a white gap.
  const overlayHost = isPortfolio
    ? (priorityMount || portfolioLayout || document.getElementById('main-content') || briefContent)
    : (briefContent || portfolioLayout);
  if (!overlayHost) return;
  if (active) {
    briefContent?.setAttribute('data-scope-stale', 'true');
    document.body?.classList?.add('gov-scope-refreshing');
    let overlay = overlayHost.querySelector(':scope > .gov-scope-stale-overlay')
      || overlayHost.querySelector('.gov-scope-stale-overlay');
    if (!overlay) {
      overlay = document.createElement('p');
      overlay.className = 'gov-scope-stale-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.setAttribute('data-testid', 'gov-scope-refresh-chip');
      overlayHost.prepend(overlay);
    }
    overlay.textContent = compactRefreshLabel(message);
  } else {
    clearScopeStaleOverlay();
  }
}

export function clearScopeStaleOverlay() {
  const briefContent = document.getElementById('gov-brief-content');
  briefContent?.removeAttribute('data-scope-stale');
  document.body?.classList?.remove('gov-scope-refreshing');
  document.querySelectorAll('.gov-scope-stale-overlay').forEach((el) => el.remove());
}

export function showPortfolioLoading(msg = COPY.portfolioLoading, options = {}) {
  const signalMount = document.getElementById('portfolio-signal-mount');
  const priorityMount = document.getElementById('governance-priority-surface-mount');
  const preserve = options.preserveContent !== false && hasGovernanceBriefContent();
  if (preserve) {
    setScopeStaleOverlay(true, msg || 'Refreshing…');
  } else if (priorityMount && !priorityMount.querySelector('[data-testid="instant-shell"], [data-testid="instant-shell-stale"], [data-testid="governance-priority-brief"]')) {
    priorityMount.innerHTML = `
      <div class="portfolio-signal-skeleton" data-portfolio-signal-skeleton aria-busy="true" aria-label="${escapeHtml(msg)}">
        ${renderSurfaceStateHtml({ variant: 'skeleton', message: msg, compact: false })}
      </div>`;
  } else if (signalMount && !preserve) {
    signalMount.innerHTML = `
      <div class="portfolio-signal-skeleton" data-portfolio-signal-skeleton aria-busy="true" aria-label="${escapeHtml(msg)}">
        ${renderSurfaceStateHtml({ variant: 'skeleton', message: msg, compact: true })}
      </div>`;
  }
  const contentEl = document.getElementById('gov-brief-content');
  if (contentEl && !preserve) {
    contentEl.style.display = 'block';
    contentEl.removeAttribute('hidden');
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
