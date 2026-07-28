import { createHash } from 'crypto';
import { z } from 'zod';

const WorkSplitSchema = z.object({
  method: z.string().default('unverified'),
  percentages: z.object({
    pi: z.number().min(0).max(100).default(0),
    support: z.number().min(0).max(100).default(0),
    unplanned: z.number().min(0).max(100).default(0),
    unknown: z.number().min(0).max(100).default(0),
  }).default({ pi: 0, support: 0, unplanned: 0, unknown: 0 }),
}).passthrough();

export const DeliveryTruthContextSchema = z.object({
  schemaVersion: z.literal(1),
  organizationRevision: z.number().int().positive(),
  squadKey: z.string().min(1),
  squadDisplayName: z.string().min(1),
  fiscalPeriod: z.string(),
  contractId: z.string(),
  squadId: z.string().min(1),
  squadName: z.string().min(1),
  projectKeys: z.array(z.string().min(1)).min(1),
  sprintId: z.union([z.string(), z.number(), z.null()]),
  sprintName: z.string(),
  sprintStart: z.string(),
  sprintEnd: z.string(),
  remainingBusinessDays: z.union([z.number().int().min(0), z.null()]),
  sprintState: z.enum(['active', 'future', 'closed', 'unverified', 'unavailable']),
  registryVersion: z.number().int().positive(),
  squadRevision: z.number().int().positive(),
  observedAt: z.string(),
  freshnessState: z.enum(['high', 'limited', 'stale', 'unavailable']),
  dataAsOf: z.string(),
  source: z.string().min(1),
  confidence: z.enum(['high', 'limited', 'stale', 'unavailable']),
  workSplit: WorkSplitSchema,
  truthHash: z.string().regex(/^[a-f0-9]{24}$/),
});

function normalizedKeys(keys = []) {
  return [...new Set(keys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean))].sort();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function governanceTruthHash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0, 24);
}

function normalizePercentages(split = {}) {
  const raw = split.percentages || split;
  const values = {
    pi: Number(raw.pi ?? raw.piPct ?? 0),
    support: Number(raw.support ?? raw.supportPct ?? 0),
    unplanned: Number(raw.unplanned ?? raw.unplannedPct ?? 0),
    unknown: Number(raw.unknown ?? raw.unknownPct ?? 0),
  };
  for (const key of Object.keys(values)) values[key] = Math.max(0, Math.min(100, Number.isFinite(values[key]) ? values[key] : 0));
  return values;
}

function sprintProjection(reality = {}) {
  const sprint = reality.sprint || reality.activeSprint || {};
  const rawState = String(sprint.state || reality.state || '').toLowerCase();
  const state = ['active', 'future', 'closed'].includes(rawState)
    ? rawState
    : (reality.unavailable || reality.error ? 'unavailable' : 'unverified');
  return {
    sprintId: sprint.id ?? reality.sprintId ?? null,
    sprintName: String(sprint.name || reality.sprintName || ''),
    sprintStart: String(sprint.startDate || reality.startDate || reality.sprintStart || ''),
    sprintEnd: String(sprint.endDate || reality.endDate || reality.sprintEnd || ''),
    remainingBusinessDays: Number.isFinite(Number(reality.remainingBusinessDays))
      ? Math.max(0, Math.round(Number(reality.remainingBusinessDays)))
      : Number.isFinite(Number(reality.daysRemaining))
        ? Math.max(0, Math.round(Number(reality.daysRemaining)))
        : null,
    sprintState: state,
  };
}

export function buildDeliveryTruthContext({ squad = {}, registry = {}, contract = {}, projectKeys = [], dataAsOf = '', source = 'Jira + organization registry', confidence = '' } = {}) {
  const squadId = String(squad.squad || squad.projectKey || squad.squadKey || projectKeys[0] || '').trim().toUpperCase();
  const registrySquad = (registry.squads || []).find((item) => String(item.squadKey).toUpperCase() === squadId) || {};
  const keys = normalizedKeys([squadId, ...(projectKeys || []), ...(squad.projectKeys || [])]);
  const sprint = sprintProjection(squad.sprintReality || squad.meta?.sprintReality || {});
  const workSplit = {
    ...(squad.workSplit || {}),
    method: String(squad.workSplit?.method || 'unverified'),
    percentages: normalizePercentages(squad.workSplit || {}),
  };
  const observedAt = String(dataAsOf || squad.verifiedAt || squad.evidenceObservedAt || new Date().toISOString());
  const fiscalPeriod = String(
    contract.fiscalPeriod
    || contract.piName
    || squad.context?.fiscalPeriod
    || squad.quarter
    || squad.baselineCoverage?.piName
    || ''
  ).trim();
  const contractId = String(contract.contractId || contract.id || squad.contractId || '').trim();
  const confidenceValue = ['high', 'limited', 'stale', 'unavailable'].includes(confidence)
    ? confidence
    : (sprint.sprintState === 'unavailable' ? 'unavailable' : sprint.sprintState === 'unverified' ? 'limited' : 'high');
  const hashInput = {
    squadId,
    keys,
    sprint,
    fiscalPeriod,
    contractId,
    participationState: registrySquad.participationState || '',
    registryVersion: Number(registry.version) || 1,
    squadRevision: Number(registrySquad.revision) || 1,
    workSplit,
  };
  return DeliveryTruthContextSchema.parse({
    schemaVersion: 1,
    organizationRevision: Number(registry.version) || 1,
    squadKey: squadId,
    squadDisplayName: String(registrySquad.friendlyName || squad.displayName || squad.squadDisplayName || squadId),
    fiscalPeriod,
    contractId,
    squadId,
    squadName: String(registrySquad.friendlyName || squad.displayName || squad.squadDisplayName || squadId),
    projectKeys: keys.length ? keys : [squadId],
    ...sprint,
    registryVersion: Number(registry.version) || 1,
    squadRevision: Number(registrySquad.revision) || 1,
    observedAt,
    freshnessState: confidenceValue,
    dataAsOf: observedAt,
    source,
    confidence: confidenceValue,
    workSplit,
    truthHash: governanceTruthHash(hashInput),
  });
}

export function assertTruthConsistency(contexts = []) {
  const bySquad = new Map();
  for (const raw of contexts.filter(Boolean)) {
    const context = DeliveryTruthContextSchema.parse(raw);
    const previous = bySquad.get(context.squadId);
    if (previous && previous.truthHash === context.truthHash
      && (previous.sprintId !== context.sprintId || previous.sprintState !== context.sprintState)) {
      const error = new Error(`Conflicting delivery truth for ${context.squadName}.`);
      error.code = 'DELIVERY_TRUTH_CONFLICT';
      error.httpStatus = 409;
      throw error;
    }
    bySquad.set(context.squadId, context);
  }
  return [...bySquad.values()];
}
