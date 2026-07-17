import { appendActiveLoopEvent, currentPromiseVersion, readActiveLoopEvents } from './Delivera-Governance-ActiveLoop-02Store-IO.js';
import { diffRelevantJiraState } from './Delivera-Governance-ActiveLoop-01Domain-SSOT.js';
import { cache } from './cache.js';

const jiraStateByIssueId = new Map();
const dirtyByScope = new Map();
const timers = new Map();

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function issueIdentity(payload = {}) {
  return clean(payload?.issue?.id || payload?.issue?.key || payload?.issueId || payload?.issueKey, 120);
}

function extractReference(payload = {}) {
  const text = JSON.stringify(payload?.comment?.body || payload?.body || payload?.message?.body || payload?.resourceData?.body || '');
  return text.match(/DLV-[A-Z0-9-]{6,40}/i)?.[0]?.toUpperCase() || '';
}

function normalizedWebhookIssue(payload = {}) {
  const issue = payload.issue || payload;
  const fields = issue.fields || {};
  return {
    status: fields.status?.name || issue.status,
    statusCategory: fields.status?.statusCategory?.key,
    assigneeAccountId: fields.assignee?.accountId,
    assigneeActive: fields.assignee?.active,
    sprintIds: fields.sprint || fields.customfield_10020 || [],
    activeSprint: (fields.sprint || fields.customfield_10020 || []).some?.((sprint) => String(sprint?.state || '').toLowerCase() === 'active') || false,
    epicId: fields.parent?.id || fields.epic?.id,
    parentId: fields.parent?.id,
    summary: fields.summary,
    description: fields.description,
    labels: fields.labels,
    components: fields.components,
    worklogTotalSeconds: fields.timespent,
    resolution: fields.resolution?.name,
    acceptanceIndicator: fields.acceptanceIndicator,
    deletedAt: payload.webhookEvent === 'jira:issue_deleted' ? new Date(payload.timestamp || Date.now()).toISOString() : '',
  };
}

function scopeForPayload(payload = {}) {
  const project = clean(payload?.issue?.fields?.project?.key || payload?.issue?.key?.split?.('-')?.[0] || 'unknown', 80).toUpperCase();
  return `${project}|active-quarter`;
}

export function queueDirtyGovernanceScope(scopeKey, issueId, { quietMs = 4000, maxMs = 15000, onFlush = null } = {}) {
  const now = Date.now();
  const existing = dirtyByScope.get(scopeKey) || { issueIds: new Set(), firstAt: now, lastAt: now };
  existing.issueIds.add(issueId);
  existing.lastAt = now;
  dirtyByScope.set(scopeKey, existing);
  if (timers.has(scopeKey)) clearTimeout(timers.get(scopeKey));
  const elapsed = now - existing.firstAt;
  const delay = elapsed >= maxMs ? 0 : Math.min(quietMs, maxMs - elapsed);
  timers.set(scopeKey, setTimeout(() => {
    timers.delete(scopeKey);
    const batch = dirtyByScope.get(scopeKey);
    dirtyByScope.delete(scopeKey);
    const work = { id: `${scopeKey}:${Date.now()}`, scopeKey, issueIds: [...(batch?.issueIds || [])], firstAt: batch?.firstAt, flushedAt: Date.now() };
    void cache.appendDurableLog('governance:targeted-recompute-queue:v1', work, 10000)
      .then(() => onFlush?.(work));
  }, delay));
  return { scopeKey, coalescedIssueCount: existing.issueIds.size, quietMs: delay };
}

async function eventForReference(deliveraRef) {
  if (!deliveraRef) return null;
  const events = await readActiveLoopEvents({ limit: 5000 });
  return [...events].reverse().find((event) => String(event?.payload?.deliveraRef || '').toUpperCase() === deliveraRef) || null;
}

