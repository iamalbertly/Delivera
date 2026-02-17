/**
 * SSOT for localStorage keys used for cross-page state (Report, Current Sprint, Leadership).
 * Import these constants instead of string literals to avoid typos and simplify adding new keys.
 */
export const PROJECTS_SSOT_KEY = 'vodaAgileBoard_selectedProjects';
export const SHARED_DATE_RANGE_KEY = 'vodaAgileBoard_dateRange_v1';
export const LAST_QUERY_KEY = 'vodaAgileBoard_lastQuery_v1';
export const LEADERSHIP_FILTERS_KEY = 'leadership_filters_v1';
export const CURRENT_SPRINT_BOARD_KEY = 'vodaAgileBoard_lastBoardId';
export const CURRENT_SPRINT_SPRINT_KEY = 'vodaAgileBoard_lastSprintId';

/** Report page only: first-run hint and last run meta (same key used for range hint). */
export const REPORT_HAS_RUN_PREVIEW_KEY = 'report-has-run-preview';
export const REPORT_LAST_RUN_KEY = 'report-last-run';
export const REPORT_FILTERS_COLLAPSED_KEY = 'report-filters-collapsed';
export const REPORT_ADVANCED_OPTIONS_OPEN_KEY = 'reportAdvancedOptionsOpen';
export const REPORT_LAST_META_KEY = 'report-last-meta';
export const REPORT_FILTERS_STALE_KEY = 'report-context-filters-stale';
