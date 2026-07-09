/**
 * SSOT: PI baseline governance API routes (extracted from api.js).
 */
import { logger } from '../lib/Delivera-Server-Logging-Utility.js';
import { savePIBaseline, getLatestPIBaseline, listPIBaselines } from '../lib/Delivera-Governance-PIBaseline-01Store-IO.js';
import {
  runProposePipeline,
  proposeFromSlideImage,
  proposeFromBoardCache,
  reconcileSlideEpics,
} from '../lib/Delivera-Governance-PIBaseline-03Propose-Agent.js';
import { createEpicsFromSlideResolved } from '../lib/Delivera-Governance-PIBaseline-06Slide-Epic-Create-SSOT.js';
import {
  loadEpicActivityFromBriefCache,
  enrichCandidatesWithEpicActivity,
  enrichActivityFromJiraExistence,
} from '../lib/Delivera-Governance-PIBaseline-04Epic-Activity-Intelligence-SSOT.js';
import { resolveProviderConfig } from '../lib/Delivera-AI-Provider-Gateway.js';
import { buildAiProviderStatus } from '../lib/Delivera-AI-Provider-Status-01SSOT.js';

function parseProjectsFromBodyOrQuery(req, bodyProjects, bodyCsv) {
  if (Array.isArray(bodyProjects) && bodyProjects.length) {
    return bodyProjects.map((p) => String(p).trim().toUpperCase()).filter(Boolean);
  }
  if (bodyCsv) {
    return String(bodyCsv).split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
  }
  const raw = req.query?.projects;
  return raw != null
    ? Array.from(new Set(String(raw).split(',').map((p) => p.trim().toUpperCase()).filter(Boolean)))
    : ['MPSA', 'MAS'];
}

/**
 * @param {import('express').Router} router
 * @param {object} deps
 */
