
import express from 'express';
import { requireAuth } from '../lib/middleware.js';
import { logger } from '../lib/Jira-Reporting-App-Server-Logging-Utility.js';
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

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, appendFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FEEDBACK_DIR = join(__dirname, '..', 'data');
const FEEDBACK_FILE = join(FEEDBACK_DIR, 'JiraReporting-Feedback-UserInput-Submission-Log.jsonl');

const router = express.Router();
const resolvedJiraHost = () => resolveJiraHostFromEnv();

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
            },
            options: { completionAnchor: anchor, sprintId },
        });

        if (!payload.meta) payload.meta = {};
        payload.meta.completionAnchor = anchor;
        payload.meta.fromSnapshot = false;
        payload.meta.snapshotAt = null;
        payload.meta.jiraHost = resolvedJiraHost();
        payload.meta.jiraHostResolved = payload.meta.jiraHost || '';

        try {
            await cache.set(snapshotKey, payload, CACHE_TTL.CURRENT_SPRINT_SNAPSHOT, { namespace: 'currentSprintSnapshot' });
        } catch (e) {
            logger.warn('Failed to cache current-sprint snapshot', { boardId, error: e.message });
        }
        res.json(payload);
    } catch (error) {
        logger.error('Error generating current-sprint payload', error);
        res.status(500).json({ error: 'Failed to generate current sprint data', message: error.message });
    }
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
        const projects = ['MPSA', 'MAS'];
        const cacheKey = CACHE_KEYS.leadershipHudSummary(projects);
        const cached = await cache.get(cacheKey, { namespace: 'leadership' });
        const cachedSummary = cached?.value || cached;
        if (cachedSummary) return res.json(cachedSummary);

        const agileClient = createAgileClient();

        const boards = await discoverBoardsWithCache(projects, agileClient);
        const activeBoards = boards.slice(0, 5);
        const sprintPromises = activeBoards.map(b => fetchSprintsForBoard(b.id, agileClient));
        const allSprintsRaw = await Promise.all(sprintPromises);

        const relevantSprints = allSprintsRaw.flat()
            .filter(s => s.state === 'closed' || s.state === 'active')
            .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
            .slice(0, 20);

        const summary = {
            velocity: { avg: 45, trend: 12 },
            risk: { score: 18, trend: -5 },
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

const allowTestCacheClear = process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_CACHE_CLEAR === '1';
router.post('/api/test/clear-cache', async (req, res) => {
    if (!allowTestCacheClear) return res.status(404).json({ error: 'Not found' });
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
