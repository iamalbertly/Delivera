// SIZE-EXEMPT: Central API surface keeps route handlers co-located for auth, caching, and
// error-contract consistency across report/current-sprint/outcome flows.
import express from 'express';
import { requireAuth, requireSuperAdmin } from '../lib/middleware.js';
import { logger, buildRequestLogContext } from '../lib/Delivera-Server-Logging-Utility.js';
import { cache, CACHE_TTL, CACHE_KEYS, buildCurrentSprintSnapshotCacheKey } from '../lib/cache.js';
import { createAgileClient, createVersion3Client } from '../lib/jiraClients.js';
import { fetchSprintsForBoard } from '../lib/sprints.js';
import { buildCurrentSprintPayload } from '../lib/currentSprint.js';
import { projectSquadSprintTruth } from '../lib/Delivera-Governance-Sprint-Reality-01SSOT.js';
import { readSquadSprintTruthBatch, writeSquadSprintTruth } from '../lib/Delivera-Governance-Squad-Sprint-Truth-02Store-IO.js';
import { readGovernanceRegistry, updateGovernanceRegistryBatch, updateGovernanceRegistrySquad } from '../lib/Delivera-Governance-Registry-01Store-IO.js';
import { assertTruthConsistency, buildDeliveryTruthContext } from '../lib/Delivera-Governance-Delivery-Truth-01SSOT.js';
import { streamCSV, CSV_COLUMNS } from '../lib/csv.js';
import { generateExcelWorkbook, generateExcelFilename, formatDateRangeForFilename } from '../lib/excel.js';
import { getQuarterLabelAndPeriod, getQuartersUpToCurrent } from '../lib/Delivera-Data-VodacomQuarters-01Bounds.js';
import { DEFAULT_WINDOW_START, DEFAULT_WINDOW_END } from '../lib/Delivera-Config-DefaultWindow.js';
import { discoverBoardsWithCache, discoverFieldsWithCache, recordActivity, resolveJiraHostFromEnv } from '../lib/server-utils.js';
import { normalizeNotesPayload, upsertCurrentSprintNotes } from '../lib/notes-store.js';
import { previewHandler } from '../lib/preview-handler.js';
import { getUnifiedRiskCounts } from '../public/Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
import { appEnvConfig, jiraEnvConfig } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';
import {
    readReportContextFromSession,
    writeReportContextToSession,
    normalizeReportContext,
} from '../lib/Delivera-User-Context-SSOT.js';
import { parseOutcomeIntake } from '../public/Delivera-Shared-Outcome-Intake-Parser.js';
import { jaccardSimilarity } from '../lib/Delivera-Outcome-Similarity-01Core.js';
import { buildBoardStyleProfile } from '../lib/Delivera-Outcome-Board-Style-Profile.js';
import { buildOutcomeDraft } from '../lib/Delivera-Outcome-Draft-Builder.js';
import { resolveProviderConfig, parseViaNarrative, testProviderConfig } from '../lib/Delivera-AI-Provider-Gateway.js';
import { buildAiProviderStatus } from '../lib/Delivera-AI-Provider-Status-01SSOT.js';
import { assembleGovernanceBrief } from '../lib/Delivera-Governance-Brief-03Assemble-Service.js';
import { savePIBaseline, getLatestPIBaseline, listPIBaselines } from '../lib/Delivera-Governance-PIBaseline-01Store-IO.js';
import {
    runProposePipeline,
} from '../lib/Delivera-Governance-PIBaseline-03Propose-Agent.js';
import { createPiBaselineSlideUploadHandler } from './Delivera-Governance-PIBaseline-Slide-Upload-01Route.js';
import { recordNarrationPattern } from '../lib/Delivera-Governance-Narration-Knowledge-IO.js';
import { recordAdoptionMetric, summarizeAdoptionMetrics } from '../lib/Delivera-Governance-Adoption-Metrics-IO.js';
import {
    readPendingInboxItems,
    resolveInboxItem,
    readRecentJobs,
    groupInboxByType,
} from '../lib/Delivera-Governance-Worker-02Jobs-IO.js';
import { buildWorkerReceipt } from '../lib/Delivera-Governance-Worker-03Receipt-SSOT.js';
import { buildScopeIntelligence } from '../lib/Delivera-Governance-BoardIntelligence-01Scope-SSOT.js';
import { buildPIConfidenceStrip } from '../lib/Delivera-Governance-PIConfidence-01Strip-SSOT.js';
import { buildFeedbackTriageSummary } from '../lib/Delivera-Governance-FeedbackTriage-01Agents-SSOT.js';
import { buildAiUsageSummary } from '../lib/Delivera-AI-Usage-01Audit-IO.js';
import { recordImprovementEvent } from '../lib/Delivera-Improvement-Events-01Store-IO.js';
import { buildAiContributionSummary } from '../lib/Delivera-Agent-Queue-01Store-IO.js';
import {
    resolveEffectiveGovernanceProfile,
    saveProfileOverride,
    listProfileOverrides,
} from '../lib/Delivera-Governance-Profile-01Resolve-SSOT.js';
import { buildImpactPack, impactPackMonthKey } from '../lib/Delivera-Governance-Worker-05ImpactPack-Builder.js';
import { clampConfidenceToFreshness } from '../lib/Delivera-Governance-Grammar-01Rules-SSOT.js';
import { buildQuarterlyKPIForProjects } from '../lib/Delivera-Data-QuarterlyKPI-Calculator.js';
import { readQuarterLabelIndex, rememberQuarterLabel } from '../lib/Delivera-Governance-Quarter-Labels-01Index-SSOT.js';
import { PROJECT_CATALOG, readCatalogKeys } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import { getAccessMap } from '../lib/Delivera-Shared-Projects-Access-01Index-SSOT.js';
import { refreshProjectsAccessBatch } from '../lib/Delivera-Shared-Projects-Access-02Refresh-Worker.js';
import { runWithTimeoutGuard } from '../lib/Delivera-Server-Async-Timeout-Guard.js';
import { buildJiraIssueUrl, escapeHtml } from '../lib/Delivera-Server-Url-And-Escape-Helpers.js';
import { postIssueComment } from '../lib/Delivera-Jira-Issue-Comment-Post-Service.js';
import {
    appendJiraActivityEntry,
    readJiraActivityEntries,
    findJiraActivityEntry,
    updateJiraActivityEntry,
} from '../lib/Delivera-Data-JiraActivity-01AuditLog-IO.js';
import { undoJiraComment } from '../lib/Delivera-Data-JiraActivity-02CommentUndo-01Service.js';
import {
    addBusinessDays,
    buildActiveGovernanceAnswer,
    reconcilePromiseCaseProjection,
    projectActiveGovernanceLayer1,
    validateAmendment,
} from '../lib/Delivera-Governance-ActiveLoop-01Domain-SSOT.js';
import { GOVERNANCE_STORY_DETAIL_NAMESPACE, governanceBriefCacheKey, governanceStoryCacheKey, governanceRefreshScopeKey, clearWarmGovernanceStory, readWarmGovernanceStory, rememberWarmGovernanceStory } from '../lib/Delivera-Governance-Story-Cache-01SSOT.js';
import {
    appendActiveLoopEvent,
    appendVersionedActiveLoopEvent,
    currentPromiseVersion,
    projectActiveLoopCases,
    readActiveLoopEvents,
} from '../lib/Delivera-Governance-ActiveLoop-02Store-IO.js';
import {
    ingestJiraGovernanceWebhook,
    ingestTeamsGovernanceNotification,
} from '../lib/Delivera-Governance-ActiveLoop-03Event-Ingestion-Service.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, appendFile } from 'fs/promises';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FEEDBACK_DIR = join(__dirname, '..', 'data');
const FEEDBACK_FILE = join(FEEDBACK_DIR, 'Delivera-Feedback-UserInput-Submission-Log.jsonl');
const LEGACY_FEEDBACK_FILE = join(FEEDBACK_DIR, 'JiraReporting-Feedback-UserInput-Submission-Log.jsonl');
const OUTCOME_INTAKE_LOG_FILE = join(FEEDBACK_DIR, 'Delivera-Outcome-Intake-Log.jsonl');
const LEGACY_OUTCOME_INTAKE_LOG_FILE = join(FEEDBACK_DIR, 'JiraReporting-Outcome-Intake-Log.jsonl');
const OUTCOME_CREATE_META_TTL = 20 * 60 * 1000;

const router = express.Router();
const serverStartTime = Date.now();
const resolvedJiraHost = () => resolveJiraHostFromEnv();
const activeRefreshJobs = new Map();

async function attachCurrentSprintTruthContext(payload, projectKeys = []) {
    if (!payload || typeof payload !== 'object') return payload;
    const registry = await readGovernanceRegistry();
    const keys = [...new Set(projectKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean))].sort();
    const contexts = keys.map((squadId) => buildDeliveryTruthContext({
        squad: {
            squad: squadId,
            sprintReality: payload.meta?.sprintReality || projectSquadSprintTruth(payload),
            workSplit: payload.meta?.workSplit || {},
        },
        registry,
        projectKeys: [squadId],
        dataAsOf: payload.meta?.snapshotAt || payload.meta?.generatedAt || new Date().toISOString(),
        source: payload.meta?.stale ? 'Last verified Jira sprint snapshot' : 'Jira active sprint',
        confidence: payload.meta?.stale ? 'stale' : (payload.meta?.partialPermissions ? 'limited' : 'high'),
    }));
    assertTruthConsistency(contexts);
    payload.contexts = contexts;
    payload.context = contexts.length === 1 ? contexts[0] : null;
    payload.meta = { ...(payload.meta || {}), registryVersion: registry.version, truthHashes: Object.fromEntries(contexts.map((item) => [item.squadId, item.truthHash])) };
    return payload;
}

async function invalidateDeliveryTruthCaches() {
    clearWarmGovernanceStory();
    await Promise.all([
        cache.invalidateByPrefix('governanceBrief:'),
        cache.invalidateByPrefix('governanceStoryV2:'),
        cache.invalidateCurrentSprintSnapshot({}),
    ]);
}

router.get('/healthz', async (req, res) => {
  let redis = null;
  try {
    redis = await cache.pingRedis();
  } catch (_) {
    redis = false;
  }

  res.status(200).json({
    ok: true,
    ready: true,
    instanceId: appEnvConfig.instanceId,
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    redis,
  });
});

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

function normalizeOutcomeTitle(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[–—]/g, '-')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildOutcomeItemHash(text) {
    const input = normalizeOutcomeTitle(text).slice(0, 180);
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0).toString(16).slice(0, 8);
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

function capSummary(value, max = 180) {
    const text = String(value || '').trim() || 'Outcome from narrative';
    return text.length > max ? text.slice(0, max - 3).trimEnd() + '...' : text;
}

function ensureLabels(baseLabels, projectKey) {
    const labels = Array.isArray(baseLabels)
        ? baseLabels.map((l) => String(l || '').trim()).filter(Boolean)
        : [];
    if (!labels.includes('OutcomeStory')) labels.push('OutcomeStory');
    if (!labels.includes('quarterly-planning')) labels.push('quarterly-planning');
    if (!labels.some((l) => /^Squad_/i.test(l))) labels.push(`Squad_${projectKey}`);
    return Array.from(new Set(labels));
}

function normalizeIssueTypeToken(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isParentFieldMeta(fieldMeta) {
    const fieldId = normalizeIssueTypeToken(fieldMeta?.fieldId);
    const key = normalizeIssueTypeToken(fieldMeta?.key);
    const name = normalizeIssueTypeToken(fieldMeta?.name);
    return fieldId === 'parent' || key === 'parent' || name === 'parent';
}

function isEpicLinkFieldMeta(fieldMeta, epicLinkFieldId) {
    if (!fieldMeta) return false;
    if (epicLinkFieldId && String(fieldMeta.fieldId || '') === String(epicLinkFieldId)) return true;
    const fieldId = normalizeIssueTypeToken(fieldMeta?.fieldId);
    const key = normalizeIssueTypeToken(fieldMeta?.key);
    const name = normalizeIssueTypeToken(fieldMeta?.name);
    return fieldId === 'epiclink' || key === 'epiclink' || name === 'epiclink';
}

function extractJiraErrorData(error) {
    const direct = error?.response?.data;
    if (direct && typeof direct === 'object') return direct;
    const response = error?.response;
    if (response && typeof response === 'object' && (response.errorMessages || response.errors)) return response;
    const nested = error?.cause?.response?.data;
    if (nested && typeof nested === 'object') return nested;
    const data = error?.data;
    if (data && typeof data === 'object') return data;
    return {};
}

function formatJiraValidationMessage(error) {
    const jiraData = extractJiraErrorData(error);
    const errorMessages = Array.isArray(jiraData?.errorMessages) ? jiraData.errorMessages.filter(Boolean) : [];
    const fieldErrors = jiraData?.errors && typeof jiraData.errors === 'object' ? jiraData.errors : {};
    const formattedFieldErrors = Object.entries(fieldErrors)
        .map(([field, message]) => `${field}: ${message}`)
        .filter(Boolean);
    return [...errorMessages, ...formattedFieldErrors].join(' | ') || error?.message || 'Jira rejected the issue payload.';
}

// One-tap comment endpoint used by the UI to post guided nudges to Jira issues
router.post('/api/issues/:issueKey/comment', requireAuth, async (req, res) => {
    try {
        const issueKey = String(req.params.issueKey || '').trim();
        const commentBody = typeof req.body?.commentBody === 'string' ? String(req.body.commentBody).trim() : '';
        if (!issueKey) return res.status(400).json({ error: 'Missing issue key', code: 'MISSING_ISSUE_KEY' });
        if (!commentBody) return res.status(400).json({ error: 'Missing comment body', code: 'MISSING_COMMENT_BODY' });

        const version3Client = createVersion3Client();
        let result = null;
        try {
            const teamRoster = Array.isArray(req.body?.teamRoster) ? req.body.teamRoster : [];
            result = await postIssueComment(version3Client, issueKey, commentBody, { roster: teamRoster });
        } catch (err) {
            logger.warn('Jira comment failed', { issueKey, error: err?.message });
            const httpStatus = err?.httpStatus || err?.response?.status || err?.status || 500;
            const errMsg = err?.message || 'Failed to post comment';
            const code = err?.code || 'JIRA_COMMENT_FAILED';
            return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500).json({ error: errMsg, code });
        }

        let activityId = null;
        try {
            const commentId = result?.id || result?.commentId || null;
            const activityRow = await appendJiraActivityEntry({
                user: req.user?.id || req.user?.email || 'unknown',
                issueKey,
                commentId,
                bodyPreview: commentBody,
                sprintId: req.body?.sprintId,
                boardId: req.body?.boardId,
                status: 'sent',
            });
            activityId = activityRow?.id || null;
        } catch (auditErr) {
            logger.warn('Jira activity audit append failed', { issueKey, error: auditErr?.message });
        }

        return res.json({
            success: true,
            comment: result || null,
            commentId: result?.id || result?.commentId || null,
            activityId,
            auditId: activityId,
        });
    } catch (error) {
        logger.error('Comment endpoint error', { error: error?.message });
        const httpStatus = error?.response?.status || error?.status || 500;
        const errMsg = error?.response?.data?.errorMessages?.[0] || error?.message || 'Failed to post comment';
        return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500).json({ error: errMsg, code: 'JIRA_COMMENT_FAILED' });
    }
});

router.get('/api/jira-activity', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
        const entries = await readJiraActivityEntries({ limit });
        return res.json({ entries });
    } catch (error) {
        logger.error('Jira activity list failed', { error: error?.message });
        return res.status(500).json({ error: 'Failed to load activity', code: 'JIRA_ACTIVITY_READ_FAILED' });
    }
});

router.post('/api/jira-activity/:id/undo', requireAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: 'Missing activity id', code: 'MISSING_ACTIVITY_ID' });
        const entry = await findJiraActivityEntry(id);
        if (!entry) return res.status(404).json({ error: 'Activity not found', code: 'ACTIVITY_NOT_FOUND' });
        if (entry.status === 'undone') {
            return res.json({ success: true, entry, alreadyUndone: true });
        }
        if (!entry.commentId) {
            return res.status(422).json({
                error: 'No Jira comment id stored — open the issue in Jira to edit manually.',
                code: 'UNDO_NO_COMMENT_ID',
            });
        }
        const version3Client = createVersion3Client();
        try {
            await undoJiraComment(version3Client, entry.issueKey, entry.commentId);
        } catch (err) {
            const httpStatus = err?.httpStatus || 500;
            await updateJiraActivityEntry(id, {
                status: 'undo_failed',
                undoReason: err?.message || 'Jira undo failed',
            });
            return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500).json({
                error: err?.message || 'Could not undo in Jira',
                code: err?.code || 'JIRA_UNDO_FAILED',
            });
        }
        const updated = await updateJiraActivityEntry(id, { status: 'undone', undoReason: '' });
        return res.json({ success: true, entry: updated });
    } catch (error) {
        logger.error('Jira activity undo failed', { error: error?.message });
        return res.status(500).json({ error: 'Undo failed', code: 'JIRA_ACTIVITY_UNDO_FAILED' });
    }
});


function buildOutcomeHttpError({ status = 422, code = 'OUTCOME_CREATE_FAILED', message, details = null }) {
    const error = new Error(message || 'Outcome creation failed');
    error.httpStatus = status;
    error.clientPayload = {
        error: message || 'Outcome creation failed',
        code,
        message: message || 'Outcome creation failed',
        details,
    };
    return error;
}

function issueTypeIntentScore(issueType, intent, requestedName = '') {
    const name = String(issueType?.name || '');
    const normalized = normalizeIssueTypeToken(name);
    const requested = normalizeIssueTypeToken(requestedName);
    const hierarchyLevel = Number(issueType?.hierarchyLevel);
    let score = 0;
    if (requested) {
        if (normalized === requested) return 5000;
        return -1000;
    }
    if (intent === 'subtask') {
        if (issueType?.subtask) score += 1000;
        if (normalized.includes('subtask')) score += 300;
        return score;
    }
    if (issueType?.subtask) return -1000;

    const isEpicLike = /(epic|feature|initiative|outcome|capabilit|theme)/i.test(name);
    const isStoryLike = /(story|task|issue|work\s*item|request)/i.test(name);
    const isBugLike = /(bug|incident|problem)/i.test(name);

    if (intent === 'epic') {
        if (hierarchyLevel > 0) score += 600;
        if (isEpicLike) score += 450;
        if (isStoryLike) score += 80;
        if (hierarchyLevel === 0) score += 20;
        if (isBugLike) score -= 400;
        return score;
    }

    if (isStoryLike) score += 450;
    if (hierarchyLevel === 0) score += 220;
    if (isEpicLike) score -= 260;
    if (isBugLike) score -= 320;
    return score;
}

