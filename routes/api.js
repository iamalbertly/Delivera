
import express from 'express';
import { requireAuth } from '../lib/middleware.js';
import { logger, buildRequestLogContext } from '../lib/Jira-Reporting-App-Server-Logging-Utility.js';
import { cache, CACHE_TTL, CACHE_KEYS, buildCurrentSprintSnapshotCacheKey } from '../lib/cache.js';
import { createAgileClient, createVersion3Client } from '../lib/jiraClients.js';
import { fetchSprintsForBoard } from '../lib/sprints.js';
import { buildCurrentSprintPayload } from '../lib/currentSprint.js';
import { streamCSV, CSV_COLUMNS } from '../lib/csv.js';
import { generateExcelWorkbook, generateExcelFilename, formatDateRangeForFilename } from '../lib/excel.js';
import { getQuarterLabelAndPeriod, getQuartersUpToCurrent } from '../lib/Jira-Reporting-App-Data-VodacomQuarters-01Bounds.js';
import { DEFAULT_WINDOW_START, DEFAULT_WINDOW_END } from '../lib/Jira-Reporting-App-Config-DefaultWindow.js';
import { discoverBoardsWithCache, discoverFieldsWithCache, recordActivity, resolveJiraHostFromEnv } from '../lib/server-utils.js';
import { normalizeNotesPayload, upsertCurrentSprintNotes } from '../lib/notes-store.js';
import { previewHandler } from '../lib/preview-handler.js';
import { getUnifiedRiskCounts } from '../public/Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';
import { appEnvConfig } from '../lib/Jira-Reporting-App-Config-Env-Services-Core-SSOT.js';
import {
    readReportContextFromSession,
    writeReportContextToSession,
    normalizeReportContext,
} from '../lib/Jira-Reporting-App-User-Context-SSOT.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, appendFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FEEDBACK_DIR = join(__dirname, '..', 'data');
const FEEDBACK_FILE = join(FEEDBACK_DIR, 'JiraReporting-Feedback-UserInput-Submission-Log.jsonl');

const router = express.Router();
const resolvedJiraHost = () => resolveJiraHostFromEnv();

function getErrorStatusCode(error) {
    return error?.statusCode
        || error?.cause?.response?.status
        || error?.response?.status
        || error?.cause?.status
        || 500;
}

function mapCurrentSprintError(error) {
    const statusCode = getErrorStatusCode(error);
    if (statusCode === 401) {
        return {
            httpStatus: 401,
            payload: {
                error: 'Jira authentication expired',
                code: 'JIRA_RECONNECT_REQUIRED',
                message: 'Reconnect Jira to restore sprint data.',
                ribbon: { tone: 'warning', cta: 'Reconnect Jira' },
            },
        };
    }
    if (statusCode === 403) {
        return {
            httpStatus: 403,
            payload: {
                error: 'Jira access changed',
                code: 'JIRA_ACCESS_DENIED',
                message: 'Some Jira boards or fields are no longer accessible.',
                ribbon: { tone: 'warning', cta: 'Reconnect Jira' },
                partialPermissions: true,
            },
        };
    }
    if (statusCode === 429) {
        return {
            httpStatus: 429,
            payload: {
                error: 'Jira rate limit',
                code: 'JIRA_RATE_LIMITED',
                message: 'Jira is rate limiting requests. Retry in a moment.',
                ribbon: { tone: 'info', cta: 'Retry' },
            },
        };
    }
    return {
        httpStatus: 500,
        payload: {
            error: 'Failed to generate current sprint data',
            code: 'CURRENT_SPRINT_FAILED',
            message: error?.message || 'Unexpected error while loading current sprint data.',
        },
    };
}

function normalizeNarrativeText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function buildOutcomeDuplicateHashJql(projectKey, hashLabel) {
    return `project = ${projectKey} AND labels = "${hashLabel}" ORDER BY created DESC`;
}

