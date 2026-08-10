import { createHash, randomUUID } from 'crypto';
import { catalogEntry } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import { projectSquadSprintTruth } from './Delivera-Governance-Sprint-Reality-01SSOT.js';
import { diagnosePromiseEvidence, PROMISE_DIAGNOSIS_CODES } from './Delivera-Governance-PIBaseline-02Compare.js';
import { periodFromEpicSummary, epicSummaryHasPiPeriod } from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';

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
export const GOVERNANCE_PRESENTATION_CONTRACT_VERSION = 6;
export const GOVERNANCE_FRESHNESS_POLICY = Object.freeze({ calmMinutes: 15, staleMinutes: 60 });
export const DOING_INSTEAD_POLICY = Object.freeze({ minimumPercent: 15, minimumTickets: 5, minimumLoggedHours: 8 });
export const POSSIBLE_REWORK_POLICY = Object.freeze({ minimumStrongPaths: 2, meaningfulTickets: 2, meaningfulHours: 4 });

export const SOURCE_WRITE_STATES = Object.freeze({
  RECEIPT: 'local-receipt',
  QUEUED: 'queued',
  PENDING: 'source-pending',
  CONFIRMED: 'source-confirmed',
  FAILED: 'source-failed',
  RECONCILED: 'projection-reconciled',
});

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

function livePromiseMatch(issueKey, activeItems = [], fallback = null, baselineDate = '', now = new Date()) {
  const expectedKey = clean(issueKey, 80).toUpperCase();
  const byKey = new Map();
  for (const item of activeItems) {
    const itemKey = clean(item?.issueKey || item?.key, 80).toUpperCase();
    if (itemKey) byKey.set(itemKey, item);
  }
  const rows = activeItems.filter((item) => {
    const itemKey = clean(item?.issueKey || item?.key, 80).toUpperCase();
    const epicKey = clean(item?.epicKey, 80).toUpperCase();
    const parentKey = clean(item?.parentKey || item?.parentIssueKey, 80).toUpperCase();
    // Subtask → parent story → epic: if parent row carries the PI epic, count this as epic-child.
    const parentEpic = parentKey ? clean(byKey.get(parentKey)?.epicKey, 80).toUpperCase() : '';
    return expectedKey && (
      itemKey === expectedKey
      || epicKey === expectedKey
      || parentKey === expectedKey
      || parentEpic === expectedKey
    );
  });
  const exact = rows.find((item) => clean(item?.issueKey || item?.key, 80).toUpperCase() === expectedKey);
  const fallbackFound = Boolean(fallback)
    && clean(fallback?.verdict, 80) !== 'not-traceable'
    && clean(fallback?.statusNow || fallback?.status, 80).toLowerCase() !== 'not found';
  const matchedThrough = exact ? 'exact-key' : rows.length ? 'epic-child' : fallbackFound ? 'baseline-comparison' : 'unmatched';
  const statuses = rows.map((item) => clean(item?.status, 80)).filter(Boolean);
  const statusNow = statuses.length
    ? (statuses.every((status) => status.toLowerCase().includes('done')) ? 'Done'
      : statuses.some((status) => /progress|review|test|block/i.test(status)) ? 'In Progress'
        : statuses[0])
    : clean(fallback?.statusNow || fallback?.status, 80);
  const dates = rows.flatMap((item) => [item?.updated, item?.created]).filter((value) => Number.isFinite(new Date(value).getTime()));
  const observedSince = dates.sort((a, b) => new Date(a) - new Date(b))[0] || baselineDate || '';
  const matchedIssueKeys = rows.map((item) => clean(item?.issueKey || item?.key, 80).toUpperCase()).filter(Boolean);
  const sprintName = rows.map((item) => clean(item?.sprintName, 160)).find(Boolean) || '';
  return {
    found: rows.length > 0 || fallbackFound,
    matchedThrough,
    matchedIssueKeys,
    statusNow,
    sprintName,
    observedSince,
    durationBusinessDays: observedSince ? businessDaysBetween(observedSince, now) : null,
  };
}

function displayNameForSquad(squad, brief = {}) {
  const key = clean(squad, 80).toUpperCase();
  const aliases = brief?.meta?.boardAliases || brief?.boardAliases || {};
  const insight = (brief?.squadInsights || []).find((item) => clean(item.projectKey || item.squad, 80).toUpperCase() === key) || {};
  return clean(aliases[key] || insight.boardAlias || insight.displayName || insight.squadName || catalogEntry(key)?.label || key, 180);
}

function contractTruth({ baselineCoverage, counts, attentionCount, piPct, evidenceComplete = true, diagnosisGroups = [] }) {
  if (baselineCoverage?.state === 'missing') return { state: 'cannot-verify', label: 'Cannot verify', detail: 'Baseline evidence is missing.' };
  if (counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF]) return { state: 'not-aligned', label: `No proof for ${counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF]} commitment${counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF] === 1 ? '' : 's'}`, detail: `${piPct ?? 0}% of the PI contract is currently evidenced.` };
  if (counts[PROMISE_MATCH_STATES.PARTLY_MATCHED]) return { state: 'partly-aligned', label: `${counts[PROMISE_MATCH_STATES.PARTLY_MATCHED]} partly matched`, detail: 'Some contract evidence remains incomplete.' };
  if (attentionCount && diagnosisGroups.length) {
    const top = diagnosisGroups[0];
    return {
      state: 'needs-attention',
      label: `${top.count} · ${String(top.label || 'evidence gap')}`,
      detail: diagnosisGroups.length > 1
        ? `${diagnosisGroups[1].count} also need ${String(diagnosisGroups[1].label || 'evidence review').toLowerCase()}.`
        : 'Evidence requires PI Team review.',
    };
  }
  if (attentionCount) return { state: 'needs-attention', label: `${attentionCount} commitment${attentionCount === 1 ? '' : 's'} need evidence`, detail: 'Evidence requires PI Team review.' };
  if (!evidenceComplete) return { state: 'cannot-verify', label: 'Cannot verify', detail: 'Sprint, Jira, or proof evidence is incomplete.' };
  return { state: 'aligned', label: 'Aligned', detail: 'No deterministic contract variance is currently proven.' };
}

