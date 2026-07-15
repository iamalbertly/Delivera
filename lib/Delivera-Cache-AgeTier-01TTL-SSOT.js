/**
 * Age-tier cache TTL — fresher data = shorter TTL; older aggregates longer (Fibonacci cap).
 */
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_TTL_MS = 7 * DAY_MS;
const FIBONACCI_HOURS = [21, 34, 55, 89, 144, 233];

export const CACHE_NS = {
  GOVERNANCE_BRIEF: 'governanceBrief',
  PORTFOLIO_DECISION: 'portfolioDecision',
};

function parseTimestampMs(value) {
  if (!value) return Date.now();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

/**
 * @param {{ generatedAt?: string, periodEnd?: string }} opts
 * @returns {{ ttlMs: number, staleServeMs: number, dataAgeMs: number }}
 */
export function deriveCacheTtlMs({ generatedAt, periodEnd } = {}) {
  const anchorMs = parseTimestampMs(periodEnd || generatedAt);
  const dataAgeMs = Math.max(0, Date.now() - anchorMs);

  let ttlMs;
  if (dataAgeMs < DAY_MS) {
    ttlMs = 3 * HOUR_MS;
  } else if (dataAgeMs < 3 * DAY_MS) {
    ttlMs = 6 * HOUR_MS;
  } else if (dataAgeMs < 7 * DAY_MS) {
    ttlMs = 12 * HOUR_MS;
  } else {
    const weeksBeyond = Math.floor((dataAgeMs - 7 * DAY_MS) / (7 * DAY_MS));
    const fibIndex = Math.min(weeksBeyond, FIBONACCI_HOURS.length - 1);
    ttlMs = Math.min(FIBONACCI_HOURS[fibIndex] * HOUR_MS, MAX_TTL_MS);
  }

  return {
    ttlMs,
    staleServeMs: deriveStaleServeMs(ttlMs),
    dataAgeMs,
  };
}

export function deriveStaleServeMs(ttlMs) {
  const safe = Math.max(HOUR_MS, Number(ttlMs) || HOUR_MS);
  return Math.min(safe, MAX_TTL_MS);
}

function normalizeProjectList(keys = []) {
  return Array.from(
    new Set(
      (Array.isArray(keys) ? keys : String(keys || '').split(','))
        .map((k) => String(k || '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort();
}

function hashCasesFingerprint(cases = []) {
  const ids = (Array.isArray(cases) ? cases : [])
    .map((c) => String(c?.id || c?.caseId || c?.title || '').slice(0, 40))
    .filter(Boolean)
    .sort();
  return ids.length ? ids.join('|').slice(0, 200) : 'none';
}

/**
 * @param {{ anchor?: string, compare?: string[], periodKey?: string, briefId?: string, cases?: object[], baselineMode?: string }} opts
 */
export function portfolioDecisionCacheKey({
  anchor = '',
  compare = [],
  periodKey = '',
  briefId = '',
  cases = [],
  baselineMode = 'pi-baseline',
  version = '',
  squadScopeKey = '',
  baselineReadinessKey = '',
} = {}) {
  const anchorKey = String(anchor || '').trim().toUpperCase();
  const compareKey = normalizeProjectList(compare).join(',');
  const period = String(periodKey || '').trim();
  const brief = String(briefId || '').trim().slice(0, 64);
  const casesHash = hashCasesFingerprint(cases);
  const baseline = String(baselineMode || 'pi-baseline').trim();
  const v = String(version || '').trim() || 'noversion';
  const scope = String(squadScopeKey || '').trim() || 'noscope';
  const readiness = String(baselineReadinessKey || '').trim().slice(0, 240) || 'noreadiness';
  return `${CACHE_NS.PORTFOLIO_DECISION}:${anchorKey}:${compareKey}:${period}:${brief}:${casesHash}:${baseline}:${v}:${scope}:${readiness}`;
}

/**
 * @param {{ projects?: string[], periodWindow?: string, includeEvidence?: boolean, includePOReadiness?: boolean }} opts
 */
export function governanceBriefCacheKey({
  projects = [],
  periodWindow = '28d',
  includeEvidence = true,
  includePOReadiness = true,
} = {}) {
  const pk = normalizeProjectList(projects).join(',');
  const w = String(periodWindow || '28d').toLowerCase();
  return `${CACHE_NS.GOVERNANCE_BRIEF}:${pk}:e${includeEvidence ? 1 : 0}:p${includePOReadiness ? 1 : 0}:w${w}`;
}
