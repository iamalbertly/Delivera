/**
 * Governance brief loading state — Instant Shell owns first paint; Surface-State attrs for skim.
 */
import { clearErrorView } from './Delivera-Shared-Status-View-Helpers.js';
import { setDeliveraSurfaceState } from './Delivera-Shared-Instant-Shell-01UI.js';
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
  if (loadingEl) {
    if (preserve) {
      loadingEl.innerHTML = `<p class="gov-loading-msg delivera-surface-loading-copy" aria-live="polite">${escapeHtml(msg || 'Refreshing… showing previous answer until live data arrives.')}</p>`;
      loadingEl.classList.remove('current-sprint-loading-with-spinner');
      loadingEl.style.display = 'block';
      loadingEl.removeAttribute('hidden');
    } else {
      // Instant Shell / static HTML own first paint — never rewrite priority mount here.
      loadingEl.style.display = 'none';
      loadingEl.setAttribute('hidden', '');
    }
  }
  if (contentEl) {
    if (preserve) {
      setScopeStaleOverlay(true, msg || 'Updating scope…');
      contentEl.style.display = 'block';
    } else {
      clearScopeStaleOverlay();
      contentEl.style.display = 'block';
      contentEl.removeAttribute('hidden');
    }
  }
  document.body?.classList?.add('gov-brief-loading');
  setDeliveraSurfaceState('governance', preserve ? 'stale' : 'loading');
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
  setDeliveraSurfaceState('governance', 'live');
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
    setDeliveraSurfaceState('governance', 'stale');
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
  const preserve = options.preserveContent !== false && hasGovernanceBriefContent();
  if (preserve) {
    setScopeStaleOverlay(true, msg || 'Refreshing…');
  }
  // Priority mount first paint is owned by Instant Shell / static HTML only.
  // Do not inject a third skeleton into #governance-priority-surface-mount.
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
  setDeliveraSurfaceState('governance', preserve ? 'stale' : 'loading');
}

export function hidePortfolioLoading() {
  hideGovernanceLoading();
}
