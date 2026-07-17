import { createHash, randomUUID } from 'crypto';

export const PROMISE_MATCH_STATES = Object.freeze({
  MATCHED: 'matched',
  PARTLY_MATCHED: 'partly-matched',
  NO_JIRA_PROOF: 'no-jira-proof',
  DONE_NOT_ACCEPTED: 'done-not-accepted',
  CANNOT_VERIFY: 'cannot-verify',
  ALIGNED_AMENDED: 'aligned-amended',
});

export const ACTIVE_LOOP_ACTIONS = Object.freeze([
  'send-nudge',
  'pull-fresh-evidence',
  'approve-match',
  'amend-contract',
  'assign-owner',
  'accept-risk',
  'recheck-promise',
  'escalate-owner',
]);

export const ACTIVE_CASE_STATES = Object.freeze({
  NEEDS_ATTENTION: 'needs-attention',
  AWAITING_OWNER: 'awaiting-owner',
  READY_TO_RECHECK: 'reply-received-ready-to-recheck',
  RECHECKING: 'rechecking',
  RESOLVED_MATCHED: 'resolved-matched',
  PROOF_STILL_MISSING: 'reply-received-proof-still-missing',
  ESCALATION_DUE: 'escalation-due',
  ESCALATED: 'escalated-awaiting-owner',
  ALIGNED_AMENDED: 'aligned-amended',
  RISK_ACCEPTED: 'risk-accepted',
});

export const GOVERNANCE_STORY_SCHEMA_VERSION = 2;
export const GOVERNANCE_FRESHNESS_POLICY = Object.freeze({ calmMinutes: 15, staleMinutes: 60 });
export const DOING_INSTEAD_POLICY = Object.freeze({ minimumPercent: 15, minimumTickets: 5, minimumLoggedHours: 8 });

const AMENDMENT_TYPES = new Set([
  'mutually-agreed-descope',
  'move-to-next-quarter',
  'split-into-new-promise',
  'replace-with-urgent-work',
  'mark-as-support-obligation',
]);

const RELEVANT_FIELDS = Object.freeze([
  'status', 'statusCategory', 'assigneeAccountId', 'ownerAccountId', 'assigneeActive',
  'sprintIds', 'activeSprint', 'epicId', 'parentId', 'summary', 'description', 'labels',
  'components', 'worklogTotalSeconds', 'lastWorklogAt', 'resolution', 'acceptanceIndicator',
  'deletedAt',
]);

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function addBusinessDays(from, count = 1) {
  const value = new Date(from);
  if (!Number.isFinite(value.getTime())) return null;
  let remaining = Math.max(0, Number(count) || 0);
  while (remaining > 0) {
    value.setUTCDate(value.getUTCDate() + 1);
    if (![0, 6].includes(value.getUTCDay())) remaining -= 1;
  }
  return value.toISOString();
}

function normalizedList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => clean(typeof item === 'object' ? (item.id || item.name || item.value) : item, 120).toLowerCase())
    .filter(Boolean)
    .sort();
}

