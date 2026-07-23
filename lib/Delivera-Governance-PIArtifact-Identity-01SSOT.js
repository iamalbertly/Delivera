import { createHash } from 'crypto';
import { PROJECT_CATALOG } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';

const EXTRA_ALIASES = Object.freeze({
  MPSA: ['m squad', 'm-squad', 'mpesa squad', 'm-pesa squad'],
  MAS: ['mini apps squad', 'mini-app squad', 'm-pesa mini-app squad', 'm pesa mini app squad'],
  RPA: ['rpa', 'robotics process automation', 'cops rpa'],
  MVA: ['digital squad'],
  ASG: ['agile and security guild', 'agile security guild'],
  FIN: ['finance squad', 'finance'],
  SD: ['dms', 'dms squad', 'kilimanjaro legends'],
  MPSA2: ['transformers', 'transformers squad'],
  TRS: ['t squad', 't-squad', 'terminal squad', 'terminal'],
  VB: ['vodacom business', 'vbu', 'vbu p&s'],
  AMS2: ['ams', 'ams squad', 'tachyons'],
  BIO: ['biometric kyc', 'bio metric kyc', 'biometric kyc & kya'],
});

function normalizeAlias(value = '') {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS_INDEX = new Map();
for (const entry of PROJECT_CATALOG) {
  const aliases = [entry.key, entry.label, ...(EXTRA_ALIASES[entry.key] || [])];
  for (const alias of aliases) ALIAS_INDEX.set(normalizeAlias(alias), entry.key);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function resolveCanonicalSquad(value = '') {
  const normalized = normalizeAlias(value);
  const exact = ALIAS_INDEX.get(normalized);
  if (exact) return { key: exact, confidence: 1, matchedAlias: normalized };
  const candidates = [];
  for (const [alias, key] of ALIAS_INDEX.entries()) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      candidates.push({ key, alias, score: Math.min(alias.length, normalized.length) / Math.max(alias.length, normalized.length) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best && best.score >= 0.72
    ? { key: best.key, confidence: best.score, matchedAlias: best.alias }
    : { key: '', confidence: 0, matchedAlias: '' };
}

export function detectSquadsInText(text = '') {
  const normalized = normalizeAlias(text);
  const byKey = new Map();
  for (const [alias, key] of ALIAS_INDEX.entries()) {
    if (alias.length < 3 || !normalized.includes(alias)) continue;
    const previous = byKey.get(key);
    const score = alias === normalizeAlias(key) ? 0.96 : Math.min(0.99, 0.78 + alias.length / 100);
    if (!previous || score > previous.confidence) byKey.set(key, { key, confidence: score, matchedAlias: alias });
  }
  return [...byKey.values()].sort((a, b) => b.confidence - a.confidence);
}

export function detectFiscalPeriod(text = '') {
  const compact = String(text || '').replace(/\s+/g, ' ');
  const counts = new Map();
  for (const match of compact.matchAll(/\bQ([1-4])\s*[-|/]?\s*FY\s*(\d{2,4})\b/gi)) {
    const label = `FY${match[2].slice(-2)} Q${match[1]}`;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  for (const match of compact.matchAll(/\bFY\s*(\d{2,4})\s*[-|/]?\s*Q([1-4])\b/gi)) {
    const label = `FY${match[1].slice(-2)} Q${match[2]}`;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { label: '', confidence: 0 };
  return {
    label: ranked[0][0],
    confidence: ranked.length === 1 || ranked[0][1] > ranked[1][1] ? 0.98 : 0.72,
    alternatives: ranked.slice(1, 4).map(([label, mentions]) => ({ label, mentions })),
  };
}

export function displayNameForSquad(key = '') {
  return PROJECT_CATALOG.find((row) => row.key === String(key).toUpperCase())?.label || String(key).toUpperCase();
}
