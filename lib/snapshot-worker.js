
import { logger } from './Delivera-Server-Logging-Utility.js';
import { cache, CACHE_TTL, buildCurrentSprintSnapshotCacheKey } from './cache.js';
import { createAgileClient, createVersion3Client } from './jiraClients.js';
import { discoverBoardsWithCache, discoverFieldsWithCache, isSystemBusy } from './server-utils.js';
import { buildCurrentSprintPayload } from './currentSprint.js';
import { jiraEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';

const SNAPSHOT_DELAY_BETWEEN_BOARDS_MS = 2000;
const SNAPSHOT_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const FALLBACK_SNAPSHOT_PROJECTS = ['MPSA', 'MAS'];
const SNAPSHOT_MAX_PROJECTS = 10;
let snapshotRefreshInFlight = false;

/**
 * Discover which projects have been recently queried by inspecting in-memory
 * cache entries for preview and sprintIssues namespaces.  Falls back to
 * FALLBACK_SNAPSHOT_PROJECTS when no cache data is available yet.
 */
async function resolveSnapshotProjects() {
    const projectSet = new Set(FALLBACK_SNAPSHOT_PROJECTS);
    try {
        const entries = await cache.entries({ namespace: 'preview' });
        for (const [key] of entries) {
            // Key format: preview:v2:{"p":["MPSA","SD"],...}
            const match = key.match(/"p":\[([^\]]+)\]/);
            if (!match) continue;
            const keys = match[1].replace(/"/g, '').split(',').map((k) => k.trim()).filter(Boolean);
            for (const k of keys) {
                if (k && projectSet.size < SNAPSHOT_MAX_PROJECTS) projectSet.add(k);
            }
        }
    } catch (_) { /* entries scan is best-effort */ }
    return Array.from(projectSet);
}

async function refreshCurrentSprintSnapshots() {
    if (snapshotRefreshInFlight) {
        logger.info('Skipping current-sprint snapshot refresh because a prior cycle is still running');
        return;
    }
    snapshotRefreshInFlight = true;
    if (!jiraEnvConfig.host || !jiraEnvConfig.email || !jiraEnvConfig.apiToken) {
        snapshotRefreshInFlight = false;
        return;
    }
    try {
        if (isSystemBusy()) {
            logger.info('Skipping current-sprint snapshot refresh because system is busy');
            return;
        }

        const snapshotProjects = await resolveSnapshotProjects();
        const agileClient = createAgileClient();
        const version3Client = createVersion3Client();
        const { boards } = await discoverBoardsWithCache(snapshotProjects, agileClient);
        logger.debug('Current-sprint snapshot projects resolved', { projects: snapshotProjects, boardCount: boards.length });
        const fields = await discoverFieldsWithCache(version3Client);
        const fieldOpts = {
            storyPointsFieldId: fields.storyPointsFieldId,
            epicLinkFieldId: fields.epicLinkFieldId,
            ebmFieldIds: fields.ebmFieldIds || {},
        };
        for (const board of boards) {
            try {
                const projectKeys = board.location?.projectKey ? [board.location.projectKey] : snapshotProjects;
                const payload = await buildCurrentSprintPayload({
                    board: { id: board.id, name: board.name, location: board.location },
                    projectKeys,
                    agileClient,
                    fields: fieldOpts,
                });
                const snapshotKey = buildCurrentSprintSnapshotCacheKey({
                    boardId: board.id,
                    sprintId: null,
                    projectKeys,
                    completionAnchor: 'resolution',
                });
                await cache.set(snapshotKey, payload, CACHE_TTL.CURRENT_SPRINT_SNAPSHOT, { namespace: 'currentSprintSnapshot' });
                logger.debug('Current-sprint snapshot refreshed', { boardId: board.id, boardName: board.name });
            } catch (err) {
                logger.warn('Current-sprint snapshot refresh failed for board', { boardId: board.id, error: err.message });
            }
            await new Promise(r => setTimeout(r, SNAPSHOT_DELAY_BETWEEN_BOARDS_MS));
        }
        logger.info('Current-sprint snapshot refresh completed', { boardCount: boards.length });
    } catch (err) {
        logger.error('Current-sprint snapshot refresh failed', { error: err.message });
    } finally {
        snapshotRefreshInFlight = false;
    }
}

export function startSnapshotScheduler() {
    // Snapshot refresh: first run after 30s, then hourly
    setTimeout(() => refreshCurrentSprintSnapshots(), 30 * 1000);
    setInterval(() => refreshCurrentSprintSnapshots(), SNAPSHOT_REFRESH_INTERVAL_MS);
}