function resolveLinkModeForIssueType(issueType, epicLinkFieldId) {
    const fields = Array.isArray(issueType?.fields) ? issueType.fields : [];
    const epicLinkField = fields.find((fieldMeta) => isEpicLinkFieldMeta(fieldMeta, epicLinkFieldId));
    if (epicLinkField) {
        return {
            mode: 'epicLink',
            fieldId: epicLinkField.fieldId || epicLinkField.key || epicLinkField.name || '',
        };
    }
    if (fields.some(isParentFieldMeta)) {
        return { mode: 'parent', fieldId: 'parent' };
    }
    return { mode: 'none', fieldId: '' };
}

function getUnsupportedRequiredFields(issueType, options = {}) {
    const { epicLinkFieldId = null, linkMode = 'none', linkFieldId = '' } = options;
    const provided = new Set([
        'summary',
        'description',
        'labels',
        'project',
        'issuetype',
    ].map(normalizeIssueTypeToken));
    if (linkMode === 'parent') provided.add('parent');
    if (linkMode === 'epicLink' && epicLinkFieldId) provided.add(normalizeIssueTypeToken(epicLinkFieldId));
    if (linkMode === 'epicLink' && linkFieldId) provided.add(normalizeIssueTypeToken(linkFieldId));
    if (linkMode === 'epicLink') provided.add('epiclink');

    return (Array.isArray(issueType?.fields) ? issueType.fields : [])
        .filter((fieldMeta) => fieldMeta?.required && !fieldMeta?.hasDefaultValue)
        .filter((fieldMeta) => {
            const candidates = [
                fieldMeta.fieldId,
                fieldMeta.key,
                fieldMeta.name,
            ].map(normalizeIssueTypeToken).filter(Boolean);
            return !candidates.some((candidate) => provided.has(candidate));
        })
        .map((fieldMeta) => ({
            fieldId: fieldMeta.fieldId || '',
            key: fieldMeta.key || '',
            name: fieldMeta.name || fieldMeta.fieldId || 'Unknown field',
        }));
}

async function discoverOutcomeProjectCreateMeta(version3Client, projectKey) {
    const normalizedProjectKey = String(projectKey || '').trim().toUpperCase();
    const cacheKey = `outcomeCreateMeta:${normalizedProjectKey}`;
    const cached = await cache.get(cacheKey, { namespace: 'discovery' });
    const cachedValue = cached?.value || cached;
    if (cachedValue?.projectKey === normalizedProjectKey && Array.isArray(cachedValue?.issueTypes)) {
        return cachedValue;
    }

    const page = await version3Client.issues.getCreateIssueMetaIssueTypes({
        projectIdOrKey: normalizedProjectKey,
        maxResults: 100,
    });
    const issueTypes = Array.isArray(page?.issueTypes) ? page.issueTypes : (Array.isArray(page?.createMetaIssueType) ? page.createMetaIssueType : []);
    const detailedIssueTypes = [];

    for (const issueType of issueTypes) {
        const issueTypeId = String(issueType?.id || '').trim();
        if (!issueTypeId) continue;
        let fields = [];
        try {
            const fieldsPage = await version3Client.issues.getCreateIssueMetaIssueTypeId({
                projectIdOrKey: normalizedProjectKey,
                issueTypeId,
                maxResults: 200,
            });
            fields = Array.isArray(fieldsPage?.fields) ? fieldsPage.fields : (Array.isArray(fieldsPage?.results) ? fieldsPage.results : []);
        } catch (error) {
            logger.warn('Outcome intake create field metadata lookup failed', {
                projectKey: normalizedProjectKey,
                issueTypeId,
                issueTypeName: issueType?.name || '',
                error: error?.message,
            });
        }
        detailedIssueTypes.push({
            id: issueTypeId,
            name: String(issueType?.name || '').trim(),
            subtask: issueType?.subtask === true,
            hierarchyLevel: Number.isFinite(Number(issueType?.hierarchyLevel)) ? Number(issueType.hierarchyLevel) : null,
            fields: fields.map((fieldMeta) => ({
                fieldId: fieldMeta?.fieldId || '',
                key: fieldMeta?.key || '',
                name: fieldMeta?.name || fieldMeta?.fieldId || '',
                required: fieldMeta?.required === true,
                hasDefaultValue: fieldMeta?.hasDefaultValue === true,
            })),
        });
    }

    const result = {
        projectKey: normalizedProjectKey,
        issueTypes: detailedIssueTypes,
    };
    await cache.set(cacheKey, result, OUTCOME_CREATE_META_TTL, { namespace: 'discovery' });
    return result;
}

function resolveOutcomeIssueType(projectMeta, options = {}) {
    const { intent = 'story', requestedName = '', epicLinkFieldId = null, requireChildLink = false } = options;
    const issueTypes = Array.isArray(projectMeta?.issueTypes) ? projectMeta.issueTypes : [];
    const ranked = issueTypes
        .map((issueType) => {
            const link = requireChildLink ? resolveLinkModeForIssueType(issueType, epicLinkFieldId) : { mode: 'none', fieldId: '' };
            const missingRequiredFields = getUnsupportedRequiredFields(issueType, {
                epicLinkFieldId,
                linkMode: link.mode,
                linkFieldId: link.fieldId,
            });
            return {
                issueType,
                linkMode: link.mode,
                linkFieldId: link.fieldId,
                missingRequiredFields,
                score: issueTypeIntentScore(issueType, intent, requestedName),
            };
        })
        .filter((entry) => entry.score > 0)
        .filter((entry) => !requireChildLink || entry.linkMode !== 'none')
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.missingRequiredFields.length !== b.missingRequiredFields.length) return a.missingRequiredFields.length - b.missingRequiredFields.length;
            return String(a.issueType?.name || '').localeCompare(String(b.issueType?.name || ''));
        });

    const supportedNames = issueTypes.map((issueType) => issueType.name).filter(Boolean);
    const viable = ranked.find((entry) => entry.missingRequiredFields.length === 0) || null;
    const best = viable || ranked[0] || null;

    return {
        viable,
        best,
        supportedNames,
    };
}

async function appendOutcomeIntakeLog(entry) {
    await mkdir(FEEDBACK_DIR, { recursive: true });
    const line = `${JSON.stringify(entry)}\n`;
    // Migration edge case: keep writing the legacy log file so older local tools keep working.
    await Promise.all([
        appendFile(OUTCOME_INTAKE_LOG_FILE, line, 'utf-8'),
        appendFile(LEGACY_OUTCOME_INTAKE_LOG_FILE, line, 'utf-8'),
    ]);
}

function buildIssueUrl(host, issueKey) {
    return buildJiraIssueUrl(host, issueKey);
}