export function registerPiBaselineRoutes(router, deps) {
  const {
    requireAuth,
    cache,
    GOVERNANCE_NS,
    createVersion3Client,
    resolvedJiraHost,
    discoverFieldsWithCache,
    discoverOutcomeProjectCreateMeta,
    resolveOutcomeIssueType,
  } = deps;

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

  router.get('/api/governance/pi-baseline/propose', requireAuth, async (req, res) => {
    try {
      const projects = parseProjectsFromBodyOrQuery(req);
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

  router.post('/api/governance/pi-baseline/propose-from-image', requireAuth, async (req, res) => {
    try {
      const imageBase64 = String(req.body?.imageBase64 || '').trim();
      const mimeType = String(req.body?.mimeType || 'image/png').trim();
      const projects = parseProjectsFromBodyOrQuery(req, req.body?.projects, req.body?.projectsCsv);
      const quarter = String(req.body?.quarter || '').trim();
      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required', code: 'MISSING_IMAGE' });
      }
      if (imageBase64.length > 6_000_000) {
        return res.status(400).json({ error: 'Image too large (max ~4MB)', code: 'IMAGE_TOO_LARGE' });
      }
      const providerConfig = resolveProviderConfig(req.headers || {});
      if (!providerConfig.apiKey || providerConfig.provider === 'built-in') {
        const envStatus = buildAiProviderStatus({});
        const missing = envStatus.slideVision?.envReady ? 'browser_key' : 'server_env';
        return res.status(400).json({
          error: 'AI provider key required for slide reading. Configure OpenRouter, OpenAI, or Claude in .env or Settings.',
          code: 'AI_KEY_REQUIRED',
          missing,
          providers: ['openrouter', 'openai', 'claude'],
        });
      }
      const board = await proposeFromBoardCache({ projects, cache, quarter });
      const boardEpics = (board.candidates || []).map((c) => ({
        issueKey: c.issueKey,
        title: c.title,
        summary: c.title,
      }));
      let version3Client = null;
      try { version3Client = createVersion3Client(); } catch (_) { version3Client = null; }
      let result = await proposeFromSlideImage({
        imageBase64,
        mimeType,
        projects,
        quarter,
        providerConfig,
        boardEpics,
        version3Client,
      });
      let activity = await loadEpicActivityFromBriefCache({ projects, cache, namespace: GOVERNANCE_NS });
      if (version3Client) {
        activity = await enrichActivityFromJiraExistence(result.candidates || [], activity, version3Client, 10);
      }
      result = {
        ...result,
        candidates: enrichCandidatesWithEpicActivity(result.candidates || [], activity),
      };
      return res.json({ ...result, cached: false });
    } catch (err) {
      logger.warn('pi-baseline propose-from-image failed', { error: err?.message });
      return res.status(500).json({ error: String(err?.message || 'Slide propose failed') });
    }
  });

  router.post('/api/governance/pi-baseline/reconcile-slide-epics', requireAuth, async (req, res) => {
    try {
      const resolved = Array.isArray(req.body?.resolved) ? req.body.resolved : [];
      const projects = parseProjectsFromBodyOrQuery(req, req.body?.projects);
      const quarter = String(req.body?.quarter || '').trim();
      if (!resolved.length) {
        return res.status(400).json({ error: 'resolved[] is required', code: 'MISSING_RESOLVED' });
      }
      const board = await proposeFromBoardCache({ projects, cache, quarter });
      const boardEpics = (board.candidates || []).map((c) => ({
        issueKey: c.issueKey,
        title: c.title,
        summary: c.title,
      }));
      let version3Client = null;
      try { version3Client = createVersion3Client(); } catch (_) { version3Client = null; }
      let result = await reconcileSlideEpics({
        version3Client,
        resolved,
        projects,
        boardEpics,
        quarter,
      });
      let activity = await loadEpicActivityFromBriefCache({ projects, cache, namespace: GOVERNANCE_NS });
      if (version3Client) {
        activity = await enrichActivityFromJiraExistence(result.candidates || [], activity, version3Client, 10);
      }
      result = {
        ...result,
        candidates: enrichCandidatesWithEpicActivity(result.candidates || [], activity),
      };
      return res.json(result);
    } catch (err) {
      logger.warn('pi-baseline reconcile-slide-epics failed', { error: err?.message });
      return res.status(500).json({ error: String(err?.message || 'Reconcile failed') });
    }
  });

  router.post('/api/governance/pi-baseline/create-epics-from-slide', requireAuth, async (req, res) => {
    try {
      const resolved = Array.isArray(req.body?.resolved) ? req.body.resolved : [];
      const projects = parseProjectsFromBodyOrQuery(req, req.body?.projects);
      const quarter = String(req.body?.quarter || '').trim();
      const actions = (req.body?.actions && typeof req.body.actions === 'object') ? req.body.actions : {};
      const createAnyway = req.body?.createAnyway === true;
      const includeChildStories = req.body?.includeChildStories !== false;
      if (!resolved.length) {
        return res.status(400).json({ error: 'resolved[] is required', code: 'MISSING_RESOLVED' });
      }
      if (!projects.length) {
        return res.status(400).json({ error: 'projects required', code: 'MISSING_PROJECT' });
      }
      let version3Client;
      try {
        version3Client = createVersion3Client();
      } catch (err) {
        return res.status(503).json({ error: String(err?.message || 'Jira unavailable'), code: 'JIRA_UNAVAILABLE' });
      }
      const host = resolvedJiraHost();
      const fields = await discoverFieldsWithCache(version3Client);
      const projectCreateMeta = await discoverOutcomeProjectCreateMeta(version3Client, projects[0]);
      const epicSelection = resolveOutcomeIssueType(projectCreateMeta, {
        intent: 'epic',
        epicLinkFieldId: fields?.epicLinkFieldId || null,
        requireChildLink: false,
      });
      const epicIssueTypeId = epicSelection?.best?.issueType?.id || null;
      const result = await createEpicsFromSlideResolved({
        version3Client,
        resolved,
        projects,
        quarter,
        actions,
        createAnyway,
        includeChildStories,
        createHelpers: {
          epicIssueTypeId,
          epicLinkFieldId: fields?.epicLinkFieldId || null,
          host,
        },
      });
      const blocked = (result.errors || []).filter((e) => e.code === 'DUPLICATE_RISK_BLOCKED');
      if (blocked.length && !result.created.length && !result.linked.length) {
        return res.status(409).json({
          code: 'DUPLICATE_RISK_BLOCKED',
          message: 'Duplicate risk — review before creating',
          ...result,
        });
      }
      let reconcile = null;
      try {
        const board = await proposeFromBoardCache({ projects, cache, quarter });
        const boardEpics = (board.candidates || []).map((c) => ({
          issueKey: c.issueKey,
          title: c.title,
          summary: c.title,
        }));
        reconcile = await reconcileSlideEpics({
          version3Client,
          resolved: result.resolved || resolved,
          projects,
          boardEpics,
          quarter,
        });
        let activity = await loadEpicActivityFromBriefCache({ projects, cache, namespace: GOVERNANCE_NS });
        activity = await enrichActivityFromJiraExistence(reconcile.candidates || [], activity, version3Client, 10);
        reconcile = {
          ...reconcile,
          candidates: enrichCandidatesWithEpicActivity(reconcile.candidates || [], activity),
        };
      } catch (_) { /* reconcile optional after create */ }
      return res.json({ ...result, reconcile });
    } catch (err) {
      logger.warn('pi-baseline create-epics-from-slide failed', { error: err?.message });
      return res.status(500).json({ error: String(err?.message || 'Create epics failed') });
    }
  });
}
