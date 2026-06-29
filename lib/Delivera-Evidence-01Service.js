import {
  EVIDENCE_TIERS,
  mutateEvidenceOsStore,
  newEvidenceOsId,
  evidenceOsNow,
  normalizeEnum,
  normalizeText,
} from './Delivera-EvidenceOS-00Store-IO.js';
import { recordAuditEvent } from './Delivera-Audit-01Event-IO.js';

const TIER_VALUES = Object.values(EVIDENCE_TIERS);

export function isVerifiedEvidenceTier(tier) {
  return tier !== EVIDENCE_TIERS.AI_INTERPRETATION;
}

export function ensureTierCanVerify(tier) {
  if (!isVerifiedEvidenceTier(tier)) {
    const error = new Error('AI interpretation evidence cannot satisfy verified sections');
    error.code = 'TIER4_NOT_VERIFIABLE';
    throw error;
  }
}

export async function listEvidence(identity) {
  const { readEvidenceOsStore } = await import('./Delivera-EvidenceOS-00Store-IO.js');
  const store = await readEvidenceOsStore();
  return store.evidenceRecords.filter((r) => r.organizationId === identity.orgId);
}

export async function createEvidence(identity, payload = {}, meta = {}) {
  const tier = normalizeEnum(payload.tier, TIER_VALUES, EVIDENCE_TIERS.USER_STATEMENT);
  const record = await mutateEvidenceOsStore((store) => {
    const item = {
      id: newEvidenceOsId('ev'),
      organizationId: identity.orgId,
      tier,
      sourceType: normalizeText(payload.sourceType || 'manual_capture', 80),
      sourceSnapshotJson: payload.sourceSnapshotJson || {},
      sourceUri: normalizeText(payload.sourceUri, 500),
      capturedAt: evidenceOsNow(),
      capturedByUserId: identity.userId,
      verificationStatus: tier === EVIDENCE_TIERS.AI_INTERPRETATION ? 'informational_only' : normalizeText(payload.verificationStatus || 'draft', 40),
      lockedAt: payload.lockedAt || null,
      version: 1,
      supersedesId: payload.supersedesId || null,
      title: normalizeText(payload.title || payload.sourceType || 'Evidence record', 180),
      statement: normalizeText(payload.statement || payload.summary || '', 2500),
    };
    store.evidenceRecords.push(item);
    return item;
  });
  await recordAuditEvent({ identity, action: 'evidence.create', entityType: 'evidence_record', entityId: record.id, after: record, requestId: meta.requestId, ip: meta.ip });
  return record;
}

export async function linkEvidence(identity, { evidenceId, entityType, entityId, requiredForVerified = false }, meta = {}) {
  const link = await mutateEvidenceOsStore((store) => {
    const evidence = store.evidenceRecords.find((r) => r.id === evidenceId && r.organizationId === identity.orgId);
    if (!evidence) {
      const error = new Error('Evidence record not found');
      error.code = 'EVIDENCE_NOT_FOUND';
      throw error;
    }
    if (requiredForVerified) ensureTierCanVerify(evidence.tier);
    const existing = store.evidenceLinks.find((l) => l.evidenceId === evidenceId && l.entityType === entityType && l.entityId === entityId);
    if (existing) return existing;
    const item = {
      id: newEvidenceOsId('evlink'),
      organizationId: identity.orgId,
      evidenceId,
      entityType: normalizeText(entityType, 80),
      entityId: normalizeText(entityId, 120),
      requiredForVerified: !!requiredForVerified,
      createdAt: evidenceOsNow(),
    };
    store.evidenceLinks.push(item);
    return item;
  });
  await recordAuditEvent({ identity, action: 'evidence.link', entityType: 'evidence_link', entityId: link.id, after: link, requestId: meta.requestId, ip: meta.ip });
  return link;
}

