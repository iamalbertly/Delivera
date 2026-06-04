// SIZE-EXEMPT: Central API surface keeps route handlers co-located for auth, caching, and
// error-contract consistency across report/current-sprint/outcome flows.
import express from 'express';
import { requireAuth } from '../lib/middleware.js';
import { logger, buildRequestLogContext } from '../lib/Delivera-Server-Logging-Utility.js';
import { cache, CACHE_TTL, CACHE_KEYS, buildCurrentSprintSnapshotCacheKey } from '../lib/cache.js';
import { createAgileClient, createVersion3Client } from '../lib/jiraClients.js';
import { fetchSprintsForBoard } from '../lib/sprints.js';
import { buildCurrentSprintPayload } from '../lib/currentSprint.js';
import { streamCSV, CSV_COLUMNS } from '../lib/csv.js';
import { generateExcelWorkbook, generateExcelFilename, formatDateRangeForFilename } from '../lib/excel.js';
import { getQuarterLabelAndPeriod, getQuartersUpToCurrent } from '../lib/Delivera-Data-VodacomQuarters-01Bounds.js';
import { DEFAULT_WINDOW_START, DEFAULT_WINDOW_END } from '../lib/Delivera-Config-DefaultWindow.js';
import { discoverBoardsWithCache, discoverFieldsWithCache, recordActivity, resolveJiraHostFromEnv } from '../lib/server-utils.js';
import { normalizeNotesPayload, upsertCurrentSprintNotes } from '../lib/notes-store.js';
import { previewHandler } from '../lib/preview-handler.js';
import { getUnifiedRiskCounts } from '../public/Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
import { appEnvConfig } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';
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
import { assembleGovernanceBrief } from '../lib/Delivera-Governance-Brief-03Assemble-Service.js';
import { savePIBaseline, getLatestPIBaseline, listPIBaselines } from '../lib/Delivera-Governance-PIBaseline-01Store-IO.js';
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
import {
    resolveEffectiveGovernanceProfile,
    saveProfileOverride,
    listProfileOverrides,
} from '../lib/Delivera-Governance-Profile-01Resolve-SSOT.js';
import { buildImpactPack, impactPackMonthKey } from '../lib/Delivera-Governance-Worker-05ImpactPack-Builder.js';
import { clampConfidenceToFreshness } from '../lib/Delivera-Governance-Grammar-01Rules-SSOT.js';
import { buildQuarterlyKPIForProjects } from '../lib/Delivera-Data-QuarterlyKPI-Calculator.js';
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

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, appendFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FEEDBACK_DIR = join(__dirname, '..', 'data');
const FEEDBACK_FILE = join(FEEDBACK_DIR, 'Delivera-Feedback-UserInput-Submission-Log.jsonl');
const LEGACY_FEEDBACK_FILE = join(FEEDBACK_DIR, 'JiraReporting-Feedback-UserInput-Submission-Log.jsonl');
const OUTCOME_INTAKE_LOG_FILE = join(FEEDBACK_DIR, 'Delivera-Outcome-Intake-Log.jsonl');
const LEGACY_OUTCOME_INTAKE_LOG_FILE = join(FEEDBACK_DIR, 'JiraReporting-Outcome-Intake-Log.jsonl');
const OUTCOME_CREATE_META_TTL = 20 * 60 * 1000;

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
        const payload = { projects: selectedProjects, boards: list };
        if (projectErrors.length) payload.jiraErrors = projectErrors;
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
                    logger.warn('Serving stale current-sprint during Jira outage', buildRequestLogContext(req, { boardId, staleAgeMs: staleEntry.staleAgeMs }));
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
        : ['MPSA', 'MAS'];
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

async function getOrBuildGovernanceBrief({ projects, req, includeEvidence = true, includePOReadiness = true }) {
    const cacheKey = `${GOVERNANCE_NS}:${projects.join(',')}:e${includeEvidence ? 1 : 0}:p${includePOReadiness ? 1 : 0}`;
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
        period: { vodacomQuarter: null, sprintNames: [] },
        cache, providerConfig, includeEvidence, includePOReadiness, baseline, profileOverrides,
    });
    await cache.set(cacheKey, brief, GOVERNANCE_BRIEF_TTL_MS, { namespace: GOVERNANCE_NS });
    // Safe telemetry: counts only, never issue bodies.
    logger.info('governance-brief built', {
        projects: projects.join(','), boards: brief.meta?.boardsResolved,
        risks: brief.risks?.length || 0, narratedBy: brief.meta?.narratedBy,
        evidenceFetched: brief.meta?.evidenceFetched,
    });
    return { brief, cached: false };
}

