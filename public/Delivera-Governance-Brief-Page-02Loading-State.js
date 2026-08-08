/**
 * Governance brief loading state — reuses Sprint spinner markup + Shared-Status-View-Helpers.
 */
import { showLoadingView, clearErrorView } from './Delivera-Shared-Status-View-Helpers.js';

const SPINNER_HTML = ''
  + '<div class="current-sprint-loading-spinner" aria-hidden="true"></div>'
  + '<p class="current-sprint-loading-msg gov-loading-msg" aria-live="polite"></p>';

const REFRESH_COPY_HTML = '<div class="current-sprint-loading-copy current-sprint-loading-copy-inline gov-loading-msg" aria-live="polite"></div>';

function getDom() {
  return {
    loadingEl: document.getElementById('gov-loading'),
    errorEl: document.getElementById('gov-error'),
    contentEl: document.getElementById('gov-brief-content'),
  };
}

export function hasGovernanceBriefContent() {
  const el = document.getElementById('gov-brief-content');
  if (!el) return false;
  return Boolean(el.querySelector('.gov-command-answer, .gov-owner-cluster, .governance-empty'));
}

export function showGovernanceLoading(msg = 'Loading your delivery answer…', options = {}) {
  const { loadingEl, errorEl, contentEl } = getDom();
  if (errorEl) errorEl.hidden = true;
  const preserve = options.preserveContent === true && hasGovernanceBriefContent();
  const activeLoopReady = Boolean(document.getElementById('gov-active-loop-mount')?.querySelector('.gov-active-loop-hero, .gov-story-row, .gov-loop-decision-bento'));
  if (loadingEl) {
    if (preserve || activeLoopReady) {
      // Keep cold/restore title structure — never wipe ActiveLoop attributes into a second empty UI.
      let titleEl = loadingEl.querySelector('[data-gov-loading-title]');
      let copyEl = loadingEl.querySelector('.gov-loading-msg');
      if (!titleEl || !copyEl) {
        loadingEl.innerHTML = ''
          + '<div class="current-sprint-loading-spinner" aria-hidden="true"></div>'
          + '<div><strong data-gov-loading-title>Refreshing verified answer</strong>'
          + '<p class="current-sprint-loading-msg gov-loading-msg" aria-live="polite"></p></div>';
        titleEl = loadingEl.querySelector('[data-gov-loading-title]');
        copyEl = loadingEl.querySelector('.gov-loading-msg');
      }
      if (titleEl) titleEl.textContent = 'Refreshing · last verified answer stays visible';
      if (copyEl) copyEl.textContent = msg || 'Refreshing… showing previous answer until live data arrives.';
      loadingEl.dataset.govLoadingMode = 'restore';
      loadingEl.classList.add('current-sprint-loading-with-spinner');
      loadingEl.classList.add('gov-loading--restore');
    } else {
      loadingEl.innerHTML = ''
        + '<div class="current-sprint-loading-spinner" aria-hidden="true"></div>'
        + '<div><strong data-gov-loading-title>Building first verified answer…</strong>'
        + '<p class="current-sprint-loading-msg gov-loading-msg" aria-live="polite"></p></div>';
      const msgEl = loadingEl.querySelector('.gov-loading-msg');
      if (msgEl) msgEl.textContent = msg;
      loadingEl.dataset.govLoadingMode = 'cold';
      loadingEl.classList.add('current-sprint-loading-with-spinner');
    }
    loadingEl.style.display = 'block';
    loadingEl.removeAttribute('hidden');
    loadingEl.setAttribute('aria-hidden', 'false');
  }
  if (contentEl) {
    if (preserve || activeLoopReady) {
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
  if (loadingEl) {
    loadingEl.style.display = 'none';
    loadingEl.setAttribute('hidden', '');
    loadingEl.classList.remove('current-sprint-loading-with-spinner');
  }
  if (contentEl) {
    clearScopeStaleOverlay();
    contentEl.style.display = 'block';
  }
  document.body?.classList?.remove('gov-brief-loading');
  clearErrorView(getDom());
}

export function setScopeStaleOverlay(active, message = '') {
  const contentEl = document.getElementById('gov-brief-content');
  if (!contentEl) return;
  if (active) {
    contentEl.setAttribute('data-scope-stale', 'true');
    let overlay = contentEl.querySelector('.gov-scope-stale-overlay');
    if (!overlay) {
      overlay = document.createElement('p');
      overlay.className = 'gov-scope-stale-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      contentEl.prepend(overlay);
    }
    overlay.textContent = message || 'Updating scope…';
  } else {
    clearScopeStaleOverlay();
  }
}

export function clearScopeStaleOverlay() {
  const contentEl = document.getElementById('gov-brief-content');
  if (!contentEl) return;
  contentEl.removeAttribute('data-scope-stale');
  contentEl.querySelector('.gov-scope-stale-overlay')?.remove();
}

export function initGovernanceLoadingEls() {
  showLoadingView(getDom(), 'Loading your delivery answer…');
}
