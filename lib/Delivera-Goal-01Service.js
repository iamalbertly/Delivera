import { mutateEvidenceOsStore, readEvidenceOsStore, newEvidenceOsId, evidenceOsNow, normalizeText } from './Delivera-EvidenceOS-00Store-IO.js';
import { recordAuditEvent } from './Delivera-Audit-01Event-IO.js';

function dateMs(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}

export async function listGoals(identity) {
  const store = await readEvidenceOsStore();
  return store.goals.filter((g) => g.organizationId === identity.orgId && (g.userId === identity.userId || identity.roles?.includes('manager')));
}

export async function createGoal(identity, payload = {}, meta = {}) {
  if (!payload.allowManualGoal && !payload.sourceSystem) {
    const error = new Error('Manual goal creation is disabled by default. Link an existing commitment first.');
    error.code = 'MANUAL_GOAL_REQUIRES_SOURCE_CHECK';
    throw error;
  }
  const goal = await mutateEvidenceOsStore((store) => {
    const item = {
      id: newEvidenceOsId('goal'),
      organizationId: identity.orgId,
      userId: payload.userId || identity.userId,
      title: normalizeText(payload.title || 'Delivery impact goal', 180),
      baseline: normalizeText(payload.baseline, 800),
      target: normalizeText(payload.target, 800),
      measurementMethod: normalizeText(payload.measurementMethod, 800),
      evidenceSource: normalizeText(payload.evidenceSource, 800),
      effectiveAt: payload.effectiveAt || evidenceOsNow(),
      deadline: payload.deadline || null,
      managerId: payload.managerId || null,
      validatorId: payload.validatorId || null,
      status: 'active',
      sourceSystem: normalizeText(payload.sourceSystem || 'manual', 80),
      sourceGoalId: normalizeText(payload.sourceGoalId || '', 160),
      sourceUri: normalizeText(payload.sourceUri || '', 500),
      linkedDeliveryItems: Array.isArray(payload.linkedDeliveryItems) ? payload.linkedDeliveryItems : [],
      createdAt: evidenceOsNow(),
      updatedAt: evidenceOsNow(),
    };
    store.goals.push(item);
    return item;
  });
  await recordAuditEvent({ identity, action: 'goal.create', entityType: 'goal', entityId: goal.id, after: goal, requestId: meta.requestId, ip: meta.ip });
  return goal;
}

export async function detectLinkedCommitments(identity, payload = {}) {
  const store = await readEvidenceOsStore();
  const workKeys = Array.from(new Set([
    ...store.contributions.filter((c) => c.organizationId === identity.orgId).map((c) => c.workItemKey).filter(Boolean),
    ...((Array.isArray(payload.workItemKeys) ? payload.workItemKeys : []).map((k) => String(k || '').trim().toUpperCase()).filter(Boolean)),
  ]));
  const projectKeys = Array.from(new Set(workKeys.map((key) => key.split('-')[0]).filter(Boolean)));
  const commitments = [];
  for (const projectKey of projectKeys.length ? projectKeys : ['PORTFOLIO']) {
    commitments.push({
      id: `commitment-${projectKey.toLowerCase()}-pi`,
      organizationId: identity.orgId,
      sourceGoal: `${projectKey} PI commitment`,
      sourceSystem: 'jira_pi_commitment',
      owner: 'Product Owner',
      effectiveDate: new Date().toISOString().slice(0, 10),
      linkedDeliveryItems: workKeys.filter((key) => key.startsWith(`${projectKey}-`)).slice(0, 12),
      measurableEvidence: ['completed_work', 'risk_reduction', 'validation_gap'],
      confidence: projectKey === 'PORTFOLIO' ? 'low' : 'medium',
    });
    commitments.push({
      id: `commitment-${projectKey.toLowerCase()}-sprint`,
      organizationId: identity.orgId,
      sourceGoal: `${projectKey} sprint goal candidate`,
      sourceSystem: 'jira_sprint_goal',
      owner: 'Scrum Team',
      effectiveDate: new Date().toISOString().slice(0, 10),
      linkedDeliveryItems: workKeys.filter((key) => key.startsWith(`${projectKey}-`)).slice(0, 8),
      measurableEvidence: ['sprint_completion', 'blocker_age', 'rollover_change'],
      confidence: projectKey === 'PORTFOLIO' ? 'low' : 'medium',
    });
  }
  return commitments.slice(0, 6);
}