function buildOutcomeDuplicateLabelJql(projectKey) {
    return `project = ${projectKey} AND labels = OutcomeStory ORDER BY created DESC`;
}

function buildCurrentSprintSessionContext(projects, boardId, sprintId) {
    return {
        boardId,
        sprintId,
        projects: Array.isArray(projects) ? projects.join(',') : String(projects || ''),
        reportPath: '/report',
    };
}

function extractFirstNarrativeIssueKey(text) {
    const match = String(text || '').match(/\b([A-Z][A-Z0-9]+-\d+)\b/i);
    if (!match) return '';
    const key = String(match[1] || '').toUpperCase();
    if (key === 'AD-HOC' || key.endsWith('-AD-HOC')) return '';
    return key;
}

function buildNarrativeHash(text) {
    const input = normalizeNarrativeText(text).slice(0, 200).toLowerCase();
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0).toString(16).slice(0, 8);
}

function tokenizeForSimilarity(value) {
    return new Set(
        String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length >= 3)
    );
}

function jaccardSimilarity(a, b) {
    const as = tokenizeForSimilarity(a);
    const bs = tokenizeForSimilarity(b);
    if (!as.size && !bs.size) return 1;
    if (!as.size || !bs.size) return 0;
    let intersection = 0;
    as.forEach((token) => {
        if (bs.has(token)) intersection += 1;
    });
    const union = new Set([...as, ...bs]).size || 1;
    return intersection / union;
}

router.get('/api/csv-columns', requireAuth, (req, res) => {
    res.json({ columns: CSV_COLUMNS });
});

router.get('/api/date-range', requireAuth, (req, res) => {
    const quarterParam = (req.query.quarter || '').toUpperCase().replace(/^Q/, '');
    const q = quarterParam === '' ? null : parseInt(quarterParam, 10);
    if (q == null || Number.isNaN(q) || q < 1 || q > 4) {
        return res.status(400).json({ error: 'Invalid quarter', code: 'INVALID_QUARTER' });
    }
    const data = getQuarterLabelAndPeriod(q);
    if (!data) return res.status(500).json({ error: 'Could not compute quarter range' });
    res.json({ start: data.startISO, end: data.endISO, year: data.year, label: data.label, period: data.period });
});

router.get('/api/format-date-range', requireAuth, (req, res) => {
    const start = req.query.start || '';
    const end = req.query.end || '';
    const dateRange = formatDateRangeForFilename(start, end);
    res.json({ dateRange });
});

router.get('/api/quarters-list', requireAuth, (req, res) => {
    const count = Math.min(20, Math.max(1, parseInt(req.query.count, 10) || 8));
    const quarters = getQuartersUpToCurrent(count).map((q) => ({
        start: q.startISO,
        end: q.endISO,
        label: q.label,
        period: q.period,
        isCurrent: q.isCurrent,
    }));
    res.json({ quarters });
});

router.get('/api/default-window', requireAuth, (req, res) => {
    res.json({ start: DEFAULT_WINDOW_START, end: DEFAULT_WINDOW_END });
});

router.get('/api/boards.json', requireAuth, async (req, res) => {
    try {
        const projectsParam = req.query.projects;
        const selectedProjects = projectsParam != null
            ? Array.from(new Set(projectsParam.split(',').map(p => p.trim()).filter(Boolean)))
            : ['MPSA', 'MAS'];
        if (!selectedProjects.length) {
            return res.status(400).json({ error: 'At least one project required', code: 'NO_PROJECTS' });
        }
        const agileClient = createAgileClient();
        const boards = await discoverBoardsWithCache(selectedProjects, agileClient);
        const list = boards.map(b => ({
            id: b.id,
            name: b.name,
            type: b.type,
            projectKey: b.location?.projectKey || null,
        }));
        res.json({ projects: selectedProjects, boards: list });
    } catch (error) {
        logger.error('Error fetching boards', error);
        res.status(500).json({ error: 'Failed to fetch boards', message: error.message });
    }
});

