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

  let status = 'idle';
  if (state === 'active' && activeCount > 0) status = 'active';
  else if (state === 'closed' || daysSinceEnd != null) status = 'ended';
  else if (activeCount === 0) status = 'none';

  return {
    status,
    sprintName,
    daysSinceEnd,
    activeSprintCount: activeCount,
    isLive: state === 'active',
  };
}

export function formatCadenceLineFromPayload(payload = {}) {
  const c = buildCadenceStateFromPayload(payload);
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