function renderIssueTypePhrase(issueTypeName, fallback) {
    const text = String(issueTypeName || fallback || 'Jira issue').trim();
    if (!text) return 'Jira issue';
    return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildOutcomeSummaryHtml(payload) {
    const projectKey = escapeHtml(payload.projectKey || '');
    const failures = Array.isArray(payload.failures) ? payload.failures : [];
    const verification = payload.verification || null;
    const verificationBits = [];
    if (verification?.createdIssueCount > 0) {
        if (verification.fetchVerified) {
            verificationBits.push('Verified in Jira');
        } else if (verification.missingKeys?.length) {
            verificationBits.push(`Jira verification failed for ${verification.missingKeys.map((item) => escapeHtml(item)).join(', ')}`);
        }
        if (verification.boardName && verification.backlogTopVerified) {
            verificationBits.push(`placed at the top of ${escapeHtml(verification.boardName)} backlog`);
        } else if (verification.boardName && verification.backlogVisibleKeys?.length) {
            verificationBits.push(`visible in ${escapeHtml(verification.boardName)} backlog but not at the top yet`);
        } else if (verification.boardName && verification.backlogErrors?.length) {
            verificationBits.push(`backlog validation failed on ${escapeHtml(verification.boardName)}`);
        } else if (verification.createdIssueCount > 0) {
            verificationBits.push('backlog placement could not be verified');
        }
        if (verification.hierarchyVerified === false && verification.hierarchyMismatches?.length) {
            verificationBits.push(`hierarchy mismatch on ${verification.hierarchyMismatches.map((item) => escapeHtml(item.key)).join(', ')}`);
        } else if (verification.fetchVerified) {
            verificationBits.push('hierarchy level verified');
        }
    }
    const verificationSuffix = verificationBits.length ? ` ${verificationBits.join(' and ')}.` : '';
    if (payload.structureMode === 'STORY_WITH_SUBTASKS' && payload.primary?.key) {
        const storyLink = payload.primary.url
            ? `<a href="${escapeHtml(payload.primary.url)}" target="_blank" rel="noopener">${escapeHtml(payload.primary.key)}</a>`
            : escapeHtml(payload.primary.key);
        const parentLabel = renderIssueTypePhrase(payload.primaryIssueTypeName, 'parent issue');
        const childLabel = renderIssueTypePhrase(payload.childIssueTypeName, 'child issue');
        const successBase = `Created ${escapeHtml(parentLabel)} ${storyLink} with ${payload.childIssues.length} ${escapeHtml(childLabel)}${payload.childIssues.length === 1 ? '' : 's'} in project ${projectKey} backlog.`;
        if (!failures.length) return `${successBase}${verificationSuffix}`;
        return `${successBase} Created ${payload.createdCount} of ${payload.expectedCreateCount}. Failed on: ${failures.map((item) => escapeHtml(item.title)).join(', ')}.${verificationSuffix}`;
    }
    if (payload.structureMode === 'MULTIPLE_EPICS') {
        const itemLabel = renderIssueTypePhrase(payload.standaloneIssueTypeName, 'Jira item');
        if (!failures.length) return `Created ${payload.createdCount} ${escapeHtml(itemLabel)}${payload.createdCount === 1 ? '' : 's'} in project ${projectKey} backlog.${verificationSuffix}`;
        return `Created ${payload.createdCount} of ${payload.expectedCreateCount} ${escapeHtml(itemLabel)}${payload.expectedCreateCount === 1 ? '' : 's'} in project ${projectKey} backlog. Failed on: ${failures.map((item) => escapeHtml(item.title)).join(', ')}.${verificationSuffix}`;
    }
    if (payload.structureMode === 'TABLE_ISSUES') {
        if (!failures.length) return `Created ${payload.createdCount} Jira issues with descriptions in project ${projectKey} backlog.${verificationSuffix}`;
        return `Created ${payload.createdCount} of ${payload.expectedCreateCount} Jira issues in project ${projectKey} backlog. Failed on: ${failures.map((item) => escapeHtml(item.title)).join(', ')}.${verificationSuffix}`;
    }
    if (payload.structureMode === 'EPIC_WITH_STORIES' && payload.primary?.key) {
        const epicLink = payload.primary.url
            ? `<a href="${escapeHtml(payload.primary.url)}" target="_blank" rel="noopener">${escapeHtml(payload.primary.key)}</a>`
            : escapeHtml(payload.primary.key);
        const childKeys = payload.childIssues.map((item) => item.key).filter(Boolean);
        const childRange = childKeys.length ? ` (${escapeHtml(childKeys[0])}${childKeys.length > 1 ? `-${escapeHtml(childKeys[childKeys.length - 1])}` : ''})` : '';
        const parentLabel = renderIssueTypePhrase(payload.primaryIssueTypeName, 'parent issue');
        const childLabel = renderIssueTypePhrase(payload.childIssueTypeName, 'child issue');
        const successBase = `Created ${escapeHtml(parentLabel)} ${epicLink} with ${payload.childIssues.length} linked ${escapeHtml(childLabel)}${payload.childIssues.length === 1 ? '' : 's'}${childRange} in project ${projectKey} backlog.`;
        if (!failures.length) return `${successBase}${verificationSuffix}`;
        return `${successBase} Created ${payload.createdCount} of ${payload.expectedCreateCount}. Failed on: ${failures.map((item) => escapeHtml(item.title)).join(', ')}.${verificationSuffix}`;
    }
    if (payload.primary?.key) {
        const issueLink = payload.primary.url
            ? `<a href="${escapeHtml(payload.primary.url)}" target="_blank" rel="noopener">${escapeHtml(payload.primary.key)}</a>`
            : escapeHtml(payload.primary.key);
        return `Created 1 Jira issue ${issueLink} in project ${projectKey} backlog.${verificationSuffix}`;
    }
    return `Created Jira work items in project ${projectKey} backlog.${verificationSuffix}`;
}

function pickPrimaryBacklogBoard(boards, projectKey) {
    const normalizedProjectKey = String(projectKey || '').trim().toUpperCase();
    const list = Array.isArray(boards) ? boards : [];
    return list.find((board) => String(board?.location?.projectKey || '').toUpperCase() === normalizedProjectKey && String(board?.type || '').toLowerCase() === 'scrum')
        || list.find((board) => String(board?.location?.projectKey || '').toUpperCase() === normalizedProjectKey)
        || list.find((board) => String(board?.type || '').toLowerCase() === 'scrum')
        || list[0]
        || null;
}

async function verifyOutcomeCreationAndBacklog({
    agileClient,
    version3Client,
    projectKey,
    issueKeys,
    expectedLevelsByKey,
}) {
    const uniqueIssueKeys = Array.from(new Set((issueKeys || []).map((key) => String(key || '').trim().toUpperCase()).filter(Boolean)));
    const verification = {
        createdIssueCount: uniqueIssueKeys.length,
        fetchVerified: false,
        verifiedKeys: [],
        missingKeys: [],
        boardId: null,
        boardName: '',
        rankRequested: false,
        rankApplied: false,
        backlogVisibleKeys: [],
        backlogTopKeys: [],
        backlogTopVerified: false,
        backlogErrors: [],
        issueChecks: [],
        hierarchyVerified: true,
        hierarchyMismatches: [],
    };
    if (!uniqueIssueKeys.length) return verification;

    for (const issueKey of uniqueIssueKeys) {
        try {
            const issue = await version3Client.issues.getIssue({
                issueIdOrKey: issueKey,
                fields: ['summary', 'status', 'project', 'issuetype', 'parent', 'created'],
            });
            verification.verifiedKeys.push(issueKey);
            verification.issueChecks.push({
                key: issueKey,
                fetched: true,
                projectKey: issue?.fields?.project?.key || '',
                issueType: issue?.fields?.issuetype?.name || '',
                status: issue?.fields?.status?.name || '',
            });
            const expectedLevel = expectedLevelsByKey && expectedLevelsByKey[issueKey];
            if (expectedLevel) {
                const issueTypeName = String(issue?.fields?.issuetype?.name || '').toLowerCase();
                const actualLevel = issueTypeName.includes('sub-task') || issueTypeName.includes('subtask')
                    ? 'subtask'
                    : (issueTypeName.includes('epic') || issueTypeName.includes('initiative') || issueTypeName.includes('theme') ? 'epic' : 'story');
                const levelOk = expectedLevel === actualLevel
                    || (expectedLevel === 'parent' && (actualLevel === 'epic' || actualLevel === 'story'))
                    || (expectedLevel === 'child' && (actualLevel === 'story' || actualLevel === 'subtask'))
                    || (expectedLevel === 'standalone' && (actualLevel === 'epic' || actualLevel === 'story'));
                if (!levelOk) {
                    verification.hierarchyVerified = false;
                    verification.hierarchyMismatches.push({
                        key: issueKey,
                        expectedLevel,
                        actualLevel,
                        issueType: issue?.fields?.issuetype?.name || '',
                    });
                }
            }
        } catch (error) {
            verification.missingKeys.push(issueKey);
            verification.issueChecks.push({
                key: issueKey,
                fetched: false,
                error: error?.message || 'Fetch failed',
            });
        }
    }
    verification.fetchVerified = verification.verifiedKeys.length === uniqueIssueKeys.length;

    try {
        const { boards } = await discoverBoardsWithCache([projectKey], agileClient);
        const board = pickPrimaryBacklogBoard(boards, projectKey);
        if (!board?.id) {
            verification.backlogErrors.push(`No matching Scrum board found for ${projectKey}.`);
            return verification;
        }
        verification.boardId = Number(board.id);
        verification.boardName = String(board.name || '');

        const beforeBacklog = await agileClient.board.getIssuesForBacklog({
            boardId: verification.boardId,
            maxResults: Math.max(10, uniqueIssueKeys.length + 5),
            fields: ['summary'],
        });
        const beforeTopKeys = Array.isArray(beforeBacklog?.issues) ? beforeBacklog.issues.map((issue) => issue?.key).filter(Boolean) : [];
        const firstForeignKey = beforeTopKeys.find((key) => !uniqueIssueKeys.includes(String(key || '').toUpperCase())) || '';

        verification.rankRequested = true;
        await agileClient.backlog.moveIssuesToBacklogForBoard({
            boardId: verification.boardId,
            issues: uniqueIssueKeys,
            ...(firstForeignKey ? { rankBeforeIssue: firstForeignKey } : {}),
        });
        verification.rankApplied = true;

        const afterBacklog = await agileClient.board.getIssuesForBacklog({
            boardId: verification.boardId,
            maxResults: Math.max(10, uniqueIssueKeys.length + 5),
            fields: ['summary'],
        });
        const afterTopKeys = Array.isArray(afterBacklog?.issues) ? afterBacklog.issues.map((issue) => String(issue?.key || '').toUpperCase()).filter(Boolean) : [];
        verification.backlogTopKeys = afterTopKeys.slice(0, Math.max(uniqueIssueKeys.length, 5));
        verification.backlogVisibleKeys = uniqueIssueKeys.filter((key) => afterTopKeys.includes(key));
        verification.backlogTopVerified = uniqueIssueKeys.every((key, index) => verification.backlogTopKeys[index] === key);
        if (!verification.backlogVisibleKeys.length) {
            verification.backlogErrors.push(`Created issues are not visible in backlog for board ${verification.boardName || verification.boardId}.`);
        } else if (!verification.backlogTopVerified) {
            verification.backlogErrors.push(`Created issues are visible in backlog for board ${verification.boardName || verification.boardId}, but not at the top.`);
        }
    } catch (error) {
        verification.backlogErrors.push(error?.message || 'Backlog verification failed');
    }

    return verification;
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

async function getCachedGovernanceQuarterLabels() {
    const labels = new Set();
    for (const label of await readQuarterLabelIndex()) {
        if (label) labels.add(label);
    }
    try {
        const entries = await cache.entries({ namespace: 'governanceBrief' });
        for (const entry of entries) {
            const brief = entry?.value || entry;
            const label = brief?.period?.vodacomQuarter;
            if (label) labels.add(String(label).trim());
        }
    } catch (err) {
        logger.warn('quarters-list cached scan failed', { error: err?.message });
    }
    return Array.from(labels);
}

router.get('/api/session-meta.json', requireAuth, (req, res) => {
    const email = jiraEnvConfig.email || '';
    let initials = 'DL';
    if (email) {
        const local = email.split('@')[0] || '';
        const parts = local.split(/[._-]+/).filter(Boolean);
        initials = parts.length >= 2
            ? `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
            : local.slice(0, 2).toUpperCase();
    }
    const emailMasked = email
        ? email.replace(/^(.).+(@.+)$/, '$1***$2')
        : '';
    return res.json({ initials: initials || 'DL', emailMasked });
});

router.post('/api/client-log', requireAuth, (req, res) => {
    const body = req.body || {};
    logger.info('client-fetch-failure', {
        url: String(body.url || '').slice(0, 240),
        status: body.status ?? null,
        message: String(body.message || '').slice(0, 240),
        context: String(body.context || '').slice(0, 80),
        user: req.session?.user || 'unknown',
    });
    return res.json({ ok: true });
});

router.get('/api/quarters-list', requireAuth, async (req, res) => {
    const count = Math.min(20, Math.max(1, parseInt(req.query.count, 10) || 8));
    const calendar = getQuartersUpToCurrent(count).map((q) => ({
        start: q.startISO,
        end: q.endISO,
        label: q.label,
        period: q.period,
        isCurrent: q.isCurrent,
    }));
    const byLabel = new Map(calendar.map((q) => [q.label, q]));
    if (req.query.includeCached === '1' || req.query.includeCached === 'true') {
        for (const label of await getCachedGovernanceQuarterLabels()) {
            if (!label || byLabel.has(label)) continue;
            byLabel.set(label, { start: '', end: '', label, period: label, isCurrent: false, fromCache: true });
        }
    }
    const quarters = Array.from(byLabel.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));
    res.json({ quarters });
});

router.get('/api/default-window', requireAuth, (req, res) => {
    res.json({ start: DEFAULT_WINDOW_START, end: DEFAULT_WINDOW_END });
});

router.get('/api/projects-catalog.json', requireAuth, async (req, res) => {
    try {
        const accessMap = await getAccessMap();
        const profiles = await Promise.all(PROJECT_CATALOG.map((entry) => resolveEffectiveGovernanceProfile({ project: entry.key, userId: req.session?.user || null })));
        const projects = PROJECT_CATALOG.map((entry, index) => {
            const row = accessMap.get(entry.key);
            return {
                ...entry,
                label: profiles[index]?.boardAliases?.[entry.key] || entry.label,
                accessible: row?.accessible ?? null,
                lastChecked: row?.lastChecked ?? null,
            };
        });
        return res.json({ projects, keys: readCatalogKeys() });
    } catch (err) {
        logger.warn('projects-catalog read failed', { error: err?.message });
        return res.status(500).json({ error: 'Catalog read failed' });
    }
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
        const { boards, projectErrors } = await discoverBoardsWithCache(selectedProjects, agileClient);
        const list = boards.map(b => ({
            id: b.id,
            name: b.name,
            type: b.type,
            projectKey: b.location?.projectKey || null,
        }));
        const authish = new Set(['JIRA_UNAUTHORIZED', 'JIRA_FORBIDDEN']);
        const allAuthFail =
            boards.length === 0 &&
            projectErrors.length > 0 &&
            projectErrors.every((e) => authish.has(e.code));
        if (allAuthFail) {
            return res.status(502).json({
                error: 'Jira access failed for all selected projects',
                code: 'JIRA_UNAUTHORIZED',
                message:
                    'Check server Jira API token, host URL, and that the token can browse each selected project.',
                jiraErrors: projectErrors,
                projects: selectedProjects,
                boards: [],
            });
        }
        const jiraHost = resolveJiraHostFromEnv();
        const payload = {
            projects: selectedProjects,
            boards: list,
            jiraBrowseHost: jiraHost ? String(jiraHost).replace(/\/$/, '') : null,
        };
        if (projectErrors.length) {
            payload.jiraErrors = projectErrors;
            payload.projectErrors = projectErrors.map((e) => ({
                project: e.projectKey || e.project,
                code: e.code || 'JIRA_ERROR',
            }));
        }
        res.json(payload);
    } catch (error) {
        logger.error('Error fetching boards', error);
        res.status(500).json({ error: 'Failed to fetch boards', message: error.message });
    }
});

// Backward-compatible endpoints expected by smoke checks and older clients.
const getSprintsHandler = async (req, res) => {
    try {
        const boardIdParam = req.query.boardId;
        const projectsParam = req.query.projects;
        const selectedProjects = projectsParam != null
            ? Array.from(new Set(String(projectsParam).split(',').map((p) => p.trim()).filter(Boolean)))
            : ['MPSA', 'MAS'];
        if (!selectedProjects.length) {
            return res.status(400).json({ error: 'At least one project required', code: 'NO_PROJECTS' });
        }

        const agileClient = createAgileClient();
        const { boards } = await discoverBoardsWithCache(selectedProjects, agileClient);
        const boardId = boardIdParam != null ? Number(boardIdParam) : null;
        const selectedBoard = boardId != null && !Number.isNaN(boardId)
            ? boards.find((board) => Number(board.id) === boardId)
            : boards[0];

        if (!selectedBoard?.id) {
            return res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
        }

        const sprints = await fetchSprintsForBoard(selectedBoard.id, agileClient);
        const list = (Array.isArray(sprints) ? sprints : []).map((sprint) => ({
            id: sprint.id,
            name: sprint.name,
            state: sprint.state,
            startDate: sprint.startDate || null,
            endDate: sprint.endDate || null,
            completeDate: sprint.completeDate || null,
            goal: sprint.goal || '',
            boardId: selectedBoard.id,
            boardName: selectedBoard.name || '',
        }));

        return res.json({
            board: {
                id: selectedBoard.id,
                name: selectedBoard.name || '',
                projectKey: selectedBoard.location?.projectKey || null,
            },
            sprints: list,
        });
    } catch (error) {
        logger.error('Error fetching sprints', error);
        return res.status(500).json({ error: 'Failed to fetch sprints', message: error?.message || 'Unexpected error' });
    }
};
router.get('/api/sprints', requireAuth, getSprintsHandler);
router.get('/api/sprints.json', requireAuth, getSprintsHandler);

router.get('/api/current-sprint/truth.json', requireAuth, async (req, res) => {
    const projects = String(req.query.projects || '').split(',').map((key) => key.trim().toUpperCase()).filter(Boolean);
    if (!projects.length) return res.status(400).json({ error: 'At least one squad is required', code: 'NO_PROJECTS' });
    const truth = await readSquadSprintTruthBatch({ squadKeys: projects, quarter: String(req.query.quarter || 'current') });
    const records = projects.map((squadKey) => truth.get(squadKey)).filter(Boolean);
    res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=300');
    return res.json({ schemaVersion: 1, records });
});

router.get('/api/current-sprint.json', requireAuth, async (req, res) => {
    let snapshotKey = null;
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
        const { boards } = await discoverBoardsWithCache(selectedProjects, agileClient);
        const board = boards.find(b => b.id === boardId);
        if (!board) return res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });

        const projectKeys = board.location?.projectKey ? [board.location.projectKey] : selectedProjects;
        const forceLive = req.query.live === 'true' || req.query.refresh === 'true';
        const completionAnchor = (req.query.completionAnchor || 'resolution').toLowerCase();
        const supportedAnchors = ['resolution', 'lastsubtask', 'statusdone'];
        const anchor = supportedAnchors.includes(completionAnchor) ? completionAnchor : 'resolution';
        snapshotKey = buildCurrentSprintSnapshotCacheKey({
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
                out.meta.sprintReality = projectSquadSprintTruth(out);
                out.meta.sprintTruthVersion = out.meta.sprintReality.version;
                out.meta.sprintTruthHash = out.meta.sprintReality.payloadHash;
                void Promise.all(projectKeys.map((squadKey) => writeSquadSprintTruth({ squadKey, payload: out, checkedBoards: [{ id: board.id, name: board.name, verified: true }] }))).catch(() => {});
                await attachCurrentSprintTruthContext(out, projectKeys);
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
        const activeCount = Number(payload?.meta?.activeSprintCount || 0);
        const noActiveSprintFallback = !sprintId && selectedSprintState === 'closed' && activeCount === 0;
        if (noActiveSprintFallback) {
            payload.meta.noActiveSprintFallback = true;
            const next = payload.nextSprint;
            if (next?.id) {
                // Team has a future sprint planned but hasn't started it — smart limbo detection
                const nextName = String(next.name || '').trim();
                const nextStart = next.startDate ? new Date(next.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
                payload.meta.explanatoryLine = nextName
                    ? `No active sprint — showing last completed. "${nextName}" is planned${nextStart ? ' from ' + nextStart : ''} but not yet started.`
                    : 'No active sprint — showing last completed. A future sprint is planned but not yet started.';
                payload.meta.nextSprintCandidate = { id: next.id, name: nextName, startDate: next.startDate || '', goal: next.goal || '' };
                payload.meta.suggestStartSprint = true;
                // Detect overdue start: planned start date has already passed but sprint was never started
                if (next.startDate) {
                    const plannedStart = new Date(next.startDate).getTime();
                    if (Number.isFinite(plannedStart) && plannedStart < Date.now()) {
                        payload.meta.nextSprintStartOverdue = true;
                    }
                }
            } else {
                payload.meta.explanatoryLine = 'No active sprint — showing last completed sprint.';
            }
        }

        payload.meta.snapshotKey = snapshotKey;
        payload.meta.checkedBoards = [{ id: board.id, name: board.name, verified: true }];
        payload.meta.sprintReality = projectSquadSprintTruth(payload);
        payload.meta.sprintTruthVersion = payload.meta.sprintReality.version;
        payload.meta.sprintTruthHash = payload.meta.sprintReality.payloadHash;

        writeReportContextToSession(req, buildCurrentSprintSessionContext(projectKeys, boardId, payload?.sprint?.id || sprintId));

        try {
            await Promise.all([
                cache.set(snapshotKey, payload, CACHE_TTL.CURRENT_SPRINT_SNAPSHOT, { namespace: 'currentSprintSnapshot' }),
                ...projectKeys.map((squadKey) => writeSquadSprintTruth({ squadKey, payload, checkedBoards: payload.meta.checkedBoards })),
            ]);
        } catch (e) {
            logger.warn('Failed to cache current-sprint snapshot', buildRequestLogContext(req, { boardId, error: e.message }));
        }
        await attachCurrentSprintTruthContext(payload, projectKeys);
        res.json(payload);
    } catch (error) {
        const boardId = req.query?.boardId != null ? Number(req.query.boardId) : null;
        const mapped = mapCurrentSprintError(error);
        if (mapped.httpStatus === 401 || mapped.httpStatus === 403) {
            await cache.invalidateCurrentSprintSnapshot({ boardId }).catch(() => {});
        }
        // Serve stale snapshot on Jira outage (502/503) so teams see data, not an error screen
        const isJiraOutage = mapped.httpStatus === 502 || mapped.httpStatus === 503;
        if (isJiraOutage && snapshotKey) {
            const staleEntry = await cache.getWithStaleFallback(snapshotKey, 8 * 60 * 60 * 1000).catch(() => null);
            if (staleEntry) {
                const out = staleEntry.value ?? staleEntry;
                if (out && typeof out === 'object') {
                    out.meta = out.meta || {};
                    out.meta.stale = true;
                    out.meta.staleAgeMs = staleEntry.staleAgeMs || 0;
                    out.meta.staleReason = 'JIRA_UNREACHABLE';
                    out.meta.sprintReality = projectSquadSprintTruth(out);
                    out.meta.sprintTruthVersion = out.meta.sprintReality.version;
                    out.meta.sprintTruthHash = out.meta.sprintReality.payloadHash;
                    logger.warn('Serving stale current-sprint during Jira outage', buildRequestLogContext(req, { boardId, staleAgeMs: staleEntry.staleAgeMs }));
                    const staleProjects = String(out.meta?.projects || req.query?.projects || '').split(',').filter(Boolean);
                    await attachCurrentSprintTruthContext(out, staleProjects);
                    return res.json(out);
                }
            }
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

        const { boards } = await discoverBoardsWithCache(projects, agileClient);
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
        let totalSP = 0;
        let doneSP = 0;
        let priorDoneSP = 0;
        let spBoardCount = 0;
        let priorSpBoardCount = 0;

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
            const boardTotalSP = Number(payload?.summary?.totalSP || 0);
            const boardDoneSP = Number(payload?.summary?.doneSP || 0);
            if (boardTotalSP > 0) {
                totalSP += boardTotalSP;
                doneSP += boardDoneSP;
                spBoardCount += 1;
            }
            const boardPriorDoneSP = Number(payload?.previousSprint?.doneSP || 0);
            if (payload?.previousSprint && boardPriorDoneSP > 0) {
                priorDoneSP += boardPriorDoneSP;
                priorSpBoardCount += 1;
            }
        }

        const completionPct = totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0;
        const riskScoreRaw = (blockersOwned * 4) + (unownedOutcomes * 2) + (missingLogged * 0.5) + (missingEstimate * 0.5) + (completionPct < 45 ? 6 : 0);
        const riskScore = Math.max(0, Math.min(100, Math.round(riskScoreRaw)));
        const deliveryRisk = Math.max(0, Math.min(100, Math.round(Math.min(1, blockersOwned / 10) * 100)));
        const dataQualityRisk = Math.max(0, Math.min(100, Math.round(Math.min(1, (unownedOutcomes + missingLogged + missingEstimate) / 30) * 100)));

        // Honest metrics only: no fabricated values may reach a governance surface.
        // Velocity = SP delivered in the current sprint window across squads (story-point backed only).
        const spAvailable = spBoardCount > 0;
        const velocity = spAvailable
            ? {
                avg: Math.round(doneSP),
                trend: priorSpBoardCount > 0 && priorDoneSP > 0
                    ? Math.round(((doneSP - priorDoneSP) / priorDoneSP) * 100)
                    : null,
                source: 'computed',
                basis: 'currentSprintDoneSP',
            }
            : { avg: null, trend: null, source: 'unavailable', basis: 'noStoryPoints' };
        // Predictability = delivered vs committed (SP when available, else story counts).
        const predictability = spAvailable
            ? { avg: totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0, trend: null, source: 'computed', basis: 'spCompletionRatio' }
            : (totalStories > 0
                ? { avg: completionPct, trend: null, source: 'computed', basis: 'storyCompletionRatio' }
                : { avg: null, trend: null, source: 'unavailable', basis: 'noStories' });
        // Rework ratio is not computed in this portfolio rollup; never invent it.
        const quality = { reworkPct: null, trend: null, source: 'unavailable', basis: 'notComputedInRollup' };

        const squads = boardPayloadsSettled.map((settled, idx) => {
            const board = activeBoards[idx];
            if (settled.status !== 'fulfilled' || !settled.value) {
                return { boardId: board?.id, boardName: board?.name || 'Unknown', sprintState: 'unavailable', error: 'Jira unreachable' };
            }
            const payload = settled.value;
            const meta = payload.meta || {};
            const sprint = payload.sprint || {};
            const nextSprint = payload.nextSprint || {};
            const selectedSprintState = String(sprint.state || '').toLowerCase();
            const activeCount = Number(meta.activeSprintCount || 0);
            const noActiveFallback = selectedSprintState === 'closed' && activeCount === 0;
            let nextSprintStartOverdue = false;
            if (noActiveFallback && nextSprint.startDate) {
                const plannedStart = new Date(nextSprint.startDate).getTime();
                if (Number.isFinite(plannedStart) && plannedStart < Date.now()) nextSprintStartOverdue = true;
            }
            const storyList = payload.stories || [];
            const boardDone = storyList.filter((s) => String(s?.status || '').toLowerCase().includes('done')).length;
            return {
                boardId: board?.id,
                boardName: board?.name || 'Unknown',
                sprintState: sprint.state || 'none',
                sprintName: sprint.name || null,
                sprintStartDate: sprint.startDate || null,
                hasActiveSprintFallback: noActiveFallback,
                nextSprintCandidate: (noActiveFallback && nextSprint.id)
                    ? { id: nextSprint.id, name: nextSprint.name || '', startDate: nextSprint.startDate || '' }
                    : null,
                nextSprintStartOverdue,
                suggestStartSprint: noActiveFallback && !!nextSprint.id,
                doneStories: boardDone,
                totalStories: storyList.length,
            };
        });

        const summary = {
            velocity,
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
            quality,
            predictability,
            squads,
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

// ─── Governance brief surface ──────────────────────────────────────────────────

const GOVERNANCE_BRIEF_TTL_MS = 30 * 60 * 1000; // 30 min: bounded Jira calls per run
const GOVERNANCE_NS = 'governanceBrief';

function parseGovernanceProjects(req) {
    const raw = req.query.projects;
    return raw != null
        ? Array.from(new Set(String(raw).split(',').map((p) => p.trim().toUpperCase()).filter(Boolean)))
        : readCatalogKeys();
}

/** Re-stamp a cached brief with cached freshness and clamp confidence accordingly. */
function applyCachedFreshness(brief) {
    if (!brief?.freshness) return brief;
    const generatedMs = brief.generatedAt ? new Date(brief.generatedAt).getTime() : Date.now();
    const ageMin = Math.max(0, Math.round((Date.now() - generatedMs) / 60000));
    brief.freshness = { ...brief.freshness, confidenceLimit: 'cached', cacheAgeMinutes: ageMin };
    if (brief.leadershipNarrative?.confidence) {
        brief.leadershipNarrative.confidence = clampConfidenceToFreshness(brief.leadershipNarrative.confidence, 'cached');
    }
    return brief;
}

async function getCachedGovernanceBrief(projects) {
    const cacheKey = governanceBriefCacheKey(projects);
    const cached = await cache.get(cacheKey, { namespace: GOVERNANCE_NS });
    const cachedBrief = cached?.value || cached;
    if (!cachedBrief) return null;
    return { brief: applyCachedFreshness(cachedBrief), cached: true };
}

async function getOrBuildGovernanceBrief({ projects, req, includeEvidence = true, includePOReadiness = true }) {
    const periodWindow = String(req.query?.periodWindow || '28d').toLowerCase();
    const cacheKey = governanceBriefCacheKey(projects, { includeEvidence, includePOReadiness, periodWindow });
    const cached = await cache.get(cacheKey, { namespace: GOVERNANCE_NS });
    const cachedBrief = cached?.value || cached;
    if (cachedBrief) return { brief: applyCachedFreshness(cachedBrief), cached: true };

    const agileClient = createAgileClient();
    const version3Client = createVersion3Client();
    const fields = await discoverFieldsWithCache(version3Client);
    const { boards } = await discoverBoardsWithCache(projects, agileClient);

    let baseline = null;
    try { baseline = await getLatestPIBaseline(`${projects.join('+')}`); } catch (_) { baseline = null; }

    let profileOverrides = null;
    try {
        profileOverrides = await resolveEffectiveGovernanceProfile({
            portfolioKey: projects.join('+'),
            project: projects[0] || '',
            userId: req.session?.user || null,
        });
    } catch (_) { profileOverrides = null; }

    const providerConfig = resolveProviderConfig(req.headers || {});
    const brief = await assembleGovernanceBrief({
        projects, boards, agileClient, version3Client, fields,
        period: { vodacomQuarter: null, sprintNames: [], periodWindow },
        cache, providerConfig, includeEvidence, includePOReadiness, baseline, profileOverrides,
    });
    await cache.set(cacheKey, brief, GOVERNANCE_BRIEF_TTL_MS, { namespace: GOVERNANCE_NS });
    const quarterLabel = brief?.period?.vodacomQuarter;
    if (quarterLabel) {
        void rememberQuarterLabel(quarterLabel, projects).catch((err) => {
            logger.warn('quarter label index write failed', { error: err?.message });
        });
    }
    // Safe telemetry: counts only, never issue bodies.
    logger.info('governance-brief built', {
        projects: projects.join(','), boards: brief.meta?.boardsResolved,
        risks: brief.risks?.length || 0, narratedBy: brief.meta?.narratedBy,
        evidenceFetched: brief.meta?.evidenceFetched,
    });
    return { brief, cached: false };
}

async function serveStaleBriefOrError(res, projects, err) {
    const cacheKey = governanceBriefCacheKey(projects);
    try {
        const staleEntry = await cache.getWithStaleFallback(cacheKey);
        if (staleEntry) {
            const brief = staleEntry.value || staleEntry;
            const ageMin = Math.max(0, Math.round((Number(staleEntry.staleAgeMs) || 0) / 60000));
            brief.freshness = { ...(brief.freshness || {}), confidenceLimit: 'stale', cacheAgeMinutes: ageMin };
            if (brief.leadershipNarrative?.confidence) {
                brief.leadershipNarrative.confidence = clampConfidenceToFreshness(brief.leadershipNarrative.confidence, 'stale');
            }
            brief.meta = { ...(brief.meta || {}), servedStale: true, staleReason: err?.code || 'JIRA_UNREACHABLE' };
            return res.json(brief);
        }
    } catch (_) { /* fall through */ }
    return res.status(502).json({ error: 'Governance brief unavailable', code: 'GOVERNANCE_BRIEF_FAILED' });
}

router.get('/api/governance-brief.json', requireAuth, async (req, res) => {
    const projects = parseGovernanceProjects(req);
    if (!projects.length) return res.status(400).json({ error: 'At least one project required', code: 'NO_PROJECTS' });
    const forceRefresh = String(req.query.refresh || '').trim() === '1';
    try {
        if (forceRefresh) {
            const cacheKey = governanceBriefCacheKey(projects);
            await cache.delete(cacheKey, { namespace: GOVERNANCE_NS });
        }
        const { brief } = await getOrBuildGovernanceBrief({ projects, req });
        return res.json(brief);
    } catch (err) {
        logger.error('governance-brief failed', { error: err?.message });
        return serveStaleBriefOrError(res, projects, err);
    }
});

router.get('/api/governance/intervention-shortlist.json', requireAuth, async (req, res) => {
    const projects = parseGovernanceProjects(req);
    if (!projects.length) return res.status(400).json({ error: 'At least one project required', code: 'NO_PROJECTS' });
    try {
        const { brief } = await getOrBuildGovernanceBrief({ projects, req, includeEvidence: false, includePOReadiness: false });
        return res.json({
            generatedAt: brief.generatedAt,
            freshness: brief.freshness,
            portfolio: brief.portfolio,
            shortlist: brief.topRisks || [],
        });
    } catch (err) {
        logger.error('intervention-shortlist failed', { error: err?.message });
        return res.status(502).json({ error: 'Shortlist unavailable', code: 'SHORTLIST_FAILED' });
    }
});

router.post('/api/governance/pi-baseline', requireAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const projects = Array.isArray(body.projects) && body.projects.length
            ? body.projects.map((p) => String(p).trim().toUpperCase())
            : ['MPSA', 'MAS'];
        const piName = String(body.piName || `${projects.join('+')}`).trim();
        const row = await savePIBaseline({ ...body, piName, projects });
        return res.json({ success: true, baseline: { id: row.id, piName: row.piName, committed: row.committedItems.length } });
    } catch (err) {
        logger.warn('pi-baseline save failed', { error: err?.message });
        return res.status(400).json({ error: String(err?.message || 'Baseline save failed'), code: 'PI_BASELINE_FAILED' });
    }
});

router.get('/api/governance/pi-baseline', requireAuth, async (req, res) => {
    try {
        const piName = req.query.piName ? String(req.query.piName).trim() : '';
        const project = req.query.project ? String(req.query.project).trim() : null;
        if (piName) {
            const baseline = await getLatestPIBaseline(piName);
            return res.json({ baseline });
        }
        const baselines = await listPIBaselines({ project });
        return res.json({ baselines });
    } catch (err) {
        logger.warn('pi-baseline read failed', { error: err?.message });
        return res.status(500).json({ error: 'Baseline read failed' });
    }
});

function expectedVersionFromRequest(req) {
    const header = String(req.headers['if-match'] || '').replace(/^W\//, '').replace(/"/g, '').trim();
    const candidate = header || req.body?.expectedVersion;
    const version = Number(candidate);
    return Number.isFinite(version) && version > 0 ? version : null;
}

function activeLoopActor(req) {
    return req.user?.id || req.user?.email || req.session?.user || 'local-pi-team-user';
}

async function resolveActiveLoopBaseline(projects = [], quarter = '') {
    const rows = await listPIBaselines();
    const wantedQuarter = String(quarter || '').trim().toLowerCase();
    const selected = [];
    for (const project of projects) {
        const match = rows.find((row) => {
            const includesProject = (row.projects || []).includes(project);
            const quarterMatches = !wantedQuarter || String(row.piName || '').toLowerCase().includes(wantedQuarter);
            return includesProject && quarterMatches;
        }) || rows.find((row) => (row.projects || []).includes(project));
        if (match && !selected.some((row) => row.id === match.id)) selected.push(match);
    }
    if (!selected.length) return null;
    if (selected.length === 1) return selected[0];
    return {
        id: `portfolio:${selected.map((row) => row.id).sort().join('+')}`,
        ts: selected.map((row) => row.ts).filter(Boolean).sort().at(-1) || new Date().toISOString(),
        piName: quarter || selected.map((row) => row.piName).filter(Boolean).join(' + '),
        baselineDate: selected.map((row) => row.baselineDate).filter(Boolean).sort().at(-1) || '',
        approvedBy: [...new Set(selected.map((row) => row.approvedBy).filter(Boolean))].join(', '),
        source: 'approved-portfolio-baselines',
        sourceBaselines: selected.map((row) => ({ id: row.id, piName: row.piName, source: row.source, sourceType: row.sourceType, sourceLabel: row.sourceLabel, artifactRef: row.artifactRef, capturedAt: row.capturedAt || row.baselineDate, verifiedAt: row.verifiedAt || row.ts, verifiedBy: row.verifiedBy || row.approvedBy, projects: row.projects || [] })),
        projects,
        committedItems: selected.flatMap((row) => row.committedItems || []),
    };
}

async function assembleActiveLoopAnswerForRequest(req, { force = false } = {}) {
    const projects = parseGovernanceProjects(req);
    if (!projects.length) {
        const err = new Error('At least one squad is required');
        err.code = 'NO_PROJECTS';
        err.httpStatus = 400;
        throw err;
    }
    if (force) {
        const cacheKey = governanceBriefCacheKey(projects);
        await cache.delete(cacheKey, { namespace: GOVERNANCE_NS });
    }
    const quarter = req.query?.quarter || req.body?.quarter || 'current';
    const [{ brief: rawBrief }, baseline, events, profiles, registry, sprintTruthBySquad] = await Promise.all([
        getOrBuildGovernanceBrief({ projects, req }),
        resolveActiveLoopBaseline(projects, req.query?.quarter || req.body?.quarter || ''),
        readActiveLoopEvents({ limit: 5000 }),
        Promise.all(projects.map((project) => resolveEffectiveGovernanceProfile({ project, portfolioKey: projects.join('+'), userId: req.session?.user || null }))),
        readGovernanceRegistry(),
        readSquadSprintTruthBatch({ squadKeys: projects, quarter }),
    ]);
    const registryByKey = new Map((registry.squads || []).map((item) => [item.squadKey, item]));
    const boardAliases = Object.fromEntries(projects.map((project, index) => [
        project,
        registryByKey.get(project)?.friendlyName || profiles[index]?.boardAliases?.[project] || PROJECT_CATALOG.find((entry) => entry.key === project)?.label || project,
    ]));
    const operatingModels = Object.fromEntries(projects.map((project, index) => {
        const participation = registryByKey.get(project)?.participationState;
        return [project, participation === 'pi-governed' ? 'pi-governed' : participation ? 'operational-group' : profiles[index]?.operatingModels?.[project] || ''];
    }).filter(([, value]) => value));
    const squadInsights = (rawBrief?.squadInsights || []).map((insight) => {
        const key = String(insight.projectKey || insight.squad || '').toUpperCase();
        const entry = registryByKey.get(key);
        const canonicalSprintRecord = sprintTruthBySquad.get(key);
        const canonicalSprintReality = canonicalSprintRecord || insight.sprintReality;
        const activeItems = canonicalSprintRecord?.currentWork?.length ? canonicalSprintRecord.currentWork : insight.activeItems;
        return entry ? { ...insight, activeItems, sprintReality: canonicalSprintReality, displayName: entry.friendlyName, squadRoles: { ...(insight.squadRoles || {}), productOwner: entry.productOwner, scrumMaster: entry.scrumMaster, streamLead: entry.streamLead } } : { ...insight, activeItems, sprintReality: canonicalSprintReality };
    });
    const brief = { ...rawBrief, squadInsights, meta: { ...(rawBrief?.meta || {}), boardAliases, operatingModels, registryVersion: registry.version } };
    const caseState = projectActiveLoopCases(events);
    const answer = buildActiveGovernanceAnswer({ brief, baseline, caseState });
    answer.registryVersion = registry.version;
    answer.contexts = assertTruthConsistency((answer.squads || []).map((squad) => buildDeliveryTruthContext({
        squad,
        registry,
        projectKeys: [squad.squad],
        dataAsOf: answer.evidenceObservedAt || answer.verifiedAt || brief.generatedAt,
        source: 'Jira + approved PI contract + organization registry',
        confidence: answer.freshness?.state === 'stale' ? 'stale' : (answer.scope?.complete === false ? 'limited' : 'high'),
    })));
    const contextBySquad = new Map(answer.contexts.map((context) => [context.squadId, context]));
    answer.squads = (answer.squads || []).map((squad) => ({ ...squad, context: contextBySquad.get(String(squad.squad || '').toUpperCase()) || null }));
    answer.promises = (answer.promises || []).map((promise) => ({
        ...promise,
        squadId: String(promise.squad || '').toUpperCase(),
        issueKey: String(promise.issueKey || ''),
        context: contextBySquad.get(String(promise.squad || '').toUpperCase()) || null,
    }));
    answer.buildSha = process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'local';
    const storyKey = governanceStoryCacheKey(projects, req.query?.quarter || req.body?.quarter || '');
    await Promise.all([
        cache.set(storyKey, projectActiveGovernanceLayer1(answer), 60 * 60 * 1000, { namespace: 'governanceStoryV2' }),
        cache.set(storyKey, answer, 60 * 60 * 1000, { namespace: GOVERNANCE_STORY_DETAIL_NAMESPACE }),
    ]);
    rememberWarmGovernanceStory(storyKey, projectActiveGovernanceLayer1(answer));
    return answer;
}

async function cachedActiveLoopDetailForRequest(req) {
    const projects = parseGovernanceProjects(req);
    const storyKey = governanceStoryCacheKey(projects, req.query?.quarter || req.body?.quarter || '');
    const hit = await cache.get(storyKey, { namespace: GOVERNANCE_STORY_DETAIL_NAMESPACE });
    const answer = hit?.value || hit || await assembleActiveLoopAnswerForRequest(req);
    const projectsForTruth = projects.length ? projects : (answer.scope?.projects || []);
    const registry = await readGovernanceRegistry();
    const patched = await patchLayer1WithCanonicalSprintTruth(answer, projectsForTruth, req.query?.quarter || req.body?.quarter || 'current');
    patched.contexts = assertTruthConsistency((patched.squads || []).map((squad) => buildDeliveryTruthContext({
        squad,
        registry,
        projectKeys: [squad.squad],
        dataAsOf: patched.evidenceObservedAt || patched.verifiedAt,
        source: 'Jira + approved PI contract + organization registry',
        confidence: patched.freshness?.state === 'stale' ? 'stale' : (patched.scope?.complete === false ? 'limited' : 'high'),
    })));
    const contextBySquad = new Map(patched.contexts.map((context) => [context.squadId, context]));
    patched.squads = (patched.squads || []).map((squad) => ({ ...squad, context: contextBySquad.get(String(squad.squad || '').toUpperCase()) || null }));
    patched.promises = (patched.promises || []).map((promise) => ({ ...promise, squadId: String(promise.squad || '').toUpperCase(), context: contextBySquad.get(String(promise.squad || '').toUpperCase()) || null }));
    return patched;
}

async function patchLayer1WithCanonicalSprintTruth(story, projects, quarter = 'current') {
    if (!story?.squads?.length) return story;
    const truthBySquad = await readSquadSprintTruthBatch({ squadKeys: projects, quarter });
    if (!truthBySquad.size) return story;
    return {
        ...story,
        squads: story.squads.map((squad) => {
            const truth = truthBySquad.get(String(squad.squad || '').toUpperCase());
            return truth ? {
                ...squad,
                sprintReality: truth,
                sprintTruthVersion: truth.version,
                sprintTruthHash: truth.payloadHash,
            } : squad;
        }),
    };
}

router.get('/api/governance/active-loop.json', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const storyKey = governanceStoryCacheKey(projects, req.query?.quarter || '');
        const warmStory = readWarmGovernanceStory(storyKey);
        const hit = warmStory ? null : await cache.get(storyKey, { namespace: 'governanceStoryV2' });
        const candidateStory = warmStory || hit?.value || hit;
        const cachedStory = Number(candidateStory?.presentationContractVersion) === 3 && candidateStory?.lensSummaries
            && Array.isArray(candidateStory?.excludedOperationalGroups)
            && candidateStory?.decisionCoverage
            && candidateStory?.squads?.every?.((squad) => Number(squad.riskOrder) > 0 && squad.payloadHash && squad.displayName && squad.contractState && squad.trustFactor)
            ? candidateStory : null;
        const prepared = cachedStory || projectActiveGovernanceLayer1(await assembleActiveLoopAnswerForRequest(req));
        const answer = await patchLayer1WithCanonicalSprintTruth(prepared, projects, req.query?.quarter || 'current');
        const registry = await readGovernanceRegistry();
        answer.contexts = assertTruthConsistency((answer.squads || []).map((squad) => buildDeliveryTruthContext({
            squad, registry, projectKeys: [squad.squad], dataAsOf: answer.evidenceObservedAt || answer.verifiedAt,
            source: 'Jira + approved PI contract + organization registry',
            confidence: answer.freshness?.state === 'stale' ? 'stale' : (answer.scope?.complete === false ? 'limited' : 'high'),
        })));
        const contextBySquad = new Map(answer.contexts.map((context) => [context.squadId, context]));
        answer.squads = (answer.squads || []).map((squad) => ({ ...squad, context: contextBySquad.get(String(squad.squad || '').toUpperCase()) || null }));
        rememberWarmGovernanceStory(storyKey, answer);
        res.setHeader('ETag', `"${answer.answerVersion}"`);
        res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=300');
        return res.json(answer);
    } catch (err) {
        logger.warn('active governance loop read failed', { error: err?.message });
        return res.status(err?.httpStatus || 502).json({ error: err?.message || 'Active governance answer unavailable', code: err?.code || 'ACTIVE_LOOP_FAILED' });
    }
});

router.get('/api/governance/actions.json', requireAuth, async (req, res) => {
    try {
        const requestedSquad = String(req.query.squad || '').trim().toUpperCase();
        const scopedRequest = requestedSquad && !req.query.projects
            ? Object.assign(Object.create(req), { query: { ...req.query, projects: requestedSquad } })
            : req;
        const answer = await cachedActiveLoopDetailForRequest(scopedRequest);
        const liveCases = projectActiveLoopCases(await readActiveLoopEvents({ limit: 5000 }));
        const freshnessRestricted = ['stale', 'failed'].includes(answer.freshness?.state);
        const promises = (answer.promises || []).map((promise) => {
            const savedCase = liveCases[promise.promiseId];
            return savedCase ? reconcilePromiseCaseProjection(promise, savedCase, {
                jiraAvailable: answer.freshness?.state !== 'failed',
                restrictFreshActions: freshnessRestricted,
            }) : promise;
        });
        const state = String(req.query.state || '').trim();
        const owner = String(req.query.owner || '').trim().toLowerCase();
        const cases = promises.filter((promise) => promise.nextAction || promise.caseState !== 'aligned')
            .filter((promise) => !state || promise.caseState === state)
            .filter((promise) => !owner || String(promise.ownerRoute?.displayName || promise.ownerRoute?.role || '').toLowerCase().includes(owner))
            .filter((promise) => !requestedSquad || String(promise.squad || '').toUpperCase() === requestedSquad)
            .map((promise) => {
                const squadId = String(promise.squad || '').toUpperCase();
                const issueKey = String(promise.issueKey || '');
                const dueState = String(promise.nextAction?.dueState || promise.caseState || 'open');
                const actionType = String(promise.nextAction?.id || promise.nextAction?.label || 'review');
                const sourceEntityId = issueKey || promise.promiseId;
                const returnContext = { sourcePage: 'actions', squadId, sprintId: promise.context?.sprintId || null };
                return {
                    promiseId: promise.promiseId, issueKey, squadId, squad: squadId, squadDisplayName: promise.squadDisplayName || promise.context?.squadName,
                    title: promise.originalText, state: promise.caseState, lifecycle: promise.actionLifecycle, ownerRoute: promise.ownerRoute,
                    nextAction: promise.nextAction, version: promise.version, dueState, actionType, sourceEntityId, returnContext,
                    groupKey: `${squadId}|${actionType}|${sourceEntityId}|${dueState}`,
                    detailHref: `/api/governance/cases/${encodeURIComponent(promise.promiseId)}/detail.json?projects=${encodeURIComponent(squadId)}&squad=${encodeURIComponent(squadId)}&returnTo=${encodeURIComponent('/actions')}`,
                };
            });
        return res.json({ schemaVersion: 3, storyVersion: answer.answerVersion, contexts: answer.contexts || [], cases });
    } catch (err) {
        return res.status(err?.httpStatus || 502).json({ error: err?.message || 'Actions queue unavailable', code: err?.code || 'ACTIONS_QUEUE_FAILED' });
    }
});

router.get('/api/governance/registry.json', requireAuth, async (_req, res) => {
    const registry = await readGovernanceRegistry();
    const sprintTruth = await readSquadSprintTruthBatch({ squadKeys: registry.squads.map((item) => item.squadKey) });
    const enriched = {
        ...registry,
        squads: registry.squads.map((item) => {
            const truth = sprintTruth.get(item.squadKey);
            const boardCandidates = (truth?.checkedBoards || []).filter((board) => board?.id).map((board) => ({ id: board.id, name: board.name || `Board ${board.id}`, confidence: board.verified === false ? 'limited' : 'high', evidence: 'Verified Current Sprint snapshot' }));
            const storedPeople = [item.productOwner, item.scrumMaster, item.streamLead].filter((person) => person?.displayName).map((person) => ({ displayName: person.displayName, confidence: 'confirmed', evidence: 'Existing organization registry' }));
            const jiraPeople = (truth?.currentWork || []).flatMap((work) => [work.assignee, work.owner, work.reporter]).map((person) => typeof person === 'string' ? person : person?.displayName || person?.name || '').filter(Boolean).map((displayName) => ({ displayName, confidence: 'observed', evidence: 'Observed in the latest Jira sprint snapshot' }));
            const people = [...new Map([...storedPeople, ...jiraPeople].map((person) => [person.displayName.toLowerCase(), person])).values()];
            return { ...item, suggestions: { boardMapping: boardCandidates, people } };
        }),
    };
    res.setHeader('ETag', `"${enriched.version}"`);
    return res.json(enriched);
});

router.patch('/api/governance/registry', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const idempotencyKey = String(req.headers['idempotency-key'] || req.body?.idempotencyKey || randomUUID());
        const registry = await updateGovernanceRegistryBatch({
            changes: req.body?.changes,
            reason: req.body?.reason,
            actor: req.authUser?.id || req.session?.user || 'authorized-user',
            idempotencyKey,
        });
        await invalidateDeliveryTruthCaches();
        res.setHeader('ETag', `"${registry.version}"`);
        return res.json({ ...registry, receipt: { id: idempotencyKey, changedSquadKeys: registry.changedSquadKeys || [] } });
    } catch (err) {
        return res.status(err?.httpStatus || 500).json({ error: err?.message || 'Registry update failed', code: err?.code || 'REGISTRY_UPDATE_FAILED', squadKey: err?.squadKey, currentRevision: err?.currentRevision });
    }
});

router.patch('/api/governance/registry/:squadKey', requireAuth, requireSuperAdmin, async (req, res) => {
    const expectedVersion = Number(String(req.headers['if-match'] || '').replace(/\D/g, ''));
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required for organization settings', code: 'REGISTRY_VERSION_REQUIRED' });
    if (!String(req.body?.reason || '').trim()) return res.status(422).json({ error: 'A reason is required for organization changes', code: 'REGISTRY_REASON_REQUIRED' });
    try {
        const registry = await updateGovernanceRegistrySquad({ squadKey: req.params.squadKey, expectedVersion, patch: req.body, actor: req.authUser?.id || req.session?.user || 'authorized-user' });
        await invalidateDeliveryTruthCaches();
        res.setHeader('ETag', `"${registry.version}"`);
        return res.json(registry);
    } catch (err) {
        return res.status(err?.httpStatus || 500).json({ error: err?.message || 'Registry update failed', code: err?.code || 'REGISTRY_UPDATE_FAILED', currentVersion: err?.currentVersion });
    }
});

router.get('/api/governance/diagnostics.json', requireAuth, async (req, res) => {
    const enabled = process.env.NODE_ENV !== 'production' || String(process.env.GOVERNANCE_DIAGNOSTICS_ENABLED || '').toLowerCase() === 'true';
    if (!enabled) return res.status(403).json({ error: 'Governance diagnostics are restricted', code: 'GOVERNANCE_DIAGNOSTICS_FORBIDDEN' });
    let redis = false;
    try { redis = await cache.pingRedis(); } catch (_) { redis = false; }
    const runningJobs = [...activeRefreshJobs.values()].filter((job) => job.status === 'running').map((job) => job.public);
    return res.json({
        version: process.env.npm_package_version || '0.0.0.1',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
        buildSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.RENDER_GIT_COMMIT || '',
        buildTime: process.env.BUILD_TIME || '',
        cacheBackend: redis ? 'redis' : (process.env.NODE_ENV === 'production' ? 'unavailable' : 'local-development fallback'),
        jiraSyncStatus: resolvedJiraHost() ? 'configured' : 'not configured',
        queueDepth: runningJobs.length,
        activeRefreshJobs: runningJobs,
        workerLeaderState: process.env.WORKER_LEADER_LOCK === '1' ? 'leader lock enabled' : 'single instance or external worker',
        featureFlags: { governanceStoryV2: process.env.GOVERNANCE_STORY_V2 !== '0' },
        uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    });
});

router.get('/api/governance/squads/:squadKey/detail.json', requireAuth, async (req, res) => {
    try {
        const squadKey = String(req.params.squadKey || '').trim().toUpperCase();
        const answer = await cachedActiveLoopDetailForRequest(req);
        const squad = [...(answer.squads || []), ...(answer.excludedOperationalGroups || [])].find((item) => item.squad === squadKey);
        if (!squad) return res.status(404).json({ error: 'Squad not found', code: 'SQUAD_NOT_FOUND' });
        return res.json({ schemaVersion: 3, storyVersion: answer.answerVersion, context: squad.context, squadPayloadHash: squad.payloadHash, squad, promises: answer.promises.filter((item) => item.squad === squadKey), currentWork: squad.currentWork || squad.doingInstead?.clusters || [], unknownWork: squad.unknownWork, possibleRework: squad.possibleRework, sprintReality: squad.sprintReality, workSplit: squad.workSplit });
    } catch (err) {
        return res.status(err?.httpStatus || 502).json({ error: err?.message || 'Squad detail unavailable', code: err?.code || 'SQUAD_DETAIL_FAILED' });
    }
});

router.get('/api/governance/cases/:promiseId/detail.json', requireAuth, async (req, res) => {
    try {
        const answer = await cachedActiveLoopDetailForRequest(req);
        const promise = answer.promises.find((item) => item.promiseId === String(req.params.promiseId || '').trim());
        if (!promise) return res.status(404).json({ error: 'Promise not found', code: 'PROMISE_NOT_FOUND' });
        const squad = answer.squads.find((item) => item.squad === promise.squad) || null;
        return res.json({ schemaVersion: 2, storyVersion: answer.answerVersion, promise, squad });
    } catch (err) {
        return res.status(err?.httpStatus || 502).json({ error: err?.message || 'Promise detail unavailable', code: err?.code || 'PROMISE_DETAIL_FAILED' });
    }
});

router.post('/api/governance/refreshes', requireAuth, async (req, res) => {
    const scopeType = String(req.body?.scopeType || '').trim().toLowerCase();
    const scopeId = String(req.body?.scopeId || '').trim();
    if (!['promise', 'squad'].includes(scopeType) || !scopeId) return res.status(422).json({ error: 'A promise or squad refresh scope is required', code: 'TARGETED_REFRESH_SCOPE_REQUIRED' });
    let projects = scopeType === 'squad' ? [scopeId.toUpperCase()] : [];
    if (scopeType === 'promise') {
        const portfolio = await assembleActiveLoopAnswerForRequest(req);
        const promise = portfolio.promises.find((item) => item.promiseId === scopeId);
        if (!promise) return res.status(404).json({ error: 'Promise not found', code: 'PROMISE_NOT_FOUND' });
        projects = [promise.squad];
    }
    const quarter = String(req.body?.quarter || req.query?.quarter || '').trim();
    const scopeKey = governanceRefreshScopeKey({ scopeType, scopeId, quarter });
    const existing = activeRefreshJobs.get(scopeKey);
    if (existing && existing.status === 'running') return res.status(202).json({ attached: true, ...existing.public });

    const lease = await cache.claimLease(`governance-refresh:${scopeKey}`, 120000, { namespace: 'governanceSingleFlight' });
    if (!lease.acquired) {
        const shared = await cache.get(`governance-refresh-job:${scopeKey}`, { namespace: 'governanceSingleFlight' });
        return res.status(202).json({ attached: true, ...(shared?.value || { status: 'running', scopeKey }) });
    }

    const jobId = randomUUID();
    const publicJob = { jobId, scopeKey, scopeType, scopeId, projects, quarter, status: 'running', startedAt: new Date().toISOString() };
    const holder = { status: 'running', public: publicJob };
    activeRefreshJobs.set(scopeKey, holder);
    await cache.set(`governance-refresh-job:${scopeKey}`, publicJob, 120000, { namespace: 'governanceSingleFlight' });
    void (async () => {
        try {
            const syntheticReq = Object.assign(Object.create(req), {
                query: { ...req.query, projects: projects.join(','), quarter },
                body: { ...req.body, projects, quarter },
            });
            const answer = await assembleActiveLoopAnswerForRequest(syntheticReq, { force: true });
            holder.status = 'completed';
            const promisePatch = scopeType === 'promise' ? answer.promises.find((item) => item.promiseId === scopeId) || null : null;
            const squadPatch = answer.squads.find((item) => item.squad === projects[0]) || null;
            holder.public = { ...publicJob, status: 'completed', completedAt: new Date().toISOString(), answerVersion: answer.answerVersion, promisePatch, squadPatch };
        } catch (err) {
            holder.status = 'failed';
            holder.public = { ...publicJob, status: 'failed', completedAt: new Date().toISOString(), error: err?.message || 'Refresh failed' };
        } finally {
            await cache.set(`governance-refresh-job:${scopeKey}`, holder.public, 5 * 60 * 1000, { namespace: 'governanceSingleFlight' });
            await cache.releaseLease(lease);
            setTimeout(() => activeRefreshJobs.delete(scopeKey), 5 * 60 * 1000).unref?.();
        }
    })();
    return res.status(202).json({ attached: false, ...publicJob });
});

router.get('/api/governance/refreshes/:jobId', requireAuth, async (req, res) => {
    const jobId = String(req.params.jobId || '').trim();
    const local = [...activeRefreshJobs.values()].find((job) => job.public?.jobId === jobId);
    if (local) return res.json(local.public);
    return res.status(404).json({ error: 'Refresh job not found or expired', code: 'REFRESH_JOB_NOT_FOUND' });
});

async function findActiveLoopPromise(req, promiseId) {
    const answer = await assembleActiveLoopAnswerForRequest(req);
    return { answer, promise: answer.promises.find((item) => item.promiseId === promiseId) || null };
}

router.post('/api/governance/cases/:promiseId/nudges', requireAuth, async (req, res) => {
    const promiseId = String(req.params.promiseId || '').trim();
    const expectedVersion = expectedVersionFromRequest(req);
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required for governance decisions', code: 'GOVERNANCE_VERSION_REQUIRED' });
    try {
        const { promise } = await findActiveLoopPromise(req, promiseId);
        if (!promise) return res.status(404).json({ error: 'Promise not found', code: 'PROMISE_NOT_FOUND' });
        const deliveraRef = `DLV-${new Date().getUTCFullYear()}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        const receiptId = `gwr_${randomUUID()}`;
        const idempotencyKey = String(req.headers['idempotency-key'] || req.body?.idempotencyKey || `nudge:${promiseId}:${expectedVersion}`).trim().slice(0, 240);
        const priorReceipt = await cache.get(`governance-write:${idempotencyKey}`, { namespace: 'governanceWriteIdempotency' });
        if (priorReceipt?.value) return res.status(202).json({ ...priorReceipt.value, duplicate: true });
        const route = req.body?.channel || (promise.issueKey ? 'jira' : 'pi-team-queue');
        const reviewedRecipient = req.body?.recipient && typeof req.body.recipient === 'object' ? {
            displayName: String(req.body.recipient.displayName || '').trim().slice(0, 160),
            accountId: String(req.body.recipient.accountId || '').trim().slice(0, 180),
            role: String(req.body.recipient.role || '').trim().slice(0, 120),
            source: String(req.body.recipient.source || 'case-override').trim().slice(0, 120),
        } : promise.ownerRoute;
        if (!reviewedRecipient?.displayName) return res.status(422).json({ error: 'Review or assign the recipient before sending', code: 'RECIPIENT_REVIEW_REQUIRED' });
        const responseDueAt = addBusinessDays(new Date(), Math.max(1, Number(req.body?.responseBusinessDays) || 1));
        const baseBody = String(req.body?.message || `Please update the Jira proof for this PI promise: ${promise.originalText}`).trim().slice(0, 1800);
        const message = `${baseBody}\n\nDelivera reference: ${deliveraRef}`;
        const queued = await appendVersionedActiveLoopEvent({
            promiseId,
            contractId: promise.contractId,
            type: 'nudge-queued',
            actorId: activeLoopActor(req),
            expectedVersion,
            payload: { receiptId, deliveraRef, idempotencyKey, targetSystem: route, targetObject: promise.issueKey || promiseId, sourceStateVersion: expectedVersion, squadPayloadHash: req.body?.squadPayloadHash || '', retryState: 'not-started', deliveraRef, route, issueKey: promise.issueKey, ownerRoute: reviewedRecipient, responseDueAt, messagePreview: baseBody.slice(0, 300), correctionPath: promise.issueKey ? 'Open Jira issue and correct the failed field, then retry.' : 'Assign a recipient from the PI Team queue.' },
        });

        const receipt = { queued: true, writeState: 'queued', receiptId, idempotencyKey, deliveraRef, route, recipient: reviewedRecipient, responseDueAt, version: queued.nextVersion };
        await cache.set(`governance-write:${idempotencyKey}`, receipt, 24 * 60 * 60 * 1000, { namespace: 'governanceWriteIdempotency' });

        if (route === 'jira' && promise.issueKey) {
            void (async () => {
                try {
                    const result = await postIssueComment(createVersion3Client(), promise.issueKey, message, { roster: [] });
                    const version = await currentPromiseVersion(promiseId);
                    await appendActiveLoopEvent({
                        promiseId,
                        contractId: promise.contractId,
                        type: 'nudge-sent',
                        actorId: 'delivera-dispatcher',
                        expectedVersion: version,
                        nextVersion: version + 1,
                        payload: { receiptId, idempotencyKey, targetSystem: 'jira', targetObject: promise.issueKey, sourceStateVersion: expectedVersion, squadPayloadHash: req.body?.squadPayloadHash || '', retryState: 'complete', deliveraRef, route, issueKey: promise.issueKey, responseDueAt, ownerRoute: reviewedRecipient, externalId: result?.id || result?.commentId || '' },
                    });
                } catch (err) {
                    const version = await currentPromiseVersion(promiseId);
                    await appendActiveLoopEvent({
                        promiseId,
                        contractId: promise.contractId,
                        type: 'nudge-failed',
                        actorId: 'delivera-dispatcher',
                        expectedVersion: version,
                        nextVersion: version + 1,
                        payload: { receiptId, idempotencyKey, targetSystem: 'jira', targetObject: promise.issueKey, sourceStateVersion: expectedVersion, squadPayloadHash: req.body?.squadPayloadHash || '', retryState: 'retryable', deliveraRef, route, issueKey: promise.issueKey, error: String(err?.message || 'Send failed').slice(0, 300), failureReason: String(err?.message || 'Send failed').slice(0, 300), correctionPath: 'Open Jira, correct the required field or route, then retry from Delivera.' },
                    });
                }
            })();
        }
        return res.status(202).setHeader('ETag', `"${queued.nextVersion}"`).json(receipt);
    } catch (err) {
        return res.status(err?.httpStatus || 400).json({ error: err?.message, code: err?.code || 'NUDGE_QUEUE_FAILED', latestVersion: err?.latestVersion });
    }
});

router.post('/api/governance/contracts/:contractId/amendments', requireAuth, async (req, res) => {
    const expectedVersion = expectedVersionFromRequest(req);
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required for governance decisions', code: 'GOVERNANCE_VERSION_REQUIRED' });
    const validation = validateAmendment(req.body || {});
    if (!validation.valid) return res.status(422).json({ error: validation.message, code: validation.code });
    try {
        const row = await appendVersionedActiveLoopEvent({
            promiseId: String(req.body?.promiseId || '').trim(),
            contractId: String(req.params.contractId || '').trim(),
            type: 'contract-amended',
            actorId: activeLoopActor(req),
            expectedVersion,
            payload: { ...validation.value, approvalProofRef: String(req.body?.approvalProofRef || '').slice(0, 500) },
        });
        return res.setHeader('ETag', `"${row.nextVersion}"`).json({ success: true, version: row.nextVersion, amendmentId: row.id });
    } catch (err) {
        return res.status(err?.httpStatus || 400).json({ error: err?.message, code: err?.code || 'AMENDMENT_FAILED', latestVersion: err?.latestVersion });
    }
});

router.post('/api/governance/cases/:promiseId/decisions', requireAuth, async (req, res) => {
    const expectedVersion = expectedVersionFromRequest(req);
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required for governance decisions', code: 'GOVERNANCE_VERSION_REQUIRED' });
    const decision = String(req.body?.decision || '').trim();
    const typeByDecision = { 'approve-match': 'match-approved', 'accept-risk': 'risk-accepted', 'assign-owner': 'owner-assigned', 'escalate-owner': 'escalation-sent' };
    const type = typeByDecision[decision];
    if (!type) return res.status(422).json({ error: 'Unsupported governance decision', code: 'INVALID_GOVERNANCE_DECISION' });
    try {
        const row = await appendVersionedActiveLoopEvent({
            promiseId: String(req.params.promiseId || '').trim(),
            contractId: String(req.body?.contractId || '').trim(),
            type,
            actorId: activeLoopActor(req),
            expectedVersion,
            payload: { reason: String(req.body?.reason || '').slice(0, 1000), assignee: req.body?.assignee || null, recipient: req.body?.recipient || null },
        });
        return res.setHeader('ETag', `"${row.nextVersion}"`).json({ success: true, version: row.nextVersion, decisionId: row.id });
    } catch (err) {
        return res.status(err?.httpStatus || 400).json({ error: err?.message, code: err?.code || 'DECISION_FAILED', latestVersion: err?.latestVersion });
    }
});

router.post('/api/governance/cases/:promiseId/owner-route', requireAuth, async (req, res) => {
    const expectedVersion = expectedVersionFromRequest(req);
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required', code: 'GOVERNANCE_VERSION_REQUIRED' });
    const recipient = req.body?.recipient || {};
    const displayName = String(recipient.displayName || '').trim().slice(0, 160);
    if (!displayName) return res.status(422).json({ error: 'Choose a recipient', code: 'RECIPIENT_REQUIRED' });
    try {
        const { promise } = await findActiveLoopPromise(req, String(req.params.promiseId || '').trim());
        if (!promise) return res.status(404).json({ error: 'Promise not found', code: 'PROMISE_NOT_FOUND' });
        const row = await appendVersionedActiveLoopEvent({
            promiseId: promise.promiseId,
            contractId: promise.contractId,
            type: 'owner-route-overridden',
            actorId: activeLoopActor(req),
            expectedVersion,
            payload: { recipient: { displayName, accountId: String(recipient.accountId || '').slice(0, 180), role: String(recipient.role || 'Selected recipient').slice(0, 120), source: 'case-override' }, saveAsSquadDefault: req.body?.saveAsSquadDefault === true },
        });
        if (req.body?.saveAsSquadDefault === true) {
            await saveProfileOverride({ scope: `project:${promise.squad}`, key: 'productOwner', value: displayName, approvedBy: activeLoopActor(req) });
        }
        return res.setHeader('ETag', `"${row.nextVersion}"`).json({ success: true, recipient: row.payload.recipient, savedAsSquadDefault: req.body?.saveAsSquadDefault === true, version: row.nextVersion });
    } catch (err) {
        return res.status(err?.httpStatus || 400).json({ error: err?.message, code: err?.code || 'OWNER_ROUTE_UPDATE_FAILED', latestVersion: err?.latestVersion });
    }
});

router.post('/api/governance/squads/:squadKey/work-themes/:themeId/rename', requireAuth, async (req, res) => {
    const expectedVersion = expectedVersionFromRequest(req);
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ').slice(0, 180);
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required', code: 'GOVERNANCE_VERSION_REQUIRED' });
    if (name.length < 3) return res.status(422).json({ error: 'Enter a clear work theme name', code: 'WORK_THEME_NAME_REQUIRED' });
    try {
        const syntheticPromiseId = `theme:${String(req.params.squadKey || '').toUpperCase()}:${String(req.params.themeId || '').slice(0, 120)}`;
        const row = await appendVersionedActiveLoopEvent({ promiseId: syntheticPromiseId, type: 'work-theme-renamed', actorId: activeLoopActor(req), expectedVersion, payload: { squad: String(req.params.squadKey || '').toUpperCase(), themeId: String(req.params.themeId || ''), name } });
        return res.setHeader('ETag', `"${row.nextVersion}"`).json({ success: true, name, version: row.nextVersion });
    } catch (err) {
        return res.status(err?.httpStatus || 400).json({ error: err?.message, code: err?.code || 'WORK_THEME_RENAME_FAILED', latestVersion: err?.latestVersion });
    }
});

router.post('/api/governance/squads/:squadKey/unknown-clusters/:clusterId/classification', requireAuth, async (req, res) => {
    const expectedVersion = expectedVersionFromRequest(req);
    const squad = String(req.params.squadKey || '').trim().toUpperCase();
    const clusterId = String(req.params.clusterId || '').trim().slice(0, 120);
    const classification = String(req.body?.classification || '').trim().toLowerCase();
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required', code: 'GOVERNANCE_VERSION_REQUIRED' });
    if (!['operational', 'operational-group-candidate', 'ad-hoc-feature', 'unclear'].includes(classification)) return res.status(422).json({ error: 'Choose a supported grouped classification', code: 'UNKNOWN_CLASSIFICATION_INVALID' });
    const idempotencyKey = String(req.headers['idempotency-key'] || req.body?.idempotencyKey || `classify:${squad}:${clusterId}:${expectedVersion}`).trim().slice(0, 240);
    const cached = await cache.get(`governance-write:${idempotencyKey}`, { namespace: 'governanceWriteIdempotency' });
    if (cached?.value) return res.status(202).json({ ...cached.value, duplicate: true });
    try {
        const receiptId = `gwr_${randomUUID()}`;
        const syntheticPromiseId = `classification:${squad}:${clusterId}`;
        const row = await appendVersionedActiveLoopEvent({
            promiseId: syntheticPromiseId,
            type: 'source-write-queued',
            actorId: activeLoopActor(req),
            expectedVersion,
            payload: {
                receiptId, idempotencyKey, targetSystem: 'jira', targetObject: `cluster:${squad}:${clusterId}`,
                sourceStateVersion: expectedVersion, squadPayloadHash: String(req.body?.squadPayloadHash || '').slice(0, 128),
                classification, retryState: 'not-started', correctionPath: 'Review the grouped issues or correct their Jira labels/components, then retry.',
            },
        });
        const receipt = { receiptId, idempotencyKey, writeState: 'queued', classification, squad, clusterId, version: row.nextVersion };
        await cache.set(`governance-write:${idempotencyKey}`, receipt, 24 * 60 * 60 * 1000, { namespace: 'governanceWriteIdempotency' });
        return res.status(202).setHeader('ETag', `"${row.nextVersion}"`).json(receipt);
    } catch (err) {
        return res.status(err?.httpStatus || 400).json({ error: err?.message, code: err?.code || 'UNKNOWN_CLASSIFICATION_QUEUE_FAILED', latestVersion: err?.latestVersion });
    }
});

router.post('/api/governance/source-writes/:receiptId/result', requireAuth, async (req, res) => {
    const expectedVersion = expectedVersionFromRequest(req);
    const receiptId = String(req.params.receiptId || '').trim().slice(0, 180);
    const promiseId = String(req.body?.promiseId || '').trim().slice(0, 240);
    const succeeded = req.body?.succeeded === true;
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required', code: 'GOVERNANCE_VERSION_REQUIRED' });
    if (!receiptId || !promiseId) return res.status(422).json({ error: 'Receipt and governance target are required', code: 'SOURCE_WRITE_RESULT_TARGET_REQUIRED' });
    try {
        const row = await appendVersionedActiveLoopEvent({
            promiseId,
            type: succeeded ? 'source-write-confirmed' : 'source-write-failed',
            actorId: activeLoopActor(req),
            expectedVersion,
            payload: {
                receiptId,
                idempotencyKey: String(req.body?.idempotencyKey || '').slice(0, 240),
                targetSystem: String(req.body?.targetSystem || 'jira').slice(0, 80),
                targetObject: String(req.body?.targetObject || '').slice(0, 240),
                sourceStateVersion: Number(req.body?.sourceStateVersion) || expectedVersion,
                squadPayloadHash: String(req.body?.squadPayloadHash || '').slice(0, 128),
                retryState: succeeded ? 'complete' : 'retryable',
                failureReason: succeeded ? '' : String(req.body?.failureReason || 'Source write failed').slice(0, 500),
                correctionPath: succeeded ? 'Projection reconciliation queued.' : String(req.body?.correctionPath || 'Correct the source data and retry.').slice(0, 500),
                sourceReceipt: String(req.body?.sourceReceipt || '').slice(0, 240),
            },
        });
        return res.setHeader('ETag', `"${row.nextVersion}"`).json({ receiptId, writeState: succeeded ? 'source-confirmed' : 'source-failed', version: row.nextVersion });
    } catch (err) {
        return res.status(err?.httpStatus || 400).json({ error: err?.message, code: err?.code || 'SOURCE_WRITE_RESULT_FAILED', latestVersion: err?.latestVersion });
    }
});

router.post('/api/governance/cases/:promiseId/recheck', requireAuth, async (req, res) => {
    const expectedVersion = expectedVersionFromRequest(req);
    if (!expectedVersion) return res.status(428).json({ error: 'If-Match is required for governance decisions', code: 'GOVERNANCE_VERSION_REQUIRED' });
    let started = null;
    let promise = null;
    try {
        ({ promise } = await findActiveLoopPromise(req, String(req.params.promiseId || '').trim()));
        if (!promise) return res.status(404).json({ error: 'Promise not found', code: 'PROMISE_NOT_FOUND' });
        started = await appendVersionedActiveLoopEvent({
            promiseId: promise.promiseId,
            contractId: promise.contractId,
            type: 'recheck-started',
            actorId: activeLoopActor(req),
            expectedVersion,
            payload: { scopeType: 'promise', scopeId: promise.promiseId, startedAt: new Date().toISOString() },
        });
        const syntheticReq = Object.assign(Object.create(req), {
            query: { ...req.query, projects: promise.squad, quarter: req.body?.quarter || req.query?.quarter || '' },
            body: { ...req.body, projects: [promise.squad] },
        });
        const refreshed = await assembleActiveLoopAnswerForRequest(syntheticReq, { force: true });
        const refreshedPromise = refreshed.promises.find((item) => item.promiseId === promise.promiseId) || promise;
        const aligned = ['matched', 'aligned-amended'].includes(refreshedPromise.matchState);
        const row = await appendVersionedActiveLoopEvent({
            promiseId: promise.promiseId,
            contractId: promise.contractId,
            type: 'recheck-completed',
            actorId: activeLoopActor(req),
            expectedVersion: started.nextVersion,
            payload: { aligned, matchState: refreshedPromise.matchState, missingProof: aligned ? '' : refreshedPromise.proofAge?.copy || 'Required Jira proof is still missing.', checkedAt: new Date().toISOString() },
        });
        const finalAnswer = await assembleActiveLoopAnswerForRequest(syntheticReq);
        return res.setHeader('ETag', `"${row.nextVersion}"`).json({ success: true, transition: aligned ? 'resolved-matched' : 'reply-received-proof-still-missing', aligned, matchState: refreshedPromise.matchState, missingProof: row.payload.missingProof, version: row.nextVersion, storyVersion: finalAnswer.answerVersion, promisePatch: finalAnswer.promises.find((item) => item.promiseId === promise.promiseId) || null, squadPatch: finalAnswer.squads.find((item) => item.squad === promise.squad) || null });
    } catch (err) {
        if (started && promise) {
            try {
                await appendVersionedActiveLoopEvent({ promiseId: promise.promiseId, contractId: promise.contractId, type: 'recheck-failed', actorId: activeLoopActor(req), expectedVersion: started.nextVersion, payload: { error: String(err?.message || 'Targeted evidence refresh failed').slice(0, 500), failedAt: new Date().toISOString() } });
            } catch (_) { /* Preserve the original refresh failure and never claim completion. */ }
        }
        return res.status(err?.httpStatus || 400).json({ error: err?.message, code: err?.code || 'RECHECK_FAILED', latestVersion: err?.latestVersion });
    }
});

router.post('/api/integrations/jira/webhooks', async (req, res) => {
    const configuredSecret = String(process.env.JIRA_WEBHOOK_SECRET || '').trim();
    if (configuredSecret && String(req.headers['x-delivera-webhook-secret'] || '') !== configuredSecret) {
        return res.status(401).json({ error: 'Invalid webhook secret', code: 'INVALID_WEBHOOK_SECRET' });
    }
    const webhookId = String(req.headers['x-atlassian-webhook-identifier'] || req.body?.webhookId || '').trim();
    if (webhookId) {
        const dedupeKey = `jira-webhook:${webhookId}`;
        const prior = await cache.get(dedupeKey, { namespace: 'jiraWebhookDedupe' });
        if (prior) return res.status(202).json({ accepted: true, duplicate: true, webhookId });
        await cache.set(dedupeKey, { processedAt: new Date().toISOString() }, 24 * 60 * 60 * 1000, { namespace: 'jiraWebhookDedupe' });
    }
    try {
        const result = await ingestJiraGovernanceWebhook(req.body || {}, {
            webhookId,
            onDirtyFlush: async ({ scopeKey }) => {
                const project = String(scopeKey || '').split('|')[0].toUpperCase();
                if (!project || project === 'UNKNOWN') return;
                const syntheticReq = Object.assign(Object.create(req), { query: { projects: project }, body: { projects: [project] } });
                await assembleActiveLoopAnswerForRequest(syntheticReq, { force: true }).catch((error) => logger.warn('targeted governance recompute failed', { project, error: error?.message }));
            },
        });
        return res.status(202).json(result);
    } catch (err) {
        logger.warn('Jira governance webhook failed', { webhookId, error: err?.message });
        return res.status(500).json({ error: 'Webhook processing failed', code: 'JIRA_WEBHOOK_FAILED' });
    }
});

router.post('/api/integrations/teams/notifications', async (req, res) => {
    if (req.query?.validationToken) return res.type('text/plain').send(String(req.query.validationToken));
    const expectedState = String(process.env.TEAMS_WEBHOOK_CLIENT_STATE || '').trim();
    const notifications = Array.isArray(req.body?.value) ? req.body.value : [req.body || {}];
    if (expectedState && notifications.some((item) => String(item.clientState || '') !== expectedState)) {
        return res.status(401).json({ error: 'Invalid Teams client state', code: 'INVALID_TEAMS_CLIENT_STATE' });
    }
    try {
        const results = [];
        for (const notification of notifications.slice(0, 100)) results.push(await ingestTeamsGovernanceNotification(notification));
        return res.status(202).json({ accepted: true, results });
    } catch (err) {
        logger.warn('Teams governance notification failed', { error: err?.message });
        return res.status(500).json({ error: 'Teams notification processing failed', code: 'TEAMS_NOTIFICATION_FAILED' });
    }
});

router.post('/api/governance/narration-feedback', requireAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const row = await recordNarrationPattern({
            patternKey: body.patternKey,
            phrase: body.phrase,
            project: body.project,
            briefId: body.briefId,
            source: body.source || 'sm-accepted',
        });
        return res.json({ success: true, recorded: { patternKey: row.patternKey, project: row.project } });
    } catch (err) {
        logger.warn('narration-feedback failed', { error: err?.message });
        return res.status(400).json({ error: String(err?.message || 'Feedback failed'), code: 'NARRATION_FEEDBACK_FAILED' });
    }
});

