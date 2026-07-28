import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { cache } from './cache.js';
import { PROJECT_CATALOG } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'Delivera-Governance-Organization-Registry.json');
const CACHE_KEY = 'registry:v1:organization';
const NS = 'governanceRegistry';
const STATES = new Set(['pi-governed', 'pending-consent', 'operational-exception']);
const PENDING_BY_DEFAULT = new Set(['VB', 'MPSA', 'MVA', 'MAS', 'TRS', 'AMS2', 'BIO']);
const PARTICIPATION_POLICY_VERSION = 1;
const PARTICIPATION_POLICY_REASON = 'Delivera seven-squad consent policy';

const REGISTRY_STATE_META = Object.freeze({
  'pi-governed': {
    state: 'pi-governed',
    operatingModel: 'pi-governed',
    includeInPiTotals: true,
    globallyExcluded: false,
    reviewRequired: false,
    label: 'PI-governed',
    reason: 'Included in PI governance totals and active intervention flows.',
  },
  'pending-consent': {
    state: 'pending-consent',
    operatingModel: 'operational-group',
    includeInPiTotals: false,
    globallyExcluded: true,
    reviewRequired: true,
    label: 'Pending consent',
    reason: 'Visible for review, but excluded from PI totals until onboarding is confirmed.',
  },
  'operational-exception': {
    state: 'operational-exception',
    operatingModel: 'operational-group',
    includeInPiTotals: false,
    globallyExcluded: true,
    reviewRequired: false,
    label: 'Operational exception',
    reason: 'Visible for operational review, but excluded from PI totals and governance interventions.',
  },
  unknown: {
    state: 'unknown',
    operatingModel: '',
    includeInPiTotals: true,
    globallyExcluded: false,
    reviewRequired: false,
    label: 'Unknown',
    reason: 'No registry participation override is recorded for this squad.',
  },
});

function initialRegistry() {
  return {
    version: 1,
    participationPolicyVersion: PARTICIPATION_POLICY_VERSION,
    updatedAt: null,
    squads: PROJECT_CATALOG.map((item) => ({
      squadKey: item.key,
      friendlyName: item.label,
      participationState: PENDING_BY_DEFAULT.has(item.key) ? 'pending-consent' : 'pi-governed',
      boardMapping: [],
      productOwner: null,
      scrumMaster: null,
      streamLead: null,
      baselineSource: null,
      lastVerifiedAt: null,
      revision: 1,
    })),
    auditHistory: [],
  };
}

function normalizedSquadKey(value = '') {
  return String(value || '').trim().toUpperCase();
}

export function participationStateMeta(participationState = '') {
  const key = String(participationState || '').trim().toLowerCase();
  return REGISTRY_STATE_META[key] || REGISTRY_STATE_META.unknown;
}

export function registryEntryBySquad(registry = {}, squadKey = '') {
  const key = normalizedSquadKey(squadKey);
  return (registry.squads || []).find((item) => normalizedSquadKey(item.squadKey) === key) || null;
}

export function resolveRegistryParticipation(registry = {}, squadKey = '') {
  const entry = registryEntryBySquad(registry, squadKey);
  const meta = participationStateMeta(entry?.participationState || '');
  return {
    squadKey: normalizedSquadKey(squadKey),
    registryEntry: entry,
    ...meta,
  };
}

export function partitionSquadsByParticipation(registry = {}, squadKeys = []) {
  const unique = [...new Set((squadKeys || []).map((key) => normalizedSquadKey(key)).filter(Boolean))];
  const partitions = {
    included: [],
    excluded: [],
    pendingConsent: [],
    operationalException: [],
    details: {},
  };
  unique.forEach((squadKey) => {
    const detail = resolveRegistryParticipation(registry, squadKey);
    partitions.details[squadKey] = detail;
    if (detail.state === 'pending-consent') partitions.pendingConsent.push(squadKey);
    if (detail.state === 'operational-exception') partitions.operationalException.push(squadKey);
    if (detail.globallyExcluded) partitions.excluded.push(squadKey);
    else partitions.included.push(squadKey);
  });
  return partitions;
}

