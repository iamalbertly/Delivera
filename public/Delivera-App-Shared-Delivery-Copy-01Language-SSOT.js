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
  piBaselineSetupLabel: 'Set baseline →',
  copyMeetingAnswer: 'Copy meeting answer',
  piBaselineWhy: 'Save what your squad agreed to deliver this quarter.',
  piBaselineImpact: 'Without this, carryover and removed work cannot be proven.',
  piBaselineDrawerTitle: 'Alignment Studio',
  piBaselineConfirmBtn: 'Save promised work',
  piBaselineInclusionHint: 'All items are pre-selected. Remove any work your squad did NOT promise this quarter.',
  piBaselineFewItems: 'Only {n} items found. If your quarter plan has more, upload the PI slide or refresh after adding work in Jira.',
  piBaselineOptionalSlide: 'Read PI plan slide',
  piBaselineStep1: 'We read promised work from your board (stories link to these items)',
  piBaselineStep2: 'Tick what your squad promised this quarter',
  piBaselineStep3: 'Save — carryover and removed scope become provable',
  piBaselinePromised: 'Promised',
  piBaselineNotSaved: 'Not saved yet',
  piBaselineTimelineLocked: 'Save promised work to unlock timeline.',
  piBaselineFixFirst: 'Fix promised work first',
  piBaselineGapTitle: 'Promised work not saved',
  piBaselineNotSavedCta: 'PI baseline not saved — Fix in 1 click',
  alignmentStudioTitle: 'Alignment Studio',
  alignmentStudioOpen: 'Upload PI slide',
  alignmentStudioModeBoard: 'Align board',
  alignmentStudioModeSlide: 'Read slide',
  alignmentStudioModeLock: 'Lock promised work',
  cadencePackLabel: 'Squad cadence',
  cadenceNoSprint: 'No active sprint',
  cadenceActiveSprint: 'In sprint · {name}',
  cadenceActiveNoMovement: 'Sprint open · 0% movement',
  cadenceActiveStalled: 'Sprint open · stalled',
  cadenceActiveProgress: 'Sprint active · {done}/{committed} done',
  cadenceSprintEnded: '{name} ended {days}d ago',
  cadenceQuarterDelivery: 'Quarter delivery {pct}%',
  cadenceQuarterDeliveryUnknown: 'Quarter delivery pending',
  portfolioSignalDetailsSummary: 'More metrics & evidence ({n} items)',
  piFocusMore: 'More',
  settingsReturnToGovernance: 'Return to Portfolio',
  alignmentOpenStudio: 'Align in Studio',
  actionsApproveInline: 'Approve nudge',
  actionsDeclineInline: 'Decline',
  actionsJiraNudgeLabel: 'Jira comment nudge',
  actionsCaseNudgeLabel: 'Intervention approval',
  aiKeyRequiredSlide: 'Connect AI in Settings or configure server AI in .env to read PI plan slides.',
  aiSlideServerReady: 'Slide reading uses your server-configured AI ({label}).',
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
  baselineTitle: 'Alignment Studio',
  baselineStep1: 'We read promised work from your board (stories link to these items)',
  baselineStep2: 'Tick what your squad promised this quarter',
  baselineStep3: 'Save — carryover and removed scope become provable',
  baselineEmptyHint: 'No promised work on the board yet. Upload your PI slide or confirm board epics here.',
  baselineEmptyHintPartial: 'Work found in Jira — upload your PI plan or pick manually below.',
  baselineConfirmTitle: 'Align board',
  baselineConfirmHint: 'All items are pre-selected. Remove any work your squad did NOT promise this quarter.',
  baselineConfirmBtn: 'Save promised work',
  baselineSlideUpload: 'Upload PI plan slide (screenshot or export)',
  baselineSlideReading: 'Reading slide…',
  baselineSlideMethod: 'Read slide',
  baselineSlideMatched: 'In Jira — confirm for on-track tracking',
  baselineSlideMissing: 'Not in Jira — create before PI baseline lock',
  baselineSlideDuplicateRisk: 'Possible duplicate — review before creating',
  baselineSlideCreateMissing: 'Draft child stories',
  baselineSlideUseExisting: 'Use existing',
  baselineSlideCreateNew: 'Create new epic',
  baselineSlideCreateAll: 'Create in Jira ({n})',
  baselineSlideReconciled: '{matched} of {total} epics ready — save promised work to lock PI baseline',
  baselineSlideChildStories: '{n} stories ready',
  baselineSlideLinkedPrior: 'Linked from prior work — on-track continues',
  baselineSlideCreating: 'Creating epics in Jira…',
  baselineSlideCreateFailed: 'Could not create epics',
  baselineSlideCreatePartial: '{created} created · {failed} failed — fix before saving promised work',
  baselineSlideEpicSummary: '{matched} in Jira · {missing} to create',
  baselineSlideAligned: 'Aligned with board — save promised work to lock baseline',
  baselineSquadMismatch: 'Selected squad may not match slide — confirm DMS + FY27 Q2',
  piFocusBoardUnmatched: 'Board work does not match PI commitments',
  piFocusCommittedDrift: 'Committed baseline and board epics have drifted',
  piFocusNoBaseline: 'PI promised work is not saved — align board and slide',
  piFocusAiKnows: 'AI knows',
  piFocusUploadSlide: 'Upload PI slide',
  piFocusConfirmBaseline: 'Confirm promised work',
  piFocusCounts: '{matched} in Jira · {missing} to create · {dup} review duplicates',
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
  drawerTabProof: 'Proof trail',
  drawerTabInvestment: 'PI baseline',
  portfolioStaleHint: 'Stale — refresh for live nudge',
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

/** Human-readable decision due label from ISO or plain date string. */
export function formatDecisionDueLabel(iso = '') {
  const raw = String(iso || '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return 'Due date pending';
    return raw;
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfDue - startOfToday) / 86400000);
  if (dayDiff === 0) return 'Due today';
  if (dayDiff === 1) return 'Due tomorrow';
  if (dayDiff === -1) return 'Due yesterday';
  if (dayDiff > 1 && dayDiff <= 7) return `Due in ${dayDiff} days`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
  if (id === 'pi-synergy') return 'Board work and PI commitments need alignment';
  return String(gap.label || '').split('—')[0].trim() || gap.id || 'Setup gap';
}

export function setupGapImpact(gap = {}) {
  const id = String(gap.id || '').toLowerCase();
  const map = {
    'pi-baseline': COPY.piBaselineImpact,
    'pi-synergy': 'Create Work or confirm baseline before investment review',
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

/** Human-relative age from ISO timestamp (worker receipt, portfolio freshness). */
export function formatHumanAge(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
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