export async function linkExistingCommitment(identity, payload = {}, meta = {}) {
  const linked = await mutateEvidenceOsStore((store) => {
    const existing = store.linkedCommitments.find((c) => c.id === payload.id && c.organizationId === identity.orgId);
    if (existing) return existing;
    const item = {
      id: normalizeText(payload.id || newEvidenceOsId('commitment'), 160),
      organizationId: identity.orgId,
      sourceGoal: normalizeText(payload.sourceGoal || 'Linked commitment', 240),
      sourceSystem: normalizeText(payload.sourceSystem || 'imported_source', 80),
      owner: normalizeText(payload.owner || 'Unknown owner', 120),
      effectiveDate: payload.effectiveDate || new Date().toISOString().slice(0, 10),
      linkedDeliveryItems: Array.isArray(payload.linkedDeliveryItems) ? payload.linkedDeliveryItems : [],
      measurableEvidence: Array.isArray(payload.measurableEvidence) ? payload.measurableEvidence : [],
      confidence: normalizeText(payload.confidence || 'review', 40),
      linkedByUserId: identity.userId,
      linkedAt: evidenceOsNow(),
    };
    store.linkedCommitments.push(item);
    return item;
  });
  await recordAuditEvent({ identity, action: 'commitment.link', entityType: 'linked_commitment', entityId: linked.id, after: linked, requestId: meta.requestId, ip: meta.ip });
  return linked;
}

export async function addGoalAmendment(identity, goalId, payload = {}, meta = {}) {
  const amendment = await mutateEvidenceOsStore((store) => {
    const goal = store.goals.find((g) => g.id === goalId && g.organizationId === identity.orgId);
    if (!goal) {
      const error = new Error('Goal not found');
      error.code = 'GOAL_NOT_FOUND';
      throw error;
    }
    const item = {
      id: newEvidenceOsId('gamut'),
      organizationId: identity.orgId,
      goalId,
      previousTarget: goal.target,
      newTarget: normalizeText(payload.newTarget || goal.target, 800),
      reason: normalizeText(payload.reason, 1000),
      communicatedAt: payload.communicatedAt || evidenceOsNow(),
      acknowledgedAt: payload.acknowledgedAt || null,
      managerAcknowledgedAt: payload.managerAcknowledgedAt || null,
      effectiveAt: payload.effectiveAt || evidenceOsNow(),
      measurementStart: payload.measurementStart || payload.effectiveAt || evidenceOsNow(),
      retrospectiveFlag: !!payload.retrospectiveFlag,
      createdByUserId: identity.userId,
    };
    goal.target = item.newTarget;
    goal.effectiveAt = item.effectiveAt;
    goal.updatedAt = evidenceOsNow();
    store.goalAmendments.push(item);
    return item;
  });
  await recordAuditEvent({ identity, action: 'goal.amend', entityType: 'goal_amendment', entityId: amendment.id, after: amendment, requestId: meta.requestId, ip: meta.ip });
  return amendment;
}

export async function scoreProgress(goalId, asOfDate = new Date()) {
  const store = await readEvidenceOsStore();
  const goal = store.goals.find((g) => g.id === goalId);
  if (!goal) return { status: 'not_measurable', reason: 'goal_not_found' };
  const amendments = store.goalAmendments.filter((a) => a.goalId === goalId).sort((a, b) => dateMs(a.effectiveAt) - dateMs(b.effectiveAt));
  const latest = amendments[amendments.length - 1] || null;
  const effectiveAt = latest?.effectiveAt || goal.effectiveAt;
  const asOfMs = dateMs(asOfDate);
  const effectiveMs = dateMs(effectiveAt);
  if (!effectiveMs || !asOfMs) return { status: 'not_measurable', reason: 'missing_effective_date' };
  if (asOfMs < effectiveMs) return { status: 'informational_only', reason: 'before_effective_date', effectiveAt };
  if (latest?.retrospectiveFlag && !(latest.acknowledgedAt && latest.managerAcknowledgedAt)) {
    return { status: 'informational_only', reason: 'retrospective_without_bilateral_acknowledgment', effectiveAt };
  }
  return { status: 'scored', reason: 'effective_window', effectiveAt, measurementStart: latest?.measurementStart || effectiveAt };
}
