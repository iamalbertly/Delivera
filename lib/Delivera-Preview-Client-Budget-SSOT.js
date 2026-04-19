/**
 * Single source for preview client/server time budget (ms).
 * Browser copy lives in public/Delivera-Report-Page-Preview-Complexity-Config.js — keep formulas identical.
 */
export const PREVIEW_SERVER_MAX_MS = 90 * 1000;
export const PREVIEW_PREFER_CACHE_ABORT_SLACK_MS = 8000;

/**
 * @param {object} opts
 * @param {string} opts.previewMode - 'normal' | 'recent-first' | 'recent-only'
 * @param {number|null|undefined} opts.rangeDays
 * @param {number|string|undefined} opts.clientBudgetMsOverride - positive number or numeric string from query
 * @returns {number}
 */
export function derivePreviewClientBudgetMs({ previewMode, rangeDays, clientBudgetMsOverride } = {}) {
    const fromQuery = Number(clientBudgetMsOverride);
    if (!Number.isNaN(fromQuery) && fromQuery > 0) return fromQuery;
    if (previewMode === 'recent-only') return 90 * 1000;
    if (previewMode === 'recent-first') return 75 * 1000;
    if (typeof rangeDays === 'number' && rangeDays > 60) return 75 * 1000;
    return 60 * 1000;
}
