import { cache } from '../lib/cache.js';
import { createVersion3Client } from '../lib/jiraClients.js';
import { resolveProviderConfig } from '../lib/Delivera-AI-Provider-Gateway.js';
import { logger, buildRequestLogContext } from '../lib/Delivera-Server-Logging-Utility.js';
import { proposeFromBoardCache, proposeFromSlideImage } from '../lib/Delivera-Governance-PIBaseline-03Propose-Agent.js';
import {
    loadEpicActivityFromBriefCache,
    enrichCandidatesWithEpicActivity,
    enrichActivityFromJiraExistence,
} from '../lib/Delivera-Governance-PIBaseline-04Epic-Activity-Intelligence-SSOT.js';

const GOVERNANCE_NAMESPACE = 'governanceBrief';

function requestProjects(req, parseGovernanceProjects) {
    if (Array.isArray(req.body?.projects) && req.body.projects.length) {
        return req.body.projects.map((project) => String(project).trim().toUpperCase()).filter(Boolean);
    }
    if (req.body?.projectsCsv) {
        return String(req.body.projectsCsv).split(',').map((project) => project.trim().toUpperCase()).filter(Boolean);
    }
    return parseGovernanceProjects(req);
}

function errorAction(code) {
    return code === 'AI_PROVIDER_LIMIT_REACHED' || code === 'AI_PROVIDER_AUTH_FAILED'
        ? { href: '/settings', label: 'Check AI provider' }
        : { label: 'Retry upload' };
}

export function createPiBaselineSlideUploadHandler({ parseGovernanceProjects }) {
    return async function piBaselineSlideUpload(req, res) {
        try {
            const imageBase64 = String(req.body?.imageBase64 || '').trim();
            const mimeType = String(req.body?.mimeType || 'image/png').trim();
            const projects = requestProjects(req, parseGovernanceProjects);
            const quarter = String(req.body?.quarter || '').trim();
            const squad = String(req.body?.squad || '').trim().toUpperCase();
            if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required', code: 'MISSING_IMAGE' });
            if (imageBase64.length > 6_000_000) return res.status(400).json({ error: 'Image too large (max ~4MB)', code: 'IMAGE_TOO_LARGE' });

            const providerConfig = resolveProviderConfig(req.headers || {});
            if (!providerConfig.apiKey || providerConfig.provider === 'built-in') {
                return res.status(400).json({ error: 'AI provider key required for slide reading. Add OpenAI or Claude key in Settings.', code: 'AI_KEY_REQUIRED' });
            }
            const board = await proposeFromBoardCache({ projects, cache, quarter });
            const boardEpics = (board.candidates || []).map((candidate) => ({ issueKey: candidate.issueKey, title: candidate.title, summary: candidate.title }));
            const result = await proposeFromSlideImage({ imageBase64, mimeType, projects, quarter, providerConfig, boardEpics, squad });
            let activity = await loadEpicActivityFromBriefCache({ projects, cache, namespace: GOVERNANCE_NAMESPACE });
            let version3Client = null;
            try { version3Client = createVersion3Client(); } catch (_) { version3Client = null; }
            if (version3Client) activity = await enrichActivityFromJiraExistence(result.candidates || [], activity, version3Client, 10);
            return res.json({ ...result, candidates: enrichCandidatesWithEpicActivity(result.candidates || [], activity), cached: false });
        } catch (err) {
            const httpStatus = Number(err?.httpStatus) || 500;
            const code = String(err?.code || 'AI_SLIDE_PROPOSE_FAILED');
            logger.warn('pi-baseline propose-from-image failed', buildRequestLogContext(req, {
                code, status: httpStatus,
                projects: Array.isArray(req.body?.projects) ? req.body.projects.join(',') : req.body?.projectsCsv,
                squad: req.body?.squad || '', quarter: req.body?.quarter || '', error: err?.message,
            }));
            const publicMessage = err?.code
                ? String(err.message || 'Slide reading failed. Retry the upload.')
                : 'Slide reading failed. Your file was not saved. Retry the upload.';
            return res.status(httpStatus).json({
                error: publicMessage,
                code, retryable: err?.retryable !== false, action: errorAction(code),
            });
        }
    };
}
