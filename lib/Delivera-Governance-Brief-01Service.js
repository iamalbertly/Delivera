/**
 * SSOT: governance brief cache read-through, build, and stale fallback.
 */
import { logger } from './Delivera-Server-Logging-Utility.js';
import { cache } from './cache.js';
import { createAgileClient, createVersion3Client } from './jiraClients.js';
import { discoverBoardsWithCache, discoverFieldsWithCache } from './server-utils.js';
import { assembleGovernanceBrief } from './Delivera-Governance-Brief-03Assemble-Service.js';
import { getLatestPIBaseline, getLatestPIBaselineForScope } from './Delivera-Governance-PIBaseline-01Store-IO.js';
import { resolveEffectiveGovernanceProfile } from './Delivera-Governance-Profile-01Resolve-SSOT.js';
import { resolveProviderConfig } from './Delivera-AI-Provider-Gateway.js';
import { clampConfidenceToFreshness } from './Delivera-Governance-Grammar-01Rules-SSOT.js';
import { rememberQuarterLabel } from './Delivera-Governance-Quarter-Labels-01Index-SSOT.js';
import {
  CACHE_NS,
  deriveCacheTtlMs,
  governanceBriefCacheKey,
} from './Delivera-Cache-AgeTier-01TTL-SSOT.js';

const GOVERNANCE_NS = CACHE_NS.GOVERNANCE_BRIEF;

function applyCachedFreshness(brief) {
  if (!brief?.freshness) return brief;
  const generatedMs = brief.generatedAt ? new Date(brief.generatedAt).getTime() : Date.now();
  const ageMin = Math.max(0, Math.round((Date.now() - generatedMs) / 60000));
  brief.freshness = { ...brief.freshness, confidenceLimit: 'cached', cacheAgeMinutes: ageMin };
  if (brief.leadershipNarrative?.confidence) {
    brief.leadershipNarrative.confidence = clampConfidenceToFreshness(brief.leadershipNarrative.confidence, 'cached');
  }
  return brief;
}

export async function getCachedGovernanceBrief(projects, {
  periodWindow = '28d',
  includeEvidence = true,
  includePOReadiness = true,
} = {}) {
  const cacheKey = governanceBriefCacheKey({ projects, periodWindow, includeEvidence, includePOReadiness });
  const cached = await cache.get(cacheKey, { namespace: GOVERNANCE_NS });
  const cachedBrief = cached?.value || cached;
  if (!cachedBrief) return null;
  const cachedAt = cached?.cachedAt || cachedBrief?.meta?.cachedAt || null;
  return {
    brief: applyCachedFreshness(cachedBrief),
    cached: true,
    cacheTtlMs: cached?.ttlMs,
    cachedAt,
  };
}

export async function getOrBuildGovernanceBrief({
  projects,
  req,
  includeEvidence = true,
  includePOReadiness = true,
}) {
  const periodWindow = String(req?.query?.periodWindow || '28d').toLowerCase();
  const cacheKey = governanceBriefCacheKey({ projects, periodWindow, includeEvidence, includePOReadiness });
  const cached = await cache.get(cacheKey, { namespace: GOVERNANCE_NS });
  const cachedBrief = cached?.value || cached;
  if (cachedBrief) {
    const cachedAt = cached?.cachedAt || cachedBrief?.meta?.cachedAt || null;
    return {
      brief: applyCachedFreshness(cachedBrief),
      cached: true,
      cacheTtlMs: cached?.ttlMs,
      cachedAt,
    };
  }

  const agileClient = createAgileClient();
  const version3Client = createVersion3Client();
  const fields = await discoverFieldsWithCache(version3Client);
  const { boards } = await discoverBoardsWithCache(projects, agileClient);

  let baseline = null;
  const quarterHint = String(req?.query?.quarter || req?.query?.vodacomQuarter || req?.query?.periodKey || '').trim();
  try {
    baseline = await getLatestPIBaselineForScope({ projects, quarter: quarterHint });
  } catch (_) { baseline = null; }
  if (!baseline) {
    try { baseline = await getLatestPIBaseline(`${projects.join('+')}`); } catch (_) { baseline = null; }
  }

  let profileOverrides = null;
  try {
    profileOverrides = await resolveEffectiveGovernanceProfile({
      portfolioKey: projects.join('+'),
      project: projects[0] || '',
      userId: req?.session?.user || null,
    });
  } catch (_) { profileOverrides = null; }

  const providerConfig = resolveProviderConfig(req?.headers || {});
  const brief = await assembleGovernanceBrief({
    projects, boards, agileClient, version3Client, fields,
    period: { vodacomQuarter: null, sprintNames: [], periodWindow },
    cache, providerConfig, includeEvidence, includePOReadiness, baseline, profileOverrides,
  });
  const { ttlMs } = deriveCacheTtlMs({
    generatedAt: brief?.generatedAt,
    periodEnd: brief?.period?.end || brief?.meta?.periodEnd,
  });
  await cache.set(cacheKey, brief, ttlMs, { namespace: GOVERNANCE_NS });
  const quarterLabel = brief?.period?.vodacomQuarter;
  if (quarterLabel) {
    void rememberQuarterLabel(quarterLabel, projects).catch((err) => {
      logger.warn('quarter label index write failed', { error: err?.message });
    });
  }
  logger.info('governance-brief built', {
    projects: projects.join(','), boards: brief.meta?.boardsResolved,
    risks: brief.risks?.length || 0, narratedBy: brief.meta?.narratedBy,
    evidenceFetched: brief.meta?.evidenceFetched,
  });
  return { brief, cached: false, cacheTtlMs: ttlMs, cachedAt: brief?.generatedAt || new Date().toISOString() };
}

export async function serveStaleBriefOrError(res, projects, err, {
  periodWindow = '28d',
  includeEvidence = true,
  includePOReadiness = true,
} = {}) {
  const cacheKey = governanceBriefCacheKey({ projects, periodWindow, includeEvidence, includePOReadiness });
  try {
    const staleEntry = await cache.getWithStaleFallback(cacheKey, { namespace: GOVERNANCE_NS });
    if (staleEntry) {
      const brief = staleEntry.value || staleEntry;
      const ageMin = Math.max(0, Math.round((Number(staleEntry.staleAgeMs) || 0) / 60000));
      brief.freshness = { ...(brief.freshness || {}), confidenceLimit: 'stale', cacheAgeMinutes: ageMin };
      if (brief.leadershipNarrative?.confidence) {
        brief.leadershipNarrative.confidence = clampConfidenceToFreshness(brief.leadershipNarrative.confidence, 'stale');
      }
      brief.meta = { ...(brief.meta || {}), servedStale: true, staleReason: err?.code || 'JIRA_UNREACHABLE' };
      return res.json(brief);
    }
  } catch (_) { /* fall through */ }
  return res.status(502).json({ error: 'Governance brief unavailable', code: 'GOVERNANCE_BRIEF_FAILED' });
}

export async function invalidateGovernanceBriefCache(projects, {
  periodWindow = '28d',
  includeEvidence = true,
  includePOReadiness = true,
} = {}) {
  const cacheKey = governanceBriefCacheKey({ projects, periodWindow, includeEvidence, includePOReadiness });
  await cache.delete(cacheKey, { namespace: GOVERNANCE_NS });
}
