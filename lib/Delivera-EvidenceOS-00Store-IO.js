import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { PROJECT_ROOT } from './Delivera-Config-Env-Services-Core-SSOT.js';

const DATA_DIR = join(PROJECT_ROOT, 'data');
const STORE_FILE = join(DATA_DIR, 'Delivera-EvidenceOS-Store.json');
let storeWriteQueue = Promise.resolve();

export const EVIDENCE_TIERS = Object.freeze({
  SYSTEM_FACT: 'system_fact',
  BUSINESS_RECORD: 'business_record',
  USER_STATEMENT: 'user_statement',
  AI_INTERPRETATION: 'ai_interpretation',
});

export const DEFAULT_ORG_ID = 'org-delivera-local';
export const DEFAULT_CONTRIBUTION_TYPES = Object.freeze([
  'facilitation',
  'delivery',
  'blocker-removal',
  'risk-escalation',
  'stakeholder-alignment',
  'quality-improvement',
  'planning',
  'analysis',
  'incident-support',
  'coaching',
  'documentation',
  'automation',
  'release-readiness',
  'customer-communication',
  'dependency-management',
  'technical-leadership',
]);

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStore() {
  return {
    organizations: [{ id: DEFAULT_ORG_ID, name: 'Delivera Local' }],
    users: [],
    roles: [
      { id: 'role-ic', key: 'individual_contributor', permissions: ['evidence:read', 'evidence:write', 'goal:read', 'goal:write', 'report:read', 'report:write'] },
      { id: 'role-manager', key: 'manager', permissions: ['evidence:read', 'evidence:write', 'evidence:validate', 'goal:read', 'goal:write', 'report:read', 'report:write'] },
      { id: 'role-admin', key: 'admin', permissions: ['*'] },
    ],
    memberRoles: [],
    teamMemberships: [],
    managerRelationships: [],
    managementPeriods: [],
    evidenceRecords: [],
    evidenceLinks: [],
    contributions: [],
    contributionTypes: DEFAULT_CONTRIBUTION_TYPES.map((name, idx) => ({ id: `ctype-${idx + 1}`, organizationId: DEFAULT_ORG_ID, name })),
    contributionTypeAssignments: [],
    goals: [],
    linkedCommitments: [],
    goalAmendments: [],
    goalComments: [],
    goalDependencies: [],
    validationRequests: [],
    validationResponses: [],
    validationConflicts: [],
    calibrationPerceptions: [],
    riskRecords: [],
    riskInterventions: [],
    opportunityAssignments: [],
    enablementRequests: [],
    reportSnapshots: [],
    reportSnapshotSources: [],
    developmentPlans: [],
    developmentActions: [],
    externalHrReferences: [],
    agentActivity: [],
    auditEvents: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function newEvidenceOsId(prefix) {
  return id(prefix);
}

export function evidenceOsNow() {
  return nowIso();
}

export async function readEvidenceOsStore() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_FILE)) {
    const initial = emptyStore();
    await writeEvidenceOsStore(initial);
    return initial;
  }
  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    return { ...emptyStore(), ...JSON.parse(raw || '{}') };
  } catch (_) {
    return emptyStore();
  }
}

export async function writeEvidenceOsStore(store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export async function mutateEvidenceOsStore(mutator) {
  const work = storeWriteQueue.then(async () => {
    const store = await readEvidenceOsStore();
    const result = await mutator(store);
    await writeEvidenceOsStore(store);
    return clone(result);
  });
  storeWriteQueue = work.catch(() => {});
  return work;
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeText(value, max = 2000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function normalizeEnum(value, allowed, fallback) {
  const raw = String(value || '').trim();
  return allowed.includes(raw) ? raw : fallback;
}

export function stableHash(value) {
  const input = JSON.stringify(value ?? null);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16);
}