router.post('/api/governance/adoption-metric', requireAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const row = await recordAdoptionMetric({
            metric: body.metric,
            value: body.value,
            project: body.project,
            user: req.session?.user || 'unknown',
            note: body.note,
        });
        return res.json({ success: true, recorded: { metric: row.metric, value: row.value } });
    } catch (err) {
        logger.warn('adoption-metric failed', { error: err?.message });
        return res.status(400).json({ error: String(err?.message || 'Metric failed'), code: 'ADOPTION_METRIC_FAILED' });
    }
});

router.get('/api/governance/adoption-metrics.json', requireAuth, async (req, res) => {
    try {
        const project = req.query.project ? String(req.query.project).trim() : null;
        const summary = await summarizeAdoptionMetrics({ project });
        return res.json(summary);
    } catch (err) {
        logger.warn('adoption-metrics read failed', { error: err?.message });
        return res.status(500).json({ error: 'Metrics read failed' });
    }
});

router.get('/api/governance/inbox.json', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const project = projects[0] || null;
        let items = await readPendingInboxItems({ project, maxAgeHours: 168 });
        if (!items.length) {
            const cacheKey = governanceBriefCacheKey(projects);
            const cached = await cache.get(cacheKey, { namespace: GOVERNANCE_NS });
            const cachedBrief = cached?.value || cached;
            if (cachedBrief?.briefId) {
                items = [{
                    id: 'synthetic-cached-brief',
                    type: 'brief',
                    projects,
                    summary: cachedBrief.leadershipNarrative?.meetingAnswer || 'Cached brief available',
                    safeToSend: cachedBrief.meta?.safeToSend === true,
                    approvalRequired: false,
                    evidenceLinks: [],
                    createdAt: cachedBrief.generatedAt || new Date().toISOString(),
                    payload: { briefId: cachedBrief.briefId, synthetic: true },
                }];
            }
        }
        const grouped = groupInboxByType(items);
        return res.json({ ...grouped, total: items.length });
    } catch (err) {
        logger.warn('governance inbox read failed', { error: err?.message });
        return res.status(500).json({ error: 'Inbox read failed' });
    }
});

