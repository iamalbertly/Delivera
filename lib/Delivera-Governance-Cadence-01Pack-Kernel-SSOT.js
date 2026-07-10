/**
 * Cadence kernel — shared sprint idle / ended math (no DOM).
 */

export function daysAgoFromIso(iso, nowMs = Date.now()) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((nowMs - ms) / 86400000));
}

/**
 * @param {object} payload - current-sprint API payload
 */
export function buildCadenceStateFromPayload(payload = {}) {
  const sprint = payload?.sprint || {};
  const meta = payload?.meta || {};
  const state = String(sprint.state || '').toLowerCase();
  const activeCount = Number(meta.activeSprintCount || 0);
  const endDate = sprint.endDate || null;
  const daysSinceEnd = state !== 'active' && endDate ? daysAgoFromIso(endDate) : null;
  const sprintName = String(sprint.name || '').trim() || 'Last sprint';

  // Stale-detection: an "active" sprint with no movement for >= STALL_THRESHOLD_DAYS
  // is NOT current — it is stalled/abandoned. This prevents the contradictory
  // "Current · Sprint open · 0% movement · 42d stale" cadence line.
  const STALL_THRESHOLD_DAYS = 7;
  const staleHours = Number(meta.sprintStaleHours || meta.staleHours || 0);
  const staleDays = Number.isFinite(staleHours) && staleHours > 0 ? staleHours / 24 : 0;
  const movementPct = Number(meta.sprintMovementPct ?? payload?.summary?.donePct ?? -1);
  const hasNoMovement = movementPct === 0 || (Number.isFinite(movementPct) && movementPct <= 0);
  const isStalledActive = state === 'active' && activeCount > 0 && staleDays >= STALL_THRESHOLD_DAYS && hasNoMovement;

  let status = 'idle';
  if (isStalledActive) {
    status = 'stalled';
  } else if (state === 'active' && activeCount > 0) {
    status = 'active';
  } else if (state === 'closed' || daysSinceEnd != null) {
    status = 'ended';
  } else if (activeCount === 0) {
    status = 'none';
  }

  return {
    status,
    sprintName,
    daysSinceEnd,
    activeSprintCount: activeCount,
    isLive: state === 'active' && !isStalledActive,
    isStalled: isStalledActive,
    staleDays: Math.round(staleDays),
  };
}

export function formatCadenceLineFromPayload(payload = {}) {
  const c = buildCadenceStateFromPayload(payload);
  if (c.status === 'stalled') {
    // Never say "Current" or "Sprint open" for a stalled sprint — that destroys trust.
    const days = c.staleDays || 0;
    return `Stalled · ${days}d since last movement`;
  }
  if (c.status === 'active') {
    const summary = payload?.summary || {};
    const done = Number(summary.doneStories || 0);
    const total = Number(summary.totalStories || 0);
    if (total > 0) return `Sprint active · ${done}/${total} done`;
    return `In sprint · ${c.sprintName}`;
  }
  if (c.status === 'ended' && c.daysSinceEnd != null) {
    return `${c.sprintName} ended ${c.daysSinceEnd}d ago`;
  }
  if (c.activeSprintCount === 0) return 'No active sprint';
  return c.sprintName || 'Sprint cadence unknown';
}
