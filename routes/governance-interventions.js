import express from 'express';
import { requireAuth } from '../lib/middleware.js';
import { logger } from '../lib/Delivera-Server-Logging-Utility.js';
import { saveProfileOverride, listProfileOverrides } from '../lib/Delivera-Governance-Profile-01Resolve-SSOT.js';
import { createAgentToolsRegistry } from '../lib/Delivera-Agent-Tools-01Registry-SSOT.js';
import {
  getInterventionCase,
  getCompactInterventionCases,
  listInterventionCases,
  patchInterventionCase,
  transitionInterventionCase,
  upsertInterventionCase,
  INTERVENTION_STATES,
} from '../lib/Delivera-Governance-InterventionCase-02Store-IO.js';
import { normalizeProjectKey } from '../lib/Delivera-Governance-InterventionCase-01SSOT.js';
import { upsertCaseAction } from '../lib/Delivera-Governance-ActionRegister-01Store-IO.js';
import { collectCaseEvidence } from '../lib/Delivera-Governance-CaseEvidence-01Collector.js';
import { resolveGovernanceRole, canSendToResolvedRole } from '../lib/Delivera-Governance-RoleResolver-01SSOT.js';
import { buildGovernanceNudgeDraft, isScopeConfirmationTrigger } from '../lib/Delivera-Governance-ScopeNudge-01Draft-SSOT.js';
import { buildEscalationDraft, resolveEscalationLevel } from '../lib/Delivera-Governance-Escalation-01Ladder-SSOT.js';
import { recordImprovementEvent } from '../lib/Delivera-Improvement-Events-01Store-IO.js';
import { appendInboxItem } from '../lib/Delivera-Governance-Worker-02Jobs-IO.js';
import {
  getOrBuildPortfolioDecision,
  invalidatePortfolioDecisionForScope,
  invalidatePortfolioDecisionForCase,
  compactCasesForScope,
} from '../lib/Delivera-Governance-PortfolioDecision-01Service.js';
import { resolveBaselineMissingFromBrief } from '../lib/Delivera-Governance-PortfolioDecision-01SSOT.js';

const router = express.Router();

