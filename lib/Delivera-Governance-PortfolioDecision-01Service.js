/**
 * SSOT: portfolio decision build, cache, and invalidation.
 */
import { cache } from './cache.js';
import versionData from '../version.json' with { type: 'json' };
import { getCompactInterventionCases } from './Delivera-Governance-InterventionCase-02Store-IO.js';
import { normalizeProjectKey } from './Delivera-Governance-InterventionCase-01SSOT.js';
import { buildPortfolioDecision, resolveBaselineMissingFromBrief } from './Delivera-Governance-PortfolioDecision-01SSOT.js';
import { buildPortfolioComparisonCards } from './Delivera-Governance-PortfolioComparison-01SSOT.js';
import { deliverySquadKeys, operationalEntityKeys } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import {
  CACHE_NS,
  deriveCacheTtlMs,
  portfolioDecisionCacheKey,
} from './Delivera-Cache-AgeTier-01TTL-SSOT.js';

const PORTFOLIO_DECISION_NS = CACHE_NS.PORTFOLIO_DECISION;

function primaryProjectFromRequest(value = '') {
  return String(value || '').split(',').map((p) => normalizeProjectKey(p)).filter(Boolean)[0] || '';
}

function baselineReadinessFingerprint(brief = {}) {
  const readiness = brief?.meta?.baselineReadinessByProject || {};
  return Object.keys(readiness)
    .sort()
    .map((key) => `${key}:${readiness[key]?.hasBaseline ? 1 : 0}:${Number(readiness[key]?.committedCount) || 0}`)
    .join('|');
}

function squadScopeFingerprint() {
  return `scoreable=${deliverySquadKeys().join(',')};excluded=${operationalEntityKeys().join(',')}`;
}

export async function compactCasesForScope({ project = '', periodKey = '', status = 'open', limit = 12 } = {}) {
  return getCompactInterventionCases({
    project: primaryProjectFromRequest(project),
    status,
    periodKey,
    limit,
  });
}

export function buildPortfolioDecisionPayload({
  brief,
  anchor,
  compareRaw,
  cases,
  baselineMode,
  baselineMissing,
  partialSquads = 0,
  wordingSource,
  claimsVerified,
  periodKey = '',
}) {
  const mergedBrief = periodKey
    ? { ...brief, meta: { ...(brief.meta || {}), quarter: periodKey } }
    : brief;
  const resolvedBaselineMissing = baselineMissing ?? resolveBaselineMissingFromBrief(mergedBrief, baselineMode);
  const decision = buildPortfolioDecision({
    brief: mergedBrief,
    anchorProject: anchor || mergedBrief.projects?.[0],
    compareProjects: compareRaw.length ? compareRaw : (mergedBrief.projects || []).filter((p) => p !== anchor),
    cases,
    baselineMissing: resolvedBaselineMissing,
    baselineMode,
    wordingSource: wordingSource || (mergedBrief.meta?._aiProviderFallback ? 'template' : 'verified'),
    claimsVerified: claimsVerified !== false,
    partialSquads,
    periodKey,
  });
  const comparison = buildPortfolioComparisonCards({
    decision,
    brief,
    insights: decision.insights || brief.squadInsights || [],
    cases,
  });
  return { decision, comparison, cases };
}

export async function invalidatePortfolioDecisionForScope({ anchor = '', periodKey = '' } = {}) {
  const anchorKey = normalizeProjectKey(anchor);
  if (!anchorKey) return;
  const prefix = `${PORTFOLIO_DECISION_NS}:${anchorKey}:`;
  await cache.invalidateByPrefix(prefix);
}

export async function invalidatePortfolioDecisionForCase(row = {}) {
  await invalidatePortfolioDecisionForScope({
    anchor: row.project || row.anchorProject,
    periodKey: row.periodKey,
  });
}

export async function getOrBuildPortfolioDecision({
  anchor,
  compareRaw,
  periodKey,
  baselineMode,
  brief,
  baselineMissing,
  partialSquads,
  wordingSource,
  claimsVerified,
  forceRefresh = false,
}) {
  const cases = await compactCasesForScope({ project: anchor, status: 'open', periodKey, limit: 20 });
  const briefId = String(brief?.meta?.briefId || brief?.generatedAt || '').slice(0, 64);
  const cacheKey = portfolioDecisionCacheKey({
    anchor,
    compare: compareRaw,
    periodKey,
    briefId,
    cases,
    baselineMode,
    version: versionData.version,
    squadScopeKey: squadScopeFingerprint(),
    baselineReadinessKey: baselineReadinessFingerprint(brief),
  });

  if (!forceRefresh) {
    const cached = await cache.get(cacheKey, { namespace: PORTFOLIO_DECISION_NS });
    const payload = cached?.value || cached;
    if (payload?.decision) {
      const cachedAt = cached?.cachedAt || payload?.meta?.cachedAt || new Date().toISOString();
      return {
        ...payload,
        meta: {
          ...(payload.meta || {}),
          cached: true,
          cachedAt,
          cacheKey,
          cacheTtlMs: payload.meta?.cacheTtlMs,
        },
      };
    }
  } else {
    await cache.delete(cacheKey, { namespace: PORTFOLIO_DECISION_NS });
  }

  const built = buildPortfolioDecisionPayload({
    brief,
    anchor,
    compareRaw,
    cases,
    baselineMode,
    baselineMissing,
    partialSquads,
    wordingSource,
    claimsVerified,
    periodKey,
  });
  const { ttlMs } = deriveCacheTtlMs({
    generatedAt: brief?.generatedAt,
    periodEnd: brief?.period?.end || brief?.meta?.periodEnd,
  });
  const meta = { cached: false, cacheTtlMs: ttlMs, cacheKey };
  const versionIdentity = {
    version: versionData.version,
    codename: versionData.codename || '',
    environment: process.env.NODE_ENV || 'development',
    commit: String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || '').slice(0, 7),
    branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.RENDER_GIT_BRANCH || '',
    generatedAt: new Date().toISOString(),
  };
  const envelope = { ok: true, ...built, versionIdentity, meta };
  await cache.set(cacheKey, envelope, ttlMs, { namespace: PORTFOLIO_DECISION_NS });
  return envelope;
}
