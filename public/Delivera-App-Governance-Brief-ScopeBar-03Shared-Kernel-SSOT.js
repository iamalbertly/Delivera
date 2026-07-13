/**
 * Governance + Portfolio scope bar — shared storage, quarters, project reads.
 */
import {
  PROJECTS_SSOT_KEY,
  GOVERNANCE_QUARTER_KEY,
  PORTFOLIO_ANCHOR_KEY,
  PORTFOLIO_BASELINE_MODE_KEY,
  readSharedProjectsCsv,
} from './Delivera-Shared-Storage-Keys.js';
import { notifyScopeChanged } from './Delivera-Shared-Scope-Notify-01Bridge.js';
import { defaultSelectedKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';
import { fetchQuartersListMemo } from './Delivera-Shared-Quarters-List-01Fetch-Memo.js';
import { catalogProjectKeys, unionProjectKeys } from './Delivera-Shared-ProjectScope-01Picker.js';

export const GOV_PERIOD_WINDOW_KEY = 'gov-period-window';
export const SCOPE_COLLAPSE_KEY = 'gov-scope-collapsed';
export const LAST_VERDICT_KEY = 'delivera_lastVerdictTier';
export const PORTFOLIO_PEER_PRESET_KEY = 'delivera_portfolio_peer_preset_v1';
export const GOV_VIEW_MODE_KEY = 'delivera:gov:viewMode';
export const PORTFOLIO_DEFAULT_ANCHOR = 'SD';
/**
 * Default compare set: ALL squads except the anchor.
 * The governance page is a bird's-eye view — users should see every squad
 * by default, not a hardcoded 3-squad subset. Individual peers can be
 * removed via chip ✕. (Audit finding: "first primary view is to view
 * all the squads at the same time".)
 */
export const PORTFOLIO_DEFAULT_COMPARE = Object.freeze(['*']); // sentinel: resolve to all squads at call-time

export function isPortfolioScopePage(mount) {
  if (mount?.id === 'portfolio-scope-bar-mount') return true;
  return typeof document !== 'undefined' && document.body?.classList?.contains('portfolio-page');
}

export function readScopeProjects() {
  try {
    if (localStorage.getItem(PROJECTS_SSOT_KEY) === '') return [];
  } catch (_) { /* ignore */ }
  ensurePortfolioDefaultScope();
  const list = readSharedProjectsCsv();
  return list.length ? list : defaultSelectedKeys();
}

/**
 * Resolve the default compare list. If PORTFOLIO_DEFAULT_COMPARE is ['*'],
 * expand to all catalog keys minus the anchor. This gives users the full
 * bird's-eye view on first visit without hardcoding a 3-squad subset.
 */
export function resolveDefaultCompare(anchor = PORTFOLIO_DEFAULT_ANCHOR) {
  if (PORTFOLIO_DEFAULT_COMPARE[0] !== '*') return [...PORTFOLIO_DEFAULT_COMPARE];
  const A = String(anchor || '').trim().toUpperCase();
  return catalogProjectKeys().filter((k) => String(k).toUpperCase() !== A);
}

/**
 * Read/write the governance view-mode separately from the data cache.
 * View-mode tracks whether the user is in "compare" or "drill" mode so
 * that a page reload restores the user's last view, not the cached data
 * scope. (Audit finding: cache restored drilled scope, trapping users.)
 */
export function readGovViewMode() {
  try { return String(sessionStorage.getItem(GOV_VIEW_MODE_KEY) || 'compare').toLowerCase(); }
  catch (_) { return 'compare'; }
}
export function writeGovViewMode(mode) {
  try { sessionStorage.setItem(GOV_VIEW_MODE_KEY, String(mode || 'compare').toLowerCase()); }
  catch (_) { /* ignore */ }
}
export function clearGovViewMode() {
  try { sessionStorage.removeItem(GOV_VIEW_MODE_KEY); }
  catch (_) { /* ignore */ }
}

/** First visit to portfolio: DMS anchor + ALL squads as compare preset. */
export function ensurePortfolioDefaultScope() {
  if (!isPortfolioScopePage()) return;
  try {
    const raw = localStorage.getItem(PROJECTS_SSOT_KEY);
    if (raw !== null && String(raw).trim() !== '') return;
    writePortfolioProjectsCsv(PORTFOLIO_DEFAULT_ANCHOR, resolveDefaultCompare());
    writePortfolioAnchor(PORTFOLIO_DEFAULT_ANCHOR);
    localStorage.setItem(PORTFOLIO_PEER_PRESET_KEY, '1');
  } catch (_) { /* ignore */ }
}

export function readPortfolioCompareProjects(anchor = readPortfolioAnchor()) {
  const A = String(anchor || '').trim().toUpperCase();
  return readScopeProjects().filter((p) => String(p).toUpperCase() !== A);
}

export function writeScopeProjects(list) {
  const csv = (Array.isArray(list) ? list : [])
    .map((p) => String(p ?? '').trim().toUpperCase())
    .filter((p) => p && p !== 'UNDEFINED')
    .join(',');
  try { localStorage.setItem(PROJECTS_SSOT_KEY, csv); } catch (_) { /* ignore */ }
  notifyScopeChanged();
}

export function readStoredQuarter(fallback = '') {
  try {
    const stored = String(localStorage.getItem(GOVERNANCE_QUARTER_KEY) || '').trim();
    if (stored) return stored;
  } catch (_) { /* ignore */ }
  return fallback;
}

export function writeStoredQuarter(label) {
  try { localStorage.setItem(GOVERNANCE_QUARTER_KEY, String(label || '')); } catch (_) { /* ignore */ }
  notifyScopeChanged();
}

export function readPeriodWindow(defaultWindow = '28d') {
  try {
    return String(sessionStorage.getItem(GOV_PERIOD_WINDOW_KEY) || defaultWindow).toLowerCase();
  } catch (_) {
    return defaultWindow;
  }
}

export function writePeriodWindow(windowId) {
  try { sessionStorage.setItem(GOV_PERIOD_WINDOW_KEY, String(windowId || '28d')); } catch (_) { /* ignore */ }
}

export function readPortfolioAnchor(projects = readScopeProjects()) {
  try {
    const stored = String(localStorage.getItem(PORTFOLIO_ANCHOR_KEY) || '').trim().toUpperCase();
    if (stored && projects.some((p) => String(p).toUpperCase() === stored)) return stored;
  } catch (_) { /* ignore */ }
  return projects[0] || '';
}

export function writePortfolioAnchor(anchor) {
  try { localStorage.setItem(PORTFOLIO_ANCHOR_KEY, String(anchor || '').toUpperCase()); } catch (_) { /* ignore */ }
}

export function readPortfolioBaselineMode() {
  try {
    return String(localStorage.getItem(PORTFOLIO_BASELINE_MODE_KEY) || 'pi-baseline').trim();
  } catch (_) {
    return 'pi-baseline';
  }
}

export function writePortfolioBaselineMode(mode) {
  try { localStorage.setItem(PORTFOLIO_BASELINE_MODE_KEY, String(mode || 'pi-baseline')); } catch (_) { /* ignore */ }
}

export function writePortfolioProjectsCsv(anchor, compare = []) {
  const A = String(anchor || '').trim().toUpperCase();
  const csv = [A, ...compare.filter((p) => String(p).toUpperCase() !== A)]
    .map((p) => String(p).trim().toUpperCase())
    .filter(Boolean)
    .join(',');
  try { localStorage.setItem(PROJECTS_SSOT_KEY, csv); } catch (_) { /* ignore */ }
  notifyScopeChanged();
}

export function unionScopeProjectKeys(selected = []) {
  return unionProjectKeys(catalogProjectKeys(), selected, readSharedProjectsCsv());
}

export function loadQuartersList(onReady, onError) {
  return fetchQuartersListMemo(8, { includeCached: true })
    .then((data) => {
      const quarters = Array.isArray(data?.quarters) ? data.quarters : [];
      const current = quarters.find((q) => q.isCurrent);
      onReady?.(quarters, current?.label || '');
    })
    .catch(() => onError?.());
}

export function bindProjectsStorageSync(onChange) {
  window.addEventListener('storage', (ev) => {
    if (ev.key !== PROJECTS_SSOT_KEY && ev.key !== PORTFOLIO_ANCHOR_KEY) return;
    onChange?.();
  });
}
