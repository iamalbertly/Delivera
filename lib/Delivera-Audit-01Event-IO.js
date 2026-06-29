import { mutateEvidenceOsStore, newEvidenceOsId, evidenceOsNow, stableHash } from './Delivera-EvidenceOS-00Store-IO.js';

export async function recordAuditEvent({
  identity,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  requestId = '',
  ip = '',
}) {
  return mutateEvidenceOsStore((store) => {
    const event = {
      id: newEvidenceOsId('audit'),
      organizationId: identity?.orgId || 'org-delivera-local',
      actorUserId: identity?.userId || 'anonymous',
      action: String(action || '').trim(),
      entityType: String(entityType || '').trim(),
      entityId: String(entityId || '').trim(),
      beforeHash: before == null ? '' : stableHash(before),
      afterHash: after == null ? '' : stableHash(after),
      requestId: String(requestId || ''),
      ip: String(ip || ''),
      createdAt: evidenceOsNow(),
    };
    store.auditEvents.push(event);
    return event;
  });
}