function operatingModelForSquad({ squad, displayName, insight = {}, baselineCoverage, piLinkedCount = 0, activeItems = [], sprintReality, brief = {} }) {
  const override = brief?.meta?.operatingModels?.[clean(squad, 80).toUpperCase()] || insight.operatingModel;
  const manual = insight.operationalGroup === true || override === 'operational-group';
  const manualPiGoverned = override === 'pi-governed';
  const nameSignal = /guild|security group|operations|service desk|shared service|platform support/i.test(displayName);
  const noPi = piLinkedCount === 0;
  const noBaselineHistory = Number(insight.baselineHistoryCount) === 0 || baselineCoverage?.state === 'missing';
  const noCadence = ['missing', 'missing-next-sprint'].includes(sprintReality?.state) || !clean(insight.sprintCadence || insight.sprintState, 80);
  const operationalItems = activeItems.filter((item) => isOperationalNoise(item) || /security|access|bau|support|incident/i.test(textForWorkItem(item))).length;
  const operationalShare = activeItems.length ? operationalItems / activeItems.length : 0;
  const signals = [
    manual && 'manual operating-model confirmation',
    nameSignal && 'operational group naming',
    noPi && '0 PI-linked commitments',
    noBaselineHistory && 'no PI baseline history',
    noCadence && 'no PI sprint cadence',
    operationalShare >= 0.7 && 'mostly security, access, support, or BAU work',
  ].filter(Boolean);
  const exclude = !manualPiGoverned && (manual || signals.length >= 3);
  return {
    state: exclude ? 'excluded-operational-group' : 'pi-governed',
    label: exclude ? 'Operational Jira Group' : 'PI-governed squad',
    confidence: manual || manualPiGoverned ? 100 : Math.min(96, 56 + signals.length * 9),
    evidence: signals,
    reviewNeeded: exclude && piLinkedCount > 0,
    override: override || '',
    copy: exclude
      ? `${signals.join(' · ') || 'Operational evidence detected'}. ${piLinkedCount ? `${piLinkedCount} possible PI-linked item${piLinkedCount === 1 ? '' : 's'} needs review.` : 'Excluded from PI risk totals.'}`
      : 'Included in PI totals; operational demand is reported separately.',
  };
}

function trustFactorForSquad({ baselineCoverage, sprintReality, boardResolved, ownerRoute, proofState, operatingModel }) {
  const gaps = [];
  if (baselineCoverage?.state === 'missing') gaps.push('baseline missing');
  if (boardResolved === false || ['missing', 'missing-next-sprint'].includes(sprintReality?.state)) gaps.push('sprint setup gap');
  if (ownerRoute?.unresolved) gaps.push('owner route missing');
  if (/stale|review/.test(proofState || '')) gaps.push('evidence needs review');
  if (operatingModel?.reviewNeeded) gaps.push('operating model review');
  return {
    level: gaps.length >= 2 ? 'low' : gaps.length === 1 ? 'limited' : 'high',
    label: gaps.length ? `${gaps.length >= 2 ? 'Low' : 'Limited'}, ${gaps.join(' and ')}` : 'High, sources verified',
    gaps,
    cleanClaimAllowed: gaps.length === 0,
  };
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

function friendlyWorkTheme(item = {}) {
  const commitment = clean(item.piCommitmentTitle || item.commitmentTitle, 180);
  if (commitment) return { title: commitment, systemDerived: false, source: 'pi-commitment' };
  const explicit = clean(item.epicTitle || item.parentTitle, 180);
  if (explicit) return { title: explicit, systemDerived: false };
  const component = clean(Array.isArray(item.components) ? item.components[0]?.name || item.components[0] : item.components, 120);
  if (component) return { title: `${component} work`, systemDerived: true, source: 'component' };
  const productArea = clean(item.productArea || (Array.isArray(item.labels) ? item.labels[0] : item.labels), 120);
  if (productArea) return { title: `${productArea} work`, systemDerived: true, source: 'label' };
  const summary = clean(item.summary, 240);
  const bracketed = summary.match(/^\[([^\]]{3,100})\]/)?.[1];
  if (bracketed) {
    const remainder = summary.replace(/^\[[^\]]+\]\s*/, '').replace(/^(as an?\s+[^,]{1,80},?\s*)?(i|we)\s+(want|need|should)\s+(to\s+)?/i, '');
    const keyPhrase = remainder.match(/\b(loan|recharge|payment|profile|journey|migration|integration|float|market|security)\b[^,.]{0,42}/i)?.[0];
    return { title: clean(`${bracketed.split(/\s+/)[0]} ${keyPhrase || 'capability'} work`, 120), systemDerived: true, source: 'title-pattern' };
  }
  const withoutStoryFrame = summary.replace(/^(as an?\s+[^,]{1,80},?\s*)?(i|we)\s+(want|need|should)\s+(to\s+)?/i, '').replace(/^(as an?\s+[^,]{1,80},?\s*)/i, '');
  if (withoutStoryFrame && withoutStoryFrame !== summary) {
    const words = withoutStoryFrame.split(/\s+/).slice(0, 7).join(' ');
    return { title: clean(words.charAt(0).toUpperCase() + words.slice(1), 100), systemDerived: true };
  }
  return { title: summary || 'Unclear work theme', systemDerived: true };
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
    const friendly = friendlyWorkTheme(item);
    const title = friendly.title;
    const current = clusters.get(title) || { title, amount: 0, ticketCount: 0, systemDerived: friendly.systemDerived };
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

function textForWorkItem(item = {}) {
  return clean([
    item.summary, item.description, item.epicTitle, item.parentTitle,
    ...(Array.isArray(item.labels) ? item.labels : [item.labels]),
    ...(Array.isArray(item.components) ? item.components : [item.components]),
    item.acceptanceIndicator,
  ].filter(Boolean).join(' '), 4000).toLowerCase();
}

export function scorePossibleRework({ items = [], now = new Date(), policy = POSSIBLE_REWORK_POLICY } = {}) {
  const candidates = [];
  for (const item of Array.isArray(items) ? items : []) {
    const text = textForWorkItem(item);
    const acceptedAt = item.acceptedAt || item.closedAt || item.resolvedAt;
    const reopenedAt = item.reopenedAt || (item.reopened ? item.updatedAt : '');
    const acceptedDays = acceptedAt && reopenedAt ? businessDaysBetween(acceptedAt, reopenedAt) : null;
    const paths = [];
    if (item.piLinked !== false && reopenedAt && acceptedDays != null && acceptedDays > 5) {
      paths.push({ id: 'accepted-reopened', label: `Accepted work reopened after ${acceptedDays} business days`, strong: true });
    }
    if (item.failedAcceptance || item.uatRejected || item.customerImpactingCorrection || /(uat reject|rejected uat|failed acceptance|escaped defect|qa defect|customer impact)/i.test(text)) {
      paths.push({ id: 'acceptance-defect', label: 'QA, UAT, acceptance, or customer-impact correction evidence', strong: true });
    }
    if ((item.createdAfterClosure || item.followUpAfterClosure) && /(rewrite|redo|re-architect|regression|defect fix|uat reject)/i.test(text)) {
      paths.push({ id: 'explicit-rework-terms', label: 'Post-closure work uses explicit correction terms', strong: true });
    }
    if (item.sameAcceptanceCriteria || item.sameCapability || item.sameCustomerJourney || item.sameComponent) {
      paths.push({ id: 'same-capability', label: 'Work affects the same acceptance criteria or capability', strong: true });
    }
    const loggedHours = Math.max(0, Number(item.worklogSeconds) || 0) / 3600;
    if (Number(item.currentSprintTicketCount) >= policy.meaningfulTickets || loggedHours >= policy.meaningfulHours || item.meaningfulSprintCapacity === true) {
      paths.push({ id: 'meaningful-capacity', label: 'Correction consumes meaningful current sprint capacity', strong: true });
    }
    const strongPathCount = paths.filter((path) => path.strong).length;
    if (!strongPathCount) continue;
    candidates.push({
      issueKey: clean(item.issueKey || item.key, 80),
      title: clean(item.epicTitle || item.parentTitle || item.summary || 'Follow-up work', 180),
      confidence: strongPathCount >= 3 ? 'high' : strongPathCount >= policy.minimumStrongPaths ? 'medium' : 'low',
      strongPathCount,
      paths,
      acceptedAt: clean(acceptedAt, 80),
      reopenedAt: clean(reopenedAt, 80),
      currentCapacityHours: Number(loggedHours.toFixed(1)),
    });
  }
  candidates.sort((a, b) => b.strongPathCount - a.strongPathCount || a.title.localeCompare(b.title));
  const promoted = candidates.find((candidate) => candidate.strongPathCount >= policy.minimumStrongPaths) || null;
  return {
    promoted,
    candidates,
    hiddenLowConfidenceCount: candidates.filter((candidate) => candidate.confidence === 'low').length,
    copy: !promoted
      ? 'No evidence-backed rework signal is promoted.'
      : promoted.confidence === 'high'
        ? `Possible rework: ${promoted.paths[1]?.label || promoted.paths[0].label}.`
        : `Possible follow-up work: ${promoted.title} reopened after closure.`,
  };
}