async function requireDurableProductionStore() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!(await cache.pingRedis().catch(() => false))) {
    const error = new Error('The organization registry is read-only while the durable store is unavailable.');
    error.code = 'REGISTRY_DURABLE_STORE_UNAVAILABLE';
    error.httpStatus = 503;
    throw error;
  }
}

export async function readGovernanceRegistry() {
  const hit = await cache.get(CACHE_KEY, { namespace: NS }).catch(() => null);
  const cached = hit?.value || hit;
  if (cached?.squads) return migrateParticipationPolicy(normalizeRegistry(cached));
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsed = JSON.parse(await readFile(FILE, 'utf8'));
      if (parsed?.squads) return migrateParticipationPolicy(normalizeRegistry(parsed));
    } catch (_) { /* first local run */ }
  }
  return initialRegistry();
}

async function migrateParticipationPolicy(registry) {
  if (Number(registry.participationPolicyVersion || 0) >= PARTICIPATION_POLICY_VERSION) return registry;
  const now = new Date().toISOString();
  const changedSquadKeys = [];
  const squads = registry.squads.map((item) => {
    const requiredState = PENDING_BY_DEFAULT.has(normalizedSquadKey(item.squadKey))
      ? 'pending-consent'
      : 'pi-governed';
    if (item.participationState === requiredState) return item;
    changedSquadKeys.push(item.squadKey);
    return {
      ...item,
      participationState: requiredState,
      revision: Number(item.revision || 1) + 1,
      lastVerifiedAt: now,
      updatedBy: 'system-policy-migration',
      reason: PARTICIPATION_POLICY_REASON,
    };
  });
  const next = {
    ...registry,
    version: Number(registry.version || 1) + 1,
    participationPolicyVersion: PARTICIPATION_POLICY_VERSION,
    updatedAt: now,
    squads,
    changedSquadKeys,
    auditHistory: [{
      id: `participation-policy-v${PARTICIPATION_POLICY_VERSION}`,
      at: now,
      actor: 'system-policy-migration',
      reason: PARTICIPATION_POLICY_REASON,
      squadKeys: changedSquadKeys,
    }, ...(registry.auditHistory || [])].slice(0, 100),
  };
  await persistRegistry(next);
  return next;
}

function normalizeRegistry(registry) {
  return {
    ...registry,
    auditHistory: Array.isArray(registry.auditHistory) ? registry.auditHistory : [],
    squads: (registry.squads || []).map((item) => ({ ...item, revision: Math.max(1, Number(item.revision) || 1) })),
  };
}

function validatePatch(patch = {}) {
  if (patch.participationState && !STATES.has(patch.participationState)) {
    const error = new Error('Choose PI-governed, pending consent, or operational exception.');
    error.code = 'REGISTRY_PARTICIPATION_INVALID';
    error.httpStatus = 422;
    throw error;
  }
}