router.post('/api/governance/inbox/:id/resolve', requireAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (id.startsWith('synthetic-')) {
            logger.info('inbox resolve synthetic no-op', { id });
            return res.json({ success: true, synthetic: true });
        }
        const resolution = String(req.body?.resolution || 'dismissed').trim();
        const editedContent = String(req.body?.editedContent || '').trim();
        const userId = req.session?.user || 'unknown';
        const row = await resolveInboxItem(id, { resolution, editedContent, userId, dismissReason: req.body?.dismissReason });
        const projects = parseGovernanceProjects(req);
        const eventType = resolution === 'approved' ? 'accepted-copy' : (row.dismissReason === 'wrong-owner' ? 'wrong-owner' : 'dismissed-risk');
        await recordImprovementEvent({
            eventType,
            surface: 'brief',
            scope: { project: projects[0] || '*', inboxId: id },
            payload: { type: row.type, summary: row.summary, dismissReason: row.dismissReason },
        }).catch(() => {});
        if (resolution === 'approved' && row.type === 'brief' && editedContent) {
            await recordNarrationPattern({
                patternKey: row.payload?.briefId || 'brief-approved',
                phrase: editedContent,
                project: projects[0] || '',
                source: 'inbox-approved',
            });
        }
        return res.json({ success: true, item: row });
    } catch (err) {
        logger.warn('inbox resolve failed', { error: err?.message });
        return res.status(400).json({ error: String(err?.message || 'Resolve failed') });
    }
});

