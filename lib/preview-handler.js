
import { logger } from './Delivera-Server-Logging-Utility.js';
import { cache, CACHE_TTL } from './cache.js';
import { createAgileClient, createVersion3Client } from './jiraClients.js';
import { fetchSprintsForBoard, filterSprintsByOverlap } from './sprints.js';
import { fetchSprintIssues, buildDrillDownRow, fetchBugsForSprints, fetchEpicIssues, buildSprintIssuesCacheKey, readCachedSprintIssues } from './issues.js';
import { calculateThroughput, calculateDoneComparison, calculateReworkRatio, calculatePredictability, calculateEpicTTM } from './metrics.js';
import { retryOnRateLimit, discoverBoardsWithCache, discoverFieldsWithCache, resolveJiraHostFromEnv } from './server-utils.js';
import { buildPreviewCacheKey, findBestPreviewCacheSubset, computeRecentSplitConfig, filterPreviewRowsToRequestedWindow, filterSprintsOverlappingWindow } from './preview-helpers.js';
import { derivePreviewClientBudgetMs, PREVIEW_SERVER_MAX_MS } from './Delivera-Preview-Client-Budget-SSOT.js';
import { DEFAULT_WINDOW_START, DEFAULT_WINDOW_END } from './Delivera-Config-DefaultWindow.js';
import { buildQuarterlyKPIFromPayload } from './Delivera-Data-QuarterlyKPI-Calculator.js';
import { DELIVERABLE_WORK_ITEM_FILTER_TOKEN } from './Delivera-Data-IssueType-Classification.js';

const inFlightPreviews = new Map();