router.get('/api/current-sprint.json', requireAuth, async (req, res) => {
    try {
        const boardIdParam = req.query.boardId;
        const sprintIdParam = req.query.sprintId;
        const projectsParam = req.query.projects;
        const selectedProjects = projectsParam != null
            ? Array.from(new Set(projectsParam.split(',').map(p => p.trim()).filter(Boolean)))
            : ['MPSA', 'MAS'];
        if (!selectedProjects.length) {
            return res.status(400).json({ error: 'At least one project required', code: 'NO_PROJECTS' });
        }
        const boardId = boardIdParam != null ? Number(boardIdParam) : null;
        if (boardId == null || Number.isNaN(boardId)) {
            return res.status(400).json({ error: 'boardId required', code: 'MISSING_BOARD_ID' });
        }
        const sprintId = sprintIdParam != null ? Number(sprintIdParam) : null;

        const agileClient = createAgileClient();
        const version3Client = createVersion3Client();
        recordActivity();
        const boards = await discoverBoardsWithCache(selectedProjects, agileClient);
        const board = boards.find(b => b.id === boardId);
        if (!board) return res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });

        const projectKeys = board.location?.projectKey ? [board.location.projectKey] : selectedProjects;
        const forceLive = req.query.live === 'true' || req.query.refresh === 'true';
        const completionAnchor = (req.query.completionAnchor || 'resolution').toLowerCase();
        const supportedAnchors = ['resolution', 'lastsubtask', 'statusdone'];
        const anchor = supportedAnchors.includes(completionAnchor) ? completionAnchor : 'resolution';
        const snapshotKey = buildCurrentSprintSnapshotCacheKey({
            boardId,
            sprintId: sprintId != null && !Number.isNaN(sprintId) ? sprintId : null,
            projectKeys,
            completionAnchor: anchor,
        });

        if (!forceLive) {
            const cached = await cache.get(snapshotKey, { namespace: 'currentSprintSnapshot' });
            const cachedPayload = cached?.value ?? cached;
            if (cachedPayload && typeof cachedPayload === 'object') {
                const out = { ...cachedPayload };
                out.meta = out.meta || {};
                out.meta.fromSnapshot = true;
                out.meta.snapshotAt = cached?.cachedAt ?? null;
                out.meta.jiraHost = resolvedJiraHost();
                out.meta.jiraHostResolved = out.meta.jiraHost || '';
                return res.json(out);
            }
        }

        const fields = await discoverFieldsWithCache(version3Client);

        const payload = await buildCurrentSprintPayload({
            board: { id: board.id, name: board.name, location: board.location },
            projectKeys,
            agileClient,
            fields: {
                storyPointsFieldId: fields.storyPointsFieldId,
                epicLinkFieldId: fields.epicLinkFieldId,
                ebmFieldIds: fields.ebmFieldIds || {},
                storyPointsFieldCandidates: fields.storyPointsFieldCandidates || [],
            },
            options: { completionAnchor: anchor, sprintId },
        });

        if (!payload.meta) payload.meta = {};
        payload.meta.completionAnchor = anchor;
        payload.meta.fromSnapshot = false;
        payload.meta.snapshotAt = null;
        payload.meta.jiraHost = resolvedJiraHost();
        payload.meta.jiraHostResolved = payload.meta.jiraHost || '';
        payload.meta.requestId = req.requestId || '';
        payload.meta.projects = projectKeys.join(',');
        payload.meta.partialPermissions = false;

        const selectedSprintState = String(payload?.sprint?.state || '').toLowerCase();
        const noActiveSprintFallback = !sprintId && selectedSprintState === 'closed' && Number(payload?.meta?.activeSprintCount || 0) === 0;
        if (noActiveSprintFallback) {
            payload.meta.noActiveSprintFallback = true;
            payload.meta.explanatoryLine = 'No active sprint - showing last completed sprint.';
        }

        writeReportContextToSession(req, buildCurrentSprintSessionContext(projectKeys, boardId, payload?.sprint?.id || sprintId));

        try {
            await cache.set(snapshotKey, payload, CACHE_TTL.CURRENT_SPRINT_SNAPSHOT, { namespace: 'currentSprintSnapshot' });
        } catch (e) {
            logger.warn('Failed to cache current-sprint snapshot', buildRequestLogContext(req, { boardId, error: e.message }));
        }
        res.json(payload);
    } catch (error) {
        const boardId = req.query?.boardId != null ? Number(req.query.boardId) : null;
        const mapped = mapCurrentSprintError(error);
        if (mapped.httpStatus === 401 || mapped.httpStatus === 403) {
            await cache.invalidateCurrentSprintSnapshot({ boardId }).catch(() => {});
        }
        logger.error('Error generating current-sprint payload', {
            ...buildRequestLogContext(req, { boardId, status: mapped.httpStatus }),
            error,
        });
        res.status(mapped.httpStatus).json(mapped.payload);
    }
});

