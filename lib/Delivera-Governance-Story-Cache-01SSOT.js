import { appEnvConfig, DELIVERA_CLIENT_RELEASE_SCHEMA } from './Delivera-Config-Env-Services-Core-SSOT.js';

export const GOVERNANCE_BRIEF_NAMESPACE = 'governanceBrief';
export const GOVERNANCE_STORY_NAMESPACE = 'governanceStoryV2';
export const GOVERNANCE_STORY_DETAIL_NAMESPACE = 'governanceStoryV2Detail';
export const GOVERNANCE_STORY_CACHE_RELEASE = `${DELIVERA_CLIENT_RELEASE_SCHEMA}-${appEnvConfig.releaseId}`;
const warmStories = new Map();

export function governanceBriefCacheKey(projects = [], { includeEvidence = true, includePOReadiness = true, periodWindow = '28d' } = {}) {
  const keys = [...new Set((projects || []).map((project) => String(project).trim().toUpperCase()).filter(Boolean))].sort();
  return `${GOVERNANCE_BRIEF_NAMESPACE}:${keys.join(',')}:e${includeEvidence ? 1 : 0}:p${includePOReadiness ? 1 : 0}:w${String(periodWindow || '28d').toLowerCase()}`;
}

export function governanceStoryCacheKey(projects = [], quarter = '') {
  const keys = [...new Set((projects || []).map((project) => String(project).trim().toUpperCase()).filter(Boolean))].sort();
  return `${GOVERNANCE_STORY_NAMESPACE}:${keys.join(',')}:${String(quarter || 'current').trim().toLowerCase()}:${GOVERNANCE_STORY_CACHE_RELEASE}`;
}

export function governanceRefreshScopeKey({ scopeType, scopeId, quarter = '' } = {}) {
  return `${String(scopeType || '').toLowerCase()}:${String(scopeId || '').toUpperCase()}|${String(quarter || 'current').toLowerCase()}`;
}

export function rememberWarmGovernanceStory(key, story) {
  if (!key || !story || Number(story.schemaVersion) !== 2) return null;
  warmStories.set(String(key), story);
  return story;
}

export function readWarmGovernanceStory(key) {
  return warmStories.get(String(key)) || null;
}

export function clearWarmGovernanceStory(key) {
  if (key) warmStories.delete(String(key)); else warmStories.clear();
}
