/**
 * SSOT: governance brief cache read-through, build, and stale fallback.
 */
import { logger } from './Delivera-Server-Logging-Utility.js';
import { cache } from './cache.js';
import { createAgileClient, createVersion3Client } from './jiraClients.js';
import { discoverBoardsWithCache, discoverFieldsWithCache } from './server-utils.js';
import { assembleGovernanceBrief } from './Delivera-Governance-Brief-03Assemble-Service.js';
import { getLatestPIBaseline, getLatestPIBaselineForScope, getLatestPIBaselinesByProject } from './Delivera-Governance-PIBaseline-01Store-IO.js';
import { resolveEffectiveGovernanceProfile } from './Delivera-Governance-Profile-01Resolve-SSOT.js';
import { resolveProviderConfig } from './Delivera-AI-Provider-Gateway.js';
import { clampConfidenceToFreshness } from './Delivera-Governance-Grammar-01Rules-SSOT.js';
import { rememberQuarterLabel } from './Delivera-Governance-Quarter-Labels-01Index-SSOT.js';
import { deriveVodacomQuarterFromDate } from './Delivera-Data-VodacomQuarters-01Bounds.js';
import {
  CACHE_NS,
  deriveCacheTtlMs,
  governanceBriefCacheKey,
} from './Delivera-Cache-AgeTier-01TTL-SSOT.js';

const GOVERNANCE_NS = CACHE_NS.GOVERNANCE_BRIEF;
const DEGRADED_EVIDENCE_TTL_MS = 30_000;

function safeProjectErrors(projectErrors = []) {
  return projectErrors.map((row) => ({
    projectKey: String(row?.projectKey || '').trim().toUpperCase(),
    code: String(row?.code || 'JIRA_UNKNOWN'),
    message: String(row?.message || 'Jira evidence could not be read.'),
  }));
}

export function applyEvidenceAccessState(brief, projects, projectErrors, boards) {
  const safeErrors = safeProjectErrors(projectErrors);
  if (!safeErrors.length) return brief;

  const failedKeys = new Set(safeErrors.map((row) => row.projectKey));
  const requestedKeys = projects.map((key) => String(key).trim().toUpperCase()).filter(Boolean);
  const evidenceUnavailable = boards.length === 0 && requestedKeys.every((key) => failedKeys.has(key));
  const affected = safeErrors.map((row) => row.projectKey).filter(Boolean).join(', ');
  const failureCode = safeErrors[0]?.code || 'JIRA_UNKNOWN';

  brief.meta = {
    ...(brief.meta || {}),
    projectErrors: safeErrors,
    evidenceUnavailable,
    evidenceFailureCode: failureCode,
    evidenceFetched: evidenceUnavailable ? 0 : brief?.meta?.evidenceFetched,
  };
  brief.freshness = {
    ...(brief.freshness || {}),
    confidenceLimit: evidenceUnavailable ? 'unavailable' : 'partial',
    jiraFetchedAt: evidenceUnavailable ? null : brief?.freshness?.jiraFetchedAt,
  };

  if (evidenceUnavailable) {
    const answer = `CANNOT VERIFY. Jira access failed for ${affected || 'the selected scope'}; no delivery-health verdict has been inferred.`;
    brief.leadershipNarrative = {
      ...(brief.leadershipNarrative || {}),
      confidence: 'low',
      headline: 'Delivery evidence is unavailable',
      meetingAnswer: answer,
      oneParagraph: `${answer} Restore Jira access in Settings, then retry this view.`,
    };
    brief.executiveView = {
      ...(brief.executiveView || {}),
      verdictTier: 'cannot-verify',
      verdictLine: answer,
      headline: 'Jira access must be restored before governance decisions are made',
    };
    const setupGaps = Array.isArray(brief.meta.setupGaps) ? brief.meta.setupGaps : [];
    brief.meta.setupGaps = [
      {
        id: 'jira-access',
        severity: 'high',
        label: 'Jira evidence unavailable',
        detail: `Delivera cannot read ${affected || 'the selected scope'} and will not guess delivery health.`,
        action: 'check-integration',
      },
      ...setupGaps.filter((gap) => gap?.id !== 'jira-access'),
    ];
  }
  return brief;
}

function applyCachedFreshness(brief) {
  if (!brief?.freshness) return brief;
  const generatedMs = brief.generatedAt ? new Date(brief.generatedAt).getTime() : Date.now();
  const ageMin = Math.max(0, Math.round((Date.now() - generatedMs) / 60000));
  const existingLimit = brief.freshness.confidenceLimit;
  const confidenceLimit = existingLimit === 'unavailable' || existingLimit === 'partial'
    ? existingLimit
    : 'cached';
  brief.freshness = { ...brief.freshness, confidenceLimit, cacheAgeMinutes: ageMin };
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
  const { boards, projectErrors = [] } = await discoverBoardsWithCache(projects, agileClient);

  let baselinesByProject = null;
  let baseline = null;
  const quarterHint = String(req?.query?.quarter || req?.query?.vodacomQuarter || req?.query?.periodKey || '').trim();
  try {
    baselinesByProject = await getLatestPIBaselinesByProject({ projects, quarter: quarterHint });
  } catch (_) { baselinesByProject = null; }
  try {
    baseline = await getLatestPIBaselineForScope({ projects, quarter: quarterHint });
  } catch (_) { baseline = null; }
  if (!baseline) {
    try { baseline = await getLatestPIBaseline(`${projects.join('+')}`); } catch (_) { baseline = null; }
  }
  if (!baseline && baselinesByProject) {
    for (const row of baselinesByProject.values()) {
      if (row?.committedItems?.length) {
        baseline = row;
        break;
      }
    }
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
  // Resolve the Vodacom quarter from the hint or derive from today's date.
  // (Audit 2026-07-15: period.vodacomQuarter was always null even when the
  // quarter was specified in the request, causing the current-sprint Quarter
  // dropdown to default to "FY24 Q4" instead of the active sprint's quarter.)
  const resolvedQuarter = quarterHint || deriveVodacomQuarterFromDate(new Date());
  const brief = await assembleGovernanceBrief({
    projects, boards, projectErrors, agileClient, version3Client, fields,
    period: { vodacomQuarter: resolvedQuarter, sprintNames: [], periodWindow },
    cache, providerConfig, includeEvidence, includePOReadiness, baseline, baselinesByProject, profileOverrides,
  });
  applyEvidenceAccessState(brief, projects, projectErrors, boards);
  const { ttlMs } = deriveCacheTtlMs({
    generatedAt: brief?.generatedAt,
    periodEnd: brief?.period?.end || brief?.meta?.periodEnd,
  });
  const effectiveTtlMs = projectErrors.length ? Math.min(ttlMs, DEGRADED_EVIDENCE_TTL_MS) : ttlMs;
  await cache.set(cacheKey, brief, effectiveTtlMs, { namespace: GOVERNANCE_NS });
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
  return { brief, cached: false, cacheTtlMs: effectiveTtlMs, cachedAt: brief?.generatedAt || new Date().toISOString() };
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
