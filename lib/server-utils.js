
import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { cache, CACHE_TTL, CACHE_KEYS } from './cache.js';

const rateLimitRegistry = new Map(); // operation -> { cooldownUntil }
const recentActivityTimestamps = []; // timestamps for basic load heuristics

export function normalizeJiraHost(host) {
    if (!host) return '';
    const trimmed = String(host).trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function resolveJiraHostFromEnv() {
    return normalizeJiraHost(process.env.JIRA_HOST || '');
}

export async function retryOnRateLimit(fn, maxRetries = 3, operation = 'unknown') {
    const now = Date.now();
    const key = operation || 'unknown';
    const existing = rateLimitRegistry.get(key);

    if (existing && existing.cooldownUntil > now) {
        const remainingMs = existing.cooldownUntil - now;
        const err = new Error(`Rate limit cooldown in effect for ${key}`);
        err.code = 'RATE_LIMIT_COOLDOWN';
        err.operation = key;
        err.cooldownRemainingMs = remainingMs;
        throw err;
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const statusCode = error.statusCode ||
                error.cause?.response?.status ||
                error.response?.status ||
                (error.cause?.status);

            if (statusCode === 429) {
                const retryAfterHeader = error.cause?.response?.headers?.['retry-after'] ||
                    error.response?.headers?.['retry-after'] ||
                    Math.pow(2, attempt);
                const parsed = parseInt(retryAfterHeader, 10);
                const delaySecondsFromHeader = Number.isNaN(parsed) ? 0 : parsed;
                const delaySeconds = Math.min(delaySecondsFromHeader || Math.pow(2, attempt), 30);
                const delay = delaySeconds * 1000;
                const cooldownMs = Math.max(delay * 2, 10_000);
                rateLimitRegistry.set(key, { cooldownUntil: Date.now() + cooldownMs });

                if (attempt < maxRetries - 1) {
                    logger.warn(`Rate limited on ${operation}, retrying after ${delay}ms`, {
                        attempt: attempt + 1,
                        maxRetries,
                        operation,
                        statusCode,
                        retryAfter: delaySeconds,
                        cooldownMs,
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
            throw error;
        }
    }
}

export function recordActivity() {
    const now = Date.now();
    recentActivityTimestamps.push(now);
    const cutoff = now - 5 * 60 * 1000;
    while (recentActivityTimestamps.length && recentActivityTimestamps[0] < cutoff) {
        recentActivityTimestamps.shift();
    }
}

export function isSystemBusy() {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const recent = recentActivityTimestamps.filter(ts => now - ts <= windowMs);
    return recent.length > 10;
}

import { discoverBoardsForProjects, discoverFields } from './discovery.js';

export async function discoverBoardsWithCache(projectKeys, agileClient) {
    const key = CACHE_KEYS.discoveryBoards(projectKeys);
    const cached = await cache.get(key, { namespace: 'discovery' });
    const cachedBoards = cached?.value || cached;
    if (Array.isArray(cachedBoards)) return cachedBoards;

    const boards = await retryOnRateLimit(
        () => discoverBoardsForProjects(projectKeys, agileClient),
        3,
        'discoverBoards'
    );
    await cache.set(key, boards, Math.min(CACHE_TTL.BOARDS, 20 * 60 * 1000), { namespace: 'discovery' });
    return boards;
}

export async function discoverFieldsWithCache(version3Client) {
    const key = CACHE_KEYS.discoveryFields();
    const cached = await cache.get(key, { namespace: 'discovery' });
    const cachedFields = cached?.value || cached;
    if (cachedFields) return cachedFields;

    const fields = await retryOnRateLimit(
        () => discoverFields(version3Client),
        3,
        'discoverFields'
    );
    await cache.set(key, fields, CACHE_TTL.FIELD_IDS, { namespace: 'discovery' });
    return fields;
}
