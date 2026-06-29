/**
 * SSOT: portfolio decision build, cache, and invalidation.
 */
import { cache } from './cache.js';
import { getCompactInterventionCases } from './Delivera-Governance-InterventionCase-02Store-IO.js';
import { normalizeProjectKey } from './Delivera-Governance-InterventionCase-01SSOT.js';
import { buildPortfolioDecision } from './Delivera-Governance-PortfolioDecision-01SSOT.js';
import { buildPortfolioComparisonCards } from './Delivera-Governance-PortfolioComparison-01SSOT.js';
import {
  CACHE_NS,
  deriveCacheTtlMs,
  portfolioDecisionCacheKey,
} from './Delivera-Cache-AgeTier-01TTL-SSOT.js';

const PORTFOLIO_DECISION_NS = CACHE_NS.PORTFOLIO_DECISION;

function primaryProjectFromRequest(value = '') {
  return String(value || '').split(',').map((p) => normalizeProjectKey(p)).filter(Boolean)[0] || '';
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
}) {
  const decision = buildPortfolioDecision({
    brief,
    anchorProject: anchor || brief.projects?.[0],
    compareProjects: compareRaw.length ? compareRaw : (brief.projects || []).filter((p) => p !== anchor),
    cases,
    baselineMissing,
    baselineMode,
    wordingSource: wordingSource || (brief.meta?._aiProviderFallback ? 'template' : 'verified'),
    claimsVerified: claimsVerified !== false,
    partialSquads,
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
  });
  const { ttlMs } = deriveCacheTtlMs({
    generatedAt: brief?.generatedAt,
    periodEnd: brief?.period?.end || brief?.meta?.periodEnd,
  });
  const meta = { cached: false, cacheTtlMs: ttlMs, cacheKey };
  const envelope = { ok: true, ...built, meta };
  await cache.set(cacheKey, envelope, ttlMs, { namespace: PORTFOLIO_DECISION_NS });
  return envelope;
}