router.get('/api/governance/jobs.json', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const jobs = await readRecentJobs({ project: projects[0], limit: 5 });
        return res.json({ jobs });
    } catch (err) {
        logger.warn('governance jobs read failed', { error: err?.message });
        return res.status(500).json({ error: 'Jobs read failed' });
    }
});

router.get('/api/governance/scope-intelligence.json', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const hit = await getCachedGovernanceBrief(projects);
        if (hit?.brief?.meta?.scopeIntelligence) {
            return res.json({
                scope: hit.brief.meta.scopeIntelligence,
                boards: hit.brief.meta?.boardsResolved || 0,
                projectErrors: [],
                cached: true,
            });
        }
        const agileClient = createAgileClient();
        const { boards, projectErrors } = await discoverBoardsWithCache(projects, agileClient);
        const { brief } = await getOrBuildGovernanceBrief({ projects, req, includeEvidence: false, includePOReadiness: false });
        const scope = brief?.meta?.scopeIntelligence || buildScopeIntelligence({
            boards,
            boardPayloads: [],
            selectedProjects: projects,
            projectErrors,
        });
        return res.json({ scope, boards: boards.length, projectErrors, cached: false });
    } catch (err) {
        logger.warn('governance scope-intelligence failed', { error: err?.message });
        return res.status(500).json({ error: 'Scope intelligence failed' });
    }
});

