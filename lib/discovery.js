import { cache, CACHE_TTL, CACHE_KEYS } from './cache.js';
import { logger } from './Delivera-Server-Logging-Utility.js';
import { paginateJira } from './Delivera-Data-JiraAPI-Pagination-Helper.js';

/**
 * @param {unknown} error
 * @returns {number|null}
 */
export function extractJiraHttpStatus(error) {
  if (!error || typeof error !== 'object') return null;
  const s =
    /** @type {any} */ (error).statusCode ??
    /** @type {any} */ (error).cause?.response?.status ??
    /** @type {any} */ (error).response?.status ??
    /** @type {any} */ (error).cause?.status ??
    null;
  return typeof s === 'number' && !Number.isNaN(s) ? s : null;
}

/**
 * Classify Jira / HTTP client errors for stable API codes (Delivera session 401 is separate).
 * @param {unknown} error
 * @returns {{ status: number|null, code: string, userMessage: string }}
 */
export function classifyJiraHttpError(error) {
  const status = extractJiraHttpStatus(error);
  const msg = String((/** @type {any} */ (error))?.message || '');
  const lower = msg.toLowerCase();
  let inferred = status;
  if (inferred == null) {
    if (/status code\s*401|\b401\b/.test(lower)) inferred = 401;
    else if (/status code\s*403|\b403\b/.test(lower)) inferred = 403;
    else if (/status code\s*429|\b429\b/.test(lower)) inferred = 429;
  }
  if (inferred === 401) {
    return {
      status: 401,
      code: 'JIRA_UNAUTHORIZED',
      userMessage: 'Jira rejected credentials or access for this project.',
    };
  }
  if (inferred === 403) {
    return {
      status: 403,
      code: 'JIRA_FORBIDDEN',
      userMessage: 'Jira denied access for this project.',
    };
  }
  if (inferred === 429) {
    return {
      status: 429,
      code: 'JIRA_RATE_LIMIT',
      userMessage: 'Jira rate limited this request.',
    };
  }
  return {
    status: inferred,
    code: 'JIRA_UNKNOWN',
    userMessage: msg || 'Jira request failed.',
  };
}

/**
 * Discovers boards per project; continues on per-project failure (partial list + projectErrors).
 * @param {string[]} projectKeys
 * @param {import('jira.js/agile').AgileClient} agileClient
 * @returns {Promise<{ boards: any[], projectErrors: Array<{ projectKey: string, code: string, message: string, detail: string }> }>}
 */
export async function discoverBoardsForProjects(projectKeys, agileClient) {
  const allBoards = [];
  const boardIdSet = new Set();
  const projectErrors = [];

  for (const projectKey of projectKeys) {
    const cacheKey = CACHE_KEYS.boardsByProject(projectKey);
    const cached = await cache.get(cacheKey, { namespace: 'boards' });
    const cachedBoards = cached?.value || cached;

    if (Array.isArray(cachedBoards) && cachedBoards.length > 0) {
      allBoards.push(...cachedBoards);
      continue;
    }

    let projectBoards;
    try {
      const result = await paginateJira((startAt, maxResults) =>
        agileClient.board.getAllBoards({ projectKeyOrId: projectKey, startAt, maxResults })
      );
      projectBoards = result.items;
    } catch (error) {
      logger.error(`Error fetching boards for project ${projectKey}`, error);
      const { code, userMessage } = classifyJiraHttpError(error);
      projectErrors.push({
        projectKey,
        code,
        message: userMessage,
        detail: String((/** @type {any} */ (error))?.message || ''),
      });
      continue;
    }

    await cache.set(cacheKey, projectBoards, CACHE_TTL.BOARDS, { namespace: 'boards' });
    allBoards.push(...projectBoards);
  }

  const uniqueBoards = [];
  for (const board of allBoards) {
    if (!boardIdSet.has(board.id)) {
      boardIdSet.add(board.id);
      uniqueBoards.push(board);
    }
  }

  return { boards: uniqueBoards, projectErrors };
}

