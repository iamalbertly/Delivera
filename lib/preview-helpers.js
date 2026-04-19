
import { cache, CACHE_KEYS } from './cache.js';

export function buildPreviewCacheKey({
    selectedProjects,
    windowStart,
    windowEnd,
    includeStoryPoints,
    requireResolvedBySprintEnd,
    includeBugsForRework,
    includePredictability,
    predictabilityMode,
    includeEpicTTM,
    includeActiveOrMissingEndDateSprints,
}) {
    return CACHE_KEYS.preview({
        selectedProjects,
        windowStart,
        windowEnd,
        includeStoryPoints,
        requireResolvedBySprintEnd,
        includeBugsForRework,
        includePredictability,
        predictabilityMode,
        includeEpicTTM,
        includeActiveOrMissingEndDateSprints,
    });
}

/** Max preview namespace entries scanned for best-subset (newest-first). */
export const PREVIEW_CACHE_BEST_SCAN_MAX = 200;

function semanticsMatch(candidateMeta, requestSemantics) {
    if (!requestSemantics || typeof requestSemantics !== 'object') return true;
    const c = candidateMeta && candidateMeta.previewCacheSemantics;
    if (!c || typeof c !== 'object') return false;
    const keys = Object.keys(requestSemantics);
    for (const k of keys) {
        if (c[k] !== requestSemantics[k]) return false;
    }
    return true;
}

function pickBetter(prev, next) {
    if (!prev) return next;
    if (!next) return prev;
    const a = prev.entry.cachedAt || 0;
    const b = next.entry.cachedAt || 0;
    return b > a ? next : prev;
}

/**
 * @returns {Promise<null|{ key: string, entry: object, payload: object, matchType: 'narrower-window'|'wider-window-filtered' }>}
 */
export async function findBestPreviewCacheSubset({
    selectedProjects,
    windowStart,
    windowEnd,
    maxAgeMs,
    previewCacheSemantics = null,
} = {}) {
    const entries = await cache.entries({ namespace: 'preview' });
    if (!entries.size) return null;

    const requestedProjects = Array.isArray(selectedProjects)
        ? [...new Set(selectedProjects.map((project) => String(project || '').trim().toUpperCase()))].sort()
        : [];
    const requestedSet = new Set(requestedProjects);
    if (!requestedSet.size) return null;

    const requestedStartMs = new Date(windowStart).getTime();
    const requestedEndMs = new Date(windowEnd).getTime();
    if (Number.isNaN(requestedStartMs) || Number.isNaN(requestedEndMs)) return null;

    const now = Date.now();
    const list = [...entries]
        .filter(([key]) => key.startsWith('preview:'))
        .sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0))
        .slice(0, PREVIEW_CACHE_BEST_SCAN_MAX);

    let best = null;

    for (const [key, entry] of list) {
        const basePayload = entry.value || entry;
        if (!basePayload || typeof basePayload !== 'object') continue;
        const meta = basePayload.meta || {};
        const metaProjects = Array.isArray(meta.selectedProjects)
            ? [...new Set(meta.selectedProjects.map((project) => String(project || '').trim().toUpperCase()))].sort()
            : null;
        if (!metaProjects || !metaProjects.length) continue;
        if (!metaProjects.every((p) => requestedSet.has(p))) continue;
        if (!semanticsMatch(meta, previewCacheSemantics)) continue;

        const metaStartMs = new Date(meta.windowStart || windowStart).getTime();
        const metaEndMs = new Date(meta.windowEnd || windowEnd).getTime();
        if (Number.isNaN(metaStartMs) || Number.isNaN(metaEndMs)) continue;

        const ageMs = typeof entry.cachedAt === 'number' ? now - entry.cachedAt : null;
        if (typeof maxAgeMs === 'number' && maxAgeMs > 0 && ageMs != null && ageMs > maxAgeMs) continue;

        let matchType = null;
        const narrowerInside =
            metaStartMs >= requestedStartMs
            && metaEndMs <= requestedEndMs
            && (metaStartMs > requestedStartMs || metaEndMs < requestedEndMs);
        const widerContains =
            metaStartMs <= requestedStartMs
            && metaEndMs >= requestedEndMs
            && (metaStartMs < requestedStartMs || metaEndMs > requestedEndMs);

        if (narrowerInside) {
            matchType = 'narrower-window';
        } else if (widerContains) {
            matchType = 'wider-window-filtered';
        } else {
            continue;
        }

        best = pickBetter(best, { key, entry, payload: basePayload, matchType });
    }

    return best;
}

export function filterPreviewRowsToRequestedWindow(rows, windowStart, windowEnd) {
    const ws = new Date(windowStart).getTime();
    const we = new Date(windowEnd).getTime();
    if (Number.isNaN(ws) || Number.isNaN(we)) return rows || [];
    return (rows || []).filter((r) => {
        if (!r) return false;
        const rd = r.resolutionDate ? new Date(r.resolutionDate).getTime() : NaN;
        if (!Number.isNaN(rd)) return rd >= ws && rd <= we;
        const se = r.sprintEndDate ? new Date(r.sprintEndDate).getTime() : NaN;
        const ss = r.sprintStartDate ? new Date(r.sprintStartDate).getTime() : NaN;
        if (!Number.isNaN(se) && !Number.isNaN(ss)) return se >= ws && ss <= we;
        return false;
    });
}

export function filterSprintsOverlappingWindow(sprints, windowStart, windowEnd) {
    const a = new Date(windowStart).getTime();
    const b = new Date(windowEnd).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return sprints || [];
    return (sprints || []).filter((s) => {
        if (!s) return false;
        const se = s.endDate ? new Date(s.endDate).getTime() : NaN;
        const ss = s.startDate ? new Date(s.startDate).getTime() : NaN;
        if (!Number.isNaN(se) && !Number.isNaN(ss)) return se >= a && ss <= b;
        return true;
    });
}

export function computeRecentSplitConfig({
    rangeDays,
    bypassCache,
    requestedSplit,
    requestedRecentDays,
    previewMode,
    endDate,
    projectCount,
    includePredictability,
}) {
    const explicitSplit =
        previewMode === 'recent-first'
        || previewMode === 'recent-only'
        || requestedSplit;

    const recentBaseDays = Number.isNaN(requestedRecentDays) || requestedRecentDays <= 0
        ? 14
        : requestedRecentDays;
    const recentSplitDays = Math.min(60, recentBaseDays);

    const heavyByProjects = projectCount >= 5 || (projectCount >= 3 && rangeDays > 45);
    const heavyByPredictability = includePredictability && projectCount >= 3 && rangeDays > 30;
    const shouldSplitByRecent = !bypassCache && (
        explicitSplit
        || rangeDays > recentSplitDays
        || heavyByProjects
        || heavyByPredictability
    );
    let splitReason = null;
    if (shouldSplitByRecent) {
        if (explicitSplit) splitReason = 'explicit';
        else if (rangeDays > recentSplitDays) splitReason = 'range';
        else if (heavyByProjects) splitReason = 'projects';
        else if (heavyByPredictability) splitReason = 'predictability';
    }

    let recentCutoffDate = null;
    if (shouldSplitByRecent && endDate) {
        recentCutoffDate = new Date(endDate);
        recentCutoffDate.setDate(recentCutoffDate.getDate() - recentSplitDays);
    }

    return { shouldSplitByRecent, recentCutoffDate, recentSplitDays, splitReason };
}
