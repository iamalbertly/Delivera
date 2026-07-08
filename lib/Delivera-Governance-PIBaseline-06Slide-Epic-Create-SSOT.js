/**
 * SSOT: Create or link Jira epics from resolved slide commitments.
 * Used by POST /api/governance/pi-baseline/create-epics-from-slide.
 */

import {
  SLIDE_EPIC_STATUS,
  SLIDE_SUGGESTED_ACTION,
  quarterKey,
  reconcileResolvedWithEpics,
  linkResolvedToExisting,
  toProposeRows,
  buildCreateWorkNarrative,
  searchJiraEpicsForResolved,
} from './Delivera-Governance-PIBaseline-05Slide-Epic-Resolver-SSOT.js';

function capSummary(value, max = 180) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function quarterLabel(quarter = '') {
  return String(quarterKey(quarter) || quarter || 'FY27 Q2').replace(/\s+/g, '-');
}

function plainDescription(text = '') {
  const body = String(text || '').trim();
  if (!body) return undefined;
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: body.slice(0, 4000) }] }],
  };
}

function normalizeActions(actions = {}) {
  const out = {};
  for (const [k, v] of Object.entries(actions || {})) {
    const key = String(k || '').trim();
    const action = String(v || '').trim().toLowerCase();
    if (!key) continue;
    if (action === 'link' || action === 'create' || action === 'skip') out[key] = action;
  }
  return out;
}

