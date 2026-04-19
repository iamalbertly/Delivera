/**
 * Preview complexity and timeout config for report preview flow.
 * SSOT for classifyPreviewComplexity and client budget constants. Used by Reporting-App-Report-Page-Preview-Flow.js.
 */

export const RECENT_SPLIT_DEFAULT_DAYS = 14;
export const PREVIEW_TIMEOUT_LIGHT_MS = 60000;
export const PREVIEW_TIMEOUT_HEAVY_MS = 75000;
export const PREVIEW_TIMEOUT_VERY_HEAVY_MS = 90000;

/**
 * Classify preview request complexity from range, project count, and options
 * @returns {{ score: number, level: 'light'|'normal'|'heavy'|'veryHeavy' }}
 */
export function classifyPreviewComplexity({
  rangeDays,
  projectCount,
  includePredictability,
  includeActiveOrMissingEndDateSprints,
  requireResolvedBySprintEnd,
}) {
  const safeRangeDays = typeof rangeDays === 'number' && rangeDays > 0 ? rangeDays : 1;
  const safeProjectCount = typeof projectCount === 'number' && projectCount > 0 ? projectCount : 1;

  let score = safeRangeDays * safeProjectCount;

  if (includePredictability) {
    score *= 1.4;
  }
  if (includeActiveOrMissingEndDateSprints) {
    score *= 1.2;
  }
  if (requireResolvedBySprintEnd) {
    score *= 1.15;
  }

  if (safeRangeDays > 365) {
    score *= 1.4;
  } else if (safeRangeDays > 180) {
    score *= 1.25;
  }

  let level = 'light';
  if (score >= 8000) {
    level = 'veryHeavy';
  } else if (score >= 2500) {
    level = 'heavy';
  } else if (score >= 600) {
    level = 'normal';
  }

  return { score, level };
}

/**
 * Client-side timeout (ms) for preview request from previewMode and optional rangeDays
 * @param {string} previewMode - 'normal' | 'recent-first' | 'recent-only'
 * @param {number|null} rangeDays - optional; used when previewMode is 'normal' to pick heavy timeout
 * @returns {number}
 */
export function getClientBudgetMs(previewMode, rangeDays = null) {
  if (previewMode === 'recent-only') {
    return PREVIEW_TIMEOUT_VERY_HEAVY_MS;
  }
  if (previewMode === 'recent-first' || (rangeDays != null && rangeDays > RECENT_SPLIT_DEFAULT_DAYS)) {
    return PREVIEW_TIMEOUT_HEAVY_MS;
  }
  return PREVIEW_TIMEOUT_LIGHT_MS;
}
