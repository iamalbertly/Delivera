/**
 * Single-flow page state for current-sprint.html.
 * Four in-page states: welcome (no board/sprint), loading, content (data loaded), error (API/user error).
 * Only the main content area switches state; header/nav/sidebar persist. No page reload on board/sprint change.
 */

import { currentSprintDom } from './Reporting-App-CurrentSprint-Page-Context.js';
import { setActionErrorOnEl, clearEl } from './Reporting-App-Shared-Status-Helpers.js';
import { stopRotatingMessages } from './Reporting-App-Shared-Loading-Theater.js';

export const PAGE_STATE = Object.freeze({
  WELCOME: 'welcome',
  LOADING: 'loading',
  CONTENT: 'content',
  ERROR: 'error',
});

const LOADING_SPINNER_HTML = ''
  + '<div class="current-sprint-loading-spinner" aria-hidden="true"></div>'
  + '<p class="current-sprint-loading-msg" aria-live="polite"></p>';
const WELCOME_MESSAGE = 'Choose scope to load the sprint HUD.';

let currentState = PAGE_STATE.WELCOME;

function getMainEl() {
  return document.getElementById('main-content');
}

function setStateAttr(state) {
  const main = getMainEl();
  if (main) main.setAttribute('data-current-sprint-state', state);
}

export function getCurrentState() {
  return currentState;
}

function hideAll() {
  const { loadingEl, errorEl, contentEl } = currentSprintDom;
  if (loadingEl) {
    loadingEl.style.display = 'none';
    loadingEl.classList.remove('current-sprint-loading-with-spinner');
  }
  if (errorEl) {
    errorEl.style.display = 'none';
    clearEl(errorEl);
  }
  if (contentEl && contentEl.getAttribute('data-preserve-content') !== 'true') contentEl.style.display = 'none';
}

export function setPageState(state, options = {}) {
  stopRotatingMessages();
  const { loadingEl, errorEl, contentEl } = currentSprintDom;
  const hasContent = Boolean(contentEl && contentEl.innerHTML && contentEl.innerHTML.trim());
  const preserveContent = options.preserveContent !== false && hasContent && (state === PAGE_STATE.LOADING || state === PAGE_STATE.ERROR);
  if (contentEl) {
    contentEl.setAttribute('data-preserve-content', preserveContent ? 'true' : 'false');
  }

  hideAll();

  switch (state) {
    case PAGE_STATE.WELCOME:
      if (loadingEl) {
        const message = options.message != null ? options.message : WELCOME_MESSAGE;
        loadingEl.innerHTML = '<div class="current-sprint-loading-copy"></div>';
        const copyEl = loadingEl.querySelector('.current-sprint-loading-copy');
        if (copyEl) copyEl.textContent = message;
        loadingEl.style.display = 'block';
        loadingEl.removeAttribute('role');
        loadingEl.setAttribute('aria-live', 'polite');
      }
      break;

    case PAGE_STATE.LOADING: {
      const msg = options.message != null ? options.message : 'Loading...';
      if (loadingEl) {
        if (preserveContent) {
          loadingEl.innerHTML = '<div class="current-sprint-loading-copy current-sprint-loading-copy-inline"></div>';
          const copyEl = loadingEl.querySelector('.current-sprint-loading-copy');
          if (copyEl) copyEl.textContent = msg;
          loadingEl.classList.remove('current-sprint-loading-with-spinner');
        } else {
          loadingEl.innerHTML = LOADING_SPINNER_HTML;
          const msgEl = loadingEl.querySelector('.current-sprint-loading-msg');
          if (msgEl) {
            const contextText = options.context != null ? String(options.context) : '';
            msgEl.textContent = contextText ? (msg + ' | ' + contextText) : msg;
          }
          loadingEl.classList.add('current-sprint-loading-with-spinner');
        }
        loadingEl.style.display = 'block';
      }
      if (preserveContent && contentEl) contentEl.style.display = 'block';
      break;
    }

    case PAGE_STATE.CONTENT:
      if (contentEl && options.html != null) {
        contentEl.innerHTML = options.html;
        contentEl.style.display = 'block';
      }
      break;

    case PAGE_STATE.ERROR:
      if (errorEl) {
        const opts = typeof options === 'object' && options !== null ? options : { message: String(options || 'An error occurred.') };
        if (opts.title || opts.message || opts.primaryLabel) {
          setActionErrorOnEl(errorEl, opts);
        } else {
          errorEl.style.display = 'block';
          errorEl.textContent = opts.message || 'An error occurred.';
          errorEl.setAttribute('role', 'alert');
        }
      }
      if (preserveContent && contentEl) contentEl.style.display = 'block';
      break;

    default:
      break;
  }

  currentState = state;
  setStateAttr(state);
}
