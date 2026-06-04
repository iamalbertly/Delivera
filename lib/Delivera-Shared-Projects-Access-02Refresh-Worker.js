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
  if (isSystemBusy()) return { skipped: true, reason: 'busy' };

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
  for (let i = 0; i < BATCH_SIZE; i++) {
    const idx = (refreshCursor + i) % pool.length;
    slice.push(pool[idx]);
  }
  refreshCursor = (refreshCursor + BATCH_SIZE) % pool.length;

  let checked = 0;
  try {
    for (const key of slice) {
      try {
        const { boards } = await discoverBoardsWithCache([key], agileClient);
        await upsertAccessRow(key, boards.length > 0, userId);
        checked += 1;
      } catch (err) {
        await upsertAccessRow(key, false, userId);
        logger.warn('project access check failed', { projectKey: key, error: err?.message });
      }
    }
  } finally {
    refreshInFlight = false;
  }
  return { checked, keys: slice };
}
