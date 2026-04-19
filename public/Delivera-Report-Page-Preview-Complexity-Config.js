/**
 * Preview complexity and timeout config for report preview flow.
 * SSOT for classifyPreviewComplexity and client budget constants. Used by Delivera-Report-Page-Preview-Flow.js.
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
 * Base client/server budget (ms). MUST match lib/Delivera-Preview-Client-Budget-SSOT.js derivePreviewClientBudgetMs.
 * @param {string} previewMode - 'normal' | 'recent-first' | 'recent-only'
 * @param {number|null} rangeDays
 * @param {number|undefined} clientBudgetMsOverride - echo from prior response or NaN to ignore
 * @returns {number}
 */
export function derivePreviewClientBudgetMs({ previewMode, rangeDays = null, clientBudgetMsOverride } = {}) {
  const fromQuery = Number(clientBudgetMsOverride);
  if (!Number.isNaN(fromQuery) && fromQuery > 0) return fromQuery;
  if (previewMode === 'recent-only') {
    return PREVIEW_TIMEOUT_VERY_HEAVY_MS;
  }
  if (previewMode === 'recent-first') {
    return PREVIEW_TIMEOUT_HEAVY_MS;
  }
  if (typeof rangeDays === 'number' && rangeDays > 60) {
    return PREVIEW_TIMEOUT_HEAVY_MS;
  }
  return PREVIEW_TIMEOUT_LIGHT_MS;
}

/**
 * @param {string} previewMode
 * @param {number|null} rangeDays
 * @returns {number}
 */
export function getClientBudgetMs(previewMode, rangeDays = null) {
  return derivePreviewClientBudgetMs({ previewMode, rangeDays, clientBudgetMsOverride: NaN });
}

/** Abort timeout for fetch: base budget + optional slack when preferCache and a prior preview exists. */
export function getPreviewFetchAbortMs({
  previewMode,
  rangeDays,
  clientBudgetMsOverride,
  preferCache,
  hasExistingPreview,
} = {}) {
  const base = derivePreviewClientBudgetMs({ previewMode, rangeDays, clientBudgetMsOverride });
  const slack = preferCache && hasExistingPreview ? 8000 : 0;
  return Math.min(90000, base + slack);
}

/** Title is empty so the error banner does not repeat a headline before the body. */
export function buildPreviewAbortErrorCopy(seconds, hasExistingPreview) {
  return {
    title: '',
    message: hasExistingPreview
      ? `After ${seconds}s the refresh did not finish. Your previous results stay below. Try fewer projects or a shorter range for a faster answer.`
      : `After ${seconds}s the preview did not finish before results were ready. Try fewer projects or a shorter range.`,
  };
}
