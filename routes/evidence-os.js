import express from 'express';
import { requireAuth } from '../lib/middleware.js';
import { requirePermission } from '../lib/Delivera-Identity-02RBAC-Middleware.js';
import { readEvidenceOsStore } from '../lib/Delivera-EvidenceOS-00Store-IO.js';
import { listEvidence, createEvidence, linkEvidence } from '../lib/Delivera-Evidence-01Service.js';
import { listContributions, createContribution, updateContributionValidation } from '../lib/Delivera-Contribution-01Service.js';
import { listGoals, createGoal, addGoalAmendment, scoreProgress, detectLinkedCommitments, linkExistingCommitment } from '../lib/Delivera-Goal-01Service.js';
import { listValidationRequests, createValidationRequest, recordValidationResponse } from '../lib/Delivera-Validation-01Service.js';
import { listReports, createReportSnapshot } from '../lib/Delivera-Report-01Snapshot-Service.js';
import { runStructuredAITask, AI_TASK_TYPES } from '../lib/Delivera-AI-Orchestrator-01Router-SSOT.js';
import { buildEvidenceOsCockpit, recordAgentActivity } from '../lib/Delivera-EvidenceOS-Insight-01Service.js';

const router = express.Router();

const enabled = () => process.env.EVIDENCE_OS_ENABLED !== '0';
const writeMeta = (req) => ({ requestId: req.requestId, ip: req.ip || req.connection?.remoteAddress || '' });

function guardEnabled(_req, res, next) {
  if (enabled()) return next();
  return res.status(404).json({ error: 'Evidence OS is disabled', code: 'EVIDENCE_OS_DISABLED' });
}

function sendError(res, err) {
  const code = err?.code || 'EVIDENCE_OS_FAILED';
  const status = /NOT_FOUND/.test(code) ? 404 : /BLOCKED|DENIED|TIER4|REQUIRES/.test(code) ? 422 : 500;
  return res.status(status).json({ error: err?.message || 'Evidence OS failed', code });
}

router.use('/api/evidence-os', requireAuth, guardEnabled, ...requirePermission('evidence:read'));

