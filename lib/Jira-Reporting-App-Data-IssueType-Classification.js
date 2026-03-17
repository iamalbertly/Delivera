/**
 * Issue type classification for current-sprint and reporting.
 * SSOT for story/work-item/subtask and feature/support buckets. Used by lib/currentSprint.js.
 */

function normalizeIssueTypeName(issue) {
  return (issue?.fields?.issuetype?.name || '').toLowerCase();
}

const SUBTASK_TYPE_PATTERNS = ['sub-task', 'subtask'];
const PEER_WORK_ITEM_PATTERNS = [
  'story',
  'feature',
  'improvement',
  'service request',
  'request',
  'task',
  'change',
  'initiative',
  'epic',
  'incident',
  'problem',
  'bug',
];

function matchesAnyPattern(type, patterns) {
  const normalized = String(type || '').trim().toLowerCase();
  if (!normalized) return false;
  return patterns.some((pattern) => normalized.includes(pattern));
}

export function isStoryIssue(issue) {
  const type = normalizeIssueTypeName(issue);
  return matchesAnyPattern(type, ['story', 'feature', 'improvement', 'service request', 'request', 'task']);
}

export function isWorkItemIssue(issue) {
  const type = normalizeIssueTypeName(issue);
  if (!type) return false;
  if (matchesAnyPattern(type, SUBTASK_TYPE_PATTERNS)) return false;
  if (matchesAnyPattern(type, PEER_WORK_ITEM_PATTERNS)) return true;
  return true;
}

export function classifyIssueTypeForSplit(issue) {
  const type = normalizeIssueTypeName(issue);
  if (!type) return 'support';
  if (type.includes('bug') || type.includes('support') || type.includes('ops') || type.includes('operation')) {
    return 'support';
  }
  if (type.includes('task') || type.includes('chore') || type.includes('maintenance') || type.includes('service request') || type.includes('request')) {
    return 'support';
  }
  if (type.includes('story') || type.includes('feature') || type.includes('improvement')) {
    return 'feature';
  }
  return 'support';
}

export function isSubtaskIssue(issue) {
  const type = normalizeIssueTypeName(issue);
  return matchesAnyPattern(type, SUBTASK_TYPE_PATTERNS);
}

export function getDefaultPeerWorkItemTypes() {
  return [
    'Story',
    'User Story',
    'Bug',
    'Task',
    'Feature',
    'Improvement',
    'Service Request',
    'Request',
    'Change',
    'Incident',
    'Problem',
    'Sub-task',
    'Subtask',
  ];
}
