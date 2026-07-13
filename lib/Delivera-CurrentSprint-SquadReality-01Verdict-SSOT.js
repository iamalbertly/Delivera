/**
 * SSOT: unified squad reality verdict for Current Sprint + Governance alignment.
 */
import { buildCadenceStateFromPayload, formatCadenceLineFromPayload } from './Delivera-Governance-Cadence-01Pack-Kernel-SSOT.js';

const VERDICT_RANK = { Healthy: 0, Caution: 1, 'At Risk': 2, Critical: 3 };
const TIER_MAP = {
  Healthy: 'onTrack',
  Caution: 'watch',
  'At Risk': 'watch',
  Critical: 'blocked',
};

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function operationalVerdict(payload = {}) {
  const summary = payload?.summary || {};
  const stuckCandidates = Array.isArray(payload?.stuckCandidates) ? payload.stuckCandidates : [];
  const stuck = stuckCandidates.length;
  const maxStaleHours = stuckCandidates.reduce((max, c) => Math.max(max, asNum(c.hoursInStatus, 0)), 0);
  const stories = Array.isArray(payload?.stories) ? payload.stories : [];
  const totalStories = asNum(summary.totalStories, stories.length);
  const doneStories = asNum(summary.doneStories, 0);
  const donePct = totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0;
  const missingEstimate = asNum(summary.subtaskMissingEstimate, 0);
  const missingLogged = asNum(summary.subtaskMissingLogged, 0);
  const unassigned = asNum(summary.subtaskUnassignedParents, 0)
    || (payload?.decisionCockpit?.topRisks || []).filter((r) => /unassign|owner/i.test(String(r?.title || ''))).length;

  // Time-weighted expected progress: a sprint on day 2 of 14 with 0% done is healthy;
  // on day 12 with 0% done is not. Replaces the flat donePct<45 rule that made
  // "healthy" nearly unreachable for every in-flight sprint.
  const sprint = payload?.sprint || {};
  const sprintStart = sprint.startDate ? new Date(sprint.startDate).getTime() : null;
  const sprintEnd = sprint.endDate ? new Date(sprint.endDate).getTime() : null;
  const nowMs = Date.now();
  let expectedPctByDay = 0;
  if (sprintStart && sprintEnd && sprintEnd > sprintStart) {
    const totalDuration = sprintEnd - sprintStart;
    const elapsed = Math.max(0, Math.min(nowMs - sprintStart, totalDuration));
    expectedPctByDay = Math.round((elapsed / totalDuration) * 100);
  }
  // Only penalize if behind the time-weighted expectation by >15pts (grace buffer).
  const behindExpectation = totalStories > 0 && donePct < Math.max(0, expectedPctByDay - 15);

  const riskScore =
    (stuck * 3)
    + (missingEstimate * 2)
    + missingLogged
    + unassigned
    + (behindExpectation ? 3 : 0)
    + (maxStaleHours >= 168 && donePct < 15 ? 8 : 0)
    + (maxStaleHours >= 72 && maxStaleHours < 168 && donePct < 25 ? 4 : 0);

  let verdict = 'Healthy';
  let color = 'green';
  if (riskScore >= 14) {
    verdict = 'Critical';
    color = 'red';
  } else if (riskScore >= 8) {
    verdict = 'At Risk';
    color = 'orange';
  } else if (riskScore >= 3) {
    verdict = 'Caution';
    color = 'yellow';
  }

  return {
    verdict,
    color,
    riskScore,
    donePct,
    totalStories,
    stuck,
    missingEstimate,
    missingLogged,
    unassigned,
    expectedPctByDay,
    maxStaleHours,
  };
}

function floorVerdict(current, floor) {
  if ((VERDICT_RANK[floor] || 0) > (VERDICT_RANK[current] || 0)) return floor;
  return current;
}

/**
 * @param {object} payload
 * @param {{ requestedSprintId?: number|null, piAlignment?: { offPi?: number, adHoc?: number, aligned?: number } }} opts
 */
