/**
 * SSOT: Worker receipt, command answer sentence, setup gaps, since-last-run deltas.
 */
import { readRecentJobs } from './Delivera-Governance-Worker-02Jobs-IO.js';
import { freshnessShortLabel } from '../public/Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

function asNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

/** Deterministic manager-ready one-liner (no LLM). */
export function buildCommandAnswerSentence(brief = {}) {
  const ev = brief?.executiveView || {};
  const n = brief?.leadershipNarrative || {};
  const line = ev.verdictLine || n.meetingAnswer || n.oneParagraph || '';
  if (line) return String(line).slice(0, 320);
  const dt = brief?.deliveryTruth || {};
  const stale = asNum(dt.staleInProgress, 0);
  const blocked = asNum(dt.blocked, 0);
  if (stale || blocked) {
    return `Delivery needs attention: ${stale} stale in progress, ${blocked} blocked. Review grouped actions below.`;
  }
  return 'Delivery is within expected bounds for this scope. Expand squad tiles for detail.';
}

export function buildSetupGaps(brief = {}, opts = {}) {
  const gaps = [];
  const hasBaseline = Boolean(brief?.baselineComparison);
  const narratedBy = brief?.meta?.narratedBy || brief?.leadershipNarrative?.narratedBy || 'template';
  const noSprint = (brief?.portfolioRisks || []).some((r) => r.riskType === 'no-active-sprint')
    || (brief?.risks || []).some((r) => r.riskType === 'no-active-sprint');
  const dt = brief?.deliveryTruth || {};
  const unassigned = (brief?.risks || []).filter((r) => r.riskType === 'missing-owner').length;

  if (!hasBaseline) {
    gaps.push({
      id: 'pi-baseline',
      action: 'set-baseline',
      severity: 'high',
    });
  }
  if (narratedBy === 'template' && opts.aiKeyConfigured === false) {
    gaps.push({
      id: 'ai-key',
      label: 'AI key missing — using built-in template wording',
      action: 'add-ai-key',
      severity: 'medium',
    });
  }
  if (noSprint) {
    gaps.push({
      id: 'no-sprint',
      label: 'No active sprint on one or more squads — delivery confidence is limited',
      action: 'map-board',
      severity: 'high',
    });
  }
  if (unassigned > 0) {
    gaps.push({
      id: 'unassigned',
      label: `${unassigned} item(s) unassigned — owner confidence is low`,
      action: 'review-lanes',
      severity: 'medium',
    });
  }
  if (brief?.freshness?.confidenceLimit === 'stale') {
    gaps.push({
      id: 'stale-data',
      label: 'Data is stale — refresh before sending nudges',
      action: 'refresh',
      severity: 'high',
    });
  }
  return gaps;
}