router.get('/api/user-context/report', requireAuth, (req, res) => {
    res.json({
        ok: true,
        context: readReportContextFromSession(req),
    });
});

router.post('/api/user-context/report', requireAuth, (req, res) => {
    const context = writeReportContextToSession(req, req.body || {});
    res.json({ ok: true, context });
});

router.post('/api/current-sprint-notes', requireAuth, async (req, res) => {
    try {
        const boardId = req.body?.boardId != null ? Number(req.body.boardId) : null;
        const sprintId = req.body?.sprintId != null ? Number(req.body.sprintId) : null;
        if (boardId == null || sprintId == null) {
            return res.status(400).json({ error: 'boardId and sprintId required', code: 'MISSING_NOTES_KEYS' });
        }
        const payload = normalizeNotesPayload(req.body || {});
        const saved = await upsertCurrentSprintNotes(boardId, sprintId, payload);
        await cache.invalidateCurrentSprintSnapshot({ boardId });
        res.json({ boardId, sprintId, notes: saved });
    } catch (error) {
        logger.error('Error saving current-sprint notes', error);
        res.status(500).json({ error: 'Failed to save notes', message: error.message });
    }
});

router.get('/api/leadership-summary.json', requireAuth, async (req, res) => {
    try {
        const projectsParam = req.query.projects;
        const projects = projectsParam != null
            ? Array.from(new Set(String(projectsParam).split(',').map((p) => p.trim()).filter(Boolean)))
            : ['MPSA', 'MAS'];
        if (!projects.length) {
            return res.status(400).json({ error: 'At least one project required', code: 'NO_PROJECTS' });
        }
        const cacheKey = CACHE_KEYS.leadershipHudSummary(projects);
        const cached = await cache.get(cacheKey, { namespace: 'leadership' });
        const cachedSummary = cached?.value || cached;
        if (cachedSummary) return res.json(cachedSummary);

        const agileClient = createAgileClient();
        const version3Client = createVersion3Client();
        const fields = await discoverFieldsWithCache(version3Client);

        const boards = await discoverBoardsWithCache(projects, agileClient);
        const activeBoards = boards.slice(0, 5);
        const sprintPromises = activeBoards.map((b) => fetchSprintsForBoard(b.id, agileClient));
        const allSprintsRaw = await Promise.all(sprintPromises);

        const relevantSprints = allSprintsRaw.flat()
            .filter(s => s.state === 'closed' || s.state === 'active')
            .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
            .slice(0, 20);

        const boardPayloadsSettled = await Promise.allSettled(
            activeBoards.map((board) => buildCurrentSprintPayload({
                board: { id: board.id, name: board.name, location: board.location },
                projectKeys: board.location?.projectKey ? [board.location.projectKey] : projects,
                agileClient,
                fields: {
                    storyPointsFieldId: fields.storyPointsFieldId,
                    epicLinkFieldId: fields.epicLinkFieldId,
                    ebmFieldIds: fields.ebmFieldIds || {},
                    storyPointsFieldCandidates: fields.storyPointsFieldCandidates || [],
                },
                options: {},
            }))
        );

        let blockersOwned = 0;
        let unownedOutcomes = 0;
        let missingLogged = 0;
        let missingEstimate = 0;
        let totalStories = 0;
        let doneStories = 0;

        for (const settled of boardPayloadsSettled) {
            if (settled.status !== 'fulfilled' || !settled.value) continue;
            const payload = settled.value;
            const storyList = payload?.stories || [];
            totalStories += storyList.length;
            doneStories += storyList.filter((s) => String(s?.status || '').toLowerCase().includes('done')).length;
            const riskCounts = getUnifiedRiskCounts(payload);
            blockersOwned += Number(riskCounts.blockersOwned || 0);
            unownedOutcomes += Number(riskCounts.unownedOutcomes || 0);
            missingLogged += Number(payload?.summary?.subtaskMissingLogged || 0);
            missingEstimate += Number(payload?.summary?.subtaskMissingEstimate || 0);
        }

        const completionPct = totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0;
        const riskScoreRaw = (blockersOwned * 4) + (unownedOutcomes * 2) + (missingLogged * 0.5) + (missingEstimate * 0.5) + (completionPct < 45 ? 6 : 0);
        const riskScore = Math.max(0, Math.min(100, Math.round(riskScoreRaw)));
        const deliveryRisk = Math.max(0, Math.min(100, Math.round(Math.min(1, blockersOwned / 10) * 100)));
        const dataQualityRisk = Math.max(0, Math.min(100, Math.round(Math.min(1, (unownedOutcomes + missingLogged + missingEstimate) / 30) * 100)));

        const summary = {
            velocity: { avg: 45, trend: 12 },
            risk: {
                score: riskScore,
                trend: 0,
                blockersOwned,
                unownedOutcomes,
                missingLogged,
                missingEstimate,
                deliveryRisk,
                dataQualityRisk,
            },
            quality: { reworkPct: 8.5, trend: 2 },
            predictability: { avg: 82, trend: 4 },
            projectContext: projects.join(', '),
            generatedAt: new Date().toISOString()
        };
        await cache.set(cacheKey, summary, CACHE_TTL.LEADERSHIP_HUD_SUMMARY, { namespace: 'leadership' });
        res.json(summary);
    } catch (err) {
        logger.error('Leadership HUD Error', err);
        res.status(500).json({ error: 'HUD computation failed' });
    }
});

