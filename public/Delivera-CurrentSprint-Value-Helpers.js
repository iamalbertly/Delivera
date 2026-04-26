import { hasOutcomeLabel, isOutcomeStoryLike } from './Delivera-Shared-Outcome-Risk-Semantics.js';

const GROWTH_HINTS = ['ga', 'gross add', 'gross adds', 'sales', 'growth', 'acquisition', 'conversion', 'nba', 'visibility'];
const CX_HINTS = ['customer', 'cx', 'care', 'css', 'alert', 'support', 'service', 'experience', 'tm'];
const ENABLER_HINTS = ['devsecops', 'infra', 'platform', 'security', 'integration', 'api', 'migration', 'pipeline', 'data fix', 'sync', 'automation'];

function normalizedText(...parts) {
  return parts
    .map((part) => String(part || '').toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(text, hints) {
  return hints.some((hint) => text.includes(hint));
}

export function deriveBusinessValueTag(story = {}) {
  const text = normalizedText(story.summary, story.description, story.epicName, story.labels?.join?.(' '));
  if (containsAny(text, GROWTH_HINTS)) return 'Growth';
  if (containsAny(text, CX_HINTS)) return 'CX';
  if (containsAny(text, ENABLER_HINTS)) return 'Efficiency';
  return isOutcomeStoryLike({ labels: story.labels, epicKey: story.epicKey }) ? 'Growth' : 'Efficiency';
}

export function deriveStoryDescription(story = {}) {
  const raw = String(story.description || '').trim();
  if (raw) return raw.slice(0, 160);
  const summary = String(story.summary || 'Sprint work').trim();
  const status = String(story.status || 'In progress').trim();
  const issueType = String(story.issueType || 'Work item').trim();
  return `${issueType} in ${status} to move "${summary}" forward this sprint.`;
}

export function deriveBusinessOutcome(story = {}) {
  const text = normalizedText(story.summary, story.description, story.epicName);
  if (text.includes('report')) return 'Gives leaders and field teams a clearer daily performance view without waiting for manual updates.';
  if (text.includes('alert') || text.includes('nba')) return 'Helps teams act faster by surfacing changes or risk conditions in time to respond.';
  if (text.includes('visibility') || text.includes('dashboard')) return 'Improves visibility so business and delivery decisions can be made earlier.';
  if (containsAny(text, ENABLER_HINTS)) return 'Protects release flow, integration trust, and delivery reliability for customer-facing work.';
  if (containsAny(text, CX_HINTS)) return 'Improves the quality and speed of the customer-facing experience this sprint.';
  return 'Moves a measurable sprint outcome forward in a way the business can explain clearly.';
}

export function deriveLinkedKpi(story = {}) {
  const text = normalizedText(story.summary, story.description, story.epicName);
  const tag = deriveBusinessValueTag(story);
  if (text.includes('ga') || text.includes('gross add')) return 'Supports Gross Adds visibility';
  if (text.includes('nba') || text.includes('alert')) return 'Supports NBA alert responsiveness';
  if (text.includes('report') || text.includes('dashboard')) return 'Supports reporting adoption and decision speed';
  if (tag === 'CX') return 'Supports customer response confidence';
  if (tag === 'Growth') return 'Supports growth KPI visibility';
  return 'Supports flow efficiency and delivery trust';
}

export function deriveSprintGoal(data = {}) {
  const explicitGoal = String(data?.sprint?.goal || data?.decisionCockpit?.summaryStrip?.goal || '').trim();
  if (explicitGoal) return explicitGoal;
  const stories = Array.isArray(data?.stories) ? data.stories : [];
  const primaryValueStory = stories.find((story) => {
    const labels = Array.isArray(story?.labels) ? story.labels : [];
    return isOutcomeStoryLike({ labels, epicKey: story?.epicKey }) || hasOutcomeLabel(labels);
  }) || stories[0];
  if (primaryValueStory) {
    return deriveBusinessOutcome(primaryValueStory);
  }
  const boardName = String(data?.board?.name || data?.meta?.projects || 'the squad').trim();
  return `Keep ${boardName} delivery aligned to customer value, simplicity, and growth outcomes.`;
}

export function deriveStoryGroup(story = {}, riskTags = []) {
  const tags = Array.isArray(riskTags) ? riskTags : [];
  const text = normalizedText(story.summary, story.description, story.issueType, story.labels?.join?.(' '));
  if (tags.some((tag) => ['blocker', 'unassigned', 'missing-estimate', 'no-log', 'scope'].includes(tag)) || text.includes('blocked')) {
    return 'blocked';
  }
  if (isOutcomeStoryLike({ labels: story.labels, epicKey: story.epicKey }) || containsAny(text, GROWTH_HINTS) || containsAny(text, CX_HINTS)) {
    return 'value';
  }
  if (containsAny(text, ENABLER_HINTS) || /task|spike|bug|sub-task/i.test(String(story.issueType || ''))) {
    return 'enabler';
  }
  return 'value';
}

export function buildDeliveredImpactBullets(stories = [], storyRiskTagMap = new Map()) {
  const doneStories = stories.filter((story) => {
    const status = String(story?.status || '').toLowerCase();
    return status.includes('done') || status.includes('closed') || status.includes('resolved');
  });
  const valueStories = doneStories.filter((story) => deriveStoryGroup(story, storyRiskTagMap.get(String(story?.issueKey || story?.key || '').toUpperCase()) || []) === 'value');
  const source = valueStories.length ? valueStories : doneStories;
  return source.slice(0, 4).map((story) => {
    const summary = String(story?.summary || '').trim();
    if (/alert/i.test(summary)) return `${summary} is now active for end users.`;
    if (/report|dashboard|visibility/i.test(summary)) return `${summary} is now visible in daily decision-making.`;
    return deriveBusinessOutcome(story);
  });
}