async function persistRegistry(next) {
  await cache.set(CACHE_KEY, next, 24 * 60 * 60 * 1000, { namespace: NS });
  if (process.env.NODE_ENV !== 'production') {
    await mkdir(dirname(FILE), { recursive: true });
    const temporary = `${FILE}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(next, null, 2), 'utf8');
    await rename(temporary, FILE);
  }
}

export async function updateGovernanceRegistryBatch({ changes = [], reason = '', actor = 'unknown', idempotencyKey = '' }) {
  await requireDurableProductionStore();
  const cleanReason = String(reason || '').trim().slice(0, 500);
  if (!cleanReason) {
    const error = new Error('A reason is required for organization changes.');
    error.code = 'REGISTRY_REASON_REQUIRED';
    error.httpStatus = 422;
    throw error;
  }
  if (!Array.isArray(changes) || !changes.length || changes.length > 100) {
    const error = new Error('Choose between 1 and 100 squads to update.');
    error.code = 'REGISTRY_CHANGES_REQUIRED';
    error.httpStatus = 422;
    throw error;
  }
  const receiptKey = idempotencyKey ? `registry:receipt:${String(idempotencyKey).slice(0, 180)}` : '';
  if (receiptKey) {
    const existing = await cache.get(receiptKey, { namespace: NS });
    if (existing?.value || existing) return existing.value || existing;
  }
  const lease = await cache.claimLease('organization-write', 15000, { namespace: 'governanceRegistryLease' });
  if (!lease.acquired) {
    const error = new Error('Organization settings are being updated. Retry in a moment.');
    error.code = 'REGISTRY_WRITE_IN_PROGRESS';
    error.httpStatus = 409;
    throw error;
  }
  try {
    const current = await readGovernanceRegistry();
    const indexed = new Map(current.squads.map((item) => [item.squadKey, item]));
    const normalized = changes.map((change) => {
      const key = String(change.squadKey || '').trim().toUpperCase();
      const present = indexed.get(key);
      if (!present) {
        const error = new Error(`${key || 'Squad'} is not in the organization catalog.`);
        error.code = 'REGISTRY_SQUAD_NOT_FOUND'; error.httpStatus = 404; throw error;
      }
      if (Number(change.expectedRevision) !== Number(present.revision || 1)) {
        const error = new Error(`${present.friendlyName} changed while you were editing. Review that squad before saving.`);
        error.code = 'REGISTRY_SQUAD_VERSION_CONFLICT'; error.httpStatus = 412;
        error.squadKey = key; error.currentRevision = present.revision || 1; throw error;
      }
      validatePatch(change.patch || {});
      return { key, present, patch: change.patch || {} };
    });
    const now = new Date().toISOString();
    const allowed = ['participationState', 'friendlyName', 'boardMapping', 'productOwner', 'scrumMaster', 'streamLead'];
    const replacements = new Map(normalized.map(({ key, present, patch }) => {
      const nextSquad = { ...present };
      for (const field of allowed) if (Object.hasOwn(patch, field)) nextSquad[field] = patch[field];
      nextSquad.revision = Number(present.revision || 1) + 1;
      nextSquad.lastVerifiedAt = now;
      nextSquad.updatedBy = actor;
      nextSquad.reason = cleanReason;
      return [key, nextSquad];
    }));
    const auditEntry = { id: String(idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`), at: now, actor, reason: cleanReason, squadKeys: [...replacements.keys()] };
    const next = {
      ...current,
      version: Number(current.version || 1) + 1,
      updatedAt: now,
      squads: current.squads.map((item) => replacements.get(item.squadKey) || item),
      auditHistory: [auditEntry, ...(current.auditHistory || [])].slice(0, 100),
      changedSquadKeys: [...replacements.keys()],
    };
    await persistRegistry(next);
    if (receiptKey) await cache.set(receiptKey, next, 24 * 60 * 60 * 1000, { namespace: NS });
    return next;
  } finally {
    await cache.releaseLease(lease).catch(() => false);
  }
}

export async function updateGovernanceRegistrySquad({ squadKey, expectedVersion, patch = {}, actor = 'unknown' }) {
  const key = String(squadKey || '').trim().toUpperCase();
  const current = await readGovernanceRegistry();
  const squad = current.squads.find((item) => item.squadKey === key);
  const expectedRevision = Number(patch.expectedRevision || (Number(expectedVersion) === Number(current.version) ? squad?.revision : expectedVersion));
  if (!squad) {
    const error = new Error('Squad is not in the organization catalog.');
    error.code = 'REGISTRY_SQUAD_NOT_FOUND'; error.httpStatus = 404; throw error;
  }
  if (expectedRevision !== Number(squad.revision || 1)) {
    const error = new Error('Organization settings changed while you were editing. Review the latest values before saving.');
    error.code = 'REGISTRY_SQUAD_VERSION_CONFLICT';
    error.httpStatus = 412;
    error.currentVersion = squad.revision || 1;
    throw error;
  }
  return updateGovernanceRegistryBatch({
    changes: [{ squadKey: key, expectedRevision, patch }],
    reason: patch.reason,
    actor,
    idempotencyKey: patch.idempotencyKey,
  });
}