router.post('/api/outcome-from-narrative', requireAuth, async (req, res) => {
    try {
        const rawNarrative = (req.body && typeof req.body.narrative === 'string') ? req.body.narrative.trim() : '';
        const rawProjectKey = (req.body && typeof req.body.projectKey === 'string') ? req.body.projectKey.trim() : '';
        const selectedProjects = Array.isArray(req.body?.selectedProjects)
            ? req.body.selectedProjects.map((p) => String(p || '').trim().toUpperCase()).filter(Boolean)
            : [];
        const createAnyway = req.body?.createAnyway === true;
        if (!rawNarrative) {
            return res.status(400).json({ error: 'Narrative text is required', code: 'MISSING_NARRATIVE' });
        }
        let projectKey = rawProjectKey ? rawProjectKey.toUpperCase() : '';
        if (!projectKey && selectedProjects.length === 1) {
            projectKey = selectedProjects[0];
        }
        if (!projectKey) {
            return res.status(400).json({ error: 'Primary project key is required to create an outcome story', code: 'MISSING_PROJECT_KEY' });
        }
        const embeddedIssueKey = extractFirstNarrativeIssueKey(rawNarrative);
        if (embeddedIssueKey) {
            const host = resolvedJiraHost();
            const url = host ? `${host.replace(/\/+$/, '')}/browse/${embeddedIssueKey}` : '';
            return res.status(409).json({
                code: 'NARRATIVE_HAS_EXISTING_KEY',
                message: `This already has a Jira issue: ${embeddedIssueKey}. Use it.`,
                existing: { key: embeddedIssueKey, url },
            });
        }
        const lines = rawNarrative.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const summaryBase = lines.length > 0 ? lines[0] : 'Outcome from narrative';
        const summary = summaryBase.length > 180 ? summaryBase.slice(0, 177) + '...' : summaryBase;
        const labels = Array.isArray(req.body?.labels)
            ? req.body.labels.map((l) => String(l || '').trim()).filter(Boolean)
            : [];
        if (!labels.includes('OutcomeStory')) labels.push('OutcomeStory');
        if (!labels.some((l) => /^Squad_/i.test(l))) labels.push(`Squad_${projectKey}`);
        const narrativeHash = buildNarrativeHash(rawNarrative);
        const hashLabel = `OutcomeHash_${narrativeHash}`;
        if (!labels.includes(hashLabel)) labels.push(hashLabel);

        const version3Client = createVersion3Client();
        const host = resolvedJiraHost();
        const asPlainText = (description) => {
            if (!description) return '';
            if (typeof description === 'string') return description;
            try {
                return JSON.stringify(description);
            } catch (_) {
                return '';
            }
        };

        const candidates = [];
        try {
            const byHash = await version3Client.issueSearch.searchForIssuesUsingJqlPost({
                jql: buildOutcomeDuplicateHashJql(projectKey, hashLabel),
                maxResults: 5,
                fields: ['summary', 'labels', 'description'],
            });
            if (Array.isArray(byHash?.issues)) candidates.push(...byHash.issues);
        } catch (error) {
            logger.warn('Outcome intake dedupe hash lookup failed', { projectKey, error: error?.message });
        }
        if (!candidates.length) {
            try {
                const byOutcomeStory = await version3Client.issueSearch.searchForIssuesUsingJqlPost({
                    jql: buildOutcomeDuplicateLabelJql(projectKey),
                    maxResults: 30,
                    fields: ['summary', 'labels', 'description'],
                });
                if (Array.isArray(byOutcomeStory?.issues)) candidates.push(...byOutcomeStory.issues);
            } catch (error) {
                logger.warn('Outcome intake dedupe label lookup failed', { projectKey, error: error?.message });
            }
        }

        const narrativeFragment = normalizeNarrativeText(rawNarrative).slice(0, 200);
        const match = candidates
            .map((issue) => {
                const issueSummary = String(issue?.fields?.summary || '');
                const issueText = `${issueSummary} ${asPlainText(issue?.fields?.description).slice(0, 400)}`;
                const hasHash = Array.isArray(issue?.fields?.labels) && issue.fields.labels.includes(hashLabel);
                const similarity = hasHash
                    ? 1
                    : Math.max(
                        jaccardSimilarity(summaryBase, issueSummary),
                        jaccardSimilarity(narrativeFragment, issueText)
                    );
                return {
                    key: issue?.key || '',
                    summary: issueSummary,
                    similarity,
                };
            })
            .filter((item) => item.key)
            .sort((a, b) => b.similarity - a.similarity)[0] || null;

        if (match && match.similarity >= 0.8 && !createAnyway) {
            const existingUrl = host ? `${host.replace(/\/+$/, '')}/browse/${match.key}` : '';
            return res.status(409).json({
                code: 'POSSIBLE_DUPLICATE_OUTCOME',
                message: `Looks like ${match.key} already exists - use existing or create anyway.`,
                duplicate: {
                    key: match.key,
                    summary: match.summary,
                    similarity: Number(match.similarity.toFixed(2)),
                    url: existingUrl,
                },
            });
        }

        const issueTypeName = (req.body && typeof req.body.issueTypeName === 'string' && req.body.issueTypeName.trim())
            ? req.body.issueTypeName.trim()
            : 'Epic';

        const createPayload = {
            fields: {
                summary,
                description: rawNarrative,
                project: { key: projectKey },
                issuetype: { name: issueTypeName },
                labels,
            },
        };

        const created = await version3Client.issues.createIssue(createPayload);
        const key = (created && (created.key || created.id)) || null;
        const url = (host && key) ? `${host.replace(/\/+$/, '')}/browse/${key}` : '';

        logger.info('Outcome issue created from narrative', { projectKey, key, labels, hashLabel });
        return res.json({
            ok: true,
            key,
            url,
            dedupe: match && match.similarity >= 0.8 ? { bypassed: true, key: match.key } : null,
        });
    } catch (error) {
        logger.error('Error creating outcome issue from narrative', { error: error.message });
        return res.status(500).json({
            error: 'Failed to create Jira issue from narrative',
            message: error && error.message ? error.message : 'Unexpected error while creating issue',
        });
    }
});

