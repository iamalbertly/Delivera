/**
 * Shared status view helpers. Generalize showLoading/showError/showContent by accepting dom refs.
 * @typedef {{ loadingEl?: HTMLElement | null, errorEl?: HTMLElement | null, contentEl?: HTMLElement | null }} StatusDom
 */

import { setErrorOnEl, setActionErrorOnEl, clearEl } from './Reporting-App-Shared-Status-Helpers.js';

/**
 * @param {StatusDom} dom
 * @param {string} [msg]
 */
export function showLoadingView(dom, msg) {
  const { loadingEl, errorEl, contentEl } = dom;
  if (loadingEl) {
    loadingEl.textContent = msg || 'Loading...';
    loadingEl.style.display = 'block';
  }
  if (errorEl) errorEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'none';
}

/**
 * @param {StatusDom} dom
 * @param {string} msg
 */
export function showErrorView(dom, msg) {
  const { loadingEl, errorEl, contentEl } = dom;
  if (loadingEl) loadingEl.style.display = 'none';
  if (errorEl) {
    if (msg && typeof msg === 'object') setActionErrorOnEl(errorEl, msg);
    else setErrorOnEl(errorEl, msg);
  }
  if (contentEl) contentEl.style.display = 'none';
}

/**
 * @param {StatusDom} dom
 */
export function clearErrorView(dom) {
  const { errorEl } = dom;
  clearEl(errorEl);
}

/**
 * @param {StatusDom} dom
 * @param {string} html
 */
export function showContentView(dom, html) {
  const { loadingEl, errorEl, contentEl } = dom;
  if (loadingEl) loadingEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';
  if (contentEl) {
    contentEl.innerHTML = html;
    contentEl.style.display = 'block';
  }
}
