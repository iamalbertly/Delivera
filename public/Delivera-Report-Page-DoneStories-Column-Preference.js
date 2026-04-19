/**
 * Persists and applies "Show optional columns" preference for Done Stories tab.
 * Used by Preview-Flow (toggle handler), Render-Preview (after render), and Init (tab switch).
 */
const STORAGE_KEY = 'report-done-stories-show-optional';

export function applyDoneStoriesOptionalColumnsPreference() {
  try {
    const show = sessionStorage.getItem(STORAGE_KEY) === '1';
    const tab = document.getElementById('tab-done-stories');
    const btn = document.getElementById('done-stories-columns-toggle');
    if (tab) tab.classList.toggle('show-optional-columns', show);
    if (btn) {
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
      btn.textContent = show ? 'Show fewer columns' : 'Show more columns (4)';
    }
  } catch (_) {}
}

export function persistDoneStoriesOptionalColumnsPreference(show) {
  try {
    sessionStorage.setItem(STORAGE_KEY, show ? '1' : '0');
  } catch (_) {}
}
