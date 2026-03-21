/**
 * Single grammar for Current Sprint mission header + compact strips (plan todo-copy-map-and-tokens).
 */
export const SPRINT_COPY = {
  pageTitle: 'Current Sprint',
  pageSubtitleEmpty: 'Sprint work, risks, and next action in one view',
  pageSubtitleLoaded: 'Sprint work, risks, and next action in one view',
  statusLive: 'Live',
  statusSnapshot: 'Snapshot',
  liveDataShort: 'Live data',
  exportReady: 'Export ready',
  exportEmpty: 'No exportable rows',
  justStarted: 'Sprint has just started - no risks yet',
  historical: 'Historical snapshot – actions limited',
  lowConfidence: 'Low confidence',
  lowConfidenceHint: 'Limited history - treat trend as an early signal.',
  noTrackableWork: 'No trackable work in this sprint yet',
  noRisks: 'No risks',
  loggingHealthy: 'Logging hygiene healthy',
  loggingNudges: (count) => `${count} logging nudges ready`,
  takeAction: 'Take action',
  reviewRisks: 'Review Work risks anyway',
  historicalAction: 'View historical risks',

  timeUnknown: 'Ends ?',
  timeEnded: 'Ended',
  endsToday: 'Ends today',
  endsInDays: (wholeDays) => `Ends in ${wholeDays}d`,

  snapshotViewLong: 'Snapshot view',
  liveSprintShort: 'Live sprint',

  segmentLabelContext: 'Context',
  segmentLabelFreshness: 'Freshness',
  stripScopeReportContext: 'Sprint scope and report context',

  allProjects: 'All projects',
  boardFallback: 'Board',
  sprintFallback: 'Sprint',

  noActiveSprintWindow: 'No active sprint window',
  sprintNamed: (id) => `Sprint ${id}`,
  noActiveSprintName: 'No active sprint',
  historicalSnapshotShort: 'Historical snapshot',

  blockersCount: (n) => `${n} blockers`,
  missingEstCount: (n) => `${n} missing est`,
  noLogCount: (n) => `${n} no log`,
  unownedCount: (n) => `${n} unowned`,

  metricDone: 'Done',
  metricWorkItems: 'Work items',
  metricLoggedEst: 'Logged / est',
  ariaSprintMetrics: 'Sprint metrics',
  vsPriorClosedSprint: (prevPct) => `vs prior closed sprint (${prevPct}% done)`,

  allWorkDefault: 'All work',
  lensDev: 'Dev lens',
  lensSM: 'SM lens',
  lensPO: 'PO lens',
  lensLeads: 'Leads lens',
  viewAsLabel: 'View as',
  ariaViewAsRole: 'View work as role',

  ariaSprintHealthVerdict: 'Sprint health verdict',
  drawerContext: 'Context',
  drawerStatusLabel: 'Status',
  drawerHygieneTitle: 'Time-tracking hygiene (not sprint health)',
  hygieneLabel: 'Hygiene',
  jumpTo: 'Jump to',
  whyThisVerdict: 'Why this verdict',
  switchSprint: 'Switch sprint',
  resetLens: 'Reset lens',
  openRemediationQueue: 'Open remediation queue',
  leadershipTrend: 'Leadership trend',
  openReport: 'Open report',
  focusRisk: (label) => `Focus: ${label}`,
  focusRiskFallback: 'Risk',
  noUrgentIntervention: 'No urgent intervention',
  compactStripAria: 'Top sprint summary',

  /** Leadership HUD (`leadership.html`) — same chip grammar as Current Sprint context segments */
  leadershipHudStripAria: 'Portfolio scope and leadership context',
  leadershipMissionEyebrow: 'Leadership mission',
  segmentLabelProjects: 'Projects',
  segmentLabelRange: 'Range',
  segmentLabelLens: 'Lens',
  lensLeadershipHud: 'Leadership HUD',
  segmentLabelTrust: 'Trust',
  segmentLabelBoards: 'Boards',
};

export function formatSprintRemainingLabel(remainingDays) {
  if (remainingDays == null) return SPRINT_COPY.timeUnknown;
  if (remainingDays <= 0) return SPRINT_COPY.timeEnded;
  if (remainingDays < 1) return SPRINT_COPY.endsToday;
  return SPRINT_COPY.endsInDays(Math.floor(remainingDays));
}

export function sprintDataPrefix(isLive) {
  return isLive ? SPRINT_COPY.liveDataShort : SPRINT_COPY.statusSnapshot;
}

export function formatFreshnessAgeLabel(isLive, ageMin) {
  const prefix = sprintDataPrefix(isLive);
  if (ageMin < 1) return `${prefix} - updated just now`;
  return `${prefix} - updated ${ageMin} min ago`;
}
