import { cache, CACHE_TTL, CACHE_KEYS } from './cache.js';
import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { paginateJira } from './JiraReporting-Data-JiraAPI-Pagination-Helper.js';

/**
 * Discovers all boards for the given projects with pagination and deduplication
 * @param {string[]} projectKeys - Array of project keys (e.g., ['MPSA', 'MAS'])
 * @param {AgileClient} agileClient - Jira Agile client
 * @returns {Promise<Array>} - Array of unique boards
 */
export async function discoverBoardsForProjects(projectKeys, agileClient) {
  const allBoards = [];
  const boardIdSet = new Set();

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
      throw new Error(`Failed to fetch boards for project ${projectKey}: ${error.message}`);
    }

    // Cache the boards for this project
    await cache.set(cacheKey, projectBoards, CACHE_TTL.BOARDS, { namespace: 'boards' });
    allBoards.push(...projectBoards);
  }

  // Deduplicate by boardId
  const uniqueBoards = [];
  for (const board of allBoards) {
    if (!boardIdSet.has(board.id)) {
      boardIdSet.add(board.id);
      uniqueBoards.push(board);
    }
  }

  return uniqueBoards;
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
