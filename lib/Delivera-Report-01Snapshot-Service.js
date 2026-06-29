import { mutateEvidenceOsStore, readEvidenceOsStore, newEvidenceOsId, evidenceOsNow, normalizeArray, normalizeText } from './Delivera-EvidenceOS-00Store-IO.js';
import { recordAuditEvent } from './Delivera-Audit-01Event-IO.js';

const VERIFIED_STATUSES = new Set(['confirmed', 'partly_confirmed']);

export async function listReports(identity) {
  const store = await readEvidenceOsStore();
  const latestByPurpose = new Map();
  for (const report of store.reportSnapshots.filter((r) => r.organizationId === identity.orgId)) {
    const key = `${report.audience}|${report.variant}|${report.period}`;
    const existing = latestByPurpose.get(key);
    if (!existing || String(report.createdAt || '') > String(existing.createdAt || '')) latestByPurpose.set(key, report);
  }
  return Array.from(latestByPurpose.values());
}

export async function createReportSnapshot(identity, payload = {}, meta = {}) {
  const report = await mutateEvidenceOsStore((store) => {
    const sourceIds = normalizeArray(payload.sourceRecordIds);
    const sources = sourceIds.map((id) => store.evidenceRecords.find((e) => e.id === id)).filter(Boolean);
    const hasTier4Verified = sources.some((s) => s.tier === 'ai_interpretation' && payload.section === 'verified');
    if (hasTier4Verified) {
      const error = new Error('AI interpretation evidence cannot be used in verified report sections');
      error.code = 'TIER4_REPORT_VERIFIED_BLOCKED';
      throw error;
    }
    const gaps = normalizeArray(payload.validationRequests)
      .filter((r) => !VERIFIED_STATUSES.has(r.response))
      .map((r) => ({ entityId: r.entityId, response: r.response || 'missing_validation' }));
    const period = normalizeText(payload.period || new Date().toISOString().slice(0, 7), 40);
    const audience = normalizeText(payload.audience || 'manager_monthly', 80);
    const variant = normalizeText(payload.variant || 'manager_monthly', 80);
    const existing = store.reportSnapshots.find((r) => r.organizationId === identity.orgId && r.period === period && r.audience === audience && r.variant === variant);
    const item = existing || {
      id: newEvidenceOsId('report'),
      organizationId: identity.orgId,
      period,
      version: 0,
      authorUserId: identity.userId,
      audience,
      status: 'draft',
      createdAt: evidenceOsNow(),
    };
    item.version += 1;
    item.narrative = normalizeText(payload.narrative, 5000);
    item.explicitGaps = gaps;
    item.purpose = normalizeText(payload.purpose || 'Give the manager decision-ready delivery impact evidence.', 500);
    item.nextDecisionMoment = normalizeText(payload.nextDecisionMoment || 'monthly_manager_check_in', 80);
    item.updatedAt = evidenceOsNow();
    if (!existing) store.reportSnapshots.push(item);
    store.reportSnapshotSources.push({ reportSnapshotId: item.id, sourceRecordIds: sourceIds, tiers: sources.map((s) => s.tier) });
    return item;
  });
  await recordAuditEvent({ identity, action: 'report.snapshot.create', entityType: 'report_snapshot', entityId: report.id, after: report, requestId: meta.requestId, ip: meta.ip });
  return report;
}
