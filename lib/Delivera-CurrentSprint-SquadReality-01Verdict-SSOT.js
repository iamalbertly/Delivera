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
  const stuck = Array.isArray(payload?.stuckCandidates) ? payload.stuckCandidates.length : 0;
  const stories = Array.isArray(payload?.stories) ? payload.stories : [];
  const totalStories = asNum(summary.totalStories, stories.length);
  const doneStories = asNum(summary.doneStories, 0);
  const donePct = totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0;
  const missingEstimate = asNum(summary.subtaskMissingEstimate, 0);
  const missingLogged = asNum(summary.subtaskMissingLogged, 0);
  const unassigned = asNum(summary.subtaskUnassignedParents, 0)
    || (payload?.decisionCockpit?.topRisks || []).filter((r) => /unassign|owner/i.test(String(r?.title || ''))).length;

  const riskScore =
    (stuck * 3)
    + (missingEstimate * 2)
    + missingLogged
    + unassigned
    + (donePct < 45 && totalStories > 0 ? 3 : 0);

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

  return { verdict, color, riskScore, donePct, totalStories, stuck, missingEstimate, missingLogged, unassigned };
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
    verdict = floorVerdict(verdict, 'Caution');
    color = verdict === 'Critical' ? 'red' : verdict === 'At Risk' ? 'orange' : 'yellow';
  }

  const offPi = asNum(opts.piAlignment?.offPi, 0);
  const adHoc = asNum(opts.piAlignment?.adHoc, 0);
  if (offPi > 0) {
    verdict = floorVerdict(verdict, offPi >= 3 ? 'At Risk' : 'Caution');
    color = verdict === 'At Risk' || verdict === 'Critical' ? 'orange' : 'yellow';
  }

  const cadenceLine = formatCadenceLineFromPayload(payload);
  const verdictTier = TIER_MAP[verdict] || 'watch';
  const verdictLabel = verdict === 'Critical' ? 'DELIVERY BLOCKED'
    : verdict === 'At Risk' ? 'NEEDS WATCH'
      : verdict === 'Caution' ? 'NEEDS WATCH'
        : 'ON TRACK';

  let verdictLine = `${verdict} · ${op.donePct}% done`;
  if (limbo) verdictLine = `${cadenceLine} · ${verdict}`;
  else if (isHistorical) verdictLine = `${cadenceLine} · Snapshot · ${verdict}`;

  const trustLabel = limbo
    ? 'Squad idle — start or plan the next sprint'
    : isHistorical
      ? 'Historical snapshot — not live sprint signals'
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