router.get('/api/governance/pi-confidence.json', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const hit = await getCachedGovernanceBrief(projects);
        const brief = hit?.brief || (await getOrBuildGovernanceBrief({ projects, req })).brief;
        const piConfidence = brief?.meta?.piConfidence || buildPIConfidenceStrip(brief);
        return res.json({
            piConfidence,
            piForumAnswer: brief?.meta?.piForumAnswer || '',
            protectMeAnswer: brief?.meta?.protectMeAnswer || '',
            cached: Boolean(hit?.cached),
        });
    } catch (err) {
        logger.warn('governance pi-confidence failed', { error: err?.message });
        return res.status(500).json({ error: 'PI confidence failed' });
    }
});

router.get('/api/governance/feedback-summary.json', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const summary = await buildFeedbackTriageSummary({ project: projects[0] });
        return res.json(summary);
    } catch (err) {
        logger.warn('governance feedback-summary failed', { error: err?.message });
        return res.status(500).json({ error: 'Feedback summary failed' });
    }
});

router.post('/api/governance/feedback-triage', requireAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const projects = parseGovernanceProjects(req);
        if (body.phrase) {
            await recordNarrationPattern({
                patternKey: body.patternKey || 'feedback-lab',
                project: projects[0] || '*',
                phrase: String(body.phrase).slice(0, 240),
                source: body.source || 'feedback-lab',
            });
        }
        if (body.metric && body.value != null) {
            await recordAdoptionMetric({
                project: projects[0] || 'MPSA',
                metric: String(body.metric),
                value: Number(body.value) || 0,
                note: body.note || '',
            });
        }
        const summary = await buildFeedbackTriageSummary({ project: projects[0] });
        return res.json({ success: true, summary });
    } catch (err) {
        logger.warn('governance feedback-triage failed', { error: err?.message });
        return res.status(400).json({ error: String(err?.message || 'Feedback triage failed') });
    }
});

router.get('/api/governance/worker-receipt.json', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const project = projects[0] || null;
        const jobs = await readRecentJobs({ project, limit: 5 });
        let items = await readPendingInboxItems({ project, maxAgeHours: 168 });
        const grouped = groupInboxByType(items);
        const cacheKey = governanceBriefCacheKey(projects);
        const cached = await cache.get(cacheKey, { namespace: GOVERNANCE_NS });
        const brief = cached?.value || cached || {};
        const workerReceipt = await buildWorkerReceipt(brief, grouped, jobs);
        const aiContribution = await buildAiContributionSummary({ project });
        const aiUsage = await buildAiUsageSummary({ hours: 24 });
        return res.json({
            workerReceipt,
            aiContribution,
            aiUsage,
            jobs: jobs.slice(0, 3),
            inboxTotal: items.length,
            setupGaps: brief?.meta?.setupGaps || [],
            sinceLastRun: brief?.meta?.sinceLastRun || null,
            piConfidence: brief?.meta?.piConfidence || null,
            poReadiness: brief?.poReadiness || brief?.meta?.poReadiness || null,
        });
    } catch (err) {
        logger.warn('governance worker-receipt failed', { error: err?.message });
        return res.status(500).json({ error: 'Worker receipt read failed' });
    }
});

router.get('/api/governance/profile', requireAuth, async (req, res) => {
    try {
        const scope = req.query.scope ? String(req.query.scope).trim() : '';
        if (scope) {
            const overrides = await listProfileOverrides({ scope });
            return res.json({ scope, overrides });
        }
        const projects = parseGovernanceProjects(req);
        const profile = await resolveEffectiveGovernanceProfile({
            portfolioKey: projects.join('+'),
            project: projects[0] || '',
            userId: req.session?.user || null,
        });
        return res.json({ profile });
    } catch (err) {
        return res.status(500).json({ error: String(err?.message || 'Profile read failed') });
    }
});

router.post('/api/governance/profile', requireAuth, async (req, res) => {
    try {
        const body = req.body || {};
        const row = await saveProfileOverride({
            scope: body.scope,
            key: body.key,
            value: body.value,
            approvedBy: req.session?.user || 'unknown',
            phraseKey: body.phraseKey,
            aliasKey: body.aliasKey,
        });
        return res.json({ success: true, override: row });
    } catch (err) {
        return res.status(400).json({ error: String(err?.message || 'Profile save failed') });
    }
});

router.get('/api/governance/pi-baseline/propose', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const quarter = String(req.query.quarter || req.query.vodacomQuarter || '').trim();
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const proposeKey = `${GOVERNANCE_NS}:propose:${projects.join(',')}:${quarter}`;
        if (!bypassCache) {
            const cached = await cache.get(proposeKey, { namespace: GOVERNANCE_NS });
            const payload = cached?.value || cached;
            if (payload?.candidates) return res.json({ ...payload, cached: true });
        }
        const providerConfig = resolveProviderConfig(req.headers || {});
        let version3Client = null;
        try { version3Client = createVersion3Client(); } catch (_) { version3Client = null; }
        const body = await runProposePipeline({
            projects,
            cache,
            version3Client,
            quarter,
            providerConfig,
        });
        await cache.set(proposeKey, body, 20 * 60 * 1000, { namespace: GOVERNANCE_NS });
        return res.json(body);
    } catch (err) {
        logger.warn('pi-baseline propose failed', { error: err?.message });
        return res.status(500).json({ error: 'Propose failed' });
    }
});

router.post('/api/governance/pi-baseline/propose-from-image', requireAuth, createPiBaselineSlideUploadHandler({ parseGovernanceProjects }));

router.get('/api/governance/impact-pack.json', requireAuth, async (req, res) => {
    try {
        const month = req.query.month ? String(req.query.month).trim() : impactPackMonthKey();
        const projects = parseGovernanceProjects(req);
        const result = await buildImpactPack({ project: projects[0] || 'MPSA', month });
        return res.json({
            month: result.month,
            skipped: result.skipped,
            markdown: result.markdown,
        });
    } catch (err) {
        logger.warn('impact-pack failed', { error: err?.message });
        return res.status(500).json({ error: 'Impact pack failed' });
    }
});

router.get('/api/ai-provider-status.json', requireAuth, async (req, res) => {
    try {
        const status = buildAiProviderStatus(req.headers || {});
        return res.json(status);
    } catch (err) {
        logger.warn('ai-provider-status read failed', { error: err?.message });
        return res.status(500).json({ error: 'AI provider status read failed' });
    }
});

router.get('/api/settings/ai-usage.json', requireAuth, async (req, res) => {
    try {
        const hours = Number(req.query?.hours) || 24;
        const summary = await buildAiUsageSummary({ hours });
        return res.json(summary);
    } catch (err) {
        logger.warn('ai-usage read failed', { error: err?.message });
        return res.status(500).json({ error: 'AI usage read failed' });
    }
});

router.post('/api/settings/ai-provider', requireAuth, async (req, res) => {
    try {
        const provider = String(req.body?.provider || req.headers?.['x-ai-provider'] || 'built-in').trim().toLowerCase();
        const action = String(req.body?.action || 'test').trim();
        const apiKey = String(req.headers?.['x-ai-key'] || req.body?.apiKey || '').trim();
        const host = String(req.headers?.['x-ai-host'] || req.body?.host || '').trim();
        if (action === 'test') {
            const result = await testProviderConfig(provider, apiKey, host);
            return res.json(result);
        }
        return res.status(400).json({ error: 'Unknown action', code: 'UNKNOWN_ACTION' });
    } catch (error) {
        logger.error('ai-provider settings error', { error: error?.message });
        return res.status(500).json({ valid: false, error: String(error?.message || 'Test failed') });
    }
});