async function appendReaction(sourceEvent, type, payload) {
  if (!sourceEvent?.promiseId) return null;
  const version = await currentPromiseVersion(sourceEvent.promiseId);
  return appendActiveLoopEvent({
    promiseId: sourceEvent.promiseId,
    contractId: sourceEvent.contractId,
    type,
    actorId: payload.actorId || 'integration-listener',
    expectedVersion: version,
    nextVersion: version + 1,
    payload,
  });
}

export async function ingestJiraGovernanceWebhook(payload = {}, { webhookId = '', onDirtyFlush = null } = {}) {
  const issueId = issueIdentity(payload);
  const eventName = clean(payload.webhookEvent || payload.issue_event_type_name || 'jira:event', 120);
  const deliveraRef = extractReference(payload);
  const sourceEvent = await eventForReference(deliveraRef);
  if (/comment_(created|updated)/i.test(eventName) && sourceEvent) {
    const body = JSON.stringify(payload?.comment?.body || '');
    await appendReaction(sourceEvent, 'owner-replied', {
      deliveraRef,
      channel: 'jira',
      issueKey: payload?.issue?.key || sourceEvent.payload?.issueKey || '',
      actorId: payload?.comment?.author?.accountId || payload?.user?.accountId || 'jira-user',
      replyExcerpt: clean(body.replace(/[{}"\[\]]/g, ' '), 400),
      externalId: clean(payload?.comment?.id, 160),
      webhookId,
    });
  }

  if (!issueId) return { accepted: true, relevantChange: false, reason: 'no-issue-identity', deliveraRef };
  const incoming = normalizedWebhookIssue(payload);
  const durableState = await cache.get(`governance:jira-relevant-state:v1:${issueId}`, { namespace: 'governanceJiraState' });
  const previous = durableState?.value || durableState || jiraStateByIssueId.get(issueId) || {};
  const diff = diffRelevantJiraState(previous, incoming);
  if (!diff.changed) return { accepted: true, relevantChange: false, skippedRecomputation: true, issueId, deliveraRef };
  jiraStateByIssueId.set(issueId, incoming);
  await cache.set(`governance:jira-relevant-state:v1:${issueId}`, incoming, 90 * 24 * 60 * 60 * 1000, { namespace: 'governanceJiraState' });
  if (sourceEvent && !/comment_/i.test(eventName)) {
    await appendReaction(sourceEvent, 'evidence-changed-after-nudge', {
      deliveraRef,
      channel: 'jira',
      issueKey: payload?.issue?.key || sourceEvent.payload?.issueKey || '',
      changedFields: diff.changedFields,
      webhookId,
    });
  }
  const coalesced = queueDirtyGovernanceScope(scopeForPayload(payload), issueId, { onFlush: onDirtyFlush });
  return { accepted: true, relevantChange: true, issueId, changedFields: diff.changedFields, nextHash: diff.nextHash, deliveraRef, coalesced };
}

export async function ingestTeamsGovernanceNotification(payload = {}) {
  const deliveraRef = extractReference(payload);
  const sourceEvent = await eventForReference(deliveraRef);
  if (!sourceEvent) return { accepted: true, correlated: false, deliveraRef };
  const body = clean(payload?.resourceData?.body?.content || payload?.message?.body?.content || payload?.body?.content, 400);
  await appendReaction(sourceEvent, 'owner-replied', {
    deliveraRef,
    channel: 'teams',
    actorId: clean(payload?.resourceData?.from?.user?.id || payload?.message?.from?.user?.id || 'teams-user', 180),
    replyExcerpt: body,
    externalId: clean(payload?.resourceData?.id || payload?.message?.id, 180),
    threadId: clean(payload?.resourceData?.replyToId || payload?.message?.replyToId, 180),
  });
  return { accepted: true, correlated: true, deliveraRef };
}

export function resetActiveLoopIngestionStateForTests() {
  jiraStateByIssueId.clear();
  dirtyByScope.clear();
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}