router.get('/api/evidence-os/summary', async (req, res) => {
  try {
    const [store, evidence, contributions, goals, validations, reports] = await Promise.all([
      readEvidenceOsStore(),
      listEvidence(req.identity),
      listContributions(req.identity),
      listGoals(req.identity),
      listValidationRequests(req.identity),
      listReports(req.identity),
    ]);
    res.json({
      identity: req.identity,
      counts: {
        evidence: evidence.length,
        contributions: contributions.length,
        goals: goals.length,
        validations: validations.length,
        reports: reports.length,
        auditEvents: store.auditEvents.filter((a) => a.organizationId === req.identity.orgId).length,
      },
      contributionTypes: store.contributionTypes.filter((t) => t.organizationId === req.identity.orgId),
      edgePolicies: [
        'No contribution is created from Jira assignee alone.',
        'AI interpretation evidence is Tier 4 and cannot verify outcomes.',
        'no_response is stored separately from not_confirmed.',
        'Report snapshots keep explicit validation gap sections.',
      ],
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/api/evidence-os/cockpit', async (req, res) => {
  try { res.json(await buildEvidenceOsCockpit(req.identity)); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/agents/run', ...requirePermission('evidence:write'), async (req, res) => {
  try {
    const activity = await recordAgentActivity(req.identity, {
      agent: req.body?.agent || 'Delivery Observer',
      action: req.body?.action || 'Scanned Jira and evidence records',
      detail: req.body?.detail || 'Detected contribution, commitment, validation, and manager brief signals.',
      status: 'complete',
    });
    res.status(201).json({ activity, cockpit: await buildEvidenceOsCockpit(req.identity) });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/api/evidence-os/evidence', async (req, res) => {
  try { res.json({ evidence: await listEvidence(req.identity) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/evidence', ...requirePermission('evidence:write'), async (req, res) => {
  try { res.status(201).json({ evidence: await createEvidence(req.identity, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/evidence-links', ...requirePermission('evidence:write'), async (req, res) => {
  try { res.status(201).json({ link: await linkEvidence(req.identity, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.get('/api/evidence-os/contributions', async (req, res) => {
  try { res.json({ contributions: await listContributions(req.identity) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/contributions', ...requirePermission('evidence:write'), async (req, res) => {
  try { res.status(201).json({ contribution: await createContribution(req.identity, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.patch('/api/evidence-os/contributions/:id/validation', ...requirePermission('evidence:validate'), async (req, res) => {
  try { res.json({ contribution: await updateContributionValidation(req.identity, req.params.id, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.get('/api/evidence-os/goals', async (req, res) => {
  try { res.json({ goals: await listGoals(req.identity) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/goals', ...requirePermission('goal:write'), async (req, res) => {
  try { res.status(201).json({ goal: await createGoal(req.identity, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.get('/api/evidence-os/commitments/detect', async (req, res) => {
  try { res.json({ commitments: await detectLinkedCommitments(req.identity, req.query || {}) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/commitments/link', ...requirePermission('goal:write'), async (req, res) => {
  try { res.status(201).json({ commitment: await linkExistingCommitment(req.identity, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/goals/:id/amendments', ...requirePermission('goal:write'), async (req, res) => {
  try { res.status(201).json({ amendment: await addGoalAmendment(req.identity, req.params.id, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.get('/api/evidence-os/goals/:id/score', async (req, res) => {
  try { res.json(await scoreProgress(req.params.id, req.query.asOfDate || new Date())); } catch (err) { sendError(res, err); }
});

router.get('/api/evidence-os/validation-requests', async (req, res) => {
  try { res.json({ validationRequests: await listValidationRequests(req.identity) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/validation-requests', ...requirePermission('evidence:write'), async (req, res) => {
  try { res.status(201).json({ validationRequest: await createValidationRequest(req.identity, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/validation-requests/draft', ...requirePermission('evidence:write'), async (req, res) => {
  try {
    const contribution = (await listContributions(req.identity)).find((c) => c.id === req.body?.contributionId) || (await listContributions(req.identity))[0];
    const humanPrompt = contribution
      ? `Albert recorded that he ${contribution.individualActionStatement || 'supported delivery'} on ${contribution.workItemKey || 'a delivery item'} and observed: ${contribution.impactStatement || 'outcome needs confirmation'}. Did you directly observe this?`
      : 'Albert recorded a delivery contribution. Did you directly observe the outcome?';
    res.json({
      channel: 'teams_or_email',
      retryPolicy: 'retry_once_then_suggest_alternate_validator',
      neutralNoResponse: true,
      prompt: humanPrompt,
      actions: ['Confirm', 'Partly confirm', 'Need correction'],
      whyNeeded: 'Only material outcomes need stakeholder confirmation before manager or calibration use.',
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/api/evidence-os/validation-requests/:id/responses', async (req, res) => {
  try { res.status(201).json({ validationResponse: await recordValidationResponse(req.identity, req.params.id, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.get('/api/evidence-os/reports', async (req, res) => {
  try { res.json({ reports: await listReports(req.identity) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/reports', ...requirePermission('report:write'), async (req, res) => {
  try { res.status(201).json({ report: await createReportSnapshot(req.identity, req.body, writeMeta(req)) }); } catch (err) { sendError(res, err); }
});

router.post('/api/evidence-os/ai/draft', ...requirePermission('evidence:write'), async (req, res) => {
  try {
    const taskType = req.body?.taskType || AI_TASK_TYPES.CONTRIBUTION_DRAFT;
    const result = await runStructuredAITask(taskType, req.body?.payload || {}, {
      reqHeaders: req.headers,
      runId: `evidence-os-${taskType}-${Date.now()}`,
    });
    const evidence = await createEvidence(req.identity, {
      tier: 'ai_interpretation',
      sourceType: `ai:${taskType}`,
      title: 'AI draft',
      statement: JSON.stringify(result.result),
      sourceSnapshotJson: { taskType, sourceRecordIds: req.body?.sourceRecordIds || [], fallbackUsed: result.fallbackUsed },
    }, writeMeta(req));
    res.status(201).json({ ...result, tier4Evidence: evidence });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
