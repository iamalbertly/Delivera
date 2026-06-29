import { mutateEvidenceOsStore, readEvidenceOsStore, newEvidenceOsId, evidenceOsNow, normalizeArray, normalizeText } from './Delivera-EvidenceOS-00Store-IO.js';
import { recordAuditEvent } from './Delivera-Audit-01Event-IO.js';
import { createEvidence, linkEvidence } from './Delivera-Evidence-01Service.js';

function dedupeKey(identity, payload) {
  return [
    identity.orgId,
    payload.userId || identity.userId,
    normalizeText(payload.workItemKey || payload.sourceUri || '', 80).toUpperCase(),
    normalizeText(payload.individualActionStatement || payload.teamStatement || '', 220).toLowerCase(),
  ].join('|');
}

export async function listContributions(identity) {
  const store = await readEvidenceOsStore();
  const allowedUsers = new Set([identity.userId, ...(identity.reporteeIds || [])]);
  return store.contributions
    .filter((c) => c.organizationId === identity.orgId && (identity.roles?.includes('manager') || allowedUsers.has(c.userId)))
    .map((c) => ({
      ...c,
      evidence: store.evidenceLinks
        .filter((l) => l.entityType === 'contribution' && l.entityId === c.id)
        .map((l) => store.evidenceRecords.find((e) => e.id === l.evidenceId))
        .filter(Boolean),
    }));
}

export async function createContribution(identity, payload = {}, meta = {}) {
  const action = normalizeText(payload.individualActionStatement, 1600);
  const teamStatement = normalizeText(payload.teamStatement, 1600);
  if (!action && payload.assigneeOnly === true) {
    const error = new Error('Contribution cannot be created from Jira assignee alone');
    error.code = 'ASSIGNEE_ONLY_CONTRIBUTION_BLOCKED';
    throw error;
  }
  const key = dedupeKey(identity, payload);
  const contribution = await mutateEvidenceOsStore((store) => {
    const existing = store.contributions.find((c) => c.dedupeKey === key && c.organizationId === identity.orgId);
    if (existing) return { ...existing, deduped: true };
    const item = {
      id: newEvidenceOsId('contrib'),
      organizationId: identity.orgId,
      userId: payload.userId || identity.userId,
      roleAtTime: normalizeText(payload.roleAtTime || 'contributor', 80),
      workItemKey: normalizeText(payload.workItemKey, 80).toUpperCase(),
      startDate: payload.startDate || null,
      endDate: payload.endDate || null,
      teamStatement,
      individualActionStatement: action,
      impactStatement: normalizeText(payload.impactStatement, 1600),
      validationStatus: 'draft',
      impactVerificationStatus: 'unverified',
      validatorUserId: payload.validatorUserId || null,
      auditVersion: 1,
      dedupeKey: key,
      createdAt: evidenceOsNow(),
      updatedAt: evidenceOsNow(),
    };
    store.contributions.push(item);
    for (const name of normalizeArray(payload.typeNames)) {
      const type = store.contributionTypes.find((t) => t.name === name) || store.contributionTypes[0];
      if (type) store.contributionTypeAssignments.push({ contributionId: item.id, contributionTypeId: type.id });
    }
    return item;
  });
  if (!contribution.deduped && (payload.evidence || payload.sourceSnapshotJson || payload.sourceUri)) {
    const evidence = await createEvidence(identity, {
      tier: payload.evidence?.tier || 'user_statement',
      sourceType: payload.evidence?.sourceType || (payload.workItemKey ? 'jira_issue' : 'manual_capture'),
      sourceUri: payload.sourceUri || payload.evidence?.sourceUri,
      sourceSnapshotJson: payload.sourceSnapshotJson || payload.evidence?.sourceSnapshotJson || {},
      title: payload.evidence?.title || payload.workItemKey || 'Contribution evidence',
      statement: payload.evidence?.statement || action || teamStatement,
    }, meta);
    await linkEvidence(identity, { evidenceId: evidence.id, entityType: 'contribution', entityId: contribution.id }, meta);
  }
  await recordAuditEvent({ identity, action: contribution.deduped ? 'contribution.dedupe' : 'contribution.create', entityType: 'contribution', entityId: contribution.id, after: contribution, requestId: meta.requestId, ip: meta.ip });
  return contribution;
}

export async function updateContributionValidation(identity, contributionId, payload = {}, meta = {}) {
  const updated = await mutateEvidenceOsStore((store) => {
    const item = store.contributions.find((c) => c.id === contributionId && c.organizationId === identity.orgId);
    if (!item) {
      const error = new Error('Contribution not found');
      error.code = 'CONTRIBUTION_NOT_FOUND';
      throw error;
    }
    const before = { ...item };
    item.validationStatus = normalizeText(payload.validationStatus || item.validationStatus, 60);
    item.impactVerificationStatus = normalizeText(payload.impactVerificationStatus || item.impactVerificationStatus, 60);
    item.managerNote = normalizeText(payload.managerNote || item.managerNote || '', 1200);
    item.auditVersion += 1;
    item.updatedAt = evidenceOsNow();
    return { before, after: item };
  });
  await recordAuditEvent({ identity, action: 'contribution.validate', entityType: 'contribution', entityId: contributionId, before: updated.before, after: updated.after, requestId: meta.requestId, ip: meta.ip });
  return updated.after;
}

