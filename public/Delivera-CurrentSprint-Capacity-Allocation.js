/**
 * Capacity summary helper
 * Consolidates sprint ownership and workload signals for the sticky header.
 */

export function buildCapacitySummary(data) {
  const issues = Array.isArray(data?.stories) ? data.stories : [];
  const daysMeta = data?.daysMeta || {};

  if (!issues.length) {
    return {
      state: 'neutral',
      label: 'No work items yet',
      detail: 'Capacity appears once sprint issues are added.',
      overloadedCount: 0,
      assigneeCount: 0,
      unassignedCount: 0,
      unassignedPercent: 0,
      hasAssigneeCoverage: false,
    };
  }

  const assigneeMap = new Map();
  issues.forEach((issue) => {
    const assignee = String(issue?.assignee || '').trim() || 'Unassigned';
    const entry = assigneeMap.get(assignee) || { name: assignee, sp: 0, count: 0 };
    entry.sp += Number(issue?.storyPoints || 0);
    entry.count += 1;
    assigneeMap.set(assignee, entry);
  });

  const assignees = Array.from(assigneeMap.values());
  const hasSP = issues.some((issue) => Number(issue?.storyPoints || 0) > 0);
  const sprintDurationDays = Math.max(1, Number(daysMeta.daysInSprintWorking || 10));
  const expectedCapacity = hasSP ? sprintDurationDays * 2 : sprintDurationDays;
  const assignedOwners = assignees.filter((entry) => entry.name !== 'Unassigned');
  const assigneeCount = assignedOwners.length;
  const unassignedCount = assigneeMap.get('Unassigned')?.count || 0;
  const unassignedPercent = issues.length > 0 ? Math.round((unassignedCount / issues.length) * 100) : 0;
  const overloadedCount = assignedOwners.filter((entry) => {
    const load = hasSP ? Number(entry.sp || 0) : Number(entry.count || 0);
    return load > expectedCapacity;
  }).length;
  const singleOwner = assigneeCount === 1;

  if (assigneeCount === 0) {
    return {
      state: 'warning',
      label: 'No owned work yet',
      detail: `${unassignedCount} issue${unassignedCount === 1 ? '' : 's'} still need an owner.`,
      overloadedCount,
      assigneeCount,
      unassignedCount,
      unassignedPercent,
      hasAssigneeCoverage: false,
    };
  }

  if (singleOwner) {
    const owner = assignedOwners[0];
    const load = hasSP ? Number(owner.sp || 0) : Number(owner.count || 0);
    const isOverloaded = load > expectedCapacity;
    return {
      state: isOverloaded ? 'warning' : 'neutral',
      label: 'Single-owner sprint',
      detail: isOverloaded
        ? `${owner.name} carries most work; rebalancing is limited.`
        : `${owner.name} owns the sprint load; rebalancing options are limited.`,
      overloadedCount: isOverloaded ? 1 : 0,
      assigneeCount,
      unassignedCount,
      unassignedPercent,
      hasAssigneeCoverage: true,
    };
  }

  if (unassignedPercent >= 40) {
    return {
      state: 'warning',
      label: 'Capacity confidence is low',
      detail: `${unassignedPercent}% of issues are still unassigned.`,
      overloadedCount,
      assigneeCount,
      unassignedCount,
      unassignedPercent,
      hasAssigneeCoverage: true,
    };
  }

  if (overloadedCount > Math.max(1, Math.floor(assigneeCount / 2))) {
    return {
      state: 'critical',
      label: 'Capacity is overloaded',
      detail: `${overloadedCount} of ${assigneeCount} owners are carrying too much work.`,
      overloadedCount,
      assigneeCount,
      unassignedCount,
      unassignedPercent,
      hasAssigneeCoverage: true,
    };
  }

  if (overloadedCount > 0) {
    return {
      state: 'warning',
      label: 'Capacity needs rebalancing',
      detail: `${overloadedCount} owner${overloadedCount === 1 ? '' : 's'} appear overloaded.`,
      overloadedCount,
      assigneeCount,
      unassignedCount,
      unassignedPercent,
      hasAssigneeCoverage: true,
    };
  }

  return {
    state: 'healthy',
    label: 'Capacity looks balanced',
    detail: `${assigneeCount} owner${assigneeCount === 1 ? '' : 's'} are carrying the sprint load.`,
    overloadedCount,
    assigneeCount,
    unassignedCount,
    unassignedPercent,
    hasAssigneeCoverage: true,
  };
}
