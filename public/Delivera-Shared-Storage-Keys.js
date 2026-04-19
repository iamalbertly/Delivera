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