export function deriveSquadRealityVerdict(payload = {}, opts = {}) {
  const meta = payload?.meta || {};
  const cadence = buildCadenceStateFromPayload(payload);
  const op = operationalVerdict(payload);
  let { verdict, color } = op;

  const activeCount = cadence.activeSprintCount;
  const sprintState = String(payload?.sprint?.state || '').toLowerCase();
  const isLiveActive = sprintState === 'active' && activeCount > 0;
  const isIdleSquad = activeCount === 0 && !isLiveActive;
  const explicitSprint = opts.requestedSprintId != null && !Number.isNaN(Number(opts.requestedSprintId));

  let resolvedSprintIntent = 'active-default';
  if (explicitSprint && !isLiveActive) resolvedSprintIntent = 'explicit';
  else if (activeCount === 0 && (sprintState === 'closed' || sprintState === 'future' || !isLiveActive)) {
    resolvedSprintIntent = 'closed-fallback';
  }

  const limbo = isIdleSquad;
  let sprintSetup = limbo ? 'limited' : 'ok';

  if (limbo) {
    const idleFloor = cadence.daysSinceEnd != null && cadence.daysSinceEnd >= 7 ? 'At Risk' : 'Caution';
    verdict = floorVerdict(verdict, idleFloor);
    if (meta.nextSprintStartOverdue) verdict = floorVerdict(verdict, 'Critical');
    color = verdict === 'Critical' ? 'red' : verdict === 'At Risk' ? 'orange' : 'yellow';
  }

  const isHistorical = !isLiveActive || meta.fromSnapshot === true;
  if (isHistorical && !limbo) {
    // Only floor to Caution if the operational verdict is already at risk —
    // a healthy snapshot of a healthy sprint should stay Healthy, not be
    // downgraded to Caution purely because it's a snapshot.
    if (op.riskScore >= 3) {
      verdict = floorVerdict(verdict, 'Caution');
      color = verdict === 'Critical' ? 'red' : verdict === 'At Risk' ? 'orange' : 'yellow';
    }
  }

  const offPi = asNum(opts.piAlignment?.offPi, 0);
  const adHoc = asNum(opts.piAlignment?.adHoc, 0);
  if (offPi > 0) {
    verdict = floorVerdict(verdict, offPi >= 3 ? 'At Risk' : 'Caution');
    color = verdict === 'At Risk' || verdict === 'Critical' ? 'orange' : 'yellow';
  }

  const cadenceLine = formatCadenceLineFromPayload(payload);
  const verdictTier = TIER_MAP[verdict] || 'watch';
  // Split Caution from At Risk labels so users can distinguish severity.
  const verdictLabel = verdict === 'Critical' ? 'DELIVERY BLOCKED'
    : verdict === 'At Risk' ? 'AT RISK'
      : verdict === 'Caution' ? 'NEEDS WATCH'
        : 'ON TRACK';

  if (!limbo && op.maxStaleHours >= 168 && op.donePct < 15) {
    verdict = floorVerdict(verdict, 'Critical');
    color = 'red';
  } else if (!limbo && op.maxStaleHours >= 72 && op.donePct < 30) {
    verdict = floorVerdict(verdict, 'At Risk');
    color = verdict === 'Critical' ? 'red' : 'orange';
  }

  let verdictLine = `${verdict} · ${op.donePct}% done`;
  if (limbo) verdictLine = `${cadenceLine} · ${verdict}`;
  else if (isHistorical) verdictLine = `${cadenceLine} · Snapshot · ${verdict}`;
  else if (op.maxStaleHours >= 72) {
    const staleDays = Math.max(1, Math.round(op.maxStaleHours / 24));
    verdictLine = `${verdict} · ${op.donePct}% done · Blocker stale ${staleDays}d`;
  }

  const trustLabel = limbo
    ? 'Squad idle — start or plan the next sprint'
    : isHistorical
      ? 'Historical snapshot — not live sprint signals'
      : op.maxStaleHours >= 168
        ? `Live sprint — blocker unchanged for ${Math.round(op.maxStaleHours / 24)}+ days`
        : (op.totalStories > 0 ? 'Signals from live sprint data' : 'Waiting for sprint stories');

  const sprintIdTrap = explicitSprint && limbo && !isLiveActive;
  const activeSprint = (payload?.recentSprints || []).find((s) => String(s?.state || '').toLowerCase() === 'active');
  const preferredActiveSprintId = activeSprint?.id ?? null;

  return {
    verdictTier,
    verdictLabel,
    verdictLine,
    trustLabel,
    sprintSetup,
    limbo,
    cadenceLine,
    resolvedSprintIntent,
    sprintIdTrap,
    preferredActiveSprintId,
    commitmentRisk: {
      offPi,
      adHoc,
      operationalClear: op.riskScore < 3,
      hasCommitmentRisk: offPi > 0 || adHoc > 0,
    },
    ...op,
    verdict,
    color,
  };
}

export function attachSquadRealityToPayload(payload = {}, opts = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const reality = deriveSquadRealityVerdict(payload, opts);
  payload.meta = payload.meta || {};
  payload.meta.verdictTier = reality.verdictTier;
  payload.meta.verdictLabel = reality.verdictLabel;
  payload.meta.verdictLine = reality.verdictLine;
  payload.meta.sprintSetup = reality.sprintSetup;
  payload.meta.limbo = reality.limbo;
  payload.meta.resolvedSprintIntent = reality.resolvedSprintIntent;
  payload.meta.cadenceLine = reality.cadenceLine;
  payload.meta.trustLabel = reality.trustLabel;
  if (reality.sprintIdTrap) {
    payload.meta.sprintIdTrap = true;
    if (reality.preferredActiveSprintId != null) {
      payload.meta.preferredActiveSprintId = reality.preferredActiveSprintId;
    }
  }
  payload.meta.commitmentRisk = reality.commitmentRisk;
  payload.meta.squadRealityVerdict = reality.verdict;
  payload.meta.squadRealityColor = reality.color;
  return payload;
}
