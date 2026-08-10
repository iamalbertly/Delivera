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
  boardIds: z.array(z.union([z.string(), z.number()])).default([]),
  sprintIds: z.array(z.union([z.string(), z.number()])).default([]),
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
  baselineRevision: z.union([z.string(), z.number()]).default(''),
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
    boardIds: [...new Set([
      ...(Array.isArray(squad.boardIds) ? squad.boardIds : []),
      ...(Array.isArray(registrySquad.boardMapping) ? registrySquad.boardMapping : []),
    ].filter((value) => value !== '' && value != null))],
    sprintIds: sprint.sprintId == null ? [] : [sprint.sprintId],
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
    baselineRevision: contract.revision || contract.version || contractId,
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

function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function issueChildren(commitment = {}) {
  return Array.isArray(commitment.children) ? commitment.children
    : Array.isArray(commitment.childStories) ? commitment.childStories
      : Array.isArray(commitment.items) ? commitment.items : [];
}

function dateValue(value) {
  const time = new Date(value || '').getTime();
  return Number.isFinite(time) ? time : null;
}

function isoDate(time) {
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

function isDone(item = {}) {
  return /done|closed|resolved|complete|accepted/i.test(String(item.status || item.state || item.statusCategory || ''));
}

/**
 * One deterministic delivery projection shared by Governance, Current Sprint and Actions.
 * The aliases already returned by those surfaces remain available for one compatibility release.
 */
export function buildDeliveryTruthProjection({ context = null, commitments = [], workItems = [], quarterElapsed = null } = {}) {
  const rows = Array.isArray(commitments) ? commitments : [];
  const itemRows = Array.isArray(workItems) ? workItems : [];
  const epicForecasts = rows.map((commitment) => {
    const children = issueChildren(commitment);
    const childDates = children.flatMap((child) => [
      dateValue(child.startDate || child.created),
      dateValue(child.endDate || child.dueDate || child.resolutionDate),
    ]).filter(Number.isFinite);
    const plannedStart = dateValue(commitment.plannedStart || commitment.startDate || commitment.expectedVsActual?.expected?.startDate);
    const plannedEnd = dateValue(commitment.plannedEnd || commitment.endDate || commitment.dueDate || commitment.expectedVsActual?.expected?.endDate);
    const actualStart = dateValue(commitment.actualStart) ?? (childDates.length ? Math.min(...childDates) : null);
    const explicitForecast = dateValue(commitment.forecastEnd);
    const incompleteDates = children
      .filter((child) => !isDone(child))
      .map((child) => dateValue(child.endDate || child.dueDate))
      .filter(Number.isFinite);
    const forecastEnd = explicitForecast ?? (incompleteDates.length ? Math.max(...incompleteDates) : plannedEnd);
    const completedChildren = children.filter(isDone).length;
    const totalChildren = children.length || numeric(
      commitment.childCount || commitment.childrenTotal || commitment.expectedVsActual?.actual?.childTotal,
      0,
    );
    const completed = children.length ? completedChildren : numeric(
      commitment.completedChildren || commitment.childrenDone || commitment.expectedVsActual?.actual?.doneChildCount,
      0,
    );
    const missingFields = [
      !plannedStart && 'planned start',
      !plannedEnd && 'planned end',
      totalChildren === 0 && 'child stories',
    ].filter(Boolean);
    return {
      commitmentId: String(commitment.commitmentId || commitment.promiseId || commitment.issueKey || ''),
      issueKey: String(commitment.issueKey || ''),
      squadKey: String(commitment.squad || context?.squadKey || '').toUpperCase(),
      plannedStart: isoDate(plannedStart),
      plannedEnd: isoDate(plannedEnd),
      actualStart: isoDate(actualStart),
      forecastEnd: isoDate(forecastEnd),
      childTotal: totalChildren,
      childCompleted: completed,
      completionPct: totalChildren ? Math.round((completed / totalChildren) * 100) : null,
      scheduleVarianceDays: plannedEnd && forecastEnd ? Math.round((forecastEnd - plannedEnd) / 86400000) : null,
      staleAgeDays: numeric(commitment.proofAge?.businessDays ?? commitment.staleAgeDays, 0),
      dependencies: Array.isArray(commitment.dependencies) ? commitment.dependencies : [],
      confidence: missingFields.length ? 'unverified' : String(commitment.forecastConfidence || 'derived'),
      missingFields,
    };
  });
  const completedCommitments = rows.filter((row, index) => {
    const forecast = epicForecasts[index];
    return isDone({ status: row.statusNow || row.status, state: row.deliveryState })
      || (forecast.childTotal > 0 && forecast.childCompleted === forecast.childTotal);
  }).length;
  const atRisk = rows.filter((row) => /risk|attention|stale|blocked|overdue|missing/i.test(JSON.stringify([
    row.caseState, row.matchState, row.diagnosisCode, row.proofAge?.state, row.nextAction?.dueState,
  ]))).length;
  const childTotal = epicForecasts.reduce((sum, row) => sum + row.childTotal, 0);
  const childCompleted = epicForecasts.reduce((sum, row) => sum + row.childCompleted, 0);
  const unplanned = itemRows.filter((row) => /unplanned|unknown/.test(String(row.category || '').toLowerCase())).length;
  const forecasted = epicForecasts.filter((row) => row.forecastEnd && row.confidence !== 'unverified').length;
  return {
    semanticsVersion: 1,
    commitmentCompletion: { completed: completedCommitments, total: rows.length },
    childStoryCompletion: { completed: childCompleted, total: childTotal },
    evidenceAvailability: {
      available: rows.filter((row) => Boolean(
        row.issueKey
        || row.expectedVsActual?.actual?.issueKeys?.length
        || row.candidateIssueKeys?.length,
      )).length,
      total: rows.length,
    },
    verifiedOutcomes: rows.filter((row) => row.verifiedOutcome === true || row.outcome?.verified === true).length,
    forecast: { byPeriodEnd: forecasted, atRisk, total: rows.length },
    deviation: { unplannedItems: unplanned, totalItems: itemRows.length },
    quarterElapsed: quarterElapsed == null ? null : Math.max(0, Math.min(100, numeric(quarterElapsed))),
    calculationBasis: 'Commitment completion and forecasts are derived deterministically from scoped Jira child stories and the approved PI baseline.',
    epicForecasts,
  };
}

export function toScopeTruth(context = {}) {
  if (!context || typeof context !== 'object') return null;
  return {
    squadKey: context.squadKey || context.squadId || '',
    projectKeys: context.projectKeys || [],
    pi: context.fiscalPeriod || '',
    boardIds: context.boardIds || (context.boardId ? [context.boardId] : []),
    sprintIds: context.sprintIds || (context.sprintId != null ? [context.sprintId] : []),
    registryRevision: context.registryVersion || context.organizationRevision || 1,
    jiraObservedAt: context.observedAt || context.dataAsOf || '',
    baselineRevision: context.baselineRevision || context.contractId || '',
    truthHash: context.truthHash || '',
  };
}
