export const GOVERNANCE_BRIEF_NAMESPACE = 'governanceBrief';
export const GOVERNANCE_STORY_NAMESPACE = 'governanceStoryV2';
export const GOVERNANCE_STORY_DETAIL_NAMESPACE = 'governanceStoryV2Detail';

export function governanceBriefCacheKey(projects = [], { includeEvidence = true, includePOReadiness = true, periodWindow = '28d' } = {}) {
  const keys = [...new Set((projects || []).map((project) => String(project).trim().toUpperCase()).filter(Boolean))];
  return `${GOVERNANCE_BRIEF_NAMESPACE}:${keys.join(',')}:e${includeEvidence ? 1 : 0}:p${includePOReadiness ? 1 : 0}:w${String(periodWindow || '28d').toLowerCase()}`;
}

export function governanceStoryCacheKey(projects = [], quarter = '') {
  const keys = [...new Set((projects || []).map((project) => String(project).trim().toUpperCase()).filter(Boolean))];
  return `${GOVERNANCE_STORY_NAMESPACE}:${keys.join(',')}:${String(quarter || 'current').trim().toLowerCase()}:v2`;
}

export function governanceRefreshScopeKey({ scopeType, scopeId, quarter = '' } = {}) {
  return `${String(scopeType || '').toLowerCase()}:${String(scopeId || '').toUpperCase()}|${String(quarter || 'current').toLowerCase()}`;
}