function unknownGroupKey(item = {}) {
  const components = normalizedList(item.components);
  const labels = normalizedList(item.labels);
  const supportPattern = textForWorkItem(item).match(/security|access|password|database|migration|support|incident|compliance|network|environment/)?.[0] || '';
  return clean(item.epicTitle || item.parentTitle || item.epicKey || components[0] || labels[0]
    || item.reporterGroup || item.issueType || item.boardLane || supportPattern || 'Unclear work theme', 180);
}

export function clusterUnknownWork({ activeItems = [], workSplit = null, thresholdPercent = DOING_INSTEAD_POLICY.minimumPercent } = {}) {
  const split = workSplit || calculateWorkSplit({ activeItems });
  const unknown = (Array.isArray(activeItems) ? activeItems : []).filter((item) => !['pi', 'amended', 'support', 'unplanned'].includes(item?.category));
  const groups = new Map();
  for (const item of unknown) {
    const title = unknownGroupKey(item);
    const current = groups.get(title) || { id: createHash('sha1').update(title.toLowerCase()).digest('hex').slice(0, 12), title, ticketCount: 0, loggedSeconds: 0, issueKeys: [], sharedEvidence: new Set() };
    current.ticketCount += 1;
    current.loggedSeconds += Math.max(0, Number(item.worklogSeconds) || 0);
    if (item.issueKey || item.key) current.issueKeys.push(clean(item.issueKey || item.key, 80));
    if (item.epicTitle || item.parentTitle) current.sharedEvidence.add('shared parent or epic');
    if (normalizedList(item.components).length) current.sharedEvidence.add('shared component');
    if (normalizedList(item.labels).length) current.sharedEvidence.add('shared label');
    if (item.reporterGroup) current.sharedEvidence.add('shared reporter group');
    if (item.issueType) current.sharedEvidence.add('shared issue type');
    groups.set(title, current);
  }
  const totalWeight = Math.max(1, Number(split.total) || activeItems.length || 1);
  const clusters = [...groups.values()].map((group) => {
    const weight = split.method === 'logged-effort' ? group.loggedSeconds : group.ticketCount;
    const percentage = Math.round((weight / totalWeight) * 100);
    const lower = group.title.toLowerCase();
    const recommendation = /security|access|password|support|incident|compliance/.test(lower)
      ? 'operational-group-candidate'
      : /feature|journey|capability|product/.test(lower) ? 'ad-hoc-feature' : 'operational';
    return { ...group, version: 1, sharedEvidence: [...group.sharedEvidence], percentage, recommendation, issueKeys: group.issueKeys.slice(0, 20) };
  }).sort((a, b) => b.percentage - a.percentage || b.ticketCount - a.ticketCount || a.title.localeCompare(b.title));
  const unknownPct = Number(split.percentages?.unknown) || 0;
  const topCluster = clusters[0] || null;
  // Cluster-first copy SSOT — UI must not re-strip "Unknown work is N%" wallpaper.
  let copy = 'No Unknown work is present.';
  if (unknownPct >= thresholdPercent && topCluster) {
    const keyHint = Array.isArray(topCluster.issueKeys) && topCluster.issueKeys[0] ? topCluster.issueKeys[0] : '';
    const title = String(topCluster.title || 'Unclassified cluster').trim();
    copy = keyHint
      ? `Classify ${keyHint}${title ? ` · ${title}` : ''}`
      : `Classify cluster · ${title}`;
  } else if (unknownPct > 0) {
    copy = `Unknown work is ${unknownPct}%. Kept visible without adding meeting noise.`;
  }
  return {
    promoted: unknownPct >= thresholdPercent,
    percentage: unknownPct,
    clusters,
    topCluster,
    copy,
  };
}

