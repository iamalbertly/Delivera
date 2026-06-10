/**
 * SSOT: Evidence Pack builder.
 *
 * The killer trust feature: for the flagged risks only (bounded, never the whole
 * backlog), fetch Jira changelog and produce a defensible evidence row per issue
 * - status now, status ~last week, last transition date, sprint-added date,
 * whether added after sprint start, blocker age, assignee, reporter, Jira URL,
 * and why Delivera flagged it. A leader can challenge any claim and get the
 * issue keys + timestamps in under 30 seconds.
 *
 * Degrades gracefully: if changelog is unavailable, the row still carries the
 * deterministic facts from the risk itself (never blocks, never invents).
 */
import { logger } from './Delivera-Server-Logging-Utility.js';

const WEEK_MS = 7 * 24 * 3600 * 1000;
const DEFAULT_MAX_ITEMS = 12;
const DEFAULT_CONCURRENCY = 4;

function toMs(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : NaN;
}

function extractStatusHistory(changelog) {
  const histories = Array.isArray(changelog?.histories) ? changelog.histories : [];
  const statusChanges = [];
  const sprintChanges = [];
  for (const h of histories) {
    const at = h?.created || '';
    for (const item of (Array.isArray(h?.items) ? h.items : [])) {
      const field = String(item?.field || '').toLowerCase();
      if (field === 'status') statusChanges.push({ at, from: item.fromString || '', to: item.toString || '' });
      if (field === 'sprint') sprintChanges.push({ at, from: item.fromString || '', to: item.toString || '' });
    }
  }
  statusChanges.sort((a, b) => toMs(a.at) - toMs(b.at));
  sprintChanges.sort((a, b) => toMs(a.at) - toMs(b.at));
  return { statusChanges, sprintChanges };
}

/** Status value as of a point in time, derived from the change history. */
function statusAsOf(statusChanges, atMs, currentStatus) {
  if (!statusChanges.length) return null;
  let value = statusChanges[0].from || null;
  for (const change of statusChanges) {
    if (toMs(change.at) <= atMs) value = change.to;
    else break;
  }
  return value || currentStatus || null;
}

function lastTransitionDate(statusChanges) {
  if (!statusChanges.length) return null;
  return statusChanges[statusChanges.length - 1].at || null;
}

/**
 * Sprint-added date: when the issue first entered a sprint (changelog), else null.
 */
function sprintAddedDate(sprintChanges) {
  const added = sprintChanges.find((c) => c.to && c.to.trim());
  return added ? added.at : null;
}

/**
 * Build a single evidence row from a risk + (optional) changelog issue.
 */
function buildEvidenceRow(risk, issue, sprintStartIso) {
  const fields = issue?.fields || {};
  const currentStatus = fields?.status?.name || risk.status || '';
  const assignee = fields?.assignee?.displayName || risk.owner || '';
  const reporter = fields?.reporter?.displayName || '';
  const created = fields?.created || risk.updated || null;
  const url = risk.issueUrl || (issue?.self ? '' : '');

  let statusLastWeek = null;
  let lastTransition = risk.updated || null;
  let addedDate = created;
  let addedAfterStart = false;

  if (issue?.changelog) {
    const { statusChanges, sprintChanges } = extractStatusHistory(issue.changelog);
    statusLastWeek = statusAsOf(statusChanges, Date.now() - WEEK_MS, currentStatus);
    lastTransition = lastTransitionDate(statusChanges) || lastTransition;
    addedDate = sprintAddedDate(sprintChanges) || created;
  }

  const startMs = toMs(sprintStartIso);
  const addedMs = toMs(addedDate);
  if (Number.isFinite(startMs) && Number.isFinite(addedMs)) addedAfterStart = addedMs > startMs;

  return {
    issueKey: risk.issueKey,
    issueTitle: risk.summary || fields?.summary || '',
    squad: risk.squad || '',
    statusNow: currentStatus,
    statusLastWeek: statusLastWeek || 'unknown (no changelog)',
    lastTransitionDate: lastTransition,
    assignee: assignee || 'Unassigned',
    reporter: reporter || 'Unknown',
    sprintAddedDate: addedDate,
    addedAfterSprintStart: addedAfterStart,
    blockerAgeHours: Math.round(Number(risk.ageHours) || 0),
    jiraUrl: url,
    riskType: risk.riskType,
    whyFlagged: risk.evidence || '',
    changelogAvailable: !!issue?.changelog,
    skipReason: risk.skipReason || null,
  };
}

async function fetchIssueWithChangelog(version3Client, issueKey, cache, cacheTtlMs) {
  const namespace = 'governanceEvidence';
  if (cache?.get) {
    try {
      const cached = await cache.get(issueKey, { namespace });
      const val = cached?.value || cached;
      if (val) return val;
    } catch (_) { /* ignore cache read errors */ }
  }
  const issue = await version3Client.issues.getIssue({
    issueIdOrKey: issueKey,
    expand: 'changelog',
    fields: ['summary', 'status', 'assignee', 'reporter', 'created', 'updated'],
  });
  if (cache?.set && issue) {
    try { await cache.set(issueKey, issue, cacheTtlMs || 15 * 60 * 1000, { namespace }); } catch (_) { /* ignore */ }
  }
  return issue;
}

/**
 * Build the Evidence Pack for a bounded list of risks.
 * @param {object} args
 * @param {Array} args.risks risks from the fact contract (already ranked)
 * @param {object} args.version3Client Jira client (optional; degrades if absent)
 * @param {Map|object} [args.sprintStartByKey] issueKey -> sprint start ISO (optional)
 * @param {object} [args.cache] cache with get/set (optional)
 * @param {number} [args.maxItems] cap on changelog fetches (token/call budget)
 * @param {number} [args.cacheTtlMs]
 * @returns {Promise<{ rows: Array, fetched: number, degraded: boolean }>}
 */
export async function buildEvidencePack({
  risks = [],
  version3Client = null,
  sprintStartByKey = null,
  cache = null,
  maxItems = DEFAULT_MAX_ITEMS,
  cacheTtlMs = 15 * 60 * 1000,
} = {}) {
  const bounded = (Array.isArray(risks) ? risks : []).slice(0, Math.max(0, maxItems));
  const startFor = (key) => {
    if (!sprintStartByKey) return null;
    if (sprintStartByKey instanceof Map) return sprintStartByKey.get(key) || null;
    return sprintStartByKey[key] || null;
  };

  if (!version3Client) {
    return {
      rows: bounded.map((r) => buildEvidenceRow(r, null, startFor(r.issueKey))),
      fetched: 0,
      degraded: true,
    };
  }

  const rows = [];
  let fetched = 0;
  let degraded = false;
  for (let i = 0; i < bounded.length; i += DEFAULT_CONCURRENCY) {
    const chunk = bounded.slice(i, i + DEFAULT_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(async (risk) => {
      const issueKey = String(risk?.issueKey || '').trim();
      if (!issueKey) {
        degraded = true;
        return buildEvidenceRow(
          { ...risk, skipReason: 'no-issue-key' },
          null,
          startFor(risk.issueKey),
        );
      }
      try {
        const issue = await fetchIssueWithChangelog(version3Client, issueKey, cache, cacheTtlMs);
        fetched += 1;
        return buildEvidenceRow(risk, issue, startFor(risk.issueKey));
      } catch (err) {
        logger.warn('Evidence changelog fetch failed', { issueKey, error: err?.message });
        degraded = true;
        return buildEvidenceRow(risk, null, startFor(risk.issueKey));
      }
    }));
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) rows.push(s.value);
    }
  }
  return { rows, fetched, degraded };
}
