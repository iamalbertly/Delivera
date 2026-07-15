/**
 * SSOT: Epic activity signals from board/sprint payloads (cache-first, no extra Jira when warm).
 */
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
    const existsInJira = Boolean(act && (act.existsInBoard || act.lifecycle === 'jira-only' || Number(act.storyCount) > 0));
    return {
      ...c,
      existsInJira: existsInJira || Boolean(act),
      epicActivity: act || (k
        ? { lifecycle: 'unknown', activityLabel: 'Key on slide — confirm existence in Jira' }
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
 * Bounded Jira GET for epic keys missing from board cache (max 10).
 */
export async function enrichActivityFromJiraExistence(candidates = [], activityByKey = new Map(), version3Client = null, maxKeys = 10) {
  if (!version3Client?.issues?.getIssue) return activityByKey;
  let calls = 0;
  for (const c of candidates) {
    if (calls >= maxKeys) break;
    const k = String(c.issueKey || '').trim().toUpperCase();
    if (!k || activityByKey.has(k)) continue;
    try {
      await version3Client.issues.getIssue({ issueIdOrKey: k });
      activityByKey.set(k, {
        issueKey: k,
        existsInBoard: false,
        lifecycle: 'jira-only',
        activityLabel: 'In Jira — refresh brief for sprint detail',
      });
      calls += 1;
    } catch (_) { /* not found or no access */ }
  }
  return activityByKey;
}