class PreviewError extends Error {
    constructor(code, httpStatus, userMessage) {
        super(userMessage);
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

export async function previewHandler(req, res) {
    let accumulatedForPartialCache = null;
    let realCacheKey = null;

    let isPreviewOwner = false;
    let ownerResolve = null;

    try {
        const jiraHostResolved = resolveJiraHostFromEnv();
        const previewStartedAt = Date.now();
        const phaseLog = [];
        let isPartial = false;
        let partialReason = null;

        const addPhase = (phase, data = {}) => {
            phaseLog.push({ phase, at: new Date().toISOString(), ...data });
        };

        // --- PARAMS & VALIDATION ---
        const projectsParam = req.query.projects;
        let selectedProjects;
        if (projectsParam !== undefined && projectsParam !== null) {
            selectedProjects = projectsParam.split(',').map(p => p.trim()).filter(Boolean);
        } else {
            selectedProjects = ['MPSA', 'MAS'];
        }
        selectedProjects = [...new Set(selectedProjects.map((p) => String(p || '').trim().toUpperCase()).filter(Boolean))].sort();

        if (!selectedProjects || selectedProjects.length === 0) {
            return res.status(400).json({ error: 'At least one project must be selected', code: 'NO_PROJECTS_SELECTED' });
        }

        const windowStart = req.query.start || DEFAULT_WINDOW_START;
        const windowEnd = req.query.end || DEFAULT_WINDOW_END;

        const includeStoryPoints = req.query.includeStoryPoints !== 'false';
        const requireResolvedBySprintEnd = req.query.requireResolvedBySprintEnd === 'true';
        const includeBugsForRework = req.query.includeBugsForRework !== 'false';
        const includePredictability = req.query.includePredictability === 'true';
        const predictabilityMode = req.query.predictabilityMode || 'approx';
        const includeEpicTTM = req.query.includeEpicTTM !== 'false';
        const includeQuarterlyKpiSummary = req.query.includeQuarterlyKpiSummary !== 'false';
        const includeActiveOrMissingEndDateSprints = req.query.includeActiveOrMissingEndDateSprints === 'true';
        const bypassCache = req.query.bypassCache === 'true';
        /** preferCache is ignored when bypassCache wins (fresh Jira path). */
        const preferCacheBestAvailable = !bypassCache && req.query.preferCache === 'true';
        const previewModeRaw = typeof req.query.previewMode === 'string' ? req.query.previewMode : 'normal';
        const previewMode = ['normal', 'recent-first', 'recent-only'].includes(previewModeRaw) ? previewModeRaw : 'normal';
        const clientBudgetMsFromQuery = Number(req.query.clientBudgetMs);

        const startDate = new Date(windowStart);
        const endDate = new Date(windowEnd);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date window', code: 'INVALID_DATE_FORMAT' });
        }
        if (startDate >= endDate) {
            return res.status(400).json({ error: 'Start date must be before end date', code: 'INVALID_DATE_RANGE' });
        }

        const maxRangeDays = 730;
        const rangeDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (rangeDays > maxRangeDays) {
            return res.status(400).json({ error: 'Date range too large', code: 'DATE_RANGE_TOO_LARGE' });
        }

        // --- SPLIT LOGIC ---
        const requestedSplit = req.query.splitRecent === 'true' || req.query.splitRecent === '1';
        const requestedRecentDays = parseInt(req.query.recentDays, 10);
        const { shouldSplitByRecent, recentCutoffDate, recentSplitDays, splitReason } = computeRecentSplitConfig({
            rangeDays, bypassCache, requestedSplit, requestedRecentDays, previewMode, endDate, projectCount: selectedProjects.length, includePredictability
        });

        const derivedClientBudgetMs = derivePreviewClientBudgetMs({
            previewMode,
            rangeDays,
            clientBudgetMsOverride: clientBudgetMsFromQuery,
        });

        const MAX_PREVIEW_MS = Math.min(PREVIEW_SERVER_MAX_MS, derivedClientBudgetMs);
        const BEST_AVAILABLE_CACHE_MAX_AGE_MS = Math.min(CACHE_TTL.PREVIEW * 0.6, 27 * 60 * 1000);

        const previewCacheSemantics = {
            includeStoryPoints,
            requireResolvedBySprintEnd,
            includeBugsForRework,
            includePredictability,
            predictabilityMode,
            includeEpicTTM,
            includeActiveOrMissingEndDateSprints,
        };

        realCacheKey = buildPreviewCacheKey({
            selectedProjects, windowStart, windowEnd, includeStoryPoints, requireResolvedBySprintEnd, includeBugsForRework, includePredictability, predictabilityMode, includeEpicTTM, includeActiveOrMissingEndDateSprints
        });

        // --- IN-FLIGHT & CACHE CHECK ---
        let cancelled = false;

        req.on('close', () => { cancelled = true; });

        if (!bypassCache) {
            const existingPromise = inFlightPreviews.get(realCacheKey);
            if (existingPromise) await existingPromise.catch(() => { });
            else {
                isPreviewOwner = true;
                inFlightPreviews.set(realCacheKey, new Promise(r => ownerResolve = r));
            }
        }

        let cachedEntry = !bypassCache ? await cache.get(realCacheKey, { namespace: 'preview' }) : null;
        let cachedFromBestAvailableSubset = false;
        let cachedKeyUsed = realCacheKey;
        let bestCacheReuse = null;

        if (!cachedEntry && !bypassCache && preferCacheBestAvailable) {
            const best = await findBestPreviewCacheSubset({
                selectedProjects,
                windowStart,
                windowEnd,
                maxAgeMs: BEST_AVAILABLE_CACHE_MAX_AGE_MS,
                previewCacheSemantics,
            });
            if (best) {
                cachedEntry = best.entry;
                cachedFromBestAvailableSubset = best.key !== realCacheKey;
                cachedKeyUsed = best.key;
                bestCacheReuse = best;
            }
        }

        if (cachedEntry) {
            const val = cachedEntry.value || cachedEntry;
            const cachedHost = (val.meta && (val.meta.jiraHostResolved || val.meta.jiraHost)) || '';
            const hostMismatch = !!cachedHost && cachedHost !== jiraHostResolved;

            let rowsOut = val.rows || [];
            let sprintsIn = val.sprintsIncluded || [];
            let sprintsUn = val.sprintsUnusable || [];
            let metricsOut = { ...(val.metrics || {}) };
            let kpisOut = val.kpis !== undefined ? val.kpis : null;
            const cacheExtra = {};

            if (bestCacheReuse) {
                kpisOut = null;
                cacheExtra.kpisDeferred = true;
                cacheExtra.kpisDeferredReason = 'cache-subset-reuse';
                cacheExtra.cacheMatchType = bestCacheReuse.matchType;
                cacheExtra.cachedSourceWindowStart = val.meta?.windowStart || null;
                cacheExtra.cachedSourceWindowEnd = val.meta?.windowEnd || null;

                if (bestCacheReuse.matchType === 'wider-window-filtered') {
                    rowsOut = filterPreviewRowsToRequestedWindow(rowsOut, windowStart, windowEnd);
                    sprintsIn = filterSprintsOverlappingWindow(sprintsIn, windowStart, windowEnd);
                    sprintsUn = filterSprintsOverlappingWindow(sprintsUn, windowStart, windowEnd);
                    if (includeStoryPoints) {
                        metricsOut.throughput = calculateThroughput(rowsOut, includeStoryPoints);
                    }
                    if (requireResolvedBySprintEnd) {
                        metricsOut.doneComparison = calculateDoneComparison(rowsOut, requireResolvedBySprintEnd);
                    }
                    cacheExtra.reducedScope = false;
                } else if (bestCacheReuse.matchType === 'narrower-window') {
                    cacheExtra.reducedScope = true;
                    cacheExtra.reducedScopeReason = (val.meta?.windowStart && val.meta?.windowEnd)
                        ? `Cached data covers ${val.meta.windowStart} to ${val.meta.windowEnd} only (narrower than your selected range).`
                        : 'Cached data covers a narrower date range than requested.';
                }
            }

            const responsePayload = {
                ...val,
                rows: rowsOut,
                sprintsIncluded: sprintsIn,
                sprintsUnusable: sprintsUn,
                metrics: metricsOut,
                kpis: kpisOut,
                meta: {
                    ...(val.meta || {}),
                    windowStart,
                    windowEnd,
                    selectedProjects,
                    fromCache: true,
                    cachedKeyUsed,
                    cachedFromBestAvailableSubset,
                    clientBudgetMsEcho: derivedClientBudgetMs,
                    previewCacheSemantics,
                    jiraHost: jiraHostResolved,
                    jiraHostResolved,
                    jiraHostFromCache: cachedHost || '',
                    jiraHostMismatch: hostMismatch,
                    ...cacheExtra,
                },
            };
            if (isPreviewOwner && ownerResolve) ownerResolve();
            ownerResolve = null;
            return res.json(responsePayload);
        }

        // --- LIVE FETCH ---
        let agileClient, version3Client;
        try {
            agileClient = createAgileClient();
            version3Client = createVersion3Client();
        } catch (error) {
            throw new PreviewError(
                'JIRA_UNAUTHORIZED',
                502,
                'Jira credentials are missing or invalid in server configuration. Set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN.'
            );
        }

        const { boards, projectErrors } = await discoverBoardsWithCache(selectedProjects, agileClient);
        addPhase('discoverBoards', { count: boards.length, projectErrors: projectErrors.length });
        if (!boards.length && projectErrors.length) {
            const authish = new Set(['JIRA_UNAUTHORIZED', 'JIRA_FORBIDDEN']);
            const allAuth = projectErrors.every((e) => authish.has(e.code));
            if (allAuth) {
                throw new PreviewError(
                    'JIRA_UNAUTHORIZED',
                    502,
                    'Jira API rejected credentials or access for all selected projects. Check API token, host, and project permissions.'
                );
            }
            throw new PreviewError(
                'BOARD_FETCH_ERROR',
                502,
                'Unable to discover boards for one or more selected projects. Deselect failing projects or fix Jira access.'
            );
        }

        const fields = await discoverFieldsWithCache(version3Client);
        addPhase('discoverFields', { found: !!fields.storyPointsFieldId });

        const fieldInventory = {
            availableFieldCount: Array.isArray(fields.availableFields) ? fields.availableFields.length : 0,
            customFieldCount: Array.isArray(fields.customFields) ? fields.customFields.length : 0,
            ebmFieldsFound: fields.ebmFieldIds ? Object.keys(fields.ebmFieldIds) : [],
            ebmFieldsMissing: []
        };

        // Fetch sprints with per-board fault isolation so one broken board does not kill the whole preview.
        const sprintFetchFailures = [];
        const allSprints = [];
        for (let i = 0; i < boards.length; i += 3) {
            if (cancelled) break;
            const chunk = boards.slice(i, i + 3);
            const res = await Promise.allSettled(
                chunk.map(b =>
                    retryOnRateLimit(
                        () => fetchSprintsForBoard(b.id, agileClient),
                        3,
                        `sprints:${b.id}`
                    )
                )
            );
            res.forEach((result, idx) => {
                const board = chunk[idx];
                if (result.status === 'fulfilled') {
                    const boardSprints = Array.isArray(result.value) ? result.value : [];
                    allSprints.push(...boardSprints.map((x) => ({ ...x, boardId: board.id })));
                    return;
                }
                sprintFetchFailures.push({
                    boardId: board?.id ?? null,
                    boardName: board?.name || '',
                    error: result.reason?.message || 'Unknown sprint fetch error',
                });
            });
        }
        addPhase('fetchSprints', { count: allSprints.length, failedBoards: sprintFetchFailures.length });
        if (!allSprints.length && sprintFetchFailures.length > 0) {
            throw new PreviewError(
                'BOARD_FETCH_ERROR',
                502,
                'Unable to fetch sprint history for selected boards. Retry preview or try a smaller date range.'
            );
        }

        const { included: sprintsIncluded, unusable: sprintsUnusable } = filterSprintsByOverlap(allSprints, windowStart, windowEnd, includeActiveOrMissingEndDateSprints);

        // Fetch Issues
        const allRows = [];
        const sprintMap = new Map(sprintsIncluded.map(s => [s.id, s]));
        const boardMap = new Map(boards.map(b => [b.id, b]));
        const sprintIds = sprintsIncluded.map(s => s.id);
        let skippedOldSprints = [];

        for (let i = 0; i < sprintIds.length; i += 3) {
            if (!isPartial && Date.now() - previewStartedAt > MAX_PREVIEW_MS) {
                isPartial = true; partialReason = 'Time budget exceeded'; break;
            }
            if (cancelled) break;

            const chunk = sprintIds.slice(i, i + 3);
            const res = await Promise.all(chunk.map(async (sid) => {
                const sprint = sprintMap.get(sid);
                const board = boardMap.get(sprint.boardId);

                // Smart Cache/Split Logic
                const sprintEndTime = sprint.endDate ? new Date(sprint.endDate).getTime() : NaN;
                const isRecent = !shouldSplitByRecent || !recentCutoffDate ? true :
                    (sprint.state === 'active' || isNaN(sprintEndTime) || sprintEndTime >= recentCutoffDate.getTime());

                if (!isRecent && shouldSplitByRecent) {
                    const sKey = buildSprintIssuesCacheKey({
                        sprintId: sid,
                        selectedProjects,
                        requireResolvedBySprintEnd,
                        sprintEndDate: sprint.endDate,
                        allowedIssueTypes: [DELIVERABLE_WORK_ITEM_FILTER_TOKEN],
                        includeSubtaskTotals: !!version3Client,
                        fieldIds: fields
                    });
                    const cParams = await readCachedSprintIssues(sKey);
                    if (cParams && cParams.length) {
                        return cParams.map(issue =>
                            buildDrillDownRow(issue, sprint, board, fields, { includeStoryPoints, includeEpicTTM })
                        );
                    }
                    skippedOldSprints.push(sid);
                    return [];
                }

                const allowedTypes = [DELIVERABLE_WORK_ITEM_FILTER_TOKEN];

                try {
                    const issues = await retryOnRateLimit(
                        () => fetchSprintIssues(
                            sid,
                            agileClient,
                            selectedProjects,
                            requireResolvedBySprintEnd,
                            sprint.endDate,
                            allowedTypes,
                            fields,
                            version3Client
                        ),
                        3,
                        `issues:${sid}`
                    );
                    return issues.map(issue =>
                        buildDrillDownRow(issue, sprint, board, fields, { includeStoryPoints, includeEpicTTM })
                    );
                } catch (e) {
                    return [];
                }
            }));

            const rows = res.flat();
            allRows.push(...rows);
            accumulatedForPartialCache = { allRows: [...allRows], boards, sprintsIncluded, sprintsUnusable, selectedProjects, windowStart, windowEnd };
        }

        // --- METRICS ---
        const metrics = {};
        if (!cancelled && !isPartial) {
            if (includeStoryPoints) metrics.throughput = calculateThroughput(allRows, includeStoryPoints);
            if (requireResolvedBySprintEnd) metrics.doneComparison = calculateDoneComparison(allRows, requireResolvedBySprintEnd);
            if (includeBugsForRework) {
                // Fetch bugs logic...
                const bugIssues = await retryOnRateLimit(
                    () => fetchBugsForSprints(sprintIds, agileClient, selectedProjects, 3, fields),
                    3,
                    'bugs'
                );
                metrics.rework = calculateReworkRatio(allRows, bugIssues, includeStoryPoints, fields.storyPointsFieldId);
            }
            if (includePredictability) metrics.predictability = await calculatePredictability(allRows, sprintsIncluded, predictabilityMode, version3Client);
            if (includeEpicTTM) {
                // Simplified Epic Fetch logic
                const epicKeys = [...new Set(allRows.map(r => r.epicKey).filter(Boolean))];
                if (epicKeys.length) {
                    const epics = await retryOnRateLimit(
                        () => fetchEpicIssues(epicKeys, version3Client, 3),
                        3,
                        'epics'
                    );
                    const ttm = calculateEpicTTM(allRows, epics);
                    metrics.epicTTM = ttm.epicTTM || ttm;
                }
            }
        }

        const meta = {
            selectedProjects,
            windowStart,
            windowEnd,
            generatedAt: new Date().toISOString(),
            fromCache: false,
            partial: isPartial,
            partialReason,
            previewMode,
            rangeDays,
            recentSplitDays: shouldSplitByRecent ? recentSplitDays : null,
            recentCutoffDate: shouldSplitByRecent && recentCutoffDate ? recentCutoffDate.toISOString() : null,
            cachedFromBestAvailableSubset,
            cachedKeyUsed,
            splitReason,
            phaseLog,
            fieldInventory,
            reducedScope: sprintFetchFailures.length > 0,
            reducedScopeReason: sprintFetchFailures.length > 0
                ? `${sprintFetchFailures.length} board(s) failed sprint retrieval`
                : '',
            failedBoards: sprintFetchFailures.slice(0, 5),
            failedBoardCount: sprintFetchFailures.length,
            jiraProjectErrors: projectErrors.length ? projectErrors : undefined,
            jiraHost: jiraHostResolved,
            jiraHostResolved,
            jiraHostFromCache: '',
            jiraHostMismatch: false,
            clientBudgetMsEcho: derivedClientBudgetMs,
            previewCacheSemantics,
        };

        const payload = {
            meta,
            boards: boards.map(b => ({ id: b.id, name: b.name })),
            rows: allRows,
            metrics,
            kpis: null,
            sprintsIncluded: sprintsIncluded.map(s => ({ ...s, name: s.name })), // Simplified
            sprintsUnusable
        };

        if (!cancelled && !isPartial && includeQuarterlyKpiSummary && selectedProjects.length) {
            const elapsedBeforeKpi = Date.now() - previewStartedAt;
            const kpiTimeHeadroomMs = derivedClientBudgetMs - 8000;
            if (elapsedBeforeKpi < kpiTimeHeadroomMs) {
                try {
                    payload.kpis = buildQuarterlyKPIFromPayload({
                        payload,
                        projectKeys: selectedProjects,
                        windowStart,
                        windowEnd,
                        projectRoot: process.cwd(),
                    });
                } catch (kpiError) {
                    logger.warn('Quarterly KPI enrichment failed during preview', {
                        error: kpiError?.message || String(kpiError),
                        projects: selectedProjects,
                    });
                }
            } else {
                payload.meta.kpisDeferred = true;
                payload.meta.kpisDeferredReason = 'time-budget';
            }
        }

        await cache.set(realCacheKey, payload, isPartial ? CACHE_TTL.PREVIEW_PARTIAL : CACHE_TTL.PREVIEW, { namespace: 'preview' });
        res.json(payload);

        // Cleanup in-flight handled in finally
    } catch (err) {
        if (realCacheKey && accumulatedForPartialCache?.allRows?.length) {
            try {
                const partialPayload = {
                    meta: {
                        selectedProjects: accumulatedForPartialCache.selectedProjects || [],
                        windowStart: accumulatedForPartialCache.windowStart,
                        windowEnd: accumulatedForPartialCache.windowEnd,
                        generatedAt: new Date().toISOString(),
                        fromCache: false,
                        partial: true,
                        partialReason: err?.message || 'Preview failed after partial data retrieval',
                        jiraHost: jiraHostResolved,
                        jiraHostResolved,
                        jiraHostFromCache: '',
                        jiraHostMismatch: false,
                    },
                    boards: (accumulatedForPartialCache.boards || []).map((board) => ({ id: board.id, name: board.name })),
                    rows: accumulatedForPartialCache.allRows || [],
                    metrics: {},
                    kpis: null,
                    sprintsIncluded: accumulatedForPartialCache.sprintsIncluded || [],
                    sprintsUnusable: accumulatedForPartialCache.sprintsUnusable || [],
                };
                await cache.set(realCacheKey, partialPayload, CACHE_TTL.PREVIEW_PARTIAL, { namespace: 'preview' });
            } catch (cacheError) {
                logger.warn('Unable to cache partial preview payload', { error: cacheError.message });
            }
        }
        logger.error('Preview Error', err);
        const status = err instanceof PreviewError && err.httpStatus ? err.httpStatus : 500;
        const code = err instanceof PreviewError && err.code ? err.code : 'PREVIEW_FAILED';
        res.status(status).json({ error: 'Preview failed', message: err.message, code });
    } finally {
        if (isPreviewOwner && ownerResolve && realCacheKey) {
            ownerResolve();
            ownerResolve = null;
            inFlightPreviews.delete(realCacheKey);
        }
    }
}