export function riskListFromBrief(body = {}) {
  const brief = body.brief || {};
  const direct = Array.isArray(body.risks) ? body.risks : [];
  const candidates = [
    ...direct,
    ...(Array.isArray(brief.topRisks) ? brief.topRisks : []),
    ...(Array.isArray(brief?.leadershipNarrative?.decisionsNeeded) ? brief.leadershipNarrative.decisionsNeeded : []),
    ...(Array.isArray(brief?.meta?.actionPlan?.groupedActions) ? brief.meta.actionPlan.groupedActions : []),
  ];
  const seen = new Set();
  return candidates.filter((risk) => {
    const key = String(risk?.issueKey || risk?.issueKeys?.[0] || risk?.summary || risk?.action || '').slice(0, 120);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

export function riskProject(risk = {}, fallback = '') {
  const issueKey = String(risk.issueKey || risk.issueKeys?.[0] || '').trim().toUpperCase();
  if (/^[A-Z][A-Z0-9]+-\d+$/.test(issueKey)) return issueKey.split('-')[0];
  return normalizeProjectKey(risk.project || risk.projectKey || fallback);
}

export function caseActionFromRisk(risk = {}, draft = null) {
  const action = risk.recommendedAction || risk.action || draft?.simple || 'Confirm decision owner and next delivery action.';
  const dueAt = risk.targetDate || risk.dueAt || '';
  return {
    actionId: `act-${String(risk.issueKey || risk.issueKeys?.[0] || action).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64)}`,
    action,
    owner: risk.decisionNeededFrom || risk.owner || draft?.recipient || 'Unresolved owner',
    dueAt,
    status: 'open',
    approvalRequired: true,
  };
}

async function evidenceCheckCase(caseRow, risk, toolRegistry) {
  const evidence = await collectCaseEvidence({ caseRow, risk, toolRegistry });
  let row = await patchInterventionCase(caseRow.id, {
    facts: evidence.facts,
    unknowns: evidence.unknowns,
    diagnosis: { ...(caseRow.diagnosis || {}), partialEvidence: evidence.partial, evidenceCheckedAt: evidence.collectedAt },
  }, 'case-evidence-checked');
  if (row.state === INTERVENTION_STATES.DETECTED) {
    row = await transitionInterventionCase(row.id, INTERVENTION_STATES.EVIDENCE_CHECKED, {
      facts: evidence.facts,
      unknowns: evidence.unknowns,
    });
  }
  return row;
}

export function issueChangedBeforeSend(caseRow = {}, body = {}) {
  const latest = String(body.latestIssueUpdatedAt || body.issueUpdatedAt || '').trim();
  if (!latest) return false;
  const fact = (caseRow.facts || []).find((f) => String(f.key || '').startsWith('updated:'));
  const captured = String(fact?.value || '').trim();
  return !captured || captured !== latest;
}

async function recordCaseEvent(eventType, caseRow, payload = {}) {
  return recordImprovementEvent({
    eventType,
    surface: 'governance-intervention',
    scope: { project: caseRow?.project || payload.project || '*' },
    payload: { caseId: caseRow?.id || '', ...payload },
  }).catch(() => null);
}

router.post('/api/governance/portfolio-decision.json', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const anchor = normalizeProjectKey(body.anchor || body.anchorProject || body.project || '');
    const compareRaw = (Array.isArray(body.compare) ? body.compare : String(body.compare || body.projects || '').split(','))
      .map(normalizeProjectKey).filter(Boolean);
    const periodKey = String(body.periodKey || body.quarter || body.brief?.meta?.quarter || '').trim();
    const baselineMode = String(body.baseline || body.baselineMode || 'pi-baseline').trim();
    const brief = body.brief || { projects: [anchor, ...compareRaw].filter(Boolean), meta: { quarter: periodKey } };
    if (periodKey && brief.meta) brief.meta.quarter = periodKey;
    const baselineMissing = resolveBaselineMissingFromBrief(brief, baselineMode);
    const partialSquads = Number(body.partialSquads) || 0;
    const forceRefresh = String(body.refresh || req.query?.refresh || '').trim() === '1';
    const payload = await getOrBuildPortfolioDecision({
      anchor,
      compareRaw,
      periodKey,
      baselineMode,
      brief,
      baselineMissing,
      partialSquads,
      wordingSource: body.wordingSource,
      claimsVerified: body.claimsVerified,
      forceRefresh,
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/api/governance/portfolio-decision.json', requireAuth, async (req, res, next) => {
  try {
    const anchor = normalizeProjectKey(req.query.anchor || req.query.project || '');
    const compareRaw = String(req.query.compare || req.query.projects || '').split(',').map(normalizeProjectKey).filter(Boolean);
    const periodKey = String(req.query.periodKey || req.query.quarter || '').trim();
    const baselineMode = String(req.query.baseline || 'pi-baseline').trim();
    const payloadBrief = {
      projects: [anchor, ...compareRaw].filter(Boolean),
      squadInsights: [],
      meta: { quarter: periodKey },
      generatedAt: new Date().toISOString(),
    };
    const baselineMissing = resolveBaselineMissingFromBrief(payloadBrief, baselineMode);
    const forceRefresh = String(req.query.refresh || '').trim() === '1';
    const payload = await getOrBuildPortfolioDecision({
      anchor,
      compareRaw,
      periodKey,
      baselineMode,
      brief: payloadBrief,
      baselineMissing,
      forceRefresh,
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/api/governance/portfolio-decision/confirm', requireAuth, async (req, res, next) => {
  try {
    const project = normalizeProjectKey(req.body.project || req.body.anchorProject || 'PORTFOLIO');
    const decisionId = String(req.body.decisionId || req.body.decision || 'review-investment').slice(0, 80);
    const periodKey = String(req.body.periodKey || req.body.quarter || 'current').slice(0, 32);
    const cases = await listInterventionCases({ project, status: 'open', periodKey, limit: 5 });
    let row = cases[0];
    if (!row) {
      row = await upsertInterventionCase({
        project,
        periodKey,
        triggerType: 'portfolio-decision',
        title: `${project} portfolio decision`,
        issueKeys: [],
      });
    }
    const action = {
      actionId: `portfolio-decision-${Date.now()}`,
      action: `Delivery decision: ${decisionId.replace(/-/g, ' ')}`,
      owner: 'Leadership',
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'open',
      approvalRequired: false,
    };
    await upsertCaseAction({ ...action, caseId: row.id, project });
    row = await patchInterventionCase(row.id, {
      decision: { decision: decisionId, recordedAt: new Date().toISOString() },
      actions: [...(row.actions || []), action],
    }, 'portfolio-decision-confirmed');
    await recordCaseEvent('portfolio-decision-confirmed', row, { decisionId });
    await invalidatePortfolioDecisionForScope({ anchor: project, periodKey });
    res.json({ ok: true, case: row, action });
  } catch (err) {
    next(err);
  }
});

router.get('/api/governance/interventions.json', requireAuth, async (req, res, next) => {
  try {
    const project = req.query.project || req.query.projects || '';
    const rows = await compactCasesForScope({
      project,
      status: req.query.status || 'open',
      periodKey: req.query.periodKey || req.query.quarter || '',
      limit: Number(req.query.limit) || 20,
    });
    res.json({ ok: true, cases: rows, generatedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

router.get('/api/governance/intervention-shortlist.json', requireAuth, async (req, res, next) => {
  try {
    const rows = await compactCasesForScope({
      project: req.query.projects || req.query.project || '',
      status: 'open',
      limit: 5,
    });
    res.json({ interventions: rows, cases: rows, generatedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

router.post('/api/governance/interventions/seed-from-brief', requireAuth, async (req, res, next) => {
  try {
    const risks = riskListFromBrief(req.body);
    const periodKey = req.body.periodKey || req.body.quarter || req.body.brief?.meta?.quarter || 'current';
    const fallbackProject = String(req.body.projects || req.query.projects || '').split(',')[0].trim().toUpperCase() || 'PORTFOLIO';
    if (!risks.length) {
      const compact = await compactCasesForScope({ project: fallbackProject, periodKey, status: 'open', limit: 12 });
      return res.json({ ok: true, seeded: 0, cases: compact });
    }
    const registry = req.app.locals?.agentToolsRegistry || createAgentToolsRegistry();
    if (!req.app.locals?.agentToolsRegistry) {
      req.app.locals = req.app.locals || {};
      req.app.locals.agentToolsRegistry = registry;
    }
    const created = [];
    const errors = [];
    for (const risk of risks) {
      try {
        const project = riskProject(risk, fallbackProject);
        const issueKeys = [risk.issueKey, ...(risk.issueKeys || [])].filter(Boolean);
        let row = await upsertInterventionCase({
          project,
          periodKey,
          issueKeys,
          triggerType: risk.riskType || risk.triggerType || 'delivery-risk',
          title: risk.displayTitle || risk.summary || risk.action || `${project} needs a decision`,
          trigger: { ...risk, source: 'governance-brief' },
          sourceSystemRefs: issueKeys.map((issueKey) => ({ system: 'jira', issueKey })),
        });
        const firstHistory = (row.history || []).length <= 1;
        row = await evidenceCheckCase(row, risk, registry);
        const role = await resolveGovernanceRole({ projectKey: project, risk, role: risk.decisionNeededFrom });
        const draft = buildGovernanceNudgeDraft({ caseRow: row, risk, role });
        const action = caseActionFromRisk(risk, draft);
        action.safeToSend = draft ? draft.safeToSend : canSendToResolvedRole(role);
        action.channel = 'teams-or-email';
        action.nudgeDraft = draft;
        const nextState = isScopeConfirmationTrigger(risk) || !canSendToResolvedRole(role)
          ? INTERVENTION_STATES.CLARIFICATION_REQUIRED
          : INTERVENTION_STATES.DECISION_REQUIRED;
        row = await patchInterventionCase(row.id, {
          decisionOwners: [role],
          actions: [action],
        }, 'case-owner-action-proposed');
        if (row.state === INTERVENTION_STATES.EVIDENCE_CHECKED) {
          row = await transitionInterventionCase(row.id, nextState);
        }
        await upsertCaseAction({ ...action, caseId: row.id, project: row.project });
        if (firstHistory) await recordCaseEvent('case-opened', row, { triggerType: row.triggerType });
        created.push(row);
      } catch (riskErr) {
        const issueKey = String(risk?.issueKey || risk?.issueKeys?.[0] || '').trim();
        errors.push({ issueKey, error: String(riskErr?.message || 'seed-risk-failed') });
        logger.warn('seed-from-brief risk failed', {
          project: fallbackProject,
          periodKey,
          issueKey,
          error: riskErr?.message,
        });
      }
    }
    const compact = await compactCasesForScope({ project: fallbackProject, periodKey, status: 'open', limit: 12 });
    await invalidatePortfolioDecisionForScope({ anchor: fallbackProject, periodKey });
    res.json({
      ok: true,
      seeded: created.length,
      cases: compact,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    logger.error('seed-from-brief failed', {
      project: String(req.body?.projects || req.query?.projects || ''),
      periodKey: req.body?.periodKey || req.body?.quarter || '',
      error: err?.message,
    });
    next(err);
  }
});

router.get('/api/governance/interventions/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await getInterventionCase(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'case-not-found' });
    return res.json({ ok: true, case: row });
  } catch (err) {
    next(err);
  }
});

router.post('/api/governance/interventions/:id/approve-nudge', requireAuth, async (req, res, next) => {
  try {
    let row = await getInterventionCase(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'case-not-found' });
    if ([INTERVENTION_STATES.CLOSED, INTERVENTION_STATES.VERIFIED, INTERVENTION_STATES.FALSE_POSITIVE].includes(row.state)) {
      return res.status(409).json({ ok: false, blocked: true, reason: 'case-already-finished', case: row });
    }
    if (issueChangedBeforeSend(row, req.body)) {
      row = await patchInterventionCase(row.id, { sendBlockedReason: 'issue-changed-before-send' }, 'case-send-blocked');
      return res.status(409).json({ ok: false, blocked: true, reason: 'issue-changed-before-send', case: row });
    }
    const risk = row.trigger || {};
    let role = row.decisionOwners?.[0] || null;
    if (!canSendToResolvedRole(role)) {
      role = await resolveGovernanceRole({ projectKey: row.project, risk });
      row = await patchInterventionCase(row.id, { decisionOwners: [role] }, 'case-role-rechecked');
    }
    const draft = buildGovernanceNudgeDraft({ caseRow: row, risk, role });
    if (!draft.safeToSend) {
      return res.status(422).json({ ok: false, blocked: true, reason: 'recipient-unresolved', draft, case: row });
    }
    if (req.body.confirmSend !== true) {
      return res.json({ ok: true, approvalRequired: true, draft, case: row });
    }
    const receipt = await appendInboxItem({
      type: 'intervention',
      projects: [row.project],
      summary: `Approved nudge for ${row.title}`,
      safeToSend: true,
      approvalRequired: true,
      evidenceLinks: row.issueKeys || [],
      payload: { caseId: row.id, draft, channel: 'teams-or-email', status: 'ready-for-channel-send' },
    });
    row = await transitionInterventionCase(row.id, INTERVENTION_STATES.CLARIFICATION_SENT, {
      lastDispatch: { receiptId: receipt.id, channel: 'teams-or-email', sentAt: new Date().toISOString(), draft },
    });
    await recordCaseEvent('nudge-sent', row, { receiptId: receipt.id });
    await invalidatePortfolioDecisionForCase(row);
    return res.json({ ok: true, receipt, case: row });
  } catch (err) {
    if (err?.code === 'INTERVENTION_ILLEGAL_TRANSITION') return res.status(409).json({ ok: false, error: err.message });
    next(err);
  }
});

router.post('/api/governance/interventions/:id/record-response', requireAuth, async (req, res, next) => {
  try {
    let row = await getInterventionCase(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'case-not-found' });
    const response = {
      text: String(req.body.responseText || '').slice(0, 2000),
      option: String(req.body.option || 'needs-review'),
      observedBy: String(req.body.observedBy || '').slice(0, 160),
      receivedAt: new Date().toISOString(),
    };
    row = row.state === INTERVENTION_STATES.CLARIFICATION_SENT
      ? await transitionInterventionCase(row.id, INTERVENTION_STATES.RESPONSE_RECEIVED, { response })
      : await patchInterventionCase(row.id, { response }, 'case-response-recorded');
    await invalidatePortfolioDecisionForCase(row);
    res.json({ ok: true, case: row });
  } catch (err) {
    if (err?.code === 'INTERVENTION_ILLEGAL_TRANSITION') return res.status(409).json({ ok: false, error: err.message });
    next(err);
  }
});

router.post('/api/governance/interventions/:id/record-decision', requireAuth, async (req, res, next) => {
  try {
    let row = await getInterventionCase(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'case-not-found' });
    const decision = {
      decision: String(req.body.decision || 'approved').slice(0, 80),
      owner: String(req.body.owner || row.decisionOwners?.[0]?.displayName || '').slice(0, 160),
      targetDate: String(req.body.targetDate || '').slice(0, 40),
      recordedAt: new Date().toISOString(),
    };
    if (row.state === INTERVENTION_STATES.RESPONSE_RECEIVED || row.state === INTERVENTION_STATES.DECISION_REQUIRED) {
      row = await transitionInterventionCase(row.id, INTERVENTION_STATES.DECISION_APPROVED, { decision });
      row = await transitionInterventionCase(row.id, INTERVENTION_STATES.ACTION_RUNNING);
    } else {
      row = await patchInterventionCase(row.id, { decision }, 'case-decision-recorded');
    }
    await invalidatePortfolioDecisionForCase(row);
    res.json({ ok: true, case: row });
  } catch (err) {
    if (err?.code === 'INTERVENTION_ILLEGAL_TRANSITION') return res.status(409).json({ ok: false, error: err.message });
    next(err);
  }
});

router.post('/api/governance/interventions/:id/escalate', requireAuth, async (req, res, next) => {
  try {
    let row = await getInterventionCase(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'case-not-found' });
    const action = row.actions?.[0] || {};
    const level = resolveEscalationLevel({ dueAt: action.dueAt || req.body.dueAt, exposesOutcome: req.body.exposesOutcome === true });
    const draft = buildEscalationDraft({ caseRow: row, action, level });
    if (req.body.confirmSend !== true) return res.json({ ok: true, approvalRequired: true, draft, case: row });
    const receipt = await appendInboxItem({
      type: 'escalation',
      projects: [row.project],
      summary: `Escalation ready: ${row.title}`,
      safeToSend: true,
      approvalRequired: true,
      evidenceLinks: row.issueKeys || [],
      payload: { caseId: row.id, draft, level },
    });
    row = await transitionInterventionCase(row.id, INTERVENTION_STATES.ESCALATION_REQUIRED, {
      escalation: { receiptId: receipt.id, level, draft, escalatedAt: new Date().toISOString() },
    });
    await recordCaseEvent('escalation-sent', row, { receiptId: receipt.id, level: level.level });
    await invalidatePortfolioDecisionForCase(row);
    res.json({ ok: true, receipt, case: row });
  } catch (err) {
    if (err?.code === 'INTERVENTION_ILLEGAL_TRANSITION') return res.status(409).json({ ok: false, error: err.message });
    next(err);
  }
});

router.post('/api/governance/interventions/:id/verify', requireAuth, async (req, res, next) => {
  try {
    let row = await getInterventionCase(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'case-not-found' });
    const evidence = Array.isArray(req.body.evidence) ? req.body.evidence : row.facts?.slice(0, 3) || [];
    const verification = {
      status: evidence.length ? 'passed' : 'needs-evidence',
      evidence,
      verifiedAt: evidence.length ? new Date().toISOString() : null,
    };
    if (!evidence.length) return res.status(422).json({ ok: false, blocked: true, reason: 'verification-needs-evidence', case: row });
    if (row.state === INTERVENTION_STATES.ACTION_RUNNING) row = await transitionInterventionCase(row.id, INTERVENTION_STATES.CHECKPOINT_REACHED);
    if (row.state === INTERVENTION_STATES.CHECKPOINT_REACHED) {
      row = await transitionInterventionCase(row.id, INTERVENTION_STATES.VERIFIED, { verification });
    } else {
      row = await patchInterventionCase(row.id, { verification }, 'case-verification-recorded');
    }
    await recordCaseEvent('verification-passed', row, { evidenceCount: evidence.length });
    await invalidatePortfolioDecisionForCase(row);
    res.json({ ok: true, case: row });
  } catch (err) {
    if (err?.code === 'INTERVENTION_ILLEGAL_TRANSITION') return res.status(409).json({ ok: false, error: err.message });
    next(err);
  }
});

router.post('/api/governance/interventions/:id/close', requireAuth, async (req, res, next) => {
  try {
    let row = await getInterventionCase(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'case-not-found' });
    const reason = String(req.body.reason || 'closed').slice(0, 80);
    if (reason === 'false-positive' && row.state !== INTERVENTION_STATES.FALSE_POSITIVE) {
      row = await transitionInterventionCase(row.id, INTERVENTION_STATES.FALSE_POSITIVE, { closeReason: reason });
      await recordCaseEvent('false-positive', row);
    }
    if (row.state !== INTERVENTION_STATES.CLOSED) {
      row = await transitionInterventionCase(row.id, INTERVENTION_STATES.CLOSED, { closeReason: reason });
    }
    await recordCaseEvent('case-closed', row, { reason });
    await invalidatePortfolioDecisionForCase(row);
    res.json({ ok: true, case: row });
  } catch (err) {
    if (err?.code === 'INTERVENTION_ILLEGAL_TRANSITION') return res.status(409).json({ ok: false, error: err.message });
    next(err);
  }
});

router.get('/api/governance/roles.json', requireAuth, async (req, res, next) => {
  try {
    const project = normalizeProjectKey(req.query.project || req.query.projects || 'PORTFOLIO');
    const overrides = await listProfileOverrides({ scope: `project:${project}` });
    const roles = {
      productOwner: await resolveGovernanceRole({ projectKey: project, role: 'Product Owner' }),
      scrumMaster: await resolveGovernanceRole({ projectKey: project, role: 'Scrum Master' }),
    };
    res.json({ ok: true, project, roles, overrides });
  } catch (err) {
    next(err);
  }
});

router.post('/api/governance/roles', requireAuth, async (req, res, next) => {
  try {
    const project = normalizeProjectKey(req.body.project || req.body.projectKey || 'PORTFOLIO');
    const roleKey = /scrum/i.test(req.body.role || '') ? 'scrumMaster' : 'productOwner';
    const displayName = String(req.body.displayName || req.body.name || '').trim().slice(0, 160);
    if (!displayName) return res.status(422).json({ ok: false, error: 'displayName-required' });
    const override = await saveProfileOverride({
      scope: `project:${project}`,
      key: roleKey,
      value: { displayName, accountId: String(req.body.accountId || '').slice(0, 128) },
      approvedBy: req.session?.user?.email || req.user?.email || 'delivera-user',
    });
    res.json({ ok: true, override });
  } catch (err) {
    next(err);
  }
});

export default router;