export function governancePayloadHash(value = {}) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function classifyStoryFreshness({ verifiedAt, jiraFailed = false, partial = false, now = new Date() } = {}) {
  const verified = new Date(verifiedAt);
  const ageMinutes = Number.isFinite(verified.getTime()) ? Math.max(0, Math.floor((new Date(now).getTime() - verified.getTime()) / 60000)) : null;
  if (jiraFailed) return { state: 'failed', ageMinutes, copy: 'Showing last verified state. Jira refresh failed.', restrictFreshActions: true };
  if (partial) return { state: 'partial', ageMinutes, copy: '', restrictFreshActions: false };
  if (ageMinutes == null || ageMinutes >= GOVERNANCE_FRESHNESS_POLICY.staleMinutes) return { state: 'stale', ageMinutes, copy: 'Showing last verified state. Freshness-dependent decisions are paused.', restrictFreshActions: true };
  // Soft pause: proof stays usable — quiet chip, not Sync-paused wallpaper.
  if (ageMinutes > GOVERNANCE_FRESHNESS_POLICY.calmMinutes) return { state: 'paused', ageMinutes, copy: `Verified ${ageMinutes}m ago`, restrictFreshActions: false };
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
  const freshnessRestricted = context.restrictFreshActions === true || context.jiraAvailable === false;
  const staleEvidence = freshnessRestricted || ['expired', 'unknown'].includes(promise.proofAge?.state);
  const hasBaseline = context.hasBaseline !== false;
  const version = Number(promise.version) || 1;
  const route = promise.ownerRoute || resolveOwnerRoute({});
  const openVariance = ![PROMISE_MATCH_STATES.MATCHED, PROMISE_MATCH_STATES.ALIGNED_AMENDED].includes(promise.matchState);
  const actions = [
    { id: 'send-nudge', allowed: openVariance && !freshnessRestricted, reason: freshnessRestricted ? 'Fresh Jira evidence is required before sending.' : (route.unresolved ? 'Will route to the PI Team assignment queue.' : `Will send via ${route.role}.`) },
    { id: 'pull-fresh-evidence', allowed: Boolean(promise.issueKey) && context.jiraAvailable !== false, reason: context.jiraAvailable === false ? 'Jira is unavailable; the last verified answer remains visible.' : (promise.issueKey ? 'Refresh only this promise evidence.' : 'No Jira evidence link exists yet.') },
    { id: 'approve-match', allowed: [PROMISE_MATCH_STATES.PARTLY_MATCHED, PROMISE_MATCH_STATES.CANNOT_VERIFY].includes(promise.matchState) && !staleEvidence, reason: staleEvidence ? 'Pull fresh evidence before approving.' : 'Evidence is reviewable.' },
    { id: 'amend-contract', allowed: hasBaseline && openVariance && context.canAmend !== false, reason: hasBaseline ? 'Preserves the original promise and appends approval.' : 'An approved baseline is required.' },
    { id: 'assign-owner', allowed: Boolean(route.unresolved || route.fallback), reason: route.unresolved ? 'Assign a person from the PI Team queue.' : 'A fallback owner is currently selected.' },
    { id: 'accept-risk', allowed: hasBaseline && openVariance && context.canAcceptRisk !== false, reason: hasBaseline ? 'Records an explicit, auditable PI risk decision.' : 'An approved baseline is required.' },
    { id: 'recheck-promise', allowed: !freshnessRestricted && (promise.caseState === ACTIVE_CASE_STATES.READY_TO_RECHECK || promise.caseState === ACTIVE_CASE_STATES.PROOF_STILL_MISSING), reason: freshnessRestricted ? 'Fresh Jira evidence is required before re-checking.' : 'Re-run deterministic match rules only for this promise.' },
    { id: 'escalate-owner', allowed: !freshnessRestricted && promise.caseState === ACTIVE_CASE_STATES.ESCALATION_DUE, reason: freshnessRestricted ? 'Fresh Jira evidence is required before escalation.' : (route.unresolved ? 'Review and assign the escalation recipient before sending.' : `Escalate to ${route.role}: ${route.displayName}.`) },
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

/** Single verdict SSOT — diagnosis beats optimistic matchState for UI chrome. */
export function reconcilePromiseVerdict({ matchState, diagnosisCode, diagnosisLabel }) {
  const verified = diagnosisCode === PROMISE_DIAGNOSIS_CODES.VERIFIED;
  let reconciledState = matchState;
  if (!verified) {
    if (matchState === PROMISE_MATCH_STATES.MATCHED) {
      reconciledState = [
        PROMISE_DIAGNOSIS_CODES.MISSING_PI_METADATA,
        PROMISE_DIAGNOSIS_CODES.EXACT_KEY_UNAVAILABLE,
        PROMISE_DIAGNOSIS_CODES.ACCESS_BLOCKED,
        PROMISE_DIAGNOSIS_CODES.BOARD_UNRESOLVED,
      ].includes(diagnosisCode)
        ? PROMISE_MATCH_STATES.CANNOT_VERIFY
        : PROMISE_MATCH_STATES.PARTLY_MATCHED;
    } else if (diagnosisCode === PROMISE_DIAGNOSIS_CODES.MISSING_PI_METADATA
      && matchState !== PROMISE_MATCH_STATES.ALIGNED_AMENDED) {
      reconciledState = PROMISE_MATCH_STATES.PARTLY_MATCHED;
    }
  }
  const verdictLabel = verified
    ? matchLabel(reconciledState)
    : (diagnosisLabel || matchLabel(reconciledState));
  return { matchState: reconciledState, verdictLabel, verdictTone: reconciledState };
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

export function lifecycleForCase(savedCase = {}, now = new Date()) {
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

export function nextGovernanceActionForPromise(promise = {}) {
  const ownerRoute = promise.ownerRoute || resolveOwnerRoute({});
  const priority = ownerRoute.unresolved
    ? ['recheck-promise', 'escalate-owner', 'assign-owner', 'send-nudge', 'pull-fresh-evidence', 'amend-contract', 'approve-match', 'accept-risk']
    : ['recheck-promise', 'escalate-owner', 'send-nudge', 'pull-fresh-evidence', 'amend-contract', 'approve-match', 'assign-owner', 'accept-risk'];
  const next = priority.map((id) => promise.allowedActions?.find((action) => action.id === id && action.allowed)).find(Boolean);
  if (!next) return null;
  const labels = {
    'send-nudge': ownerRoute.unresolved ? 'Send to PI Team assignment queue' : `Nudge ${ownerRoute.role}: ${ownerRoute.displayName}`,
    'pull-fresh-evidence': 'Pull fresh proof',
    'amend-contract': 'Amend contract',
    'approve-match': 'Approve match',
    'assign-owner': 'Owner route missing · resolve in drawer',
    'accept-risk': 'Accept risk',
  };
  const label = next.id === 'recheck-promise'
    ? 'Re-check this promise'
    : next.id === 'escalate-owner'
      ? (ownerRoute.unresolved ? 'Review escalation route' : `Escalate to ${ownerRoute.role}: ${ownerRoute.displayName}`)
      : labels[next.id] || next.id;
  return { id: next.id, label, reason: next.reason };
}

export function reconcilePromiseCaseProjection(promise = {}, savedCase = {}, context = {}) {
  const reconciled = {
    ...promise,
    version: Math.max(Number(promise.version) || 1, Number(savedCase.version) || 1),
    caseState: savedCase.state || promise.caseState,
    ownerRoute: savedCase.ownerRoute || promise.ownerRoute,
    actionHistory: savedCase.actions || promise.actionHistory || [],
    sourceWrites: savedCase.sourceWrites || promise.sourceWrites || [],
    actionLifecycle: lifecycleForCase(savedCase, context.now || new Date()),
  };
  reconciled.allowedActions = allowedActionsForPromise(reconciled, {
    hasBaseline: reconciled.baselineCoverage?.state !== 'missing',
    jiraAvailable: context.jiraAvailable !== false,
    restrictFreshActions: context.restrictFreshActions === true,
  });
  reconciled.nextAction = nextGovernanceActionForPromise(reconciled);
  reconciled.drawerStateHash = governancePayloadHash({
    promiseId: reconciled.promiseId,
    version: reconciled.version,
    matchState: reconciled.matchState,
    caseState: reconciled.caseState,
    ownerRoute: reconciled.ownerRoute,
    proofAge: reconciled.proofAge,
    amendmentHistory: reconciled.amendmentHistory,
    sourceWrites: reconciled.sourceWrites,
  });
  return reconciled;
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
  return projectSquadSprintTruth({ ...insight, sprintReality: insight.sprintReality, meta: { partial: insight.partial, noActiveSprintFallback: insight.endedWithoutReplacement } });
}

function fiscalPeriodFromEvidence(baseline = {}, brief = {}) {
  const candidates = [
    ...(baseline.committedItems || []).flatMap((item) => [item.title, item.originalText, item.sourceBullet]),
    baseline.piName,
    brief?.baselineComparison?.piName,
    brief?.period?.vodacomQuarter,
  ].map((value) => clean(value, 1000)).filter(Boolean);
  const counts = new Map();
  candidates.forEach((value) => {
    const match = value.match(/\bFY\s*(\d{2,4})\s*Q\s*([1-4])\b/i);
    if (!match) return;
    const year = match[1].length === 2 ? match[1] : match[1].slice(-2);
    const period = `FY${year} Q${match[2]}`;
    counts.set(period, (counts.get(period) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || clean(baseline.piName || brief?.baselineComparison?.piName || brief?.period?.vodacomQuarter || 'current PI', 160);
}

export function buildActiveGovernanceAnswer({ brief = {}, baseline = null, caseState = {}, now = new Date() } = {}) {
  const observedAt = brief.generatedAt || now.toISOString();
  const jiraFailed = Boolean(brief?.meta?.staleReason || brief?.meta?.jiraFailed);
  const evidenceAgeMinutes = Math.max(0, Math.floor((new Date(now).getTime() - new Date(observedAt).getTime()) / 60000));
  const restrictFreshActions = jiraFailed || evidenceAgeMinutes >= GOVERNANCE_FRESHNESS_POLICY.staleMinutes;
  const evidence = evidenceByKey(brief);
  const comparisonItems = Array.isArray(brief?.baselineComparison?.items) ? brief.baselineComparison.items : [];
  const sourceItems = baseline?.committedItems || [];
  const comparisonByKey = new Map(comparisonItems.map((item) => [clean(item.issueKey, 80).toUpperCase(), item]));
  const source = sourceItems.length ? sourceItems : comparisonItems;
  const fiscalPeriod = fiscalPeriodFromEvidence(baseline || {}, brief);
  const contractId = baseline?.id || brief?.baselineComparison?.piName || `contract-${(brief?.projects || []).join('+')}`;
  const currentEpicKeys = new Set((brief?.meta?.boardEpicIndex || []).map((item) => clean(item.issueKey, 80).toUpperCase()));
  const baselineIssueEvidence = brief?.meta?.baselineIssueEvidence || {};
  const promises = source.map((item, ordinal) => {
    const issueKey = clean(item.issueKey, 80).toUpperCase();
    const row = {
      ...(baselineIssueEvidence[issueKey] || {}),
      ...(evidence.get(issueKey) || {}),
    };
    const observed = comparisonByKey.get(issueKey);
    const observedStatus = clean(row.statusNow || row.status || item.statusNow, 120);
    let current = observed || {
      ...item,
      statusNow: observedStatus || (currentEpicKeys.has(issueKey) ? 'Jira epic found' : 'not found'),
      verdict: ((row.issueKey && !['jira-only', 'access-blocked', 'not-found'].includes(row.lifecycle)) || currentEpicKeys.has(issueKey))
        ? (String(observedStatus).toLowerCase().includes('done') ? 'delivered' : 'on-track')
        : 'not-traceable',
    };
    const squadKey = clean(item.squad || issueKey.split('-')[0], 80);
    const insight = (brief?.squadInsights || []).find((entry) => entry.projectKey === squadKey) || {};
    const activeItems = Array.isArray(insight.activeItems) ? insight.activeItems : [];
    const liveMatch = livePromiseMatch(issueKey, activeItems, observed || (currentEpicKeys.has(issueKey) ? current : null), baseline?.baselineDate, now);
    if (liveMatch.found) {
      current = {
        ...current,
        statusNow: liveMatch.statusNow || current.statusNow,
        verdict: String(liveMatch.statusNow || current.statusNow).toLowerCase().includes('done') ? 'delivered' : 'on-track',
      };
    }
    const promiseId = item.promiseId || stablePromiseId({ contractId, issueKey, title: item.title, squad: item.squad, ordinal });
    const savedCase = caseState[promiseId] || {};
    const amendment = (savedCase.amendments || []).find((entry) => entry.status === 'approved');
    const done = String(current.statusNow || '').toLowerCase().includes('done') || current.verdict === 'delivered';
    const accepted = Boolean(row.acceptedAt || row.acceptanceIndicator || savedCase.accepted);
    const proofAge = classifyProofAge({
      lastMovementAt: row.lastTransitionAt || row.updated || current.updated || brief.generatedAt,
      incomplete: !done,
      deletedAt: row.deletedAt || '',
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
    const titleWords = clean(item.title || item.originalText, 500).toLowerCase().split(/\W+/).filter((word) => word.length > 4);
    const relatedItems = activeItems.filter((entry) => {
      const key = clean(entry.issueKey || entry.key, 80).toUpperCase();
      const epicKey = clean(entry.epicKey, 80).toUpperCase();
      const parentKey = clean(entry.parentKey || entry.parentIssueKey, 80).toUpperCase();
      const title = clean(entry.summary || entry.title || entry.epicTitle, 500).toLowerCase();
      const titleOverlap = titleWords.length > 0
        && titleWords.filter((word) => title.includes(word)).length >= Math.min(2, titleWords.length);
      return key === issueKey || epicKey === issueKey || parentKey === issueKey || titleOverlap;
    });
    const currentFound = Boolean(
      row.existsInJira
      || (row.issueKey && !['access-blocked', 'not-found'].includes(row.lifecycle))
      || currentEpicKeys.has(issueKey)
      || observed
      || liveMatch.found,
    );
    const titlePeriod = periodFromEpicSummary(
      item.originalText || item.title || row.title || relatedItems[0]?.summary || relatedItems[0]?.epicTitle || '',
    );
    const relatedHasTitlePeriod = relatedItems.some((entry) => epicSummaryHasPiPeriod(
      entry.summary || entry.epicTitle || entry.title || '',
    ));
    const jiraPeriod = titlePeriod
      || row.jiraPeriod
      || row.fixVersion
      || row.quarterLabel
      || relatedItems.map((entry) => periodFromEpicSummary(entry.summary || entry.epicTitle || '')).find(Boolean)
      || '';
    const missingPiMetadata = titlePeriod || relatedHasTitlePeriod
      ? false
      : (row.missingPiMetadata === true || relatedItems.some((entry) => entry.missingPiMetadata === true));
    const epicAct = observed?.epicActivity || {};
    const childTotal = Number(epicAct.storyCount)
      || (liveMatch.matchedIssueKeys?.length || 0)
      || relatedItems.filter((entry) => entry.parentKey || entry.epicKey).length;
    const childDone = Number(epicAct.doneCount) || 0;
    const startDate = observed?.plannedStartDate || epicAct.firstActiveSprintStart || item.plannedStartDate || '';
    const endDate = observed?.targetDate || observed?.plannedEndDate || item.plannedEndDate || '';
    const promiseFiscalPeriod = titlePeriod || fiscalPeriod;
    const diagnosis = diagnosePromiseEvidence({
      ...item,
      ...current,
      ...row,
      issueKey,
      ownerRoute,
      currentFound,
      boardResolved: insight.boardResolved,
      permissionDenied: Boolean(row.permissionDenied || insight.permissionDenied),
      httpStatus: row.httpStatus || insight.httpStatus,
      inBacklog: row.inBacklog ?? relatedItems.some((entry) => entry.inBacklog || String(entry.sprintState || '').toLowerCase() === 'backlog'),
      inFutureSprint: row.inFutureSprint ?? relatedItems.some((entry) => entry.inFutureSprint || String(entry.sprintState || '').toLowerCase().includes('future')),
      sprintName: row.sprintName || relatedItems[0]?.sprintName,
      matchMethod: liveMatch.matchedThrough,
      matchedIssueKeys: liveMatch.matchedIssueKeys,
      missingPiMetadata,
      fixVersion: row.fixVersion,
      quarterLabel: row.quarterLabel || row.piLabel || titlePeriod,
      baselinePeriod: fiscalPeriod,
      jiraPeriod,
      piPeriodSource: titlePeriod ? 'epic-title' : (jiraPeriod ? 'fix-version-or-label' : 'none'),
      candidateIssueKeys: [...liveMatch.matchedIssueKeys, ...relatedItems.map((entry) => entry.issueKey || entry.key)].filter(Boolean),
      candidateReason: liveMatch.matchedThrough === 'epic-child'
        ? 'Current sprint stories are children of the approved PI epic'
        : relatedItems.length ? 'Strong title overlap in the same canonical squad' : '',
      searchScope: row.existsInJira
        ? 'Direct Jira issue lookup plus current canonical squad and board scope'
        : insight.boardResolved === false ? 'Configured board could not be resolved' : 'Current canonical squad and board scope',
      acceptanceIndicator: row.acceptanceIndicator,
      releaseEvidence: row.releaseEvidence,
    });
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
      quarter: fiscalPeriod,
      squad: squadKey,
      squadDisplayName: displayNameForSquad(squadKey, brief),
      issueKey,
      statusNow: clean(current.statusNow || row.statusNow || 'not found', 120),
      matchState,
      matchLabel: matchLabel(matchState),
      proofAge,
      ownerRoute,
      version: Number(savedCase.version) || 1,
      amendmentHistory: savedCase.amendments || [],
      actionHistory: savedCase.actions || [],
      sourceWrites: savedCase.sourceWrites || [],
      caseState: savedCase.state || (matchState === PROMISE_MATCH_STATES.MATCHED ? 'aligned' : 'needs-attention'),
      baselineCoverage,
      amendmentSentence: amendmentSentence(clean(item.originalText || item.title, 1000), amendment),
      actionLifecycle: lifecycleForCase(savedCase, now),
      ...diagnosis,
      expectedVsActual: {
        expected: {
          issueKey,
          commitment: clean(item.originalText || item.title, 1000),
          fiscalPeriod: promiseFiscalPeriod,
          startDate,
          endDate,
        },
        actual: {
          issueKeys: liveMatch.matchedIssueKeys,
          status: clean(current.statusNow || row.statusNow || 'not found', 120),
          sprintName: liveMatch.sprintName || insight.sprintReality?.sprintName || '',
          matchedThrough: liveMatch.matchedThrough,
          childTotal,
          doneChildCount: childDone,
          openChildCount: Math.max(0, childTotal - childDone),
        },
        disconnectCode: liveMatch.matchedThrough === 'epic-child'
          ? 'story-delivers-approved-epic'
          : liveMatch.matchedThrough === 'exact-key' || liveMatch.matchedThrough === 'baseline-comparison'
            ? 'aligned-by-jira-key'
            : diagnosis.diagnosisCode,
        since: liveMatch.observedSince || baseline?.baselineDate || '',
        durationBusinessDays: liveMatch.durationBusinessDays,
      },
    };
    const verdict = reconcilePromiseVerdict({
      matchState: promise.matchState,
      diagnosisCode: promise.diagnosisCode,
      diagnosisLabel: promise.diagnosisLabel,
    });
    promise.matchState = verdict.matchState;
    promise.verdictLabel = verdict.verdictLabel;
    promise.matchLabel = verdict.verdictLabel;
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
      jiraAvailable: !jiraFailed,
      restrictFreshActions,
    });
    promise.nextAction = nextGovernanceActionForPromise(promise);
    if (diagnosis.diagnosisCode !== PROMISE_DIAGNOSIS_CODES.VERIFIED && diagnosis.recommendedAction) {
      promise.nextAction = {
        ...(promise.nextAction || { id: 'review-diagnosis' }),
        label: diagnosis.recommendedAction,
      };
    }
    promise.drawerStateHash = governancePayloadHash({
      promiseId, version: promise.version, matchState: promise.matchState, caseState: promise.caseState,
      ownerRoute, proofAge, amendmentHistory: promise.amendmentHistory,
      sourceWrites: promise.sourceWrites,
    });
    return promise;
  });

  const squadKeys = [...new Set([...(brief?.projects || []), ...promises.map((p) => p.squad)].filter(Boolean))];
  const squadInsights = new Map((brief?.squadInsights || []).map((s) => [s.projectKey, s]));
  let squads = squadKeys.map((squad) => {
    const displayName = displayNameForSquad(squad, brief);
    const squadPromises = promises.filter((p) => p.squad === squad || p.issueKey.startsWith(`${squad}-`));
    const counts = {};
    for (const promise of squadPromises) counts[promise.matchState] = (counts[promise.matchState] || 0) + 1;
    const diagnosisGroups = [...squadPromises.reduce((groups, promise) => {
      if (!promise.diagnosisCode || promise.diagnosisCode === PROMISE_DIAGNOSIS_CODES.VERIFIED) return groups;
      const key = promise.diagnosisCode;
      const group = groups.get(key) || {
        code: key,
        label: promise.diagnosisLabel,
        confidence: promise.diagnosisConfidence,
        count: 0,
        issueKeys: [],
        customerOrPiImpact: promise.customerOrPiImpact,
        recommendedAction: promise.recommendedAction,
        ownerRoute: promise.ownerRoute,
      };
      group.count += 1;
      group.confidence = Math.min(group.confidence, promise.diagnosisConfidence);
      group.issueKeys.push(...(promise.candidateIssueKeys?.length ? promise.candidateIssueKeys : [promise.issueKey]).filter(Boolean));
      groups.set(key, group);
      return groups;
    }, new Map()).values()].map((group) => ({ ...group, issueKeys: [...new Set(group.issueKeys)] }))
      .sort((a, b) => b.count - a.count || b.confidence - a.confidence);
    const insight = squadInsights.get(squad) || {};
    const attention = squadPromises.filter((p) => ![PROMISE_MATCH_STATES.MATCHED, PROMISE_MATCH_STATES.ALIGNED_AMENDED].includes(p.matchState));
    const proofState = attention.some((p) => ['expired', 'stale'].includes(p.proofAge.state)) ? 'stale proof' : (attention.length ? 'proof needs review' : 'fresh proof');
    const piTotal = Number(insight.piCommitted) || squadPromises.length;
    const piDone = Number(insight.piDone) || squadPromises.filter((p) => [PROMISE_MATCH_STATES.MATCHED, PROMISE_MATCH_STATES.ALIGNED_AMENDED].includes(p.matchState)).length;
    const piPct = piTotal ? Math.round((piDone / piTotal) * 100) : null;
    const topState = diagnosisGroups.length ? `${diagnosisGroups[0].count} ${diagnosisGroups[0].label.toLowerCase()}`
      : counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF] ? `${counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF]} no-proof promise${counts[PROMISE_MATCH_STATES.NO_JIRA_PROOF] === 1 ? '' : 's'}`
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
    const unknownWork = clusterUnknownWork({ activeItems: inferredItems, workSplit: calculated });
    const possibleRework = scorePossibleRework({ items: inferredItems, now });
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
    const sprintReality = sprintRealityForInsight(insight);
    const evidenceComplete = insight.boardResolved !== false
      && !['unverified', 'partial', 'ended-no-successor', 'active-dates-expired'].includes(sprintReality.state)
      && !jiraFailed;
    const contractState = contractTruth({
      baselineCoverage,
      counts,
      attentionCount: squadAttention,
      piPct,
      evidenceComplete,
      diagnosisGroups,
    });
    const operatingModel = operatingModelForSquad({ squad, displayName, insight, baselineCoverage, piLinkedCount: piTotal, activeItems: inferredItems, sprintReality, brief });
    const operationalEvidence = {
      issueTypeDistribution: insight.issueTypeDistribution || {},
      sprintCadence: clean(insight.sprintCadence || insight.sprintState, 160),
      baselineHistoryCount: Number(insight.baselineHistoryCount) || (baselineCoverage.state === 'missing' ? 0 : 1),
      ownerRegistryMatched: Boolean(insight.productOwner || insight.owner || nextPromise?.ownerRoute?.source?.startsWith('settings-')),
      boardResolved: insight.boardResolved !== false,
      piLinkedEpicCount: piTotal,
      historicalPiParticipation: baselineCoverage.state === 'missing' ? 'unverified' : 'confirmed',
      classificationSignals: operatingModel.evidence,
    };
    const sourceWriteSummary = squadPromises.flatMap((promise) => promise.sourceWrites || []).sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))[0] || null;
    const projected = {
      squad,
      displayName,
      promiseCount: squadPromises.length,
      attentionCount: squadAttention,
      counts,
      proofState,
      diagnosisGroups,
      piPct: baselineCoverage.state === 'missing' ? null : piPct,
      topState: baselineCoverage.state === 'missing' ? 'cannot verify' : topState,
      workSplit,
      doingInstead,
      currentWork: inferredItems.slice(0, 12).map((item) => ({
        themeId: clean(item.epicKey || item.parentKey || item.id || item.issueKey, 120),
        title: clean(item.epicTitle || item.parentSummary || item.summary || item.issueKey || 'Unclear work theme', 180),
        issueKey: clean(item.issueKey || item.key || '', 80),
        systemDerived: !item.epicTitle && !item.parentSummary && Boolean(item.summary),
      })),
      unknownWork,
      possibleRework,
      sprintReality,
      sprintTruthVersion: sprintReality.version || sprintReality.evidenceAt || '',
      sprintTruthHash: sprintReality.payloadHash || '',
      sprintCadence: {
        state: ['missing', 'missing-next-sprint'].includes(sprintReality.state) ? 'unverified' : sprintReality.state,
        label: ['missing', 'missing-next-sprint'].includes(sprintReality.state) ? 'No active sprint verified' : sprintReality.copy,
        detail: sprintReality.copy,
      },
      contractState,
      evidenceCompleteness: { complete: evidenceComplete, jiraAvailable: !jiraFailed, sprintVerified: !['unverified', 'partial'].includes(sprintReality.state), baselineVerified: baselineCoverage.state !== 'missing' },
      actionEligibility: { freshnessRestricted: restrictFreshActions, reason: restrictFreshActions ? (jiraFailed ? 'Jira refresh failed; evidence-dependent decisions are paused.' : 'Evidence is over 60 minutes old; pull fresh proof before deciding.') : '' },
      baselineCoverage,
      boardResolved: insight.boardResolved !== false,
      governanceInclusion: operatingModel.state,
      operatingModel,
      operatingModelEvidence: operationalEvidence,
      sourceWriteSummary,
      version: Math.max(1, ...squadPromises.map((promise) => promise.version)),
      detailHref: `/api/governance/squads/${encodeURIComponent(squad)}/detail.json`,
      nextAction: diagnosisGroups[0]
        ? { id: 'review-diagnosis', label: diagnosisGroups[0].recommendedAction, diagnosisCode: diagnosisGroups[0].code }
        : nextPromise?.nextAction || (baselineCoverage.state === 'missing' ? { id: 'save-baseline', label: 'Save baseline to compare' } : null),
      amendmentSentence: squadPromises.find((promise) => promise.amendmentSentence)?.amendmentSentence || '',
    };
    projected.trustFactor = trustFactorForSquad({ baselineCoverage, sprintReality, boardResolved: projected.boardResolved, ownerRoute: nextPromise?.ownerRoute, proofState, operatingModel });
    projected.riskScore = baselineCoverage.state === 'missing' ? 5
      : (squadAttention * 20) + (proofState === 'stale proof' ? 12 : 0) + (workSplit.unknownPct || 0) / 5
        + (doingInstead.major ? 8 : 0) + (possibleRework.promoted ? (possibleRework.promoted.confidence === 'high' ? 10 : 5) : 0);
    projected.payloadHash = governancePayloadHash({
      squad, version: projected.version, counts, proofState, workSplit, doingInstead, currentWork: projected.currentWork,
      unknownWork, possibleRework, sprintReality: projected.sprintReality, baselineCoverage,
      displayName, contractState, trustFactor: projected.trustFactor, operatingModel, diagnosisGroups,
      ownerRoutes: squadPromises.map((promise) => promise.ownerRoute), sourceWriteSummary,
    });
    return projected;
  });

  const excludedOperationalGroups = squads.filter((squad) => squad.governanceInclusion === 'excluded-operational-group')
    .sort((a, b) => b.operatingModel.confidence - a.operatingModel.confidence || a.displayName.localeCompare(b.displayName));
  squads = squads.filter((squad) => squad.governanceInclusion !== 'excluded-operational-group')
    .sort((a, b) => b.riskScore - a.riskScore || a.squad.localeCompare(b.squad))
    .map((squad, index) => ({ ...squad, riskOrder: index + 1 }));

  const partialProjects = brief?.meta?.partialProjects || [];
  const portfolioSquadCount = squads.length + excludedOperationalGroups.length;
  const verifiedSquads = Math.max(0, portfolioSquadCount - partialProjects.length);
  const needsAttention = squads.filter((s) => s.attentionCount > 0 && s.baselineCoverage?.state !== 'missing' && !partialProjects.includes(s.squad));
  const baselineMissing = squads.filter((s) => s.baselineCoverage?.state === 'missing');
  const totalChecked = promises.length;
  const complete = portfolioSquadCount > 0 && verifiedSquads === portfolioSquadCount;
  const answer = !baseline && !brief?.baselineComparison
    ? 'No approved PI contract is available. Recover the baseline before making off-plan claims.'
    : !complete
      ? `${verifiedSquads} of ${portfolioSquadCount} squads verified. Portfolio conclusion limited.`
      : needsAttention.length
        ? `${needsAttention.length} squad${needsAttention.length === 1 ? ' is' : 's are'} not aligned to PI promises. ${needsAttention.slice(0, 2).map((s) => {
          const top = (s.diagnosisGroups || [])[0];
          if (top?.label) {
            return `${s.displayName}: ${top.count} commitment${top.count === 1 ? '' : 's'} — ${top.label}`;
          }
          return `${s.displayName}: ${s.attentionCount || 0} need attention`;
        }).join('. ')}.`
        : baselineMissing.length
          ? `${baselineMissing.length} squad${baselineMissing.length === 1 ? ' cannot' : 's cannot'} be verified because baseline evidence is missing.`
        : squads.some((squad) => squad.contractState?.state === 'cannot-verify')
          ? 'No deterministic breach is proven, but incomplete evidence prevents an aligned portfolio claim.'
          : `All ${squads.length} PI-governed squads are aligned to the approved PI promises.`;
  const verifiedAt = brief.generatedAt || now.toISOString();
  const quarter = fiscalPeriod;
  const sourceLine = baseline || brief?.baselineComparison
    ? `Compared with ${quarter} PI contract · ${totalChecked} promises checked`
    : 'Baseline recovery required · no off-plan conclusion shown';
  const prepared = promises.filter((p) => p.allowedActions.some((a) => a.id === 'send-nudge' && a.allowed)).length;
  const deliveraDid = `Delivera matched the contract to Jira, checked proof age and work split, and prepared ${prepared} safe owner ask${prepared === 1 ? '' : 's'}.`;
  const closedDecisions = promises.filter((p) => ['aligned', 'closed', ACTIVE_CASE_STATES.RESOLVED_MATCHED, ACTIVE_CASE_STATES.ALIGNED_AMENDED, ACTIVE_CASE_STATES.RISK_ACCEPTED].includes(p.caseState)).length;
  const loopCompletion = totalChecked ? Math.round((closedDecisions / totalChecked) * 100) : 0;
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
  if (!complete) freshness.copy = `${verifiedSquads} of ${portfolioSquadCount} squads verified. Portfolio conclusion limited.`;
  const lensSummaries = {
    overall: needsAttention.length ? `${needsAttention.slice(0, 3).map((squad) => squad.displayName).join(', ')} drive PI miss risk because ${needsAttention.reduce((sum, squad) => sum + squad.attentionCount, 0)} commitments need evidence or a decision.` : 'No verified PI variance requires intervention.',
    rollover: `${squads.filter((squad) => Number(squad.sprintReality?.carryoverCount) > 0).length} squads show sprint carryover evidence. Review recurrence before treating spillover as normal.`,
    sprint: `${squads.filter((squad) => ['unverified', 'partial', 'ended-no-successor', 'active-dates-expired'].includes(squad.sprintReality?.state)).length} squads have sprint evidence requiring attention. Prioritize those that also have PI contract gaps.`,
    operational: `${squads.filter((squad) => squad.doingInstead?.major).length} squads have material non-PI work pressure. Review whether it is approved support or unmanaged demand.`,
    unknown: `${squads.filter((squad) => squad.unknownWork?.promoted).length} squads have Unknown work above threshold. Classify the top cluster before trusting Work Split.`,
    rework: `${squads.filter((squad) => squad.possibleRework?.promoted?.confidence === 'high').length} high-confidence possible rework signal${squads.filter((squad) => squad.possibleRework?.promoted?.confidence === 'high').length === 1 ? '' : 's'} found. ${squads.reduce((sum, squad) => sum + (squad.possibleRework?.hiddenLowConfidenceCount || 0), 0)} low-confidence reopened items remain normal follow-up.`,
  };
  return {
    schemaVersion: GOVERNANCE_STORY_SCHEMA_VERSION,
    presentationContractVersion: GOVERNANCE_PRESENTATION_CONTRACT_VERSION,
    compatibilitySchemaVersion: 1,
    answerId: randomUUID(),
    answerVersion: Math.max(1, ...promises.map((p) => p.version)),
    contract: baseline ? { id: contractId, piName: quarter, approvedBy: baseline.approvedBy || '', approvedAt: baseline.ts || baseline.baselineDate || '', source: baseline.source || '' } : null,
    scope: { mode: 'all-squads', projects: brief?.projects || squadKeys, expectedSquads: portfolioSquadCount, piGovernedSquads: squads.length, excludedOperationalGroups: excludedOperationalGroups.length, verifiedSquads, complete, partialProjects },
    answer,
    sourceLine,
    missionHeader: `${quarter} PI contract governance`,
    deliveraDid,
    verifiedAt,
    evidenceObservedAt: brief?.freshness?.asOf || brief.generatedAt || verifiedAt,
    freshness,
    loopCompletion,
    decisionCoverage: {
      closed: closedDecisions,
      total: totalChecked,
      preparedOwnerAsks: prepared,
      copy: totalChecked
        ? `${closedDecisions} decided · ${Math.max(0, totalChecked - closedDecisions)} open · ${totalChecked} in scope`
        : 'No promises in scope yet',
    },
    lensSummaries,
    squads,
    excludedOperationalGroups,
    promises,
    nextDecisionPromiseId: promises.filter((promise) => !excludedOperationalGroups.some((squad) => squad.squad === promise.squad)).find((p) => p.caseState === ACTIVE_CASE_STATES.READY_TO_RECHECK)?.promiseId || promises.filter((promise) => !excludedOperationalGroups.some((squad) => squad.squad === promise.squad)).find((p) => p.caseState === ACTIVE_CASE_STATES.ESCALATION_DUE)?.promiseId || promises.filter((promise) => !excludedOperationalGroups.some((squad) => squad.squad === promise.squad)).find((p) => p.caseState === ACTIVE_CASE_STATES.NEEDS_ATTENTION)?.promiseId || null,
  };
}

export function projectActiveGovernanceLayer1(answer = {}) {
  return {
    ...answer,
    promises: (answer.promises || []).map((promise) => ({
      promiseId: promise.promiseId,
      contractId: promise.contractId,
      squad: promise.squad,
      squadDisplayName: promise.squadDisplayName,
      issueKey: promise.issueKey,
      quarter: promise.quarter,
      originalText: promise.originalText,
      statusNow: promise.statusNow,
      matchState: promise.matchState,
      matchLabel: promise.matchLabel,
      caseState: promise.caseState,
      version: promise.version,
      proofAge: promise.proofAge,
      baselineCoverage: promise.baselineCoverage,
      amendmentSentence: promise.amendmentSentence,
      actionLifecycle: promise.actionLifecycle,
      nextAction: promise.nextAction,
      diagnosisCode: promise.diagnosisCode,
      diagnosisLabel: promise.diagnosisLabel,
      diagnosisConfidence: promise.diagnosisConfidence,
      diagnosisEvidence: promise.diagnosisEvidence,
      candidateIssueKeys: promise.candidateIssueKeys,
      customerOrPiImpact: promise.customerOrPiImpact,
      recommendedAction: promise.recommendedAction,
      ownerRoute: promise.ownerRoute,
      requiresHumanDecision: promise.requiresHumanDecision,
      expectedVsActual: promise.expectedVsActual,
      drawerStateHash: promise.drawerStateHash,
      sourceWriteSummary: promise.sourceWrites?.slice(-1)[0] || null,
      detailHref: `/api/governance/cases/${encodeURIComponent(promise.promiseId)}/detail.json`,
    })),
  };
}