/**
 * Discovers field IDs for Story Points and Epic Link fields
 * @param {Version3Client} version3Client - Jira Version3 client
 * @returns {Promise<Object>} - Object with storyPointsFieldId and epicLinkFieldId (may be null)
 */
export async function discoverFields(version3Client) {
  const cacheKey = CACHE_KEYS.discoveryFields();
  const cached = await cache.get(cacheKey, { namespace: 'discovery' });
  const cachedFields = cached?.value || cached;
  
  if (cachedFields) {
    return cachedFields;
  }

  try {
    const fields = await version3Client.issueFields.getFields();
    
    let storyPointsFieldId = null;
    let epicLinkFieldId = null;
    const storyPointsFieldCandidates = [];

    const storyPointNameMatches = new Set([
      'story points',
      'story point',
      'story point estimate',
      'story point estimates',
      'sp',
      'points',
    ]);

    for (const field of fields) {
      const fieldName = field.name?.toLowerCase() || '';
      const clauseNames = Array.isArray(field.clauseNames)
        ? field.clauseNames.map(name => name.toLowerCase())
        : [];
      const schemaCustom = field.schema?.custom?.toLowerCase() || '';
      const schemaType = field.schema?.type?.toLowerCase() || '';

      const nameMatch = storyPointNameMatches.has(fieldName);
      const clauseMatch = clauseNames.some(name => storyPointNameMatches.has(name));
      const schemaMatch =
        schemaCustom.includes('story-points') ||
        (schemaCustom.includes('greenhopper') && fieldName.includes('story') && fieldName.includes('point')) ||
        (schemaType === 'number' && fieldName.includes('story') && fieldName.includes('point'));

      if (nameMatch || clauseMatch || schemaMatch) {
        storyPointsFieldCandidates.push({ id: field.id, name: field.name });
        if (!storyPointsFieldId) {
          storyPointsFieldId = field.id;
        }
      }

      if (!epicLinkFieldId && fieldName === 'epic link') {
        epicLinkFieldId = field.id;
      }

      // Early exit if both found
      if (storyPointsFieldId && epicLinkFieldId) {
        break;
      }
    }

    const availableFields = fields.map(field => ({
      id: field.id,
      name: field.name,
      custom: !!field.custom,
      schemaType: field.schema?.type || null,
      schemaCustom: field.schema?.custom || null,
      clauseNames: Array.isArray(field.clauseNames) ? field.clauseNames : [],
    }));

    const customFields = availableFields.filter(field => field.custom);
    const ebmFieldNames = [
      'Team',
      'Product Area',
      'Customer segments',
      'Value',
      'Impact',
      'Satisfaction',
      'Sentiment',
      'Severity',
      'Source',
      'Work category',
      'Goals',
      'Theme',
      'Roadmap',
      'Focus Areas',
      'Delivery status',
      'Delivery progress',
    ];

    const ebmFieldIds = {};
    for (const fieldName of ebmFieldNames) {
      const match = availableFields.find(field => (field.name || '').toLowerCase() === fieldName.toLowerCase());
      if (match?.id) {
        ebmFieldIds[fieldName] = match.id;
      }
    }

    const result = {
      storyPointsFieldId,
      epicLinkFieldId,
      availableFields,
      customFields,
      ebmFieldIds,
      storyPointsFieldCandidates,
    };

    // Cache the result
    await cache.set(cacheKey, result, CACHE_TTL.FIELD_IDS, { namespace: 'discovery' });
    return result;
  } catch (error) {
    logger.error('Error discovering fields', error);
    return {
      storyPointsFieldId: null,
      epicLinkFieldId: null,
      availableFields: [],
      customFields: [],
      ebmFieldIds: {},
      storyPointsFieldCandidates: [],
    };
  }
}
