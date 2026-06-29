/**
 * SSOT for localStorage keys used for cross-page state (Report, Current Sprint, Leadership).
 * Import these constants instead of string literals to avoid typos and simplify adding new keys.
 * v2: keys use the `delivera_` prefix; legacy `vodaAgileBoard_*` values are migrated on first load.
 */
export const PROJECTS_SSOT_KEY = 'delivera_selectedProjects';
export const SHARED_DATE_RANGE_KEY = 'delivera_dateRange_v1';
export const LAST_QUERY_KEY = 'delivera_lastQuery_v1';
export const LEADERSHIP_FILTERS_KEY = 'leadership_filters_v1';
export const CURRENT_SPRINT_BOARD_KEY = 'delivera_lastBoardId';
export const CURRENT_SPRINT_SPRINT_KEY = 'delivera_lastSprintId';
export const CURRENT_SPRINT_SPRINT_SELECTED_AT_KEY = 'delivera_lastSprintSelectedAt';
export const CURRENT_SPRINT_SNAPSHOT_KEY = 'delivera_currentSprintSnapshot_v1';
export const REPORT_CONTEXT_KEY = 'delivera_reportContext_v1';
export const REPORT_SEARCH_STORAGE_KEY = 'delivera_reportSearch_v1';
export const REPORT_ACTIVE_TAB_SEARCH_KEY = 'delivera_reportSearch_active_v1';

/** Report page only: first-run hint and last run meta (same key used for range hint). */
export const REPORT_HAS_RUN_PREVIEW_KEY = 'report-has-run-preview';
export const REPORT_LAST_RUN_KEY = 'report-last-run';
export const REPORT_FILTERS_COLLAPSED_KEY = 'report-filters-collapsed';
export const REPORT_ADVANCED_OPTIONS_OPEN_KEY = 'reportAdvancedOptionsOpen';
export const REPORT_LAST_META_KEY = 'report-last-meta';
export const REPORT_LAST_PREVIEW_KEY = 'report-last-preview-v1';
/** Stored envelope `{ schemaVersion, savedAt, payload }` for REPORT_LAST_PREVIEW_KEY. Bump when preview payload shape changes. */
export const REPORT_LAST_PREVIEW_SCHEMA_VERSION = 2;
/** ~3.5MB JSON cap to avoid silent localStorage failures in constrained browsers. */
export const REPORT_LAST_PREVIEW_MAX_JSON_CHARS = 3500000;
export const REPORT_FILTERS_STALE_KEY = 'report-context-filters-stale';
export const REPORT_FILTERS_STALE_REASON_KEY = 'report-context-filters-stale-reason';
export const REPORT_NAMED_VIEWS_KEY = 'report-named-views-v1';
export const REPORT_LAST_VIEW_KEY = 'report-last-view-v1';
export const CURRENT_SPRINT_LAST_VIEW_KEY = 'current-sprint-last-view-v1';
export const LEADERSHIP_LAST_VIEW_KEY = 'leadership-last-view-v1';
export const OUTCOME_ACTIVITY_LOG_KEY = 'delivera_outcomeActivityLog_v1';
/** Stores preferred AI provider name in localStorage (key stored in sessionStorage separately). */
export const AI_PROVIDER_PREF_KEY = 'delivera_ai_provider_pref_v1';
/** Last time governance inbox was expanded (ISO) — badge shows only newer items. */
export const GOVERNANCE_INBOX_LAST_SEEN_KEY = 'delivera_gov_inbox_seen_v1';
/** Last time adoption micro-survey was shown (ISO). */
export const GOVERNANCE_SURVEY_LAST_ASKED_KEY = 'delivera_gov_survey_asked_v1';
/** Simple mode toggle — unified key (replaces delivera.simpleEnglishMode.v1). */
export const SIMPLE_MODE_KEY = 'delivera_simpleMode';
/** @deprecated — migrated to SIMPLE_MODE_KEY on read */
export const LEGACY_SIMPLE_ENGLISH_KEY = 'delivera.simpleEnglishMode.v1';
export const GOVERNANCE_QUARTER_KEY = 'delivera_gov_quarter_v1';
/** Portfolio anchor squad (compare list remains in PROJECTS_SSOT_KEY). */
export const PORTFOLIO_ANCHOR_KEY = 'delivera_portfolio_anchor_v1';
export const PORTFOLIO_BASELINE_MODE_KEY = 'delivera_portfolio_baseline_mode_v1';
export const GOV_PERIOD_WINDOW_KEY = 'gov-period-window';
export const GOV_SCOPE_COLLAPSED_KEY = 'gov-scope-collapsed';
export const SIDEBAR_COLLAPSED_KEY = 'delivera_sidebar_collapsed';
export const SIDEBAR_COLLAPSED_PRESET_KEY = 'delivera_sidebar_collapsed_preset_v1';
export const APP_NOTIFICATIONS_KEY = 'appNotificationsV1';
export const GOV_DRAWER_TAB_KEY = 'gov-drawer-active-tab';
export const GOV_EVIDENCE_TAB_KEY = 'gov-evidence-active-tab';
export const BRIEF_CLIENT_CACHE_KEY = 'delivera:brief:cache:v1';
export const LAST_VERDICT_TIER_KEY = 'delivera_lastVerdictTier';
export const REPORT_LAST_OUTCOME_PROJECT_KEY = 'report_last_outcome_project_v1';

