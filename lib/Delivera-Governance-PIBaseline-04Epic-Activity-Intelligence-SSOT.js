/**
 * SSOT: Epic activity signals from board/sprint payloads (cache-first, no extra Jira when warm).
 */
import { epicSummaryHasPiPeriod, periodFromEpicSummary } from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';

function statusIsDone(status) {
  return String(status || '').toLowerCase().includes('done');
}

/**
 * Rebuild minimal board payloads from brief meta.boardEpicIndex (cache-only).
 */
export function boardPayloadsFromBriefMeta(brief = {}) {
  const index = brief?.meta?.boardEpicIndex || [];
  if (!index.length) return [];
  const byPk = new Map();
  for (const e of index) {
    const pk = String(e.projectKey || e.issueKey?.split('-')[0] || 'board').toUpperCase();
    if (!byPk.has(pk)) byPk.set(pk, []);
    byPk.get(pk).push({
      epicKey: e.issueKey,
      epicSummary: e.title,
      summary: e.title,
      status: 'In Progress',
    });
  }
  return [...byPk.entries()].map(([pk, stories]) => ({
    board: { name: pk, location: { projectKey: pk } },
    payload: { sprint: { state: 'active' }, stories },
  }));
}

/**
 * @param {Array} boardPayloads { board, payload }[]
 * @returns {Map<string, object>}
 */
export function buildEpicActivityByKey(boardPayloads = []) {
  const byEpic = new Map();

  for (const entry of boardPayloads) {
    const sprint = entry?.payload?.sprint || {};
    const sprintId = String(sprint.id || sprint.name || entry?.board?.name || '').trim();
    const sprintStart = sprint.startDate || sprint.start || '';
    const sprintState = String(sprint.state || '').toLowerCase();
    const stories = Array.isArray(entry?.payload?.stories) ? entry.payload.stories : [];

    for (const s of stories) {
      const ek = String(s?.epicKey || '').trim().toUpperCase();
      if (!ek) continue;
      if (!byEpic.has(ek)) {
        byEpic.set(ek, {
          issueKey: ek,
          title: s.epicSummary || s.summary || ek,
          storyCount: 0,
          doneCount: 0,
          activeStoryCount: 0,
          sprintIds: new Set(),
          firstSprintStart: null,
          lastSprintStart: null,
          inActiveSprint: false,
        });
      }
      const row = byEpic.get(ek);
      row.storyCount += 1;
      if (statusIsDone(s?.status)) row.doneCount += 1;
      else row.activeStoryCount += 1;
      if (sprintId) row.sprintIds.add(sprintId);
      if (sprintStart) {
        const ms = new Date(sprintStart).getTime();
        if (Number.isFinite(ms)) {
          if (!row.firstSprintStart || ms < new Date(row.firstSprintStart).getTime()) {
            row.firstSprintStart = sprintStart;
          }
          if (!row.lastSprintStart || ms > new Date(row.lastSprintStart).getTime()) {
            row.lastSprintStart = sprintStart;
          }
        }
      }
      if (sprintState === 'active') row.inActiveSprint = true;
    }
  }

  const out = new Map();
  for (const [ek, row] of byEpic) {
    const sprintCount = row.sprintIds.size;
    let lifecycle = 'not-started';
    if (row.storyCount === 0) lifecycle = 'not-started';
    else if (row.activeStoryCount === 0 && row.doneCount === row.storyCount) lifecycle = 'complete';
    else if (row.inActiveSprint || row.activeStoryCount > 0) lifecycle = 'in-flight';
    else lifecycle = 'backlog-only';

    out.set(ek, {
      issueKey: ek,
      title: row.title,
      existsInBoard: true,
      storyCount: row.storyCount,
      doneCount: row.doneCount,
      sprintCount,
      firstActiveSprintStart: row.firstSprintStart,
      lastSprintStart: row.lastSprintStart,
      lifecycle,
      activityLabel: lifecycleLabel(lifecycle, sprintCount, row.firstSprintStart),
    });
  }
  return out;
}

function lifecycleLabel(lifecycle, sprintCount, firstStart) {
  if (lifecycle === 'not-started') return 'Not started in sprint yet';
  if (lifecycle === 'complete') return 'All stories done';
  if (lifecycle === 'backlog-only') return 'Stories exist, not in active sprint';
  const start = firstStart ? `since ${String(firstStart).slice(0, 10)}` : '';
  return sprintCount > 1
    ? `In flight · ${sprintCount} sprints ${start}`.trim()
    : `In flight ${start}`.trim();
}

export function enrichCandidatesWithEpicActivity(candidates = [], activityByKey = new Map()) {
  return candidates.map((c) => {
    const k = String(c.issueKey || '').trim().toUpperCase();
    const act = activityByKey.get(k);
    const existsInJira = Boolean(k && (act?.existsInBoard || c.issueKey));
    return {
      ...c,
      existsInJira,
      epicActivity: act || (existsInJira
        ? { lifecycle: 'unknown', activityLabel: 'On board — refresh brief for sprint detail' }
        : { lifecycle: 'missing', activityLabel: 'Not on board — create in Jira first' }),
    };
  });
}

