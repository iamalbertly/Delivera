/**
 * Shared state for governance brief page modules.
 */
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

export const govPage = {
  els: {},
  lastBrief: null,
  lastDecision: null,
  lastSurfaces: null,
  proofRisks: [],
  ownerGroups: [],
  scopeBarApi: null,
  inboxApi: null,
  lastFeedbackSummary: null,
};

export const MARK_WRONG_REASONS = [
  { id: 'wrong-board', label: 'Wrong board' },
  { id: 'wrong-sprint', label: 'Wrong sprint' },
  { id: 'already-moved', label: 'Issue already moved' },
  { id: 'owner-wrong', label: 'Owner wrong' },
  { id: 'other', label: 'Other' },
];

export function $(id) {
  return document.getElementById(id);
}

export function projectsCsv() {
  const fromBar = govPage.scopeBarApi?.getProjects?.();
  if (fromBar?.length) return fromBar.join(',');
  try {
    const list = readSharedProjectsCsv();
    return list.length ? list.join(',') : 'MPSA,MAS';
  } catch (_) {
    return 'MPSA,MAS';
  }
}

export function selectedProjects(brief) {
  const fromBar = govPage.scopeBarApi?.getProjects?.();
  if (fromBar?.length) return fromBar;
  return Array.isArray(brief?.projects) ? brief.projects : [];
}

export function isPortfolioMode(brief) {
  return selectedProjects(brief).length >= 2;
}

export function refreshScopeBarCounts() {
  govPage.scopeBarApi?.refreshCapsule?.();
}

/** Single entry — opens promised-work wizard without expanding scope panel. */
export function openPiBaselineWizard(opts = {}) {
  govPage.scopeBarApi?.openPiBaselineWizard?.(opts)
    || govPage.scopeBarApi?.openBaselineWizard?.(opts);
}

export function whyItMatters(risk) {
  if (risk.riskType === 'insufficient-delivery-evidence') {
    return 'Progress cannot be verified from Jira for this scope.';
  }
  if (risk.riskType === 'data-confidence-gap') {
    return 'Delivery numbers may be wrong until story points are set up correctly.';
  }
  if (risk.escalation === 'escalate') return 'Leadership should hear this before the next check-in.';
  return 'This slows delivery unless someone acts today.';
}
