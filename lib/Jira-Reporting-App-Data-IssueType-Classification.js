/**
 * Issue type classification for current-sprint and reporting.
 * SSOT for top-level work items, subtasks, and support/feature split.
 */

export const WORK_ITEM_FILTER_TOKEN = '__WORK_ITEMS__';
export const DELIVERABLE_WORK_ITEM_FILTER_TOKEN = '__DELIVERABLE_WORK_ITEMS__';

function normalizeIssueTypeName(issue) {
  return normalizeIssueTypeNameValue(issue?.fields?.issuetype?.name || '');
}

export function normalizeIssueTypeNameValue(value) {
  return String(value || '').trim().toLowerCase();
}

const SUBTASK_TYPE_PATTERNS = ['sub-task', 'subtask'];
const HIERARCHY_TYPE_PATTERNS = ['epic', 'initiative', 'capabilit', 'theme', 'portfolio'];
const BUG_LIKE_TYPE_PATTERNS = ['bug', 'incident', 'problem', 'defect'];
const FEATURE_LIKE_TYPE_PATTERNS = ['story', 'feature', 'improvement'];
const SUPPORT_LIKE_TYPE_PATTERNS = ['task', 'chore', 'maintenance', 'service request', 'request', 'change', 'support', 'ops', 'operation'];

function matchesAnyPattern(type, patterns) {
  const normalized = String(type || '').trim().toLowerCase();
  if (!normalized) return false;
  return patterns.some((pattern) => normalized.includes(pattern));
}

export function isSubtaskIssueTypeName(typeName) {
  return matchesAnyPattern(typeName, SUBTASK_TYPE_PATTERNS);
}

export function isHierarchyIssueTypeName(typeName) {
  return matchesAnyPattern(typeName, HIERARCHY_TYPE_PATTERNS);
}

export function isBugLikeIssueTypeName(typeName) {
  return matchesAnyPattern(typeName, BUG_LIKE_TYPE_PATTERNS);
}

export function isWorkItemTypeName(typeName, { includeBugs = true } = {}) {
  const type = normalizeIssueTypeNameValue(typeName);
  if (!type) return false;
  if (isSubtaskIssueTypeName(type)) return false;
  if (isHierarchyIssueTypeName(type)) return false;
  if (!includeBugs && isBugLikeIssueTypeName(type)) return false;
  return true;
}

export function isStoryIssue(issue) {
  const type = normalizeIssueTypeName(issue);
  return isWorkItemTypeName(type, { includeBugs: false });
}

export function isWorkItemIssue(issue) {
  const type = normalizeIssueTypeName(issue);
  return isWorkItemTypeName(type, { includeBugs: true });
}

export function classifyIssueTypeForSplit(issue) {
  const type = normalizeIssueTypeName(issue);
  if (!type) return 'support';
  if (isBugLikeIssueTypeName(type)) {
    return 'bug';
  }
  if (matchesAnyPattern(type, SUPPORT_LIKE_TYPE_PATTERNS)) {
    return 'support';
  }
  if (matchesAnyPattern(type, FEATURE_LIKE_TYPE_PATTERNS)) {
    return 'feature';
  }
  return isWorkItemTypeName(type) ? 'feature' : 'support';
}

export function isSubtaskIssue(issue) {
  const type = normalizeIssueTypeName(issue);
  return isSubtaskIssueTypeName(type);
}

export function getDefaultPeerWorkItemTypes() {
  return [
    WORK_ITEM_FILTER_TOKEN,
  ];
}