function minutesAgo(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

export async function buildWorkerReceipt(brief = {}, inboxGrouped = {}, jobs = []) {
  const lastJob = (jobs || []).find((j) => j.status === 'completed' || j.status === 'skipped')
    || jobs[0];
  const mins = minutesAgo(lastJob?.completedAt || lastJob?.startedAt || brief?.generatedAt);
  const ago = mins == null ? 'unknown' : mins < 2 ? 'just now' : `${mins}m ago`;
  const briefs = inboxGrouped.briefs?.length || 0;
  const nudges = inboxGrouped.nudges?.length || 0;
  const confirm = inboxGrouped.confirm?.length || 0;
  const piDrift = inboxGrouped.piDrift?.length || 0;
  const impact = inboxGrouped.impact?.length || 0;
  const poReadiness = inboxGrouped.poReadiness?.length || 0;
  const inboxTotal = briefs + nudges + confirm + piDrift + impact + poReadiness;
  const gaps = brief?.meta?.setupGaps || buildSetupGaps(brief);
  const needs = gaps.slice(0, 2).map((g) => g.id.replace(/-/g, ' ')).join(', ') || 'none';
  const authFailed = (jobs || []).some((j) => j.status === 'auth_failed');
  const skips = Array.isArray(brief?.meta?.partialBoardSkips) ? brief.meta.partialBoardSkips : [];
  const warming = !lastJob && !brief?.generatedAt;
  let line;
  if (authFailed) {
    line = `Last run: ${ago} · Jira auth failed — reconnect · Prepared: ${briefs} brief, ${nudges} nudges · Needs: reconnect`;
  } else if (skips.length) {
    line = `Last run: ${ago} · Partial (${skips.length} board${skips.length === 1 ? '' : 's'} skipped — kanban) · Prepared: ${briefs} brief, ${nudges} nudges · Needs: ${needs}`;
  } else if (warming) {
    line = 'Warming Jira cache';
  } else {
    line = `Last run: ${ago} · Checked: Jira, sprint, evidence · Prepared: ${briefs} brief, ${nudges} nudges${confirm ? `, ${confirm} review` : ''} · Needs: ${needs}`;
  }
  return {
    line,
    lastRunAt: lastJob?.completedAt || lastJob?.startedAt || brief?.generatedAt,
    authFailed,
    warming,
    partialBoardSkips: skips.length,
    preparedBriefs: briefs,
    preparedNudges: nudges,
    needsReview: confirm,
    inboxTotal,
    pendingCount: inboxTotal,
  };
}

export function computeSinceLastRun(brief = {}, lastJob = null) {
  if (!lastJob?.outputs?.snapshot) return null;
  const prev = lastJob.outputs.snapshot;
  const cur = {
    blockers: (brief?.topRisks || []).filter((r) => r.escalation === 'escalate' || r.verdictTier === 'blocked').length,
    stale: asNum(brief?.deliveryTruth?.staleInProgress, 0),
    risks: (brief?.topRisks || []).length + (brief?.portfolioRisks || []).length,
  };
  const parts = [];
  const dBlock = cur.blockers - asNum(prev.blockers, 0);
  const dStale = cur.stale - asNum(prev.stale, 0);
  if (dBlock > 0) parts.push(`+${dBlock} blocker${dBlock > 1 ? 's' : ''}`);
  if (dStale > 0) parts.push(`+${dStale} stale`);
  if (dBlock < 0) parts.push(`${dBlock} blocker`);
  if (dStale < 0) parts.push(`${dStale} stale`);
  const unchangedKey = prev.topIssueKey && (brief?.topRisks?.[0]?.issueKey === prev.topIssueKey)
    ? `${prev.topIssueKey} unchanged`
    : '';
  if (unchangedKey) parts.push(unchangedKey);
  if (!parts.length) return null;
  return { summary: `Since last brief: ${parts.join(', ')}`, parts };
}

export function buildBriefSnapshotForJob(brief = {}) {
  return {
    blockers: (brief?.topRisks || []).filter((r) => r.escalation === 'escalate').length,
    stale: asNum(brief?.deliveryTruth?.staleInProgress, 0),
    risks: (brief?.topRisks || []).length + (brief?.portfolioRisks || []).length,
    topIssueKey: brief?.topRisks?.[0]?.issueKey || '',
    safeToSend: brief?.meta?.safeToSend === true,
  };
}

/** Attach meta fields used by command-surface UI. */
export async function enrichBriefCommandMeta(brief, { projects = [], aiKeyConfigured = null } = {}) {
  const jobs = await readRecentJobs({ project: projects[0], limit: 5 });
  const lastCompleted = jobs.find((j) => j.status === 'completed' && j.type === 'prepare-weekly-brief')
    || jobs.find((j) => j.status === 'completed');
  const partialProjects = [];
  if (brief?.meta?.boardsFailed > 0 && Array.isArray(brief?.projects)) {
    const resolved = asNum(brief.meta.boardsResolved, 0);
    if (resolved < brief.projects.length) {
      partialProjects.push(...brief.projects.slice(resolved));
    }
  }
  const setupGaps = buildSetupGaps(brief, { aiKeyConfigured });
  const sinceLastRun = computeSinceLastRun(brief, lastCompleted);
  let inboxGrouped = {};
  try {
    const { readPendingInboxItems, groupInboxByType } = await import('./Delivera-Governance-Worker-02Jobs-IO.js');
    const items = await readPendingInboxItems({ project: projects[0] });
    inboxGrouped = groupInboxByType(items);
  } catch (_) { /* non-blocking */ }
  const workerReceipt = await buildWorkerReceipt(brief, inboxGrouped, jobs);
  brief.meta = {
    ...(brief.meta || {}),
    setupGaps,
    sinceLastRun,
    partialProjects,
    workerReceipt,
    dataFreshnessLabel: freshnessShortLabel(brief?.freshness || {}),
  };
  return brief;
}

export function proofChipSummary(brief = {}, issueKeys = []) {
  const rows = brief?.evidencePack?.rows || [];
  const keys = new Set((issueKeys || []).map((k) => String(k).toUpperCase()));
  const matched = keys.size
    ? rows.filter((r) => keys.has(String(r.issueKey).toUpperCase()))
    : rows;
  const changelog = matched.filter((r) => r.changelogAvailable).length;
  const fresh = brief?.freshness?.confidenceLimit === 'live' ? 'live' : brief?.freshness?.confidenceLimit || 'cached';
  const age = brief?.freshness?.cacheAgeMinutes;
  const freshLabel = fresh === 'live' ? 'live' : age != null ? `cached ${age}m` : 'cached';
  return {
    keys: matched.length || keys.size || rows.length,
    changelog,
    freshLabel,
    text: `Proof: ${matched.length || keys.size} keys · ${changelog} changelog checks · ${freshLabel}`,
  };
}

export function sendReadinessBadge(brief = {}) {
  if (brief?.freshness?.confidenceLimit === 'stale') {
    return { label: 'Stale — refresh first', tier: 'stale' };
  }
  if (brief?.meta?.safeToSend === false) {
    return { label: 'Needs edit', tier: 'weak' };
  }
  if (brief?.meta?.safeToSend === true) {
    return { label: 'Safe to send', tier: 'safe' };
  }
  return { label: 'Weak evidence', tier: 'weak' };
}
