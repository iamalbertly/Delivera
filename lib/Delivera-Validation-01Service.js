import { mutateEvidenceOsStore, readEvidenceOsStore, newEvidenceOsId, evidenceOsNow, normalizeEnum, normalizeText } from './Delivera-EvidenceOS-00Store-IO.js';
import { recordAuditEvent } from './Delivera-Audit-01Event-IO.js';

const RESPONSE_TYPES = ['confirmed', 'partly_confirmed', 'not_confirmed', 'insufficient_info', 'no_response'];

export async function listValidationRequests(identity) {
  const store = await readEvidenceOsStore();
  return store.validationRequests.filter((r) => r.organizationId === identity.orgId);
}

export async function createValidationRequest(identity, payload = {}, meta = {}) {
  const request = await mutateEvidenceOsStore((store) => {
    const item = {
      id: newEvidenceOsId('valreq'),
      organizationId: identity.orgId,
      entityType: normalizeText(payload.entityType || 'contribution', 80),
      entityId: normalizeText(payload.entityId, 120),
      validatorUserId: payload.validatorUserId || null,
      prompt: normalizeText(payload.prompt || 'Please confirm the outcome you observed.', 1000),
      humanPrompt: normalizeText(payload.humanPrompt || payload.prompt || 'Please confirm the observed delivery outcome.', 1000),
      whyNeeded: normalizeText(payload.whyNeeded || 'Material outcome needs observer confirmation before manager or calibration use.', 800),
      channel: normalizeText(payload.channel || 'teams_or_email', 80),
      retryPolicy: normalizeText(payload.retryPolicy || 'retry_once_then_suggest_alternate_validator', 120),
      neutralNoResponse: payload.neutralNoResponse !== false,
      responseActions: Array.isArray(payload.responseActions) ? payload.responseActions : ['Confirm', 'Partly confirm', 'Need correction'],
      status: 'pending',
      dueAt: payload.dueAt || null,
      createdByUserId: identity.userId,
      createdAt: evidenceOsNow(),
    };
    store.validationRequests.push(item);
    return item;
  });
  await recordAuditEvent({ identity, action: 'validation.request', entityType: 'validation_request', entityId: request.id, after: request, requestId: meta.requestId, ip: meta.ip });
  return request;
}

export async function recordValidationResponse(identity, requestId, payload = {}, meta = {}) {
  const response = await mutateEvidenceOsStore((store) => {
    const request = store.validationRequests.find((r) => r.id === requestId && r.organizationId === identity.orgId);
    if (!request) {
      const error = new Error('Validation request not found');
      error.code = 'VALIDATION_REQUEST_NOT_FOUND';
      throw error;
    }
    const item = {
      id: newEvidenceOsId('valres'),
      organizationId: identity.orgId,
      requestId,
      response: normalizeEnum(payload.response, RESPONSE_TYPES, 'insufficient_info'),
      note: normalizeText(payload.note, 1200),
      respondedByUserId: identity.userId,
      respondedAt: evidenceOsNow(),
    };
    request.status = item.response === 'no_response' ? 'expired_no_response' : 'responded';
    store.validationResponses.push(item);
    return item;
  });
  await recordAuditEvent({ identity, action: 'validation.response', entityType: 'validation_response', entityId: response.id, after: response, requestId: meta.requestId, ip: meta.ip });
  return response;
}
