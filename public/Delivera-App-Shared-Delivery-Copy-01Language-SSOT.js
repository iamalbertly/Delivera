/**
 * Plain-English delivery copy — single source for user-facing labels.
 */
export const COPY = {
  briefTitle: "Today's delivery answer",
  whatToSayHeading: 'What to say in the meeting',
  actionsNeeded: 'Actions needed',
  topActions: 'Top actions',
  attentionQueue: 'Attention queue',
  proof: 'Proof',
  whatNeedsAttention: 'What needs attention',
  deliveryStatus: 'Delivery status',
  dataFreshness: 'Data freshness',
  markAsWrong: 'Mark as wrong',
  copyMeetingAnswer: 'Copy meeting answer',
  draftNudge: 'Draft nudge',
  exportBrief: 'Export brief',
  backlogReadiness: 'Backlog readiness',
  planVsNow: 'Plan vs now',
  proofForBrief: 'Proof for current Brief',
  proofTabDelivery: 'Delivery proof',
  proofTabDataIssues: 'Data issues',
  proofTabSprintList: 'Sprint list',
  proofTabResolved: 'Resolved work',
  sprintToday: 'Sprint today',
  whoToChase: 'Who to chase',
  nextMove: 'Next move',
  problem: 'Problem',
  whyItMatters: 'Why it matters',
  owner: 'Owner',
  proofLine: 'Proof',
  verdictBlocked: 'DELIVERY BLOCKED',
  verdictWatch: 'NEEDS WATCH',
  verdictOnTrack: 'ON TRACK',
  verdictTooEarly: 'TOO EARLY',
  doNow: 'Do now',
  seeIssues: 'See issues',
  measurementStrip: 'Data gaps weakening this brief',
  agentQueue: 'Agent queue',
  setupGaps: 'Setup gaps weakening this brief',
  meetingScript: 'Meeting script',
  sendNudge: 'Send nudge',
  openInJira: 'Open in Jira',
  unassigned: 'Unassigned',
  valueDelivered: 'Value delivered',
  timeElapsed: 'Time in sprint',
  portfolioRisksBanner: 'Portfolio-wide critical risks and blockers',
  executiveLeaderboard: 'Executive leaderboard',
  squadLabel: 'Squad',
  bottleneck: 'Bottleneck',
  bottleneckNone: 'None',
  portfolioRollupOk: 'No critical blockers across selected squads',
  capacity: 'Capacity',
  leadTime: 'Lead time',
  productivity: 'Productivity',
  squadDataUnavailable: 'Sprint data unavailable — refresh or check board mapping',
  statusLabel: 'Status',
  ownerLabel: 'Who',
  doFirst: 'Do first',
  reviewActions: 'Review actions',
  overflowMore: 'More',
  statusBlocked: 'Blocked',
  statusWatch: 'Watch',
  statusOnTrack: 'OK',
  statusSetup: 'Setup',
  statusIconBlocked: '✕ Blocked',
  statusIconWatch: '⚠ Watch',
  statusIconOnTrack: '✓ OK',
  statusIconSetup: '○ Setup',
  fixPiBaseline: 'Fix PI baseline',
  adHocChip: 'Ad-hoc',
  learningReceipt: 'Feedback improved',
  openLab: 'Lab',
};

export function isSimpleMode() {
  try { return localStorage.getItem('delivera_simpleMode') === '1'; } catch (_) { return false; }
}

export function simpleStatusLabel(tier = 'watch', withIcon = false) {
  const t = String(tier || '').toLowerCase();
  if (t === 'blocked') return withIcon ? COPY.statusIconBlocked : COPY.statusBlocked;
  if (t === 'on-track' || t === 'ok') return withIcon ? COPY.statusIconOnTrack : COPY.statusOnTrack;
  if (t === 'setup' || t === 'limited') return withIcon ? COPY.statusIconSetup : COPY.statusSetup;
  return withIcon ? COPY.statusIconWatch : COPY.statusWatch;
}

export function verdictTierFromBrief(brief = {}) {
  const ev = brief?.executiveView || {};
  const tier = String(ev.verdictTier || '').toLowerCase();
  if (tier === 'blocked') return 'blocked';
  if (tier === 'watch') return 'watch';
  if (tier === 'on-track' || tier === 'ok') return 'on-track';
  if (tier === 'setup' || tier === 'limited') return 'setup';
  if (ev.verdictTier) return ev.verdictTier;
  const line = String(ev.verdictLine || '').toLowerCase();
  if (line.includes('blocked')) return 'blocked';
  if (line.includes('watch')) return 'watch';
  if (line.includes('track') || line.includes('ok')) return 'on-track';
  return 'watch';
}

export function businessTitleFromSummary(summary = '', maxLen = 72) {
  let t = String(summary || '').trim();
  t = t.replace(/^[A-Z]{2,10}-\d+\s*[-:–]?\s*/i, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > maxLen) t = `${t.slice(0, maxLen - 1)}…`;
  return t || 'Work item needs attention';
}

export function firstNameFromDisplay(name = '') {
  const n = String(name || '').trim();
  if (!n || /^unassigned$/i.test(n)) return '';
  return n.split(/\s+/)[0] || n;
}

export function initialsFromDisplay(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function deliveryStatusLabel(confidence) {
  if (isSimpleMode()) {
    const c = String(confidence || 'low').toLowerCase();
    if (c === 'high') return COPY.statusOnTrack;
    if (c === 'medium') return COPY.statusWatch;
    return COPY.statusBlocked;
  }
  const c = String(confidence || 'low').toLowerCase();
  if (c === 'high') return 'On track';
  if (c === 'medium') return 'Watch';
  return 'At risk';
}

export function freshnessPlainEnglish(freshness = {}) {
  const limit = freshness.confidenceLimit || 'live';
  const age = Math.round(Number(freshness.cacheAgeMinutes) || 0);
  if (limit === 'live') return 'Live from Jira';
  if (limit === 'stale') {
    return age > 0
      ? `Data is ${age} minutes old. Refresh before making a final decision.`
      : 'Data is stale. Refresh before making a final decision.';
  }
  if (limit === 'partial') return 'Partial data — some squads did not return.';
  if (limit === 'cached') return age > 0 ? `Cached ${age}m` : 'Cached data';
  return 'Data freshness unknown';
}

export function freshnessShortLabel(freshness = {}) {
  const limit = freshness.confidenceLimit || 'live';
  const age = Math.round(Number(freshness.cacheAgeMinutes) || 0);
  if (limit === 'live') return 'Live';
  if (limit === 'cached') return age > 0 ? `Cached ${age}m` : 'Cached';
  if (limit === 'stale') return age > 0 ? `Stale ${age}m` : 'Stale';
  if (limit === 'partial') return 'Partial';
  return limit;
}

export function navLabel(key) {
  const map = {
    governance: 'Brief',
    sprints: 'Sprint',
    report: 'Proof',
    settings: 'Settings',
  };
  return map[key] || key;
}

export function noOutcomesPlainEnglish() {
  return 'No customer-facing outcomes found. This may be maintenance work, missing outcome tags, or work tracked under another board.';
}

export function boardMismatchHint() {
  return 'No done stories found. Check whether this work is tracked under another board.';
}