/**
 * Safe localStorage read/write with quota handling.
 */
export const safeLocalStorage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  },
  getJson(key, fallback = null) {
    const raw = safeLocalStorage.get(key, null);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  },
  setJson(key, value) {
    try {
      return safeLocalStorage.set(key, JSON.stringify(value));
    } catch (_) {
      return false;
    }
  },
};

const LEGACY_KEY_PAIRS = [
  [PROJECTS_SSOT_KEY, 'vodaAgileBoard_selectedProjects'],
  [SHARED_DATE_RANGE_KEY, 'vodaAgileBoard_dateRange_v1'],
  [LAST_QUERY_KEY, 'vodaAgileBoard_lastQuery_v1'],
  [CURRENT_SPRINT_BOARD_KEY, 'vodaAgileBoard_lastBoardId'],
  [CURRENT_SPRINT_SPRINT_KEY, 'vodaAgileBoard_lastSprintId'],
  [CURRENT_SPRINT_SPRINT_SELECTED_AT_KEY, 'vodaAgileBoard_lastSprintSelectedAt'],
  [CURRENT_SPRINT_SNAPSHOT_KEY, 'vodaAgileBoard_currentSprintSnapshot_v1'],
  [REPORT_CONTEXT_KEY, 'vodaAgileBoard_reportContext_v1'],
  [REPORT_SEARCH_STORAGE_KEY, 'vodaAgileBoard_reportSearch_v1'],
  [REPORT_ACTIVE_TAB_SEARCH_KEY, 'vodaAgileBoard_reportSearch_active_v1'],
];

/**
 * Copy legacy VodaAgileBoard localStorage values into Delivera keys once per browser profile.
 * Safe to call from any page script that imports this module.
 */
export function migrateVodaAgileBoardStorageKeys() {
  if (typeof localStorage === 'undefined') return;
  for (const [nextKey, prevKey] of LEGACY_KEY_PAIRS) {
    try {
      if (localStorage.getItem(nextKey) != null) continue;
      const prev = localStorage.getItem(prevKey);
      if (prev != null) localStorage.setItem(nextKey, prev);
    } catch (_) {
      // ignore quota / privacy mode
    }
  }
}

migrateVodaAgileBoardStorageKeys();

/**
 * Shared helper used by Leadership, Executive-Surface, and any module needing
 * the selected projects list from localStorage. Centralises the split/trim/filter
 * pattern that was previously duplicated in 3+ modules.
 */
export function readSharedProjectsCsv() {
  try {
    const raw = localStorage.getItem(PROJECTS_SSOT_KEY) || '';
    return raw.split(',')
      .map((p) => String(p ?? '').trim().toUpperCase())
      .filter((p) => p && p !== 'UNDEFINED');
  } catch (_) {
    return [];
  }
}
