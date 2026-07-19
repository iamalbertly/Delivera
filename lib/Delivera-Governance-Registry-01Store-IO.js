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

function initialRegistry() {
  return {
    version: 1,
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
    })),
  };
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
  if (cached?.squads) return cached;
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsed = JSON.parse(await readFile(FILE, 'utf8'));
      if (parsed?.squads) return parsed;
    } catch (_) { /* first local run */ }
  }
  return initialRegistry();
}

export async function updateGovernanceRegistrySquad({ squadKey, expectedVersion, patch = {}, actor = 'unknown' }) {
  await requireDurableProductionStore();
  const key = String(squadKey || '').trim().toUpperCase();
  const current = await readGovernanceRegistry();
  if (Number(expectedVersion) !== Number(current.version)) {
    const error = new Error('Organization settings changed while you were editing. Review the latest values before saving.');
    error.code = 'REGISTRY_VERSION_CONFLICT';
    error.httpStatus = 412;
    error.currentVersion = current.version;
    throw error;
  }
  const index = current.squads.findIndex((item) => item.squadKey === key);
  if (index < 0) {
    const error = new Error('Squad is not in the organization catalog.');
    error.code = 'REGISTRY_SQUAD_NOT_FOUND';
    error.httpStatus = 404;
    throw error;
  }
  if (patch.participationState && !STATES.has(patch.participationState)) {
    const error = new Error('Choose PI-governed, pending consent, or operational exception.');
    error.code = 'REGISTRY_PARTICIPATION_INVALID';
    error.httpStatus = 422;
    throw error;
  }
  const allowed = ['participationState', 'friendlyName', 'boardMapping', 'productOwner', 'scrumMaster', 'streamLead'];
  const nextSquad = { ...current.squads[index] };
  for (const field of allowed) if (Object.hasOwn(patch, field)) nextSquad[field] = patch[field];
  nextSquad.lastVerifiedAt = new Date().toISOString();
  nextSquad.updatedBy = actor;
  nextSquad.reason = String(patch.reason || '').trim().slice(0, 500);
  const next = { ...current, version: current.version + 1, updatedAt: nextSquad.lastVerifiedAt, squads: current.squads.map((item, i) => i === index ? nextSquad : item) };
  await cache.set(CACHE_KEY, next, 24 * 60 * 60 * 1000, { namespace: NS });
  if (process.env.NODE_ENV !== 'production') {
    await mkdir(dirname(FILE), { recursive: true });
    const temporary = `${FILE}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(next, null, 2), 'utf8');
    await rename(temporary, FILE);
  }
  return next;
}