router.post('/export', requireAuth, (req, res) => {
    try {
        const { columns, rows } = req.body;
        if (!Array.isArray(columns) || !Array.isArray(rows)) return res.status(400).json({ error: 'Invalid request' });
        streamCSV(columns, rows, res);
    } catch (error) {
        logger.error('Error exporting CSV', error);
        res.status(500).json({ error: 'Failed to export CSV' });
    }
});

router.post('/export-excel', requireAuth, async (req, res) => {
    try {
        const { workbookData, meta } = req.body;
        if (!workbookData || !Array.isArray(workbookData.sheets)) return res.status(400).json({ error: 'Invalid request' });
        const buffer = await generateExcelWorkbook(workbookData);
        const filename = meta ? generateExcelFilename(meta) : 'jira-report.xlsx';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        logger.error('Error exporting Excel', error);
        res.status(500).json({ error: 'Failed to export Excel' });
    }
});

const feedbackRateLimitByIp = (function () {
    const map = new Map();
    const WINDOW_MS = 60 * 1000;
    const MAX_PER_WINDOW = 3;
    return {
        check(ip) {
            const now = Date.now();
            let record = map.get(ip);
            if (record && now > record.resetAt) {
                map.delete(ip);
                record = null;
            }
            if (!record) {
                map.set(ip, { count: 1, resetAt: now + WINDOW_MS });
                return true;
            }
            if (record.count >= MAX_PER_WINDOW) return false;
            record.count += 1;
            return true;
        }
    };
})();