/**
 * Load activity map from governance brief cache for projects.
 */
export async function loadEpicActivityFromBriefCache({ projects, cache, namespace = 'governanceBrief' }) {
  const pks = Array.isArray(projects) ? projects : [];
  const merged = new Map();
  for (const pk of pks.slice(0, 5)) {
    const cacheKey = `${namespace}:${pk}:e1:p1`;
    const cached = await cache.get(cacheKey, { namespace });
    const brief = cached?.value || cached;
    if (!brief) continue;
    const payloads = boardPayloadsFromBriefMeta(brief);
    for (const [k, v] of buildEpicActivityByKey(payloads)) merged.set(k, v);
  }
  if (pks.length > 1) {
    const joined = await cache.get(`${namespace}:${pks.join(',')}:e1:p1`, { namespace });
    const brief = joined?.value || joined;
    if (brief) {
      for (const [k, v] of buildEpicActivityByKey(boardPayloadsFromBriefMeta(brief))) merged.set(k, v);
    }
  }
  return merged;
}

/**
 * Bounded, cache-first Jira GET for keys missing from the board payload.
 */
export async function enrichActivityFromJiraExistence(candidates = [], activityByKey = new Map(), version3Client = null, maxKeys = 10, options = {}) {
  if (!version3Client?.issues?.getIssue) return activityByKey;
  const cache = options.cache || null;
  const cacheTtlMs = Number(options.cacheTtlMs) || 15 * 60 * 1000;
  const namespace = 'governanceBaselineIssueEvidenceV1';
  let calls = 0;
  for (const c of candidates) {
    if (calls >= maxKeys) break;
    const k = String(c.issueKey || '').trim().toUpperCase();
    if (!k || activityByKey.has(k)) continue;
    const cacheKey = `jira-issue:${k}`;
    const cached = cache ? await cache.get(cacheKey, { namespace }) : null;
    const cachedValue = cached?.value || cached;
    if (cachedValue?.issueKey === k) {
      activityByKey.set(k, cachedValue);
      continue;
    }
    calls += 1;
    try {
      const issue = await version3Client.issues.getIssue({
        issueIdOrKey: k,
        fields: ['summary', 'status', 'fixVersions', 'labels', 'issuetype', 'updated'],
      });
      const fields = issue?.fields || {};
      const fixVersions = (fields.fixVersions || []).map((entry) => entry?.name).filter(Boolean);
      const labels = (fields.labels || []).map(String).filter(Boolean);
      const summary = String(fields.summary || c.title || '');
      // Title-format SSOT first (FY27 Q2 - Squad - Platform - Title); Fix Version/labels are fallback.
      const titlePeriod = periodFromEpicSummary(summary);
      const hasPiMetadata = Boolean(titlePeriod)
        || epicSummaryHasPiPeriod(summary)
        || [...fixVersions, ...labels].some((value) => (
          /\bFY\s*\d{2,4}\s*[-_ ]?Q[1-4]\b/i.test(value)
          || /\bQ[1-4]\s*[-_ ]?FY\s*\d{2,4}\b/i.test(value)
        ));
      const resolved = {
        issueKey: k,
        existsInJira: true,
        existsInBoard: false,
        lifecycle: 'jira-only',
        title: summary || c.title || k,
        status: fields.status?.name || '',
        issueType: fields.issuetype?.name || '',
        updated: fields.updated || '',
        fixVersion: fixVersions.join(', '),
        quarterLabel: titlePeriod || labels.join(', '),
        jiraPeriod: titlePeriod || fixVersions.find((v) => /\bFY\s*\d{2,4}/i.test(v)) || '',
        piPeriodSource: titlePeriod ? 'epic-title' : (hasPiMetadata ? 'fix-version-or-label' : 'none'),
        missingPiMetadata: !hasPiMetadata,
        activityLabel: 'Exists in Jira; active-sprint evidence is still being resolved',
      };
      activityByKey.set(k, resolved);
      if (cache) await cache.set(cacheKey, resolved, cacheTtlMs, { namespace });
    } catch (error) {
      const httpStatus = Number(error?.statusCode || error?.status || error?.response?.status);
      if (httpStatus === 401 || httpStatus === 403) {
        const blocked = {
          issueKey: k,
          existsInJira: false,
          existsInBoard: false,
          permissionDenied: true,
          httpStatus,
          lifecycle: 'access-blocked',
          activityLabel: 'Jira access blocked this issue check',
        };
        activityByKey.set(k, blocked);
        if (cache) await cache.set(cacheKey, blocked, Math.min(cacheTtlMs, 5 * 60 * 1000), { namespace });
      } else if (httpStatus === 404) {
        const missing = {
          issueKey: k,
          existsInJira: false,
          existsInBoard: false,
          notFoundInJira: true,
          httpStatus,
          lifecycle: 'not-found',
          activityLabel: 'Jira returned 404 for this approved commitment key',
        };
        activityByKey.set(k, missing);
        if (cache) await cache.set(cacheKey, missing, Math.min(cacheTtlMs, 5 * 60 * 1000), { namespace });
      }
    }
  }
  return activityByKey;
}
