/**
 * Actions case scope filter — SSOT for project continuity on /actions.
 * Rejects foreign "X board" titles and wrong-key rows for the active squad.
 */

export function resolveActionsProjectFromQuery(searchParams, sharedProjects = []) {
  const fromQuery = String(searchParams?.get?.('project') || '').trim().toUpperCase();
  if (fromQuery) return fromQuery;
  const first = Array.isArray(sharedProjects) ? sharedProjects[0] : '';
  return String(first || '').toUpperCase();
}

export function caseMatchesProject(row = {}, project = '') {
  const want = String(project || '').trim().toUpperCase();
  if (!want) return true;
  const rowProject = String(row.project || row.projectKey || row.anchorProject || '').trim().toUpperCase();
  const title = String(row.title || row.primaryAction?.action || '');
  const foreignBoard = title.match(/\b([A-Z][A-Z0-9]+)\s+board(?:\s+board)?\b/i);
  if (foreignBoard) {
    const named = String(foreignBoard[1] || '').toUpperCase();
    if (named && named !== want && named !== 'THE') return false;
  }
  if (rowProject && rowProject !== want) return false;
  const keys = (row.issueKeys || []).map((k) => String(k).toUpperCase());
  if (keys.length && keys.every((k) => /^[A-Z][A-Z0-9]+-\d+$/.test(k))) {
    return keys.some((k) => k.startsWith(`${want}-`));
  }
  return !rowProject || rowProject === want;
}

export function filterCasesByTab(cases = [], tab = 'ready', project = '') {
  const scoped = (Array.isArray(cases) ? cases : []).filter((c) => caseMatchesProject(c, project));
  if (tab === 'closed') return scoped.filter((c) => c.state === 'closed');
  if (tab === 'escalations') return scoped.filter((c) => String(c.state || '').includes('escalation'));
  if (tab === 'ready') {
    return scoped.filter((c) => c.state !== 'closed' && (
      c.needsApproval
      || String(c.state || '').includes('clarification')
      || String(c.state || '').includes('decision')
    ));
  }
  return scoped.filter((c) => c.state !== 'closed');
}
