/**
 * Plain-English delivery copy — single source for user-facing labels.
 */
import { SIMPLE_MODE_KEY, LEGACY_SIMPLE_ENGLISH_KEY } from './Delivera-Shared-Storage-Keys.js';

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
  fixPiBaseline: 'Confirm promised work',
  piBaselineCta: 'Confirm promised work',
  piBaselineWhy: 'Save what your squad agreed to deliver this quarter.',
  piBaselineImpact: 'Without this, carryover and removed work cannot be proven.',
  piBaselineDrawerTitle: 'Promised work this quarter',
  piBaselineConfirmBtn: 'Save promised work',
  piBaselineInclusionHint: 'All items are pre-selected. Remove any work your squad did NOT promise this quarter.',
  piBaselineFewItems: 'Only {n} items found. If your quarter plan has more, upload the PI slide or refresh after adding work in Jira.',
  piBaselineOptionalSlide: 'Optional: match your PI plan slide',
  piBaselineStep1: 'We read promised work from your board (stories link to these items)',
  piBaselineStep2: 'Tick what your squad promised this quarter',
  piBaselineStep3: 'Save — carryover and removed scope become provable',
  piBaselinePromised: 'Promised',
  piBaselineNotSaved: 'Not saved yet',
  piBaselineTimelineLocked: 'Save promised work to unlock timeline.',
  piBaselineFixFirst: 'Fix promised work first',
  piBaselineGapTitle: 'Promised work not saved',
  aiKeyRequiredSlide: 'Add an OpenAI or Claude key in Settings to read PI plan slides.',
  adHocChip: 'Not confirmed',
  adHocChipHint: 'In Jira, not saved in Delivera yet',
  learningReceipt: 'Feedback improved',
  openLab: 'Lab',
  seeQueue: 'See queue',
  queueTabReady: 'Ready',
  queueTabDoNow: 'Do now',
  queueTabBackground: 'Background',
  queueTabNudges: 'Nudges',
  queueTabPiDrift: 'PI drift',
  queueTabConfirm: 'Confirm',
  queueTabImpact: 'Impact',
  queueTabPo: 'PO',
  baselineLoading: 'Loading promised work…',
  inboxPreparing: 'Brief is preparing — refresh shortly.',
  inboxUnavailable: 'Queue unavailable — refresh the brief.',
  inboxCachedHint: 'Cached preview — refresh for live queue.',
  inboxApprove: 'Approve',
  inboxReview: 'Review',
  inboxDismiss: 'Dismiss',
  dismissIrrelevant: 'Not relevant',
  dismissHandled: 'Already handled',
  inboxMoreGroups: 'more groups',
  inboxAlreadyHandled: 'Already handled',
  inboxResolveFailed: 'Could not update queue',
  refreshBrief: 'Refresh',
  close: 'Close',
  baselineTitle: 'Promised work this quarter',
  baselineStep1: 'We read promised work from your board (stories link to these items)',
  baselineStep2: 'Tick what your squad promised this quarter',
  baselineStep3: 'Save — carryover and removed scope become provable',
  baselineEmptyHint: 'No promised work on the board yet. Use Create work to add it first.',
  baselineEmptyHintPartial: 'Work found in Jira — upload your PI plan or pick manually below.',
  baselineConfirmTitle: 'Promised work',
  baselineConfirmHint: 'All items are pre-selected. Remove any work your squad did NOT promise this quarter.',
  baselineConfirmBtn: 'Save promised work',
  baselineSlideUpload: 'Upload PI plan slide (screenshot or export)',
  baselineSlideReading: 'Reading slide…',
  baselineSlideMethod: 'Found from slide',
  baselinePiNotSet: 'Step missing: save promised work for this quarter',
  baselineProposeFailed: 'Could not load promised work',
  baselineSaveFailed: 'Could not save baseline',
  baselineRetry: 'Retry',
  checkSetup: 'Check setup',
  clearerWording: 'Clearer wording',
  standardWording: 'Standard wording',
  evidenceTabProof: 'Proof',
  evidenceTabPlan: 'Plan',
  evidenceTabPilot: 'Pilot',
  improveDelivera: 'Improve Delivera',
  improveDeliveraPlaceholder: 'What would help you get value faster?',
  squadBehind: 'behind PI',
  piAligned: 'PI aligned',
  offPi: 'Off PI',
  adHocWork: 'Ad-hoc',
  investmentLens: 'Investment',
  period14d: '14d',
  period28d: '28d',
  periodPi: 'PI',
  likelyOwner: 'Likely owner',
  nudgeSmPo: 'Nudge SM & PO',
  unplannedTime: 'Unplanned time',
  feedbackReceived: 'Thanks — your feedback was received.',
  refineSquads: 'Refine',
  openSprint: 'Open sprint',
  scrumMaster: 'SM',
  productOwner: 'PO',
  alignmentSummary: 'items PI-aligned',
  drawerTabProof: 'Proof',
  drawerTabInvestment: 'Investment',
};

export function isSimpleMode() {
  try {
    if (localStorage.getItem(SIMPLE_MODE_KEY) === '1') return true;
    const legacy = localStorage.getItem(LEGACY_SIMPLE_ENGLISH_KEY);
    if (legacy === 'true' || legacy === '1') {
      localStorage.setItem(SIMPLE_MODE_KEY, '1');
      return true;
    }
    return false;
  } catch (_) { return false; }
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

/** Human rollup for epic rows — stories are proof, not the commitment label. */
export function humanEpicActivityLabel(act = {}) {
  const storyCount = Number(act.storyCount) || 0;
  const doneCount = Number(act.doneCount) || 0;
  const lifecycle = String(act.lifecycle || '').toLowerCase();
  if (!storyCount && lifecycle === 'missing') return 'Not on board — create in Jira first';
  if (!storyCount || lifecycle === 'not-started') return 'Not in sprint yet';
  if (lifecycle === 'complete' || (doneCount > 0 && doneCount >= storyCount)) return `All ${storyCount} stories done`;
  if (doneCount > 0) {
    return `${storyCount} stories in sprint · ${doneCount} done`;
  }
  return `${storyCount} ${storyCount === 1 ? 'story' : 'stories'} in sprint`;
}

export function setupGapTitle(gap = {}) {
  const id = String(gap.id || '').toLowerCase();
  if (id === 'pi-baseline') return COPY.piBaselineGapTitle;
  return String(gap.label || '').split('—')[0].trim() || gap.id || 'Setup gap';
}

export function setupGapImpact(gap = {}) {
  const id = String(gap.id || '').toLowerCase();
  const map = {
    'pi-baseline': COPY.piBaselineImpact,
    'ai-key': 'Template wording only',
    'no-sprint': 'Delivery invisible for squad',
    unassigned: 'Owner confidence low',
    'stale-data': 'Do not send nudges yet',
  };
  return map[id] || 'Brief confidence is limited';
}

export function guidanceCodeToHint(code = '') {
  const map = {
    'no-board-epics': COPY.baselineEmptyHint,
    'jira-unmatched': COPY.baselineEmptyHintPartial,
    'quarter-filter-empty': COPY.baselineEmptyHintPartial,
  };
  return map[String(code || '')] || null;
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
