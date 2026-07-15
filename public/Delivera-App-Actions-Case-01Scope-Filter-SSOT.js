/**
 * Actions case scope filter — SSOT for project continuity on /actions.
 * Rejects foreign "X board" titles and wrong-key rows for the active squad.
 * Never treats PORTFOLIO_ALL (__ALL__) as a Jira project key.
 */
import { resolveEffectiveSquad } from './Delivera-Governance-EffectiveSquad-01Resolve-SSOT.js';

export function resolveActionsProjectFromQuery(searchParams, sharedProjects = []) {
  const fromQuery = String(searchParams?.get?.('project') || '').trim().toUpperCase();
  if (fromQuery && fromQuery !== '__ALL__') return fromQuery;
  const list = (Array.isArray(sharedProjects) ? sharedProjects : [])
    .map((p) => String(p || '').trim().toUpperCase())
    .filter((p) => p && p !== '__ALL__');
  return resolveEffectiveSquad({
    anchor: fromQuery || list[0] || '',
    projects: list,
  });
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

function normalizedCaseTitle(row = {}) {
  return String(row.title || row.primaryAction?.action || '')
    .toLowerCase()
    .replace(/\b[a-z][a-z0-9]+-\d+\b/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function actionCaseIdentity(row = {}) {
  const project = String(row.project || row.projectKey || row.anchorProject || '').trim().toUpperCase();
  const quarter = String(row.quarter || row.periodKey || row.piName || '').trim().toUpperCase();
  const issueKeys = [...new Set((row.issueKeys || [])
    .map((key) => String(key || '').trim().toUpperCase())
    .filter(Boolean))]
    .sort()
    .join(',');
  const intervention = String(row.triggerType || row.kind || row.primaryAction?.type || '').trim().toLowerCase();
  return [project, quarter, issueKeys || normalizedCaseTitle(row), intervention].join('|');
}

export function dedupeActionCases(cases = []) {
  const byIdentity = new Map();
  for (const row of Array.isArray(cases) ? cases : []) {
    const identity = actionCaseIdentity(row);
    const existing = byIdentity.get(identity);
    if (!existing) {
      byIdentity.set(identity, { ...row, duplicateCount: 0 });
      continue;
    }
    const priority = (item) => Number(Boolean(item.needsApproval)) * 100
      + Number(String(item.state || '').includes('escalation')) * 50
      + (Date.parse(item.updatedAt || item.createdAt || '') || 0) / 1e12;
    const winner = priority(row) > priority(existing) ? row : existing;
    byIdentity.set(identity, {
      ...winner,
      duplicateCount: Number(existing.duplicateCount || 0) + 1,
      duplicateCaseIds: [...new Set([
        ...(existing.duplicateCaseIds || []),
        existing.id,
        row.id,
      ].filter(Boolean))],
    });
  }
  return [...byIdentity.values()];
}

export function filterCasesByTab(cases = [], tab = 'ready', project = '') {
  const scoped = dedupeActionCases(cases).filter((c) => caseMatchesProject(c, project));
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