router.post('/feedback', async (req, res) => {
    try {
        const { email, message } = req.body || {};
        const trimmedMessage = typeof message === 'string' ? message.trim() : '';
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '';
        if (!trimmedMessage) return res.status(400).json({ error: 'Message required' });
        if (!feedbackRateLimitByIp.check(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });
        await mkdir(FEEDBACK_DIR, { recursive: true });
        const feedbackEntry = {
            submittedAt: new Date().toISOString(),
            email: typeof email === 'string' ? email.trim() : '',
            message: trimmedMessage,
            userAgent: req.headers['user-agent'] || '',
            ip,
            user: (req.session && req.session.user) ? { id: req.session.user.id } : null,
        };
        await appendFile(FEEDBACK_FILE, `${JSON.stringify(feedbackEntry)}\n`, 'utf-8');
        res.json({ ok: true });
    } catch (error) {
        logger.error('Failed to save feedback', { error: error.message });
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

router.post('/api/test/clear-cache', async (req, res) => {
    if (!appEnvConfig.allowTestCacheClear) return res.status(404).json({ error: 'Not found' });
    await cache.clear();
    res.json({ ok: true });
});

router.get('/api/cache-metrics', requireAuth, (req, res) => {
    const metrics = cache.getMetricsSnapshot();
    res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        ...metrics,
    });
});

router.get('/preview.json', requireAuth, previewHandler);

export default router;
