/**
 * Batched catalog access refresh (Jira board probe per key).
 */
import { readCatalogKeys } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import { createAgileClient } from './jiraClients.js';
import { discoverBoardsWithCache } from './server-utils.js';
import { jiraEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';
import { isSystemBusy } from './server-utils.js';
import { logger } from './Delivera-Server-Logging-Utility.js';
import { readProjectsAccessIndex, upsertAccessRow } from './Delivera-Shared-Projects-Access-01Index-SSOT.js';

const BATCH_SIZE = 4;
let refreshCursor = 0;
let refreshInFlight = false;

export async function refreshProjectsAccessBatch({ userId = 'system', forceAll = false } = {}) {
  if (refreshInFlight) return { skipped: true, reason: 'in-flight' };
  if (!jiraEnvConfig.host || !jiraEnvConfig.email || !jiraEnvConfig.apiToken) {
    return { skipped: true, reason: 'no-jira-env' };
  }
  if (!forceAll && isSystemBusy()) return { skipped: true, reason: 'busy' };

  const catalog = readCatalogKeys();
  if (!catalog.length) return { checked: 0 };

  refreshInFlight = true;
  const agileClient = createAgileClient();
  const existing = await readProjectsAccessIndex();
  const staleMs = 6 * 3600 * 1000;
  const now = Date.now();

  let pool = catalog;
  if (!forceAll) {
    pool = catalog.filter((key) => {
      const row = existing.find((r) => r.projectKey === key);
      if (!row?.lastChecked) return true;
      return now - new Date(row.lastChecked).getTime() > staleMs;
    });
    if (!pool.length) pool = catalog;
  }

  const slice = [];
  const requestedCount = forceAll ? pool.length : Math.min(BATCH_SIZE, pool.length);
  for (let i = 0; i < requestedCount; i++) {
    const idx = (refreshCursor + i) % pool.length;
    slice.push(pool[idx]);
  }
  refreshCursor = (refreshCursor + requestedCount) % pool.length;

  let checked = 0;
  const results = [];
  try {
    for (const key of slice) {
      try {
        const { boards, projectErrors = [] } = await discoverBoardsWithCache([key], agileClient);
        const errors = projectErrors.filter((row) => String(row?.projectKey || '').toUpperCase() === key);
        if (errors.length && boards.length === 0) {
          const errorCode = String(errors[0]?.code || errors[0]?.error || 'JIRA_PROBE_FAILED');
          await upsertAccessRow(key, null, userId, { errorCode });
          results.push({ projectKey: key, state: 'degraded', boardCount: 0, errorCode });
          checked += 1;
          continue;
        }
        await upsertAccessRow(key, boards.length > 0, userId, { boardCount: boards.length });
        results.push({ projectKey: key, state: boards.length ? 'verified' : 'no-board', boardCount: boards.length });
        checked += 1;
      } catch (err) {
        await upsertAccessRow(key, null, userId, { errorCode: err?.code || 'JIRA_PROBE_FAILED' });
        results.push({ projectKey: key, state: 'degraded', boardCount: 0, errorCode: err?.code || 'JIRA_PROBE_FAILED' });
        logger.warn('project access check failed', { projectKey: key, error: err?.message });
      }
    }
  } finally {
    refreshInFlight = false;
  }
  return { checked, keys: slice, results };
}
