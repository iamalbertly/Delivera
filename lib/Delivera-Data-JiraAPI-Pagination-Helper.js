/**
 * SSOT for Jira API pagination (startAt, maxResults, isLast, values/issues).
 * Use from discovery (boards), sprints, and issues to avoid duplicate pagination logic.
 */

/**
 * Fetches all pages from a Jira-style paginated API.
 * @param {(startAt: number, maxResults: number) => Promise<{ values?: Array, issues?: Array, isLast?: boolean, total?: number }>} fetcher - Called per page
 * @param {{ maxResults?: number, maxPages?: number }} options - maxResults (default 50), maxPages (default 100)
 * @returns {Promise<{ items: Array, stoppedByMaxPages: boolean }>} - items and whether pagination stopped due to maxPages
 */
export async function paginateJira(fetcher, options = {}) {
  const { maxResults = 50, maxPages = 100 } = options;
  const all = [];
  let startAt = 0;
  let isLast = false;
  let pageCount = 0;

  while (!isLast && pageCount < maxPages) {
    const response = await fetcher(startAt, maxResults);
    const chunk = response.values ?? response.issues ?? [];
    all.push(...chunk);
    if (response.isLast !== undefined) {
      isLast = response.isLast;
    } else if (response.total !== undefined) {
      isLast = startAt + maxResults >= response.total;
    } else {
      isLast = chunk.length === 0 || chunk.length < maxResults;
    }
    startAt += maxResults;
    pageCount++;
  }

  return { items: all, stoppedByMaxPages: pageCount >= maxPages && !isLast };
}
