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
  if (loadingEl) {
    if (preserve) {
      loadingEl.innerHTML = REFRESH_COPY_HTML;
      const copyEl = loadingEl.querySelector('.gov-loading-msg');
      if (copyEl) {
        copyEl.textContent = msg || 'Refreshing… showing previous answer until live data arrives.';
      }
      loadingEl.classList.remove('current-sprint-loading-with-spinner');
    } else {
      loadingEl.innerHTML = SPINNER_HTML;
      const msgEl = loadingEl.querySelector('.gov-loading-msg');
      if (msgEl) msgEl.textContent = msg;
      loadingEl.classList.add('current-sprint-loading-with-spinner');
    }
    loadingEl.style.display = 'block';
    loadingEl.removeAttribute('hidden');
  }
  if (contentEl) {
    if (preserve) {
      contentEl.setAttribute('data-scope-stale', 'true');
      contentEl.style.display = 'block';
    } else {
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
    contentEl.removeAttribute('data-scope-stale');
    contentEl.style.display = 'block';
  }
  document.body?.classList?.remove('gov-brief-loading');
  clearErrorView(getDom());
}

export function initGovernanceLoadingEls() {
  showLoadingView(getDom(), 'Loading your delivery answer…');
}
