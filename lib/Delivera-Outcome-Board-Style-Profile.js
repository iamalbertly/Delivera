/**
 * Board-scoped style profile from Jira (no LLM). Quality-filtered, bounded JQL.
 * Cache: namespace outcomeProfile, key includes projectKey + boardId + window.
 */

import { cache } from './cache.js';
import { logger } from './Delivera-Server-Logging-Utility.js';

const PROFILE_TTL_MS = 30 * 60 * 1000;
const WINDOW_DAYS = 120;
const RECENT_DAYS = 42;
const MAX_ISSUES_LONG = 35;
const MAX_ISSUES_RECENT = 25;

function profileCacheKey(projectKey, boardId, refresh) {
  const b = boardId != null && !Number.isNaN(Number(boardId)) ? String(Number(boardId)) : 'noboard';
  return `outcomeStyle:v1:${String(projectKey || '').toUpperCase()}:board:${b}:r${refresh ? '1' : '0'}`;
}

function isNoiseIssue(issue) {
  const s = String(issue?.fields?.summary || '').trim();
  if (s.length < 3) return true;
  if (/^[\W_]+$/.test(s)) return true;
  return false;
}

function isCancelled(issue) {
  const cat = String(issue?.fields?.status?.statusCategory?.key || '').toLowerCase();
  const name = String(issue?.fields?.status?.name || '').toLowerCase();
  return cat === 'done' && /cancel|wont|duplicate|declined/.test(name);
}

function extractAcronyms(text) {
  const set = new Set();
  const re = /\b[A-Z]{2,5}\b/g;
  let m;
  const s = String(text || '');
  while ((m = re.exec(s)) != null) {
    const w = m[0];
    if (w.length >= 2 && w.length <= 5) set.add(w);
  }
  return [...set];
}

function delimiterHistogram(summaries) {
  const scores = { dash: 0, pipe: 0, emdash: 0 };
  summaries.forEach((s) => {
    if (/–|—/.test(s)) scores.emdash += 1;
    if (/\s-\s/.test(s) || / - /.test(s)) scores.dash += 1;
    if (/\s\|\s/.test(s)) scores.pipe += 1;
  });
  return scores;
}

function subtaskPhraseHistogram(subtaskSummaries) {
  const map = new Map();
  subtaskSummaries.forEach((raw) => {
    const t = String(raw || '').trim();
    if (t.length < 4 || t.length > 120) return;
    const k = t.toLowerCase();
    map.set(k, (map.get(k) || 0) + 1);
  });
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([phrase]) => phrase);
}

/** Summaries that look like quarter + system + support bucket */
function findSupportEpicCandidates(epicSummaries) {
  const out = [];
  epicSummaries.forEach(({ key, summary }) => {
    const s = String(summary || '');
    if (!/\b(support|maintenance|adhoc|operations)\b/i.test(s)) return;
    if (!/\b(fy\d{2}|q[1-4])\b/i.test(s.toLowerCase()) && !/\b20\d{2}\b/.test(s)) return;
    out.push({ key, summary: s });
  });
  return out.slice(0, 8);
}