async function serveStaleBriefOrError(res, projects, err) {
    const cacheKey = `${GOVERNANCE_NS}:${projects.join(',')}:e1:p1`;
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
    try {
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
            const cacheKey = `${GOVERNANCE_NS}:${projects.join(',')}:e1:p1`;
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
        const row = await resolveInboxItem(id, { resolution, editedContent, userId });
        if (resolution === 'approved' && row.type === 'brief' && editedContent) {
            const projects = parseGovernanceProjects(req);
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
        const agileClient = createAgileClient();
        const { boards, projectErrors } = await discoverBoardsWithCache(projects, agileClient);
        const { brief } = await getOrBuildGovernanceBrief({ projects, req, includeEvidence: false, includePOReadiness: false });
        const scope = brief?.meta?.scopeIntelligence || buildScopeIntelligence({
            boards,
            boardPayloads: [],
            selectedProjects: projects,
            projectErrors,
        });
        return res.json({ scope, boards: boards.length, projectErrors });
    } catch (err) {
        logger.warn('governance scope-intelligence failed', { error: err?.message });
        return res.status(500).json({ error: 'Scope intelligence failed' });
    }
});

router.get('/api/governance/pi-confidence.json', requireAuth, async (req, res) => {
    try {
        const projects = parseGovernanceProjects(req);
        const { brief } = await getOrBuildGovernanceBrief({ projects, req });
        const piConfidence = brief?.meta?.piConfidence || buildPIConfidenceStrip(brief);
        return res.json({
            piConfidence,
            piForumAnswer: brief?.meta?.piForumAnswer || '',
            protectMeAnswer: brief?.meta?.protectMeAnswer || '',
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
        const cacheKey = `${GOVERNANCE_NS}:${projects.join(',')}:e1:p1`;
        const cached = await cache.get(cacheKey, { namespace: GOVERNANCE_NS });
        const brief = cached?.value || cached || {};
        const workerReceipt = await buildWorkerReceipt(brief, grouped, jobs);
        return res.json({
            workerReceipt,
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
        const version3Client = createVersion3Client();
        const candidates = [];
        const quarterRe = /Q[1-4]|FY\d{2}|PI\s*\d/i;
        for (const pk of projects.slice(0, 3)) {
            try {
                const jql = `project = ${pk} AND issuetype in (Epic, Story) ORDER BY updated DESC`;
                const resJira = await version3Client.issueSearch.searchForIssuesUsingJql({
                    jql,
                    maxResults: 50,
                    fields: ['summary', 'status', 'fixVersions', 'labels'],
                });
                const issues = resJira?.issues || [];
                for (const issue of issues) {
                    const key = issue?.key || '';
                    const fvs = (issue?.fields?.fixVersions || []).map((v) => v?.name || '').filter(Boolean);
                    const matchFv = fvs.find((n) => quarterRe.test(n));
                    const labels = issue?.fields?.labels || [];
                    const matchLabel = labels.some((l) => quarterRe.test(String(l)));
                    if (matchFv || matchLabel) {
                        candidates.push({
                            issueKey: key,
                            title: issue?.fields?.summary || '',
                            squad: pk,
                            fixVersion: matchFv || '',
                            method: matchFv ? 'fix-version' : 'label',
                        });
                    }
                }
            } catch (err) {
                logger.warn('pi-baseline propose jql failed', { project: pk, error: err?.message });
            }
        }
        const method = candidates.length ? 'fix-version-or-label' : 'manual';
        return res.json({
            method,
            candidates: candidates.slice(0, 42),
            guidance: candidates.length
                ? null
                : 'No quarter-labeled fix versions found. Enter PI items manually.',
        });
    } catch (err) {
        logger.warn('pi-baseline propose failed', { error: err?.message });
        return res.status(500).json({ error: 'Propose failed' });
    }
});

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