export function stablePromiseId({ contractId = '', issueKey = '', title = '', squad = '', ordinal = 0 } = {}) {
  const seed = [contractId, issueKey, title, squad, ordinal].map((v) => clean(v, 300).toLowerCase()).join('|');
  return `prm_${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

export function normalizeRelevantJiraState(issue = {}) {
  const normalized = {
    hashSchemaVersion: 1,
    status: clean(issue.status || issue.fields?.status?.name, 80).toLowerCase(),
    statusCategory: clean(issue.statusCategory || issue.fields?.status?.statusCategory?.key, 80).toLowerCase(),
    assigneeAccountId: clean(issue.assigneeAccountId || issue.fields?.assignee?.accountId, 160),
    ownerAccountId: clean(issue.ownerAccountId, 160),
    assigneeActive: issue.assigneeActive ?? issue.fields?.assignee?.active ?? null,
    sprintIds: normalizedList(issue.sprintIds || issue.fields?.sprint),
    activeSprint: Boolean(issue.activeSprint),
    epicId: clean(issue.epicId || issue.fields?.epic?.id || issue.fields?.parent?.id, 120),
    parentId: clean(issue.parentId || issue.fields?.parent?.id, 120),
    summary: clean(issue.summary || issue.fields?.summary, 500).toLowerCase(),
    description: clean(issue.descriptionText || issue.description || issue.fields?.description?.content?.map?.((p) => p?.content?.map?.((t) => t?.text || '').join(' ')).join(' '), 4000).toLowerCase(),
    labels: normalizedList(issue.labels || issue.fields?.labels),
    components: normalizedList(issue.components || issue.fields?.components),
    worklogTotalSeconds: Math.max(0, Number(issue.worklogTotalSeconds || issue.fields?.timespent) || 0),
    lastWorklogAt: clean(issue.lastWorklogAt, 80),
    resolution: clean(issue.resolution || issue.fields?.resolution?.name, 120).toLowerCase(),
    acceptanceIndicator: clean(issue.acceptanceIndicator, 240).toLowerCase(),
    deletedAt: clean(issue.deletedAt, 80),
  };
  return normalized;
}

export function relevantJiraStateHash(issue = {}) {
  const normalized = normalizeRelevantJiraState(issue);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function diffRelevantJiraState(previous = {}, incoming = {}) {
  const before = normalizeRelevantJiraState(previous);
  const after = normalizeRelevantJiraState(incoming);
  const changedFields = RELEVANT_FIELDS.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return {
    changed: changedFields.length > 0,
    changedFields,
    previousHash: createHash('sha256').update(JSON.stringify(before)).digest('hex'),
    nextHash: createHash('sha256').update(JSON.stringify(after)).digest('hex'),
    normalized: after,
  };
}

export function businessDaysBetween(from, to = new Date(), holidays = []) {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null;
  const holidaySet = new Set((holidays || []).map((d) => new Date(d).toISOString().slice(0, 10)));
  let days = 0;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const finish = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor < finish) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6 && !holidaySet.has(cursor.toISOString().slice(0, 10))) days += 1;
  }
  return days;
}

export function classifyProofAge({ lastMovementAt, incomplete = true, deletedAt = '', closedPeriod = false, done = false, accepted = false, now = new Date(), holidays = [] } = {}) {
  if (done && !accepted) return { state: 'done-not-accepted', businessDays: businessDaysBetween(lastMovementAt, now, holidays), copy: 'Done in Jira, acceptance not proven.' };
  const age = businessDaysBetween(lastMovementAt, now, holidays);
  if (deletedAt || closedPeriod || (age != null && age > 30)) return { state: 'expired', businessDays: age, copy: 'Evidence is expired or no longer available in Jira.' };
  if (age == null) return { state: 'unknown', businessDays: null, copy: 'Movement date is unavailable. Delivera cannot verify proof age.' };
  if (!incomplete || age <= 5) return { state: 'fresh', businessDays: age, copy: `Evidence moved ${age} business day${age === 1 ? '' : 's'} ago.` };
  if (age <= 10) return { state: 'aging', businessDays: age, copy: `Evidence has not moved in ${age} business days.` };
  return { state: 'stale', businessDays: age, copy: `This work has not moved in ${age} business days. Ask the owner if it is blocked or already done.` };
}

export function chooseWorkSplitMethod({ activeItems = [], worklogCoverageThreshold = 0.8, loggingPolicyEnabled = true } = {}) {
  const items = Array.isArray(activeItems) ? activeItems : [];
  const withWorklog = items.filter((item) => Number(item?.worklogSeconds) > 0).length;
  const coverage = items.length ? withWorklog / items.length : 0;
  const method = loggingPolicyEnabled && items.length > 0 && coverage >= worklogCoverageThreshold ? 'logged-effort' : 'ticket-count';
  return { method, coverage: Number(coverage.toFixed(2)), threshold: worklogCoverageThreshold };
}

export function calculateWorkSplit({ activeItems = [], worklogCoverageThreshold = 0.8, loggingPolicyEnabled = true } = {}) {
  const items = Array.isArray(activeItems) ? activeItems : [];
  const selection = chooseWorkSplitMethod({ activeItems: items, worklogCoverageThreshold, loggingPolicyEnabled });
  const weight = (item) => selection.method === 'logged-effort' ? Math.max(0, Number(item?.worklogSeconds) || 0) : 1;
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const buckets = { pi: 0, amended: 0, support: 0, unplanned: 0, unknown: 0 };
  const clusters = new Map();
  for (const item of items) {
    const category = ['pi', 'amended', 'support', 'unplanned'].includes(item?.category) ? item.category : 'unknown';
    const amount = weight(item);
    buckets[category] += amount;
    if (category === 'unplanned' || category === 'unknown') {
      const key = clean(item?.epicTitle || item?.epicKey || 'Unmapped work', 180);
      clusters.set(key, (clusters.get(key) || 0) + amount);
    }
  }
  const pct = (value) => total > 0 ? Math.round((value / total) * 100) : 0;
  const percentages = Object.fromEntries(Object.keys(buckets).map((key) => [key, 0]));
  if (total > 0) {
    const shares = Object.entries(buckets).map(([key, value]) => {
      const raw = (value / total) * 100;
      return { key, floor: Math.floor(raw), remainder: raw - Math.floor(raw) };
    });
    let remaining = 100 - shares.reduce((sum, share) => sum + share.floor, 0);
    shares.sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));
    for (const share of shares) {
      percentages[share.key] = share.floor + (remaining > 0 ? 1 : 0);
      if (remaining > 0) remaining -= 1;
    }
  }
  const largest = [...clusters.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  return {
    method: selection.method,
    coverage: selection.coverage,
    total,
    percentages,
    largestUnmappedCluster: largest ? { title: largest[0], weight: largest[1], percentage: pct(largest[1]) } : null,
  };
}

function isOperationalNoise(item = {}) {
  return /password|minor|cleanup|housekeep|operational|access request|small bug|typo/i.test(`${item.summary || ''} ${item.epicTitle || ''} ${item.labels || ''}`);
}

export function buildDoingInstead({ activeItems = [], workSplit = null, policy = DOING_INSTEAD_POLICY } = {}) {
  const split = workSplit || calculateWorkSplit({ activeItems });
  const amountFor = (item) => split.method === 'logged-effort' ? Math.max(0, Number(item.worklogSeconds) || 0) : 1;
  const total = Math.max(0, Number(split.total) || activeItems.reduce((sum, item) => sum + amountFor(item), 0));
  const clusters = new Map();
  let noiseTickets = 0;
  let noiseAmount = 0;
  for (const item of activeItems) {
    if (!['unplanned', 'unknown', 'support'].includes(item?.category)) continue;
    const amount = amountFor(item);
    if (isOperationalNoise(item)) {
      noiseTickets += 1;
      noiseAmount += amount;
      continue;
    }
    const title = clean(item.epicTitle || item.parentTitle || item.summary || 'Unclear work theme', 180);
    const current = clusters.get(title) || { title, amount: 0, ticketCount: 0, systemDerived: !item.epicTitle && !item.parentTitle };
    current.amount += amount;
    current.ticketCount += 1;
    clusters.set(title, current);
  }
  const ranked = [...clusters.values()].map((cluster) => ({
    ...cluster,
    percentage: total > 0 ? Math.round((cluster.amount / total) * 100) : 0,
    loggedHours: split.method === 'logged-effort' ? Number((cluster.amount / 3600).toFixed(1)) : null,
  })).sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title));
  const major = ranked.find((cluster) => cluster.percentage >= policy.minimumPercent
    && (split.method === 'logged-effort' ? cluster.loggedHours >= policy.minimumLoggedHours : cluster.ticketCount >= policy.minimumTickets)) || null;
  const minorTickets = noiseTickets + ranked.filter((cluster) => cluster !== major).reduce((sum, cluster) => sum + cluster.ticketCount, 0);
  return {
    major,
    operationalNoise: { ticketCount: minorTickets, amount: noiseAmount },
    clusters: ranked,
    copy: major
      ? `Major diversion: ${major.title}. ${minorTickets ? `Smaller items grouped as operational noise (${minorTickets}).` : ''}`.trim()
      : (minorTickets ? `Operational noise, ${minorTickets} low-priority ticket${minorTickets === 1 ? '' : 's'}.` : 'No major diversion is proven.'),
  };
}

export function classifyStoryFreshness({ verifiedAt, jiraFailed = false, partial = false, now = new Date() } = {}) {
  const verified = new Date(verifiedAt);
  const ageMinutes = Number.isFinite(verified.getTime()) ? Math.max(0, Math.floor((new Date(now).getTime() - verified.getTime()) / 60000)) : null;
  if (jiraFailed) return { state: 'failed', ageMinutes, copy: 'Showing last verified state. Jira refresh failed.', restrictFreshActions: true };
  if (partial) return { state: 'partial', ageMinutes, copy: '', restrictFreshActions: false };
  if (ageMinutes == null || ageMinutes >= GOVERNANCE_FRESHNESS_POLICY.staleMinutes) return { state: 'stale', ageMinutes, copy: 'Showing last verified state. Freshness-dependent decisions are paused.', restrictFreshActions: true };
  if (ageMinutes > GOVERNANCE_FRESHNESS_POLICY.calmMinutes) return { state: 'paused', ageMinutes, copy: `Sync paused ${ageMinutes}m ago.`, restrictFreshActions: false };
  return { state: 'calm', ageMinutes, copy: `Last verified ${verified.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC.`, restrictFreshActions: false };
}

export function resolveOwnerRoute({ explicitOwner = null, jiraAssignee = null, productOwner = null, streamLead = null } = {}) {
  const candidates = [
    { role: 'Explicit owner', person: explicitOwner, source: 'promise-owner' },
    { role: 'Jira assignee', person: jiraAssignee, source: 'jira-assignee' },
    { role: 'Squad PO', person: productOwner, source: 'settings-product-owner' },
    { role: 'Squad or stream lead', person: streamLead, source: 'settings-stream-lead' },
  ];
  const checked = candidates.map(({ role, person, source }) => ({
    role,
    source,
    displayName: clean(person?.displayName || person?.name, 160),
    accountId: clean(person?.accountId || person?.id, 180),
    active: person?.active !== false,
  }));
  const selected = checked.find((candidate) => candidate.displayName && candidate.active);
  if (selected) return { ...selected, fallback: checked.findIndex((c) => c === selected) > 1, resolutionPath: checked };
  return { role: 'PI Team queue', source: 'pi-team-queue', displayName: 'PI Team queue', accountId: '', active: true, fallback: true, unresolved: true, resolutionPath: checked };
}

export function validateAmendment(input = {}) {
  const type = clean(input.type, 80).toLowerCase().replace(/_/g, '-');
  const reason = clean(input.reason, 1000);
  if (!AMENDMENT_TYPES.has(type)) return { valid: false, code: 'INVALID_AMENDMENT_TYPE', message: 'Choose an approved contract amendment type.' };
  if (reason.length < 8) return { valid: false, code: 'AMENDMENT_REASON_REQUIRED', message: 'Explain the approved business reason.' };
  return { valid: true, value: { ...input, type, reason } };
}

export function allowedActionsForPromise(promise = {}, context = {}) {
  const staleEvidence = context.jiraAvailable === false || ['expired', 'unknown'].includes(promise.proofAge?.state);
  const hasBaseline = context.hasBaseline !== false;
  const version = Number(promise.version) || 1;
  const route = promise.ownerRoute || resolveOwnerRoute({});
  const openVariance = ![PROMISE_MATCH_STATES.MATCHED, PROMISE_MATCH_STATES.ALIGNED_AMENDED].includes(promise.matchState);
  const actions = [
    { id: 'send-nudge', allowed: openVariance && context.jiraAvailable !== false, reason: context.jiraAvailable === false ? 'Fresh Jira access is required before sending.' : (route.unresolved ? 'Will route to the PI Team assignment queue.' : `Will send via ${route.role}.`) },
    { id: 'pull-fresh-evidence', allowed: Boolean(promise.issueKey), reason: promise.issueKey ? 'Refresh only this promise evidence.' : 'No Jira evidence link exists yet.' },
    { id: 'approve-match', allowed: [PROMISE_MATCH_STATES.PARTLY_MATCHED, PROMISE_MATCH_STATES.CANNOT_VERIFY].includes(promise.matchState) && !staleEvidence, reason: staleEvidence ? 'Pull fresh evidence before approving.' : 'Evidence is reviewable.' },
    { id: 'amend-contract', allowed: hasBaseline && openVariance && context.canAmend !== false, reason: hasBaseline ? 'Preserves the original promise and appends approval.' : 'An approved baseline is required.' },
    { id: 'assign-owner', allowed: Boolean(route.unresolved || route.fallback), reason: route.unresolved ? 'Assign a person from the PI Team queue.' : 'A fallback owner is currently selected.' },
    { id: 'accept-risk', allowed: hasBaseline && openVariance && context.canAcceptRisk !== false, reason: hasBaseline ? 'Records an explicit, auditable PI risk decision.' : 'An approved baseline is required.' },
    { id: 'recheck-promise', allowed: promise.caseState === ACTIVE_CASE_STATES.READY_TO_RECHECK || promise.caseState === ACTIVE_CASE_STATES.PROOF_STILL_MISSING, reason: 'Re-run deterministic match rules only for this promise.' },
    { id: 'escalate-owner', allowed: promise.caseState === ACTIVE_CASE_STATES.ESCALATION_DUE, reason: route.unresolved ? 'Review and assign the escalation recipient before sending.' : `Escalate to ${route.role}: ${route.displayName}.` },
  ];
  return actions.map((action) => ({ ...action, expectedVersion: version }));
}

function mapBaselineVerdict(verdict, current = {}) {
  if (current.amended) return PROMISE_MATCH_STATES.ALIGNED_AMENDED;
  if (current.done && !current.accepted) return PROMISE_MATCH_STATES.DONE_NOT_ACCEPTED;
  if (verdict === 'removed') return PROMISE_MATCH_STATES.NO_JIRA_PROOF;
  if (verdict === 'not-traceable') return PROMISE_MATCH_STATES.CANNOT_VERIFY;
  if (verdict === 'delayed') return PROMISE_MATCH_STATES.PARTLY_MATCHED;
  if (verdict === 'delivered' || verdict === 'on-track') return PROMISE_MATCH_STATES.MATCHED;
  return PROMISE_MATCH_STATES.CANNOT_VERIFY;
}

function matchLabel(state) {
  return ({
    [PROMISE_MATCH_STATES.MATCHED]: 'Matched',
    [PROMISE_MATCH_STATES.PARTLY_MATCHED]: 'Partly matched',
    [PROMISE_MATCH_STATES.NO_JIRA_PROOF]: 'No Jira proof',
    [PROMISE_MATCH_STATES.DONE_NOT_ACCEPTED]: 'Done but not accepted',
    [PROMISE_MATCH_STATES.CANNOT_VERIFY]: 'Cannot verify',
    [PROMISE_MATCH_STATES.ALIGNED_AMENDED]: 'Aligned, amended',
  })[state] || 'Cannot verify';
}

function evidenceByKey(brief) {
  return new Map((brief?.evidencePack?.rows || []).map((row) => [clean(row.issueKey, 80).toUpperCase(), row]));
}

function relativeHours(from, now) {
  const value = new Date(from).getTime();
  if (!Number.isFinite(value)) return '';
  const hours = Math.max(0, Math.round((new Date(now).getTime() - value) / 3600000));
  return `${hours}h ago`;
}

function lifecycleForCase(savedCase = {}, now = new Date()) {
  const actions = savedCase.actions || [];
  const sent = [...actions].reverse().find((event) => event.type === 'nudge-sent' || event.type === 'nudge-queued');
  const reply = [...actions].reverse().find((event) => event.type === 'owner-replied' || event.type === 'evidence-changed-after-nudge');
  const parts = [];
  if (sent) parts.push(`Nudge sent ${relativeHours(sent.ts, now)}`);
  if (reply) {
    parts.push(`reply received ${relativeHours(reply.ts, now)}`);
    const excerpt = clean(reply.replyExcerpt || reply.messagePreview, 100);
    if (excerpt) parts.push(`owner says ${excerpt}`);
  }
  const ending = ({
    [ACTIVE_CASE_STATES.READY_TO_RECHECK]: 'ready to re-check',
    [ACTIVE_CASE_STATES.PROOF_STILL_MISSING]: 'owner reply received, proof still missing',
    [ACTIVE_CASE_STATES.ESCALATION_DUE]: 'escalation due',
    [ACTIVE_CASE_STATES.ESCALATED]: 'escalated, awaiting owner',
    [ACTIVE_CASE_STATES.RESOLVED_MATCHED]: 'resolved, matched',
    [ACTIVE_CASE_STATES.AWAITING_OWNER]: 'awaiting owner',
  })[savedCase.state];
  if (ending) parts.push(ending);
  return parts.join(' · ') || 'No governance action has been sent yet.';
}

function amendmentSentence(originalText, amendment = null) {
  if (!amendment) return '';
  const type = clean(amendment.type, 100).replace(/-/g, ' ');
  const approver = clean(amendment.approvedBy || amendment.actorId || 'PI Team', 120);
  const approvedAt = amendment.approvedAt ? new Date(amendment.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  return `${clean(originalText, 300)} → ${type}, approved by ${approver}${approvedAt ? ` on ${approvedAt}` : ''}${amendment.reason ? ` because ${clean(amendment.reason, 300)}` : ''}.`;
}

function baselineCoverageForSquad(baseline, squad) {
  const sources = baseline?.sourceBaselines || (baseline ? [baseline] : []);
  const matchedSource = sources.find((item) => (item.projects || []).includes?.(squad) || item.project === squad);
  const source = matchedSource || ((baseline && (!(baseline.projects || []).length || (baseline.projects || []).includes(squad))) ? baseline : null);
  if (!source) return { state: 'missing', sourceType: 'missing', sourceLabel: 'Baseline missing', copy: 'Cannot verify · baseline missing · save baseline to compare.' };
  const rawType = clean(source.sourceType || source.source || 'manual', 80).toLowerCase();
  const sourceType = /image|slide/.test(rawType) ? 'squad-image' : /deck/.test(rawType) ? 'full-deck' : 'manual';
  const date = source.verifiedAt || source.capturedAt || source.baselineDate || source.ts || '';
  const dateLabel = date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  const label = clean(source.sourceLabel || (sourceType === 'squad-image' ? 'Baseline image' : sourceType === 'full-deck' ? 'Deck source' : 'Manual baseline'), 160);
  return { state: 'verified', sourceType, sourceLabel: label, artifactRef: source.artifactRef || source.sourceRef || '', capturedAt: source.capturedAt || source.baselineDate || '', verifiedAt: source.verifiedAt || source.ts || '', verifiedBy: source.verifiedBy || source.approvedBy || '', copy: `${label}${dateLabel ? ` verified ${dateLabel}` : ' confirmed'}.` };
}

function sprintRealityForInsight(insight = {}) {
  if (insight.boardResolved === false || insight.healthSignals?.sprintSetup === 'limited') return { state: 'missing', copy: 'No active sprint could be verified.' };
  const pulse = insight.sprintPulse || {};
  const age = Math.max(0, Number(pulse.sprintAgeDays || pulse.daysElapsed || insight.sprintAgeDays) || 0);
  const stalled = Math.max(0, Number(pulse.stalled || pulse.staleCount || insight.stalledCount) || 0);
  const carried = Math.max(0, Number(pulse.carryover || insight.carryoverCount) || 0);
  const reopened = Math.max(0, Number(pulse.reopened || insight.reopenedCount) || 0);
  const parts = [age ? `Sprint started ${age} days ago.` : 'Sprint is active.'];
  if (stalled) parts.push(`${stalled} PI-linked item${stalled === 1 ? ' has' : 's have'} not moved.`);
  if (carried) parts.push(`${carried} item${carried === 1 ? '' : 's'} carried over.`);
  if (reopened) parts.push(`${reopened} reopened after Done.`);
  return { state: stalled || carried || reopened ? 'watch' : 'active', ageDays: age, stalled, carried, reopened, copy: parts.join(' ') };
}

export function buildActiveGovernanceAnswer({ brief = {}, baseline = null, caseState = {}, now = new Date() } = {}) {
  const evidence = evidenceByKey(brief);
  const comparisonItems = Array.isArray(brief?.baselineComparison?.items) ? brief.baselineComparison.items : [];
  const sourceItems = baseline?.committedItems || [];
  const comparisonByKey = new Map(comparisonItems.map((item) => [clean(item.issueKey, 80).toUpperCase(), item]));
  const source = sourceItems.length ? sourceItems : comparisonItems;
  const contractId = baseline?.id || brief?.baselineComparison?.piName || `contract-${(brief?.projects || []).join('+')}`;
  const currentEpicKeys = new Set((brief?.meta?.boardEpicIndex || []).map((item) => clean(item.issueKey, 80).toUpperCase()));
  const promises = source.map((item, ordinal) => {
    const issueKey = clean(item.issueKey, 80).toUpperCase();
    const row = evidence.get(issueKey) || {};
    const observed = comparisonByKey.get(issueKey);
    const observedStatus = clean(row.statusNow || row.status || item.statusNow, 120);
    const current = observed || {
      ...item,
      statusNow: observedStatus || (currentEpicKeys.has(issueKey) ? 'Jira epic found' : 'not found'),
      verdict: (row.issueKey || currentEpicKeys.has(issueKey))
        ? (String(observedStatus).toLowerCase().includes('done') ? 'delivered' : 'on-track')
        : 'removed',
    };
    const promiseId = item.promiseId || stablePromiseId({ contractId, issueKey, title: item.title, squad: item.squad, ordinal });
    const savedCase = caseState[promiseId] || {};
    const amendment = (savedCase.amendments || []).find((entry) => entry.status === 'approved');
    const done = String(current.statusNow || '').toLowerCase().includes('done') || current.verdict === 'delivered';
    const accepted = Boolean(row.acceptedAt || row.acceptanceIndicator || savedCase.accepted);
    const proofAge = classifyProofAge({
      lastMovementAt: row.lastTransitionAt || row.updated || current.updated || brief.generatedAt,
      incomplete: !done,
      deletedAt: current.verdict === 'removed' ? (row.deletedAt || now.toISOString()) : '',
      done,
      accepted,
      now,
    });
    let ownerRoute = resolveOwnerRoute({
      explicitOwner: item.owner ? { displayName: item.owner } : null,
      jiraAssignee: row.assigneeName ? { displayName: row.assigneeName, accountId: row.assigneeAccountId } : null,
      productOwner: (brief?.squadInsights || []).find((s) => s.projectKey === (item.squad || issueKey.split('-')[0]))?.squadRoles?.productOwner,
      streamLead: savedCase.streamLead,
    });
    if (savedCase.ownerRoute?.displayName) ownerRoute = { ...savedCase.ownerRoute, fallback: true, unresolved: false, resolutionPath: ownerRoute.resolutionPath };
    const squadKey = clean(item.squad || issueKey.split('-')[0], 80);
    const baselineCoverage = baselineCoverageForSquad(baseline, squadKey);
    const matchState = baselineCoverage.state === 'missing'
      ? PROMISE_MATCH_STATES.CANNOT_VERIFY
      : mapBaselineVerdict(current.verdict, { amended: Boolean(amendment), done, accepted });
    const promise = {
      promiseId,
      contractId,
      originalText: clean(item.originalText || item.title, 1000),
      businessOutcome: clean(item.businessOutcome, 1000),
      source: clean(item.source || baseline?.source || 'Approved PI baseline', 240),
      sourceReference: clean(item.sourceReference || item.sourceBullet || baseline?.sourceRef, 500),
      quarter: clean(baseline?.piName || brief?.baselineComparison?.piName || brief?.period?.vodacomQuarter, 160),
      squad: squadKey,
      issueKey,
      statusNow: clean(current.statusNow || row.statusNow || 'not found', 120),
      matchState,
      matchLabel: matchLabel(matchState),
      proofAge,
      ownerRoute,
      version: Number(savedCase.version) || 1,
      amendmentHistory: savedCase.amendments || [],
      actionHistory: savedCase.actions || [],
      caseState: savedCase.state || (matchState === PROMISE_MATCH_STATES.MATCHED ? 'aligned' : 'needs-attention'),
      baselineCoverage,
      amendmentSentence: amendmentSentence(clean(item.originalText || item.title, 1000), amendment),
      actionLifecycle: lifecycleForCase(savedCase, now),
    };
    const readinessMissing = [...new Set([
      ...(Array.isArray(item.readinessGaps) ? item.readinessGaps : []),
      !item.owner ? 'owner' : '',
      !item.businessOutcome ? 'outcome' : '',
      !issueKey ? 'Jira evidence link' : '',
      !item.acceptanceDefinition && !item.acceptanceProof ? 'acceptance proof definition' : '',
      !(baseline?.piName || item.quarter) ? 'quarter link' : '',
    ].filter(Boolean))];
    promise.readiness = {
      ready: readinessMissing.length === 0,
      missing: readinessMissing,
      committedWithRisk: item.committedWithRisk === true,
      copy: readinessMissing.length ? `Not ready to promise: missing ${readinessMissing.join(', ')}.` : 'Ready to promise.',
    };
    promise.allowedActions = allowedActionsForPromise(promise, {
      hasBaseline: baselineCoverage.state !== 'missing',
      jiraAvailable: brief?.freshness?.confidenceLimit !== 'stale',
    });
    const priority = ['recheck-promise', 'escalate-owner', 'send-nudge', 'pull-fresh-evidence', 'amend-contract', 'approve-match', 'assign-owner', 'accept-risk'];
    const next = priority.map((id) => promise.allowedActions.find((action) => action.id === id && action.allowed)).find(Boolean);
    const labels = { 'send-nudge': ownerRoute.unresolved ? 'Assign owner before nudge' : `Nudge ${ownerRoute.role}: ${ownerRoute.displayName}`, 'pull-fresh-evidence': 'Pull fresh proof', 'amend-contract': 'Amend contract', 'approve-match': 'Approve match', 'assign-owner': 'Assign owner', 'accept-risk': 'Accept risk' };
    promise.nextAction = next ? { id: next.id, label: next.id === 'recheck-promise' ? 'Re-check this promise' : next.id === 'escalate-owner' ? (ownerRoute.unresolved ? 'Review escalation route' : `Escalate to ${ownerRoute.role}: ${ownerRoute.displayName}`) : labels[next.id] || next.id, reason: next.reason } : null;
    return promise;
  });

  const squadKeys = [...new Set([...(brief?.projects || []), ...promises.map((p) => p.squad)].filter(Boolean))];
  const squadInsights = new Map((brief?.squadInsights || []).map((s) => [s.projectKey, s]));
  const squads = squadKeys.map((squad) => {
    const squadPromises = promises.filter((p) => p.squad === squad || p.issueKey.startsWith(`${squad}-`));
    const counts = {};
    for (const promise of squadPromises) counts[promise.matchState] = (counts[promise.matchState] || 0) + 1;
    const insight = squadInsights.get(squad) || {};
    const attention = squadPromises.filter((p) => ![PROMISE_MATCH_STATES.MATCHED, PROMISE_MATCH_STATES.ALIGNED_AMENDED].includes(p.matchState));
    const proofState = attention.some((p) => ['expired', 'stale'].includes(p.proofAge.state)) ? 'stale proof' : (attention.length ? 'proof needs review' : 'fresh proof');
    const piTotal = Number(insight.piCommitted) || squadPromises.length;
    const piDone = Number(insight.piDone) || squadPromises.filter((p) => [PROMISE_MATCH_STATES.MATCHED, PROMISE_MATCH_STATES.ALIGNED_AMENDED].includes(p.matchState)).length;
    const piPct = piTotal ? Math.round((piDone / piTotal) * 100) : null;
    const topState = counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF] ? `${counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF]} no-proof promise${counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF] === 1 ? '' : 's'}`
      : counts[PROMISE_MATCH_STATES.PARTLY_MATCHED] ? `${counts[PROMISE_MATCH_STATES.PARTLY_MATCHED]} partial match`
        : counts[PROMISE_MATCH_STATES.DONE_NOT_ACCEPTED] ? `${counts[PROMISE_MATCH_STATES.DONE_NOT_ACCEPTED]} awaiting acceptance`
          : attention.length ? `${attention.length} cannot verify` : 'aligned';
    const offPlanCount = Math.max(0, Number(insight.offPlanEpicCount) || 0);
    const adHoc = (brief?.meta?.adHocEpics || []).find((item) => String(item?.squad || item?.projectKey || item?.issueKey || '').toUpperCase().includes(squad));
    const suppliedItems = Array.isArray(insight.activeItems) ? insight.activeItems : [];
    const inferredItems = suppliedItems.length ? suppliedItems : [
      ...Array.from({ length: Math.max(0, piTotal) }, (_, index) => ({ id: `${squad}-pi-${index}`, category: 'pi', summary: squadPromises[index]?.originalText || 'PI contract work' })),
      ...Array.from({ length: offPlanCount }, (_, index) => ({ id: `${squad}-off-${index}`, category: 'unplanned', epicTitle: clean(adHoc?.title || adHoc?.summary || adHoc?.issueKey || 'Unclear work theme', 180), summary: adHoc?.summary || 'Unplanned Jira work' })),
    ];
    const calculated = calculateWorkSplit({ activeItems: inferredItems });
    const doingInstead = buildDoingInstead({ activeItems: inferredItems, workSplit: calculated });
    const workSplit = calculated.total > 0 ? {
      method: calculated.method,
      piPct: calculated.percentages.pi + calculated.percentages.amended,
      supportPct: calculated.percentages.support,
      unplannedPct: calculated.percentages.unplanned,
      unknownPct: calculated.percentages.unknown,
      largestUnmappedCluster: calculated.largestUnmappedCluster?.title || '',
      explanation: calculated.method === 'logged-effort'
        ? `Calculated by logged effort because time logging coverage is ${Math.round(calculated.coverage * 100)}%.`
        : 'Calculated by ticket count because time logging is incomplete.',
    } : { method: 'unknown', piPct: null, supportPct: null, unplannedPct: null, unknownPct: 100, largestUnmappedCluster: '', explanation: 'Delivera cannot classify the squad work split safely from the available evidence.' };
    const baselineCoverage = baselineCoverageForSquad(baseline, squad);
    const squadAttention = baselineCoverage.state === 'missing' ? squadPromises.length : attention.length;
    const nextPromise = squadPromises.find((promise) => promise.nextAction) || squadPromises[0];
    return {
      squad,
      promiseCount: squadPromises.length,
      attentionCount: squadAttention,
      counts,
      proofState,
      piPct: baselineCoverage.state === 'missing' ? null : piPct,
      topState: baselineCoverage.state === 'missing' ? 'cannot verify' : topState,
      workSplit,
      doingInstead,
      sprintReality: sprintRealityForInsight(insight),
      baselineCoverage,
      boardResolved: insight.boardResolved !== false,
      version: Math.max(1, ...squadPromises.map((promise) => promise.version)),
      detailHref: `/api/governance/squads/${encodeURIComponent(squad)}/detail.json`,
      nextAction: nextPromise?.nextAction || (baselineCoverage.state === 'missing' ? { id: 'save-baseline', label: 'Save baseline to compare' } : null),
      amendmentSentence: squadPromises.find((promise) => promise.amendmentSentence)?.amendmentSentence || '',
    };
  });

  const partialProjects = brief?.meta?.partialProjects || [];
  const verifiedSquads = Math.max(0, squads.length - partialProjects.length);
  const needsAttention = squads.filter((s) => s.attentionCount > 0 && s.baselineCoverage?.state !== 'missing' && !partialProjects.includes(s.squad));
  const baselineMissing = squads.filter((s) => s.baselineCoverage?.state === 'missing');
  const totalChecked = promises.length;
  const complete = squads.length > 0 && verifiedSquads === squads.length;
  const answer = !baseline && !brief?.baselineComparison
    ? 'No approved PI contract is available. Recover the baseline before making off-plan claims.'
    : !complete
      ? `${verifiedSquads} of ${squads.length} squads verified. Portfolio conclusion limited.`
      : needsAttention.length
        ? `${needsAttention.length} squad${needsAttention.length === 1 ? ' is' : 's are'} not aligned to PI promises. ${needsAttention.slice(0, 2).map((s) => `${s.squad} has ${s.topState}`).join('. ')}.`
        : baselineMissing.length
          ? `${baselineMissing.length} squad${baselineMissing.length === 1 ? ' cannot' : 's cannot'} be verified because baseline evidence is missing.`
        : `All ${squads.length} squads are aligned to the approved PI promises.`;
  const verifiedAt = brief.generatedAt || now.toISOString();
  const quarter = clean(baseline?.piName || brief?.baselineComparison?.piName || brief?.period?.vodacomQuarter || 'current PI', 160);
  const sourceLine = baseline || brief?.baselineComparison
    ? `Compared with ${quarter} PI contract · ${totalChecked} promises checked · last verified ${new Date(verifiedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`
    : 'Baseline recovery required · no off-plan conclusion shown';
  const prepared = promises.filter((p) => p.allowedActions.some((a) => a.id === 'send-nudge' && a.allowed)).length;
  const deliveraDid = `Delivera matched the contract to Jira, checked proof age and work split, and prepared ${prepared} safe owner ask${prepared === 1 ? '' : 's'}.`;
  const loopCompletion = totalChecked ? Math.round((promises.filter((p) => ['aligned', 'closed'].includes(p.caseState)).length / totalChecked) * 100) : 0;
  for (const promise of promises) {
    const split = squads.find((squad) => squad.squad === promise.squad)?.workSplit;
    promise.tradeOffGuardrail = split?.unplannedPct > 0
      ? { required: true, percentage: split.unplannedPct, copy: `This work adds ${split.unplannedPct}% more work to the quarter. Choose what moves out, mark it as support work, amend the PI contract, or accept PI risk.` }
      : { required: false, percentage: 0, copy: 'No measurable unplanned-work trade-off is currently proven.' };
  }
  const freshness = classifyStoryFreshness({
    verifiedAt,
    jiraFailed: Boolean(brief?.meta?.staleReason || brief?.meta?.jiraFailed),
    partial: !complete,
    now,
  });
  if (!complete) freshness.copy = `${verifiedSquads} of ${squads.length} squads verified. Portfolio conclusion limited.`;
  return {
    schemaVersion: GOVERNANCE_STORY_SCHEMA_VERSION,
    compatibilitySchemaVersion: 1,
    answerId: randomUUID(),
    answerVersion: Math.max(1, ...promises.map((p) => p.version)),
    contract: baseline ? { id: contractId, piName: quarter, approvedBy: baseline.approvedBy || '', approvedAt: baseline.ts || baseline.baselineDate || '', source: baseline.source || '' } : null,
    scope: { mode: 'all-squads', projects: brief?.projects || squadKeys, expectedSquads: squads.length, verifiedSquads, complete, partialProjects },
    answer,
    sourceLine,
    missionHeader: `${quarter} PI contract governance`,
    deliveraDid,
    verifiedAt,
    evidenceObservedAt: brief?.freshness?.asOf || brief.generatedAt || verifiedAt,
    freshness,
    loopCompletion,
    squads,
    promises,
    nextDecisionPromiseId: promises.find((p) => p.caseState === ACTIVE_CASE_STATES.READY_TO_RECHECK)?.promiseId || promises.find((p) => p.caseState === ACTIVE_CASE_STATES.ESCALATION_DUE)?.promiseId || promises.find((p) => p.caseState === ACTIVE_CASE_STATES.NEEDS_ATTENTION)?.promiseId || null,
  };
}

export function projectActiveGovernanceLayer1(answer = {}) {
  return {
    ...answer,
    promises: (answer.promises || []).map((promise) => ({
      promiseId: promise.promiseId,
      contractId: promise.contractId,
      squad: promise.squad,
      originalText: promise.originalText,
      matchState: promise.matchState,
      matchLabel: promise.matchLabel,
      caseState: promise.caseState,
      version: promise.version,
      proofAge: promise.proofAge,
      baselineCoverage: promise.baselineCoverage,
      amendmentSentence: promise.amendmentSentence,
      actionLifecycle: promise.actionLifecycle,
      nextAction: promise.nextAction,
      detailHref: `/api/governance/cases/${encodeURIComponent(promise.promiseId)}/detail.json`,
    })),
  };
}
