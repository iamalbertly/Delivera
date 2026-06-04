/**
 * SSOT: Layered governance profile resolver (global → portfolio → project → board → user).
 * Parent thresholds live in Grammar SSOT; only whitelisted keys may be overridden via JSONL.
 */
import { mkdir, appendFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GOVERNANCE_THRESHOLDS } from './Delivera-Governance-Grammar-01Rules-SSOT.js';
import { loadNarrationKnowledge } from './Delivera-Governance-Narration-Knowledge-IO.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OVERRIDES_FILE = join(DATA_DIR, 'Delivera-Governance-Profile-Overrides.jsonl');

const TUNABLE_THRESHOLD_KEYS = new Set([
  'staleInProgressHours',
  'staleEscalateHours',
  'staleCriticalHours',
  'riskBriefTopN',
  'noRecentCommentHours',
  'backlogNoMovementHours',
]);

const TUNABLE_META_KEYS = new Set([
  'suppressStaleConfirm',
  'stakeholderAlias',
]);

function parseScope(scope) {
  const s = String(scope || '').trim();
  const [kind, key] = s.split(':');
  return { kind: kind || 'global', key: key || '*' };
}

async function readAllOverrides() {
  try {
    const raw = await readFile(OVERRIDES_FILE, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

function scopeMatches(row, layers) {
  const { kind, key } = parseScope(row.scope);
  if (kind === 'global') return true;
  if (kind === 'portfolio' && layers.portfolioKey && key === layers.portfolioKey) return true;
  if (kind === 'project' && layers.project && key === layers.project) return true;
  if (kind === 'board' && layers.boardId && key === String(layers.boardId)) return true;
  if (kind === 'user' && layers.userId && key === layers.userId) return true;
  return false;
}

function mergeOverrides(layers) {
  const all = layers._overrides || [];
  const thresholds = { ...GOVERNANCE_THRESHOLDS };
  const phraseMap = new Map();
  const stakeholderAliases = {};
  const suppressedRiskTypes = new Set();
  let suppressStaleConfirmUntil = null;

  for (const row of all) {
    if (!scopeMatches(row, layers)) continue;
    const k = String(row.key || '').trim();
    const v = row.value;
    if (TUNABLE_THRESHOLD_KEYS.has(k) && Number.isFinite(Number(v))) {
      thresholds[k] = Number(v);
    }
    if (k === 'suppressRiskType' && v) suppressedRiskTypes.add(String(v));
    if (k === 'phraseOverride' && row.phraseKey) phraseMap.set(String(row.phraseKey), String(v));
    if (k === 'stakeholderAlias' && row.aliasKey) stakeholderAliases[String(row.aliasKey)] = String(v);
    if (k === 'suppressStaleConfirm') suppressStaleConfirmUntil = String(v);
  }

  return {
    thresholds,
    suppressedRiskTypes: Array.from(suppressedRiskTypes),
    phraseMap,
    stakeholderAliases,
    suppressStaleConfirmUntil,
  };
}

/**
 * Resolve effective governance profile for a scope stack.
 */
export async function resolveEffectiveGovernanceProfile({
  portfolioKey = '',
  project = '',
  boardId = null,
  userId = null,
} = {}) {
  const overrides = await readAllOverrides();
  const pk = String(portfolioKey || (project ? `${project}` : '')).trim().toUpperCase();
  const proj = String(project || '').trim().toUpperCase();
  let phraseMap = new Map();
  try {
    phraseMap = await loadNarrationKnowledge(proj || '*');
  } catch (_) { phraseMap = new Map(); }

  const merged = mergeOverrides({
    portfolioKey: pk,
    project: proj,
    boardId: boardId != null ? String(boardId) : null,
    userId: userId ? String(userId) : null,
    _overrides: overrides,
  });

  for (const [k, v] of merged.phraseMap) phraseMap.set(k, v);

  return {
    thresholds: merged.thresholds,
    suppressedRiskTypes: merged.suppressedRiskTypes,
    phraseMap,
    stakeholderAliases: merged.stakeholderAliases,
    suppressStaleConfirmUntil: merged.suppressStaleConfirmUntil,
  };
}

export async function saveProfileOverride({ scope, key, value, approvedBy = 'unknown', phraseKey = '', aliasKey = '' }) {
  const k = String(key || '').trim();
  if (!TUNABLE_THRESHOLD_KEYS.has(k) && !TUNABLE_META_KEYS.has(k) && k !== 'suppressRiskType' && k !== 'phraseOverride') {
    throw new Error(`Profile key not allowed: ${k}`);
  }
  const row = {
    ts: new Date().toISOString(),
    scope: String(scope || 'global:*').trim(),
    key: k,
    value,
    phraseKey: phraseKey || undefined,
    aliasKey: aliasKey || undefined,
    approvedBy: String(approvedBy || '').trim(),
  };
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(OVERRIDES_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

export async function listProfileOverrides({ scope = null } = {}) {
  const all = await readAllOverrides();
  if (!scope) return all;
  const wanted = String(scope).trim();
  return all.filter((r) => String(r.scope || '') === wanted);
}

export function isStaleConfirmSuppressed(profile) {
  const until = profile?.suppressStaleConfirmUntil;
  if (!until) return false;
  const t = new Date(until).getTime();
  return Number.isFinite(t) && t > Date.now();
}