router.post('/api/outcome-draft', requireAuth, async (req, res) => {
    try {
        const rawNarrative = (req.body && typeof req.body.narrative === 'string') ? req.body.narrative.trim() : '';
        const rawProjectKey = (req.body && typeof req.body.projectKey === 'string') ? req.body.projectKey.trim() : '';
        const selectedProjects = Array.isArray(req.body?.selectedProjects)
            ? req.body.selectedProjects.map((p) => String(p || '').trim().toUpperCase()).filter(Boolean)
            : [];
        const boardId = req.body?.boardId != null ? Number(req.body.boardId) : null;
        const inputMode = ['mixed', 'quarterly', 'support'].includes(String(req.body?.inputMode || '').toLowerCase())
            ? String(req.body.inputMode).toLowerCase()
            : 'mixed';
        const quarterHint = typeof req.body?.quarterHint === 'string' ? req.body.quarterHint.trim() : '';
        const refreshProfile = req.body?.refreshProfile === true;
        if (!rawNarrative) {
            return res.status(400).json({ error: 'Narrative text is required', code: 'MISSING_NARRATIVE' });
        }
        let projectKey = rawProjectKey ? rawProjectKey.toUpperCase() : '';
        if (!projectKey && selectedProjects.length === 1) {
            projectKey = selectedProjects[0];
        }
        if (!projectKey) {
            return res.status(400).json({ error: 'Primary project key is required', code: 'MISSING_PROJECT_KEY' });
        }
        const version3Client = createVersion3Client();
        const host = resolvedJiraHost();
        let profile = null;
        try {
            profile = await buildBoardStyleProfile({
                version3Client,
                projectKey,
                boardId: Number.isFinite(boardId) ? boardId : null,
                refresh: refreshProfile,
            });
        } catch (error) {
            logger.warn('outcome-draft profile skipped', { error: error?.message });
        }
        const providerConfig = resolveProviderConfig(req.headers || {});
        const draft = await parseViaNarrative(
            rawNarrative,
            { projectKey, boardStyleProfile: profile, quarterHint },
            providerConfig,
            () => buildOutcomeDraft({
                rawNarrative,
                projectKey,
                boardId: Number.isFinite(boardId) ? boardId : null,
                inputMode,
                quarterHint,
                version3Client,
                host,
                profile,
            }),
        );
        return res.json(draft);
    } catch (error) {
        logger.error('outcome-draft failed', { error: error?.message });
        return res.status(500).json({ error: 'Draft generation failed', code: 'OUTCOME_DRAFT_FAILED' });
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
        const requestedStructureMode = typeof req.body?.structureMode === 'string' ? req.body.structureMode.trim() : '';
        const requestedConfidenceScore = Number(req.body?.confidenceScore || 0);
        // Per-item estimate hours: { "0": 2, "3": 4 } — keyed by sourceLineIndex
        const itemEstimates = (req.body?.itemEstimates && typeof req.body.itemEstimates === 'object' && !Array.isArray(req.body.itemEstimates))
            ? req.body.itemEstimates : {};
        // Per-item story points from rich Teams chat format: { "0": 13, "2": 5 }
        const itemStoryPoints = (req.body?.itemStoryPoints && typeof req.body.itemStoryPoints === 'object' && !Array.isArray(req.body.itemStoryPoints))
            ? req.body.itemStoryPoints : {};
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
        const parsedIntake = parseOutcomeIntake(rawNarrative);
        const commitChildIndices = Array.isArray(req.body?.commitChildIndices)
            ? req.body.commitChildIndices.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0)
            : [];
        if (commitChildIndices.length) {
            const want = new Set(commitChildIndices);
            if (parsedIntake.structureMode === 'EPIC_WITH_STORIES' || parsedIntake.structureMode === 'STORY_WITH_SUBTASKS') {
                parsedIntake.items = parsedIntake.items.filter((_, i) => want.has(i));
                if (Array.isArray(parsedIntake.previewRows) && parsedIntake.previewRows.length > 1) {
                    const parentRow = parsedIntake.previewRows[0];
                    const childRows = parsedIntake.previewRows.slice(1).filter((_, i) => want.has(i));
                    parsedIntake.previewRows = [parentRow, ...childRows];
                }
            } else if (parsedIntake.structureMode === 'MULTIPLE_EPICS' || parsedIntake.structureMode === 'TABLE_ISSUES') {
                parsedIntake.items = parsedIntake.items.filter((_, i) => want.has(i));
                parsedIntake.previewRows = (parsedIntake.previewRows || []).filter((_, i) => want.has(i));
            }
        }
        const parentSummaryOverride = typeof req.body?.parentSummaryOverride === 'string' ? req.body.parentSummaryOverride.trim() : '';
        if (parentSummaryOverride && parsedIntake.epic) {
            parsedIntake.epic.title = parentSummaryOverride;
        }
        const structureMode = parsedIntake.structureMode;
        const embeddedIssueKey = extractFirstNarrativeIssueKey(rawNarrative);
        if (embeddedIssueKey && structureMode === 'SINGLE_ISSUE') {
            const host = resolvedJiraHost();
            const url = host ? `${host.replace(/\/+$/, '')}/browse/${embeddedIssueKey}` : '';
            return res.status(409).json({
                code: 'NARRATIVE_HAS_EXISTING_KEY',
                message: `This already has a Jira issue: ${embeddedIssueKey}. Use it.`,
                existing: { key: embeddedIssueKey, url },
            });
        }
        const summaryBase = parsedIntake?.epic?.title || 'Outcome from narrative';
        const summary = capSummary(summaryBase);
        const labels = ensureLabels(
            [
                ...(Array.isArray(req.body?.labels) ? req.body.labels : []),
                ...(Array.isArray(parsedIntake?.suggestedLabels) ? parsedIntake.suggestedLabels : []),
            ],
            projectKey,
        );
        const narrativeHash = buildNarrativeHash(rawNarrative);
        const hashLabel = `OutcomeHash_${narrativeHash}`;
        if (!labels.includes(hashLabel)) labels.push(hashLabel);

        const version3Client = createVersion3Client();
        const agileClient = createAgileClient();
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
                const normalizedIssueSummary = normalizeOutcomeTitle(issueSummary);
                const itemTitles = (parsedIntake?.items || []).map((item) => String(item?.title || '')).filter(Boolean);
                const itemSimilarity = itemTitles.reduce((best, title) => Math.max(best, jaccardSimilarity(title, issueSummary)), 0);
                const exactItemMatch = itemTitles.some((title) => normalizeOutcomeTitle(title) === normalizedIssueSummary);
                const similarity = hasHash
                    ? 1
                    : Math.max(
                        jaccardSimilarity(summaryBase, issueSummary),
                        itemSimilarity,
                        jaccardSimilarity(narrativeFragment, issueText)
                    );
                return {
                    key: issue?.key || '',
                    summary: issueSummary,
                    similarity,
                    exactItemMatch,
                };
            })
            .filter((item) => item.key)
            .sort((a, b) => b.similarity - a.similarity)[0] || null;

        if (match && (match.similarity >= 0.8 || match.exactItemMatch) && !createAnyway) {
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

        const fields = await discoverFieldsWithCache(version3Client);
        const projectCreateMeta = await discoverOutcomeProjectCreateMeta(version3Client, projectKey);
        const requestedIssueTypeName = (req.body && typeof req.body.issueTypeName === 'string' && req.body.issueTypeName.trim())
            ? req.body.issueTypeName.trim()
            : '';
        const requestedChildIssueTypeName = (req.body && typeof req.body.childIssueTypeName === 'string' && req.body.childIssueTypeName.trim())
            ? req.body.childIssueTypeName.trim()
            : '';
        const parentTypeIntent = structureMode === 'STORY_WITH_SUBTASKS'
            ? 'story'
            : ((structureMode === 'SINGLE_ISSUE' && parsedIntake.singleIssueType === 'Story') || structureMode === 'TABLE_ISSUES' ? 'story' : 'epic');
        const childTypeIntent = structureMode === 'STORY_WITH_SUBTASKS' ? 'subtask' : 'story';
        const parentSelection = resolveOutcomeIssueType(projectCreateMeta, {
            intent: parentTypeIntent,
            requestedName: requestedIssueTypeName,
            epicLinkFieldId: fields?.epicLinkFieldId || null,
            requireChildLink: false,
        });
        const childSelection = (structureMode === 'EPIC_WITH_STORIES' || structureMode === 'STORY_WITH_SUBTASKS')
            ? resolveOutcomeIssueType(projectCreateMeta, {
                intent: childTypeIntent,
                requestedName: requestedChildIssueTypeName,
                epicLinkFieldId: fields?.epicLinkFieldId || null,
                requireChildLink: true,
            })
            : null;
        const standaloneSelection = (structureMode === 'MULTIPLE_EPICS' || structureMode === 'TABLE_ISSUES')
            ? resolveOutcomeIssueType(projectCreateMeta, {
                intent: structureMode === 'MULTIPLE_EPICS' ? 'epic' : 'story',
                epicLinkFieldId: fields?.epicLinkFieldId || null,
                requireChildLink: false,
            })
            : null;
        const selectedParentType = parentSelection?.best?.issueType || null;
        const selectedChildType = childSelection?.best?.issueType || null;
        const selectedStandaloneType = standaloneSelection?.best?.issueType || null;
        const childLinkMode = childSelection?.best?.linkMode || 'none';
        const childLinkFieldId = childSelection?.best?.linkFieldId || fields?.epicLinkFieldId || '';

        const parentIssueTypeName = selectedParentType?.name || requestedIssueTypeName || (structureMode === 'SINGLE_ISSUE' ? parsedIntake.singleIssueType : 'Epic');
        const childIssueTypeName = selectedChildType?.name || requestedChildIssueTypeName || (structureMode === 'STORY_WITH_SUBTASKS' ? 'Sub-task' : 'Story');
        const standaloneIssueTypeName = selectedStandaloneType?.name || (structureMode === 'MULTIPLE_EPICS' ? 'Epic' : 'Story');

        const configurationProblems = [];
        if ((structureMode === 'SINGLE_ISSUE' || structureMode === 'EPIC_WITH_STORIES' || structureMode === 'STORY_WITH_SUBTASKS') && !selectedParentType) {
            configurationProblems.push({
                role: 'parent',
                issueTypeName: requestedIssueTypeName || 'No supported parent issue type',
                missingFields: ['Supported issue type'],
            });
        }
        if ((structureMode === 'SINGLE_ISSUE' || structureMode === 'EPIC_WITH_STORIES' || structureMode === 'STORY_WITH_SUBTASKS') && selectedParentType && parentSelection?.best?.missingRequiredFields?.length) {
            configurationProblems.push({
                role: 'parent',
                issueTypeName: selectedParentType.name,
                missingFields: parentSelection.best.missingRequiredFields.map((fieldMeta) => fieldMeta.name),
            });
        }
        if ((structureMode === 'EPIC_WITH_STORIES' || structureMode === 'STORY_WITH_SUBTASKS') && !selectedChildType) {
            configurationProblems.push({
                role: 'child',
                issueTypeName: requestedChildIssueTypeName || 'No supported child issue type',
                missingFields: ['Supported child issue type with parent linking'],
            });
        }
        if ((structureMode === 'EPIC_WITH_STORIES' || structureMode === 'STORY_WITH_SUBTASKS') && selectedChildType) {
            if (childSelection?.best?.missingRequiredFields?.length) {
                configurationProblems.push({
                    role: 'child',
                    issueTypeName: selectedChildType.name,
                    missingFields: childSelection.best.missingRequiredFields.map((fieldMeta) => fieldMeta.name),
                });
            }
            if (childLinkMode === 'none') {
                configurationProblems.push({
                    role: 'child',
                    issueTypeName: selectedChildType.name,
                    missingFields: ['Parent link field'],
                });
            }
        }
        if ((structureMode === 'MULTIPLE_EPICS' || structureMode === 'TABLE_ISSUES') && !selectedStandaloneType) {
            configurationProblems.push({
                role: 'item',
                issueTypeName: 'No supported issue type',
                missingFields: ['Supported issue type'],
            });
        }
        if ((structureMode === 'MULTIPLE_EPICS' || structureMode === 'TABLE_ISSUES') && selectedStandaloneType && standaloneSelection?.best?.missingRequiredFields?.length) {
            configurationProblems.push({
                role: 'item',
                issueTypeName: selectedStandaloneType.name,
                missingFields: standaloneSelection.best.missingRequiredFields.map((fieldMeta) => fieldMeta.name),
            });
        }
        if (configurationProblems.length) {
            throw buildOutcomeHttpError({
                status: 422,
                code: 'OUTCOME_CREATE_CONFIG_REQUIRED',
                message: `Project ${projectKey} needs extra Jira create fields before this narrative can be created automatically.`,
                details: {
                    projectKey,
                    supportedIssueTypes: projectCreateMeta?.issueTypes?.map((issueType) => issueType.name).filter(Boolean) || [],
                    problems: configurationProblems,
                },
            });
        }
        const createdChildren = [];
        const linkedExisting = [];
        const warnings = [];
        const failures = [];
        const createdStandalone = [];
        const expectedLevelsByKey = {};
        let primary = null;
        const outcomeCreateTimeoutMsRaw = Number(process.env.DELIVERA_OUTCOME_CREATE_TIMEOUT_MS || 45000);
        const outcomeCreateTimeoutMs = Number.isFinite(outcomeCreateTimeoutMsRaw) && outcomeCreateTimeoutMsRaw > 0
            ? outcomeCreateTimeoutMsRaw
            : 45000;
        const withOutcomeTimeout = async (label, fn) => {
            try {
                return await runWithTimeoutGuard(fn, {
                    timeoutMs: outcomeCreateTimeoutMs,
                    timeoutCode: 'OUTCOME_CREATE_TIMEOUT',
                    timeoutMessage: `Jira ${label} timed out after ${outcomeCreateTimeoutMs}ms. Re-authenticate Jira and retry.`,
                });
            } catch (error) {
                if (error?.code === 'OUTCOME_CREATE_TIMEOUT') {
                    throw buildOutcomeHttpError({
                        status: 504,
                        code: 'OUTCOME_CREATE_TIMEOUT',
                        message: error.message,
                    });
                }
                throw error;
            }
        };

        // Builds Jira estimate + story-points fields for a given line index
        const estimateFieldsForIndex = (lineIndex) => {
            const result = {};
            const hours = lineIndex >= 0 ? Number(itemEstimates[String(lineIndex)]) : NaN;
            if (Number.isFinite(hours) && hours > 0) {
                result.timeoriginalestimate = Math.round(hours * 3600);
            }
            const sp = lineIndex >= 0 ? Number(itemStoryPoints[String(lineIndex)]) : NaN;
            if (Number.isFinite(sp) && sp > 0 && fields?.storyPointsFieldId) {
                result[fields.storyPointsFieldId] = sp;
            }
            return result;
        };

        const createIssue = async (issueFields, issueTypeMeta = null, createContext = {}) => {
            try {
                const created = await withOutcomeTimeout('issue creation', () => version3Client.issues.createIssue({ fields: issueFields }));
                const createdKey = created?.key || '';
                return {
                    key: createdKey,
                    id: created?.id || '',
                    self: created?.self || '',
                    url: buildIssueUrl(host, createdKey),
                    issueTypeName: issueTypeMeta?.name || issueFields?.issuetype?.name || '',
                    context: createContext,
                };
            } catch (error) {
                logger.error('Jira outcome create request failed', {
                    projectKey,
                    statusCode: getErrorStatusCode(error),
                    context: createContext,
                    issueTypeName: issueTypeMeta?.name || issueFields?.issuetype?.name || '',
                    jira: extractJiraErrorData(error),
                });
                throw error;
            }
        };

        if (structureMode === 'SINGLE_ISSUE') {
            primary = await createIssue({
                summary,
                description: parsedIntake?.epic?.description || rawNarrative,
                project: { key: projectKey },
                issuetype: { name: parentIssueTypeName },
                labels,
            }, selectedParentType, { role: 'single' });
            if (primary?.key) expectedLevelsByKey[primary.key] = 'single';
        } else if (structureMode === 'MULTIPLE_EPICS' || structureMode === 'TABLE_ISSUES') {
            const duplicateTitleSeen = new Set();
            const candidateByNormalizedSummary = new Map(
                candidates
                    .map((issue) => ({
                        key: String(issue?.key || '').trim(),
                        summary: String(issue?.fields?.summary || '').trim(),
                    }))
                    .filter((entry) => entry.key && entry.summary)
                    .map((entry) => [normalizeOutcomeTitle(entry.summary), entry])
            );
            for (const [itemIdx, item] of parsedIntake.items.entries()) {
                const normalizedTitle = normalizeOutcomeTitle(item.title);
                if (!normalizedTitle) continue;
                if (duplicateTitleSeen.has(normalizedTitle)) {
                    warnings.push(`Skipped duplicate line in narrative: ${item.title}`);
                    continue;
                }
                duplicateTitleSeen.add(normalizedTitle);
                const existingKey = Array.isArray(item.jiraKeys) && item.jiraKeys.length ? item.jiraKeys[0] : '';
                if (existingKey) {
                    linkedExisting.push({ key: existingKey, url: buildIssueUrl(host, existingKey), title: item.title });
                    continue;
                }
                const directCandidate = candidateByNormalizedSummary.get(normalizedTitle);
                if (directCandidate && !createAnyway) {
                    linkedExisting.push({
                        key: directCandidate.key,
                        url: buildIssueUrl(host, directCandidate.key),
                        title: item.title,
                        reason: 'existing-summary-match',
                    });
                    continue;
                }
                try {
                    const itemHashLabel = `OutcomeItemHash_${buildOutcomeItemHash(item.title)}`;
                    const createdItem = await createIssue({
                        summary: capSummary(item.title),
                        description: item.description || item.title,
                        project: { key: projectKey },
                        issuetype: { name: standaloneIssueTypeName },
                        labels: ensureLabels([...(item.labels || []), itemHashLabel], projectKey),
                        ...estimateFieldsForIndex(commitChildIndices[itemIdx] ?? -1),
                    }, selectedStandaloneType, { role: 'standalone', title: item.title });
                    createdStandalone.push({ ...createdItem, title: item.title });
                    if (createdItem?.key) expectedLevelsByKey[createdItem.key] = 'standalone';
                } catch (error) {
                    failures.push({ title: item.title, reason: formatJiraValidationMessage(error) });
                }
            }
        } else {
            primary = await createIssue({
                summary,
                description: parsedIntake?.epic?.description || rawNarrative,
                project: { key: projectKey },
                issuetype: { name: parentIssueTypeName },
                labels,
            }, selectedParentType, { role: 'parent' });
            if (primary?.key) expectedLevelsByKey[primary.key] = 'parent';
            for (const [childIdx, item] of parsedIntake.items.entries()) {
                const itemLabels = ensureLabels(
                    [...labels, ...(Array.isArray(item.labels) ? item.labels : [])].filter((label) => !/^OutcomeHash_/i.test(label)),
                    projectKey,
                );
                const existingKey = Array.isArray(item.jiraKeys) && item.jiraKeys.length ? item.jiraKeys[0] : '';
                if (existingKey) {
                    try {
                        const updateFields = childLinkMode === 'epicLink'
                            ? { [childLinkFieldId]: primary.key }
                            : (childLinkMode === 'parent' ? { parent: { key: primary.key } } : {});
                        if (Object.keys(updateFields).length) {
                            await version3Client.issues.editIssue({
                                issueIdOrKey: existingKey,
                                fields: updateFields,
                            });
                        }
                        linkedExisting.push({ key: existingKey, url: buildIssueUrl(host, existingKey), title: item.title });
                    } catch (error) {
                        failures.push({ title: item.title, reason: formatJiraValidationMessage(error) });
                    }
                    continue;
                }
                const childFields = {
                    summary: capSummary(item.title),
                    description: item.description || item.title,
                    project: { key: projectKey },
                    issuetype: { name: childIssueTypeName },
                    labels: itemLabels,
                    ...estimateFieldsForIndex(commitChildIndices[childIdx] ?? -1),
                };
                if (childLinkMode === 'parent') childFields.parent = { key: primary.key };
                else if (childLinkMode === 'epicLink' && childLinkFieldId) childFields[childLinkFieldId] = primary.key;
                try {
                    const createdItem = await createIssue(childFields, selectedChildType, {
                        role: 'child',
                        title: item.title,
                        linkMode: childLinkMode,
                    });
                    createdChildren.push({ ...createdItem, title: item.title });
                    if (createdItem?.key) expectedLevelsByKey[createdItem.key] = 'child';
                } catch (error) {
                    failures.push({ title: item.title, reason: formatJiraValidationMessage(error) });
                }
            }
        }

        const expectedCreateCount = (parsedIntake.previewRows || []).filter((item) => !(item.jiraKeys?.length)).length;
        const createdCount = [primary?.key ? 1 : 0, createdChildren.length, createdStandalone.length].reduce((sum, value) => sum + value, 0);
        failures.forEach((item) => warnings.push(`${item.title}: ${item.reason}`));

        const createdKeysForVerification = [
            primary?.key || '',
            ...createdChildren.map((item) => item.key),
            ...createdStandalone.map((item) => item.key),
        ].filter(Boolean);
        const verification = await withOutcomeTimeout('verification', () => verifyOutcomeCreationAndBacklog({
            agileClient,
            version3Client,
            projectKey,
            issueKeys: createdKeysForVerification,
            expectedLevelsByKey,
        }));
        const responsePayload = {
            ok: true,
            verified: verification.fetchVerified && verification.backlogTopVerified,
            key: primary?.key || createdStandalone[0]?.key || null,
            url: primary?.url || createdStandalone[0]?.url || '',
            epic: structureMode === 'EPIC_WITH_STORIES' ? primary : null,
            primary,
            structureMode,
            confidenceScore: parsedIntake.confidenceScore,
            confidenceLabel: parsedIntake.confidenceLabel,
            createdCount,
            expectedCreateCount,
            issueCount: createdCount + linkedExisting.length,
            childIssues: createdChildren,
            linkedExisting,
            createdStandalone,
            projectKey,
            primaryIssueTypeName: parentIssueTypeName,
            childIssueTypeName,
            standaloneIssueTypeName,
            failures,
            warnings,
            verification,
            createdIssues: [
                ...(primary?.key ? [{ key: primary.key, url: primary.url || '' }] : []),
                ...createdChildren.map((item) => ({ key: item.key, url: item.url || '' })),
                ...createdStandalone.map((item) => ({ key: item.key, url: item.url || '' })),
            ],
            summaryHtml: buildOutcomeSummaryHtml({
                structureMode,
                primary,
                childIssues: createdChildren,
                createdCount,
                expectedCreateCount,
                failures,
                projectKey,
                verification,
            }),
            dedupe: match && match.similarity >= 0.8 ? { bypassed: true, key: match.key } : null,
        };

        await appendOutcomeIntakeLog({
            createdAt: new Date().toISOString(),
            projectKey,
            userId: req.session?.user?.id || null,
            narrative: rawNarrative,
            parsed: parsedIntake,
            requestedStructureMode,
            requestedConfidenceScore,
            response: {
                primaryKey: primary?.key || null,
                childKeys: createdChildren.map((item) => item.key),
                standaloneKeys: createdStandalone.map((item) => item.key),
                linkedExisting: linkedExisting.map((item) => item.key),
                failures,
                warnings,
                verification,
            },
        }).catch((error) => {
            logger.warn('Failed to append outcome intake log', { error: error?.message });
        });

        logger.info('Outcome issue created from narrative', {
            projectKey,
            key: responsePayload.key,
            labels,
            hashLabel,
            structureMode,
            primaryIssueTypeName: parentIssueTypeName,
            childIssueTypeName,
            confidenceScore: parsedIntake.confidenceScore,
            childCount: createdChildren.length,
            linkedExisting: linkedExisting.length,
            failures: failures.length,
            verification,
        });
        if (!verification.fetchVerified || verification.backlogErrors.length || !verification.backlogTopVerified) {
            logger.warn('Outcome issue verification requires attention', {
                projectKey,
                key: responsePayload.key,
                verification,
            });
        }
        return res.json(responsePayload);
    } catch (error) {
        await appendOutcomeIntakeLog({
            createdAt: new Date().toISOString(),
            projectKey: req.body?.projectKey || '',
            userId: req.session?.user?.id || null,
            narrative: req.body?.narrative || '',
            requestedStructureMode: req.body?.structureMode || '',
            requestedConfidenceScore: Number(req.body?.confidenceScore || 0),
            error: error?.message || 'Unexpected error',
        }).catch(() => {});
        const statusCode = error?.httpStatus || getErrorStatusCode(error);
        const jira = extractJiraErrorData(error);
        logger.error('Error creating outcome issue from narrative', {
            error: error.message,
            statusCode,
            jira,
        });
        if (error?.clientPayload) {
            return res.status(error.httpStatus || 422).json(error.clientPayload);
        }
        const message = formatJiraValidationMessage(error);
        const payload = {
            error: statusCode >= 500 ? 'Failed to create Jira issue from narrative' : 'Jira rejected the outcome payload',
            code: statusCode === 400 ? 'JIRA_CREATE_VALIDATION_FAILED' : 'OUTCOME_CREATE_FAILED',
            message,
            details: Object.keys(jira || {}).length ? jira : null,
        };
        return res.status(statusCode === 400 ? 422 : statusCode).json(payload);
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

router.get('/api/quarterly-kpi-summary.json', requireAuth, async (req, res) => {
    try {
        const projectsParam = String(req.query.projects || '').trim();
        const projectKeys = projectsParam ? projectsParam.split(',').map((p) => p.trim()).filter(Boolean) : [];
        if (!projectKeys.length) {
            res.status(400).json({
                error: 'Missing projects',
                code: 'MISSING_PROJECTS',
                message: 'At least one project key is required.',
            });
            return;
        }

        const windowStart = req.query.start || DEFAULT_WINDOW_START;
        const windowEnd = req.query.end || DEFAULT_WINDOW_END;

        const kpiPayload = await buildQuarterlyKPIForProjects({
            projectKeys,
            windowStart,
            windowEnd,
            projectRoot: join(__dirname, '..'),
        });

        res.json(kpiPayload);
    } catch (error) {
        logger.error('Failed to build quarterly KPI summary', {
            error,
        });
        res.status(500).json({
            error: 'Failed to build quarterly KPI summary',
            code: 'QUARTERLY_KPI_FAILED',
            message: error?.message || 'Unexpected error while computing quarterly KPIs.',
        });
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
        const { email, message, category, context } = req.body || {};
        const trimmedMessage = typeof message === 'string' ? message.trim() : '';
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '';
        if (!trimmedMessage) return res.status(400).json({ error: 'Message required' });
        if (!feedbackRateLimitByIp.check(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });
        await mkdir(FEEDBACK_DIR, { recursive: true });
        const feedbackEntry = {
            submittedAt: new Date().toISOString(),
            email: typeof email === 'string' ? email.trim() : '',
            message: trimmedMessage,
            category: typeof category === 'string' ? category.trim().slice(0, 64) : '',
            context: context && typeof context === 'object' ? context : null,
            userAgent: req.headers['user-agent'] || '',
            ip,
            user: (req.session && req.session.user) ? { id: req.session.user.id } : null,
        };
        const line = `${JSON.stringify(feedbackEntry)}\n`;
        // Migration edge case: dual-write while some jobs still read the legacy filename.
        await Promise.all([
            appendFile(FEEDBACK_FILE, line, 'utf-8'),
            appendFile(LEGACY_FEEDBACK_FILE, line, 'utf-8'),
        ]);
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