export async function buildBoardStyleProfile({
  version3Client,
  projectKey,
  boardId = null,
  refresh = false,
}) {
  const pk = String(projectKey || '').trim().toUpperCase();
  if (!pk) return emptyProfile('missing project');

  const key = profileCacheKey(pk, boardId, refresh);
  if (!refresh) {
    const hit = await cache.get(key, { namespace: 'outcomeProfile' });
    const v = hit?.value ?? hit;
    if (v && typeof v === 'object' && v.projectKey === pk) return v;
  }

  const jqlDone = `project = ${pk} AND statusCategory = Done AND updated >= -${WINDOW_DAYS}d ORDER BY updated DESC`;
  const jqlRecent = `project = ${pk} AND updated >= -${RECENT_DAYS}d ORDER BY updated DESC`;

  let doneIssues = [];
  let recentIssues = [];
  try {
    const [r1, r2] = await Promise.all([
      version3Client.issueSearch.searchForIssuesUsingJqlPost({
        jql: jqlDone,
        maxResults: MAX_ISSUES_LONG,
        fields: ['summary', 'issuetype', 'status', 'resolutiondate', 'updated'],
      }).catch(() => ({ issues: [] })),
      version3Client.issueSearch.searchForIssuesUsingJqlPost({
        jql: jqlRecent,
        maxResults: MAX_ISSUES_RECENT,
        fields: ['summary', 'issuetype', 'status', 'updated'],
      }).catch(() => ({ issues: [] })),
    ]);
    doneIssues = Array.isArray(r1?.issues) ? r1.issues : [];
    recentIssues = Array.isArray(r2?.issues) ? r2.issues : [];
  } catch (error) {
    logger.warn('buildBoardStyleProfile JQL failed', { projectKey: pk, error: error?.message });
    const empty = emptyProfile('jql_failed');
    await cache.set(key, empty, PROFILE_TTL_MS, { namespace: 'outcomeProfile' });
    return empty;
  }

  const merged = [...doneIssues, ...recentIssues];
  const clean = merged.filter((i) => !isNoiseIssue(i) && !isCancelled(i));
  const epicSummaries = [];
  const storySummaries = [];
  const subtaskSummaries = [];

  clean.forEach((issue) => {
    const typeName = String(issue?.fields?.issuetype?.name || '');
    const isEpic = /epic|initiative|theme|feature/i.test(typeName) && !issue?.fields?.issuetype?.subtask;
    const isSub = issue?.fields?.issuetype?.subtask === true || /sub-task|subtask/i.test(typeName);
    const sum = String(issue?.fields?.summary || '');
    const row = { key: issue?.key || '', summary: sum };
    if (isEpic) epicSummaries.push(row);
    else if (isSub) subtaskSummaries.push(sum);
    else storySummaries.push(sum);
  });

  const recentCut = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recentEpicTitles = epicSummaries
    .filter((e) => {
      const u = issueUpdatedMs(merged.find((i) => i.key === e.key));
      return u >= recentCut;
    })
    .map((e) => e.summary);
  const allEpicTitles = epicSummaries.map((e) => e.summary);
  const weightedSummaries = [...recentEpicTitles, ...recentEpicTitles, ...allEpicTitles];
  const delims = delimiterHistogram(weightedSummaries.length ? weightedSummaries : allEpicTitles);

  const acronymFreq = new Map();
  [...storySummaries, ...allEpicTitles].forEach((s) => {
    extractAcronyms(s).forEach((a) => {
      acronymFreq.set(a, (acronymFreq.get(a) || 0) + 1);
    });
  });
  const topAcronyms = [...acronymFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([a]) => a);

  const profile = {
    projectKey: pk,
    boardId: boardId != null ? Number(boardId) : null,
    sampledAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    recentDays: RECENT_DAYS,
    sampleCounts: {
      done: doneIssues.length,
      recent: recentIssues.length,
      used: clean.length,
    },
    delimiterBias: delims,
    topAcronyms,
    subtaskPhraseHints: subtaskPhraseHistogram(subtaskSummaries),
    supportEpicCandidates: findSupportEpicCandidates(epicSummaries),
    epicTitleSamples: allEpicTitles.slice(0, 12),
    degraded: false,
    degradeReason: '',
  };

  await cache.set(key, profile, PROFILE_TTL_MS, { namespace: 'outcomeProfile' });
  return profile;
}

function issueUpdatedMs(issue) {
  const u = issue?.fields?.updated;
  if (!u) return 0;
  const t = new Date(u).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function emptyProfile(reason) {
  return {
    projectKey: '',
    boardId: null,
    sampledAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    recentDays: RECENT_DAYS,
    sampleCounts: { done: 0, recent: 0, used: 0 },
    delimiterBias: { dash: 0, pipe: 0, emdash: 0 },
    topAcronyms: [],
    subtaskPhraseHints: [],
    supportEpicCandidates: [],
    epicTitleSamples: [],
    degraded: true,
    degradeReason: reason || 'empty',
  };
}
