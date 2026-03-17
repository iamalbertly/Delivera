
import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { cache, CACHE_TTL } from './cache.js';
import { createAgileClient, createVersion3Client } from './jiraClients.js';
import { fetchSprintsForBoard, filterSprintsByOverlap } from './sprints.js';
import { fetchSprintIssues, buildDrillDownRow, fetchBugsForSprints, fetchEpicIssues, buildSprintIssuesCacheKey, readCachedSprintIssues } from './issues.js';
import { calculateThroughput, calculateDoneComparison, calculateReworkRatio, calculatePredictability, calculateEpicTTM } from './metrics.js';
import { retryOnRateLimit, discoverBoardsWithCache, discoverFieldsWithCache, resolveJiraHostFromEnv } from './server-utils.js';
import { buildPreviewCacheKey, findBestPreviewCacheSubset, computeRecentSplitConfig } from './preview-helpers.js';
import { DEFAULT_WINDOW_START, DEFAULT_WINDOW_END } from './Jira-Reporting-App-Config-DefaultWindow.js';
import { buildQuarterlyKPIFromPayload } from './Jira-Reporting-App-Data-QuarterlyKPI-Calculator.js';

const PREVIEW_SERVER_MAX_MS = 90 * 1000;
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
        const preferCacheBestAvailable = req.query.preferCache === 'true';
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

        const derivedClientBudgetMs = (() => {
            if (!Number.isNaN(clientBudgetMsFromQuery) && clientBudgetMsFromQuery > 0) return clientBudgetMsFromQuery;
            if (previewMode === 'recent-only') return 90 * 1000;
            if (previewMode === 'recent-first') return 75 * 1000;
            if (rangeDays > 60) return 75 * 1000;
            return 60 * 1000;
        })();

        const MAX_PREVIEW_MS = Math.min(PREVIEW_SERVER_MAX_MS, derivedClientBudgetMs);
        const BEST_AVAILABLE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

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

        if (!cachedEntry && !bypassCache && preferCacheBestAvailable) {
            const best = await findBestPreviewCacheSubset({ selectedProjects, windowStart, windowEnd, maxAgeMs: BEST_AVAILABLE_CACHE_MAX_AGE_MS });
            if (best) {
                cachedEntry = best.entry;
                cachedFromBestAvailableSubset = best.key !== realCacheKey;
                cachedKeyUsed = best.key;
            }
        }

        if (cachedEntry) {
            const val = cachedEntry.value || cachedEntry;
            const cachedHost = (val.meta && (val.meta.jiraHostResolved || val.meta.jiraHost)) || '';
            const hostMismatch = !!cachedHost && cachedHost !== jiraHostResolved;
            const responsePayload = {
                ...val,
                meta: {
                    ...(val.meta || {}),
                    fromCache: true,
                    cachedKeyUsed,
                    jiraHost: jiraHostResolved,
                    jiraHostResolved,
                    jiraHostFromCache: cachedHost || '',
                    jiraHostMismatch: hostMismatch,
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
            throw new PreviewError('AUTH_ERROR', 500, 'Jira authentication failed.');
        }

        const boards = await discoverBoardsWithCache(selectedProjects, agileClient);
        addPhase('discoverBoards', { count: boards.length });

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
                        allowedIssueTypes: includeBugsForRework ? ['Story', 'User Story', 'Bug'] : ['Story', 'User Story'],
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

                const allowedTypes = ['Story', 'User Story'];
                if (includeBugsForRework) allowedTypes.push('Bug');

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
            jiraHost: jiraHostResolved,
            jiraHostResolved,
            jiraHostFromCache: '',
            jiraHostMismatch: false,
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