async function findEpicByExactSummary(version3Client, projectKey, summary) {
  const escaped = String(summary || '').replace(/["\\]/g, '\\$&').slice(0, 100);
  if (!escaped) return null;
  try {
    const res = await version3Client.issueSearch.searchForIssuesUsingJql({
      jql: `project = ${projectKey} AND issuetype = Epic AND summary ~ "${escaped}" ORDER BY updated DESC`,
      maxResults: 8,
      fields: ['summary', 'status'],
    });
    const want = String(summary || '').toLowerCase().trim();
    for (const issue of res?.issues || []) {
      const title = String(issue?.fields?.summary || '').toLowerCase().trim();
      if (title === want || title.includes(want.slice(0, 40))) {
        return {
          issueKey: String(issue.key || '').toUpperCase(),
          title: issue?.fields?.summary || issue.key,
          status: issue?.fields?.status?.name || '',
        };
      }
    }
  } catch (_) { /* optional */ }
  return null;
}

/**
 * Create epics + optional child stories for missing / opted-in duplicate-risk rows.
 *
 * @param {object} args
 * @param {object} args.version3Client
 * @param {Array} args.resolved
 * @param {string[]} args.projects
 * @param {string} [args.quarter]
 * @param {Record<string,string>} [args.actions] title -> link|create|skip
 * @param {boolean} [args.createAnyway]
 * @param {boolean} [args.includeChildStories]
 * @param {object} [args.createHelpers] { resolveEpicIssueTypeId, epicLinkFieldId, host }
 */
export async function createEpicsFromSlideResolved({
  version3Client,
  resolved = [],
  projects = [],
  quarter = '',
  actions = {},
  createAnyway = false,
  includeChildStories = true,
  createHelpers = {},
} = {}) {
  const projectKey = String(projects[0] || '').toUpperCase();
  if (!version3Client || !projectKey) {
    return { created: [], linked: [], skipped: [], errors: [{ error: 'Missing Jira client or project key' }] };
  }

  const actionMap = normalizeActions(actions);
  const created = [];
  const linked = [];
  const skipped = [];
  const errors = [];
  let working = [...(resolved || [])];

  const qLabel = quarterLabel(quarter);
  const defaultLabels = ['PIBaseline', qLabel, 'OutcomeStory'].filter(Boolean);

  for (const row of working) {
    const title = String(row.suggestedEpicTitle || '').trim();
    if (!title) continue;

    const action = actionMap[title]
      || (row.status === SLIDE_EPIC_STATUS.MATCHED ? 'link'
        : row.status === SLIDE_EPIC_STATUS.DUPLICATE_RISK
          ? (row.suggestedAction === SLIDE_SUGGESTED_ACTION.LINK ? 'link' : 'skip')
          : 'create');

    if (row.status === SLIDE_EPIC_STATUS.MATCHED && row.issueKey) {
      skipped.push({ issueKey: row.issueKey, title, reason: 'already-matched' });
      continue;
    }

    if (action === 'skip') {
      skipped.push({ issueKey: row.issueKey || '', title, reason: 'skipped' });
      continue;
    }

    if (action === 'link') {
      const key = String(row.issueKey || row.duplicateRisk?.issueKey || '').toUpperCase();
      if (!key) {
        errors.push({ title, error: 'No existing issue key to link' });
        continue;
      }
      working = linkResolvedToExisting(working, title, key, row.matchedTitle || row.duplicateRisk?.title || '');
      linked.push({
        issueKey: key,
        title,
        linkedTitle: row.matchedTitle || row.duplicateRisk?.title || '',
      });
      continue;
    }

    // action === 'create' — require createAnyway for duplicate-risk rows
    if (row.status === SLIDE_EPIC_STATUS.DUPLICATE_RISK && !createAnyway) {
      errors.push({
        title,
        error: 'Duplicate risk — confirm create with createAnyway',
        code: 'DUPLICATE_RISK_BLOCKED',
        existing: row.duplicateRisk,
      });
      continue;
    }

    const existing = await findEpicByExactSummary(version3Client, projectKey, title);
    if (existing && !createAnyway) {
      working = linkResolvedToExisting(working, title, existing.issueKey, existing.title);
      linked.push({ issueKey: existing.issueKey, title, linkedTitle: existing.title, reason: 'dedupe-match' });
      continue;
    }

    try {
      const epicTypeId = createHelpers.resolveEpicIssueTypeId
        || createHelpers.epicIssueTypeId
        || undefined;
      const issueFields = {
        project: { key: projectKey },
        summary: capSummary(title),
        issuetype: epicTypeId ? { id: String(epicTypeId) } : { name: 'Epic' },
        labels: defaultLabels,
      };
      if (row.notes) issueFields.description = plainDescription(row.notes);

      const createdEpic = await version3Client.issues.createIssue({ fields: issueFields });
      const epicKey = String(createdEpic?.key || '').toUpperCase();
      if (!epicKey) {
        errors.push({ title, error: 'Jira create returned no key' });
        continue;
      }

      const childKeys = [];
      if (includeChildStories && Array.isArray(row.childStories) && row.childStories.length) {
        const epicLinkFieldId = createHelpers.epicLinkFieldId;
        for (const story of row.childStories) {
          try {
            const childFields = {
              project: { key: projectKey },
              summary: capSummary(story.title),
              issuetype: { name: 'Story' },
              labels: defaultLabels,
            };
            if (story.description) childFields.description = plainDescription(story.description);
            if (epicLinkFieldId) childFields[epicLinkFieldId] = epicKey;
            const createdChild = await version3Client.issues.createIssue({ fields: childFields });
            if (createdChild?.key) childKeys.push(createdChild.key);
          } catch (childErr) {
            errors.push({
              title: story.title,
              parent: epicKey,
              error: String(childErr?.message || 'Child story create failed'),
            });
          }
        }
      }

      working = linkResolvedToExisting(working, title, epicKey, title);
      created.push({
        issueKey: epicKey,
        title,
        childKeys,
        url: createHelpers.host ? `${String(createHelpers.host).replace(/\/+$/, '')}/browse/${epicKey}` : '',
      });
    } catch (err) {
      errors.push({ title, error: String(err?.message || 'Epic create failed') });
    }
  }

  return { created, linked, skipped, errors, resolved: working };
}

/**
 * Reconcile resolved rows against live Jira (no vision). Returns wizard-shaped payload.
 */
export async function reconcileSlideEpics({
  version3Client,
  resolved = [],
  projects = [],
  boardEpics = [],
  quarter = '',
} = {}) {
  let jiraEpics = [];
  if (version3Client) {
    jiraEpics = await searchJiraEpicsForResolved(version3Client, resolved, projects);
  }
  const nextResolved = reconcileResolvedWithEpics(resolved, jiraEpics, boardEpics);
  const { candidates, unmatched, duplicateRisk } = toProposeRows(nextResolved);
  const matchedCount = nextResolved.filter((r) => r.status === SLIDE_EPIC_STATUS.MATCHED).length;
  const missingCount = nextResolved.filter((r) => r.status === SLIDE_EPIC_STATUS.MISSING).length;
  return {
    method: 'slide-reconciled',
    resolved: nextResolved,
    candidates: [...candidates, ...unmatched],
    unmatched,
    duplicateRisk,
    createWorkNarrative: buildCreateWorkNarrative(nextResolved),
    matchedCount,
    missingCount,
    quarter,
    projects,
  };
}
