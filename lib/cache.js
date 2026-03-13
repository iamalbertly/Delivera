import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { appEnvConfig, redisEnvConfig } from './Jira-Reporting-App-Config-Env-Services-Core-SSOT.js';

function normalizeProjectKeys(projects = []) {
  return Array.from(
    new Set(
      (Array.isArray(projects) ? projects : [])
        .map((project) => String(project || '').trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();
}

function normalizeIsoDateDay(rawDate) {
  if (!rawDate) return '';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeIssueTypes(issueTypes = []) {
  return Array.from(
    new Set((Array.isArray(issueTypes) ? issueTypes : []).map((type) => String(type || '').trim()).filter(Boolean))
  ).sort();
}

function normalizePredictabilityMode(includePredictability, predictabilityMode) {
  if (!includePredictability) return 'none';
  const candidate = String(predictabilityMode || '').trim().toLowerCase();
  return candidate === 'strict' ? 'strict' : 'approx';
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '{}';
  }
}

function buildPreviewWindowScope(startDay, endDay) {
  const startDate = new Date(startDay);
  const endDate = new Date(endDay);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'unknown';
  const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays <= 31) return 'short';
  if (rangeDays <= 90) return 'quarter';
  if (rangeDays <= 180) return 'half';
  return 'long';
}

export const CACHE_TTL = {
  FIELD_IDS: 60 * 60 * 1000, // 60 minutes
  BOARDS: 30 * 60 * 1000, // 30 minutes
  SPRINTS: 30 * 60 * 1000, // 30 minutes
  SPRINT_ISSUES: 20 * 60 * 1000, // 20 minutes
  BUG_ISSUES: 20 * 60 * 1000, // 20 minutes
  SUBTASK_ISSUES: 20 * 60 * 1000, // 20 minutes
  EPIC_ISSUES: 60 * 60 * 1000, // 60 minutes
  PREVIEW: 45 * 60 * 1000, // 45 minutes
  PREVIEW_PARTIAL: 15 * 60 * 1000, // 15 minutes
  CURRENT_SPRINT_SNAPSHOT: 2 * 60 * 60 * 1000, // 2 hours
  LEADERSHIP_HUD_SUMMARY: 90 * 60 * 1000, // 90 minutes
};

export const CACHE_KEYS = {
  discoveryBoards(projectKeys) {
    return `discovery:boards:projects:${normalizeProjectKeys(projectKeys).join(',')}`;
  },
  discoveryFields() {
    return 'discovery:fields:all';
  },
  boardsByProject(projectKey) {
    return `boards:${String(projectKey || '').trim().toUpperCase()}`;
  },
  sprintsByBoard(boardId) {
    return `sprints:board:${Number(boardId) || 0}`;
  },
  sprintIssues({
    sprintId,
    selectedProjects,
    requireResolvedBySprintEnd = false,
    sprintEndDate = '',
    allowedIssueTypes = ['Story'],
    includeSubtaskTotals = false,
    fieldIds = null,
  } = {}) {
    const ebmFields = fieldIds?.ebmFieldIds || {};
    const normalizedEndDate = normalizeIsoDateDay(sprintEndDate);
    return [
      'sprintIssues',
      `sprint:${Number(sprintId) || 0}`,
      `projects:${normalizeProjectKeys(selectedProjects).join(',')}`,
      `resolvedBySprintEnd:${requireResolvedBySprintEnd ? '1' : '0'}`,
      `sprintEnd:${normalizedEndDate || 'na'}`,
      `types:${normalizeIssueTypes(allowedIssueTypes).join(',')}`,
      `subtasks:${includeSubtaskTotals ? '1' : '0'}`,
      `ebm:${safeJsonStringify(ebmFields)}`,
    ].join('|');
  },
  sprintIssuesTransparency({ sprintId, selectedProjects, allowedIssueTypes = ['Story', 'Bug'], fieldIds = null } = {}) {
    const ebmFields = fieldIds?.ebmFieldIds || {};
    return [
      'sprintIssuesTransparency',
      `sprint:${Number(sprintId) || 0}`,
      `projects:${normalizeProjectKeys(selectedProjects).join(',')}`,
      `types:${normalizeIssueTypes(allowedIssueTypes).join(',')}`,
      `ebm:${safeJsonStringify(ebmFields)}`,
    ].join('|');
  },
  bugIssues({ sprintId, selectedProjects, fieldIds = null } = {}) {
    const ebmFields = fieldIds?.ebmFieldIds || {};
    return [
      'bugIssues',
      `sprint:${Number(sprintId) || 0}`,
      `projects:${normalizeProjectKeys(selectedProjects).join(',')}`,
      `ebm:${safeJsonStringify(ebmFields)}`,
    ].join('|');
  },
  epicIssue(epicKey) {
    return `epicIssue:${String(epicKey || '').trim().toUpperCase()}`;
  },
  subtaskTotalsByParent(parentKey) {
    return `subtaskTotals:parent:${String(parentKey || '').trim().toUpperCase()}`;
  },
  subtaskTotalsUnsupportedFlag() {
    return 'subtaskTotals:unsupported';
  },
  preview({
    selectedProjects,
    windowStart,
    windowEnd,
    includeStoryPoints,
    requireResolvedBySprintEnd,
    includeBugsForRework,
    includePredictability,
    predictabilityMode,
    includeEpicTTM,
    includeActiveOrMissingEndDateSprints,
  } = {}) {
    const normalizedProjects = normalizeProjectKeys(selectedProjects);
    const startDay = normalizeIsoDateDay(windowStart);
    const endDay = normalizeIsoDateDay(windowEnd);
    const mode = normalizePredictabilityMode(includePredictability, predictabilityMode);
    const windowScope = buildPreviewWindowScope(startDay, endDay);
    const criticalConfig = {
      p: normalizedProjects,
      ws: startDay,
      we: endDay,
      wc: windowScope,
      rse: requireResolvedBySprintEnd ? 1 : 0,
      pred: mode,
      aom: includeActiveOrMissingEndDateSprints ? 1 : 0,
      sp: includeStoryPoints === false ? 0 : 1,
      rw: includeBugsForRework === false ? 0 : 1,
      et: includeEpicTTM === false ? 0 : 1,
    };
    return `preview:v2:${safeJsonStringify(criticalConfig)}`;
  },
  currentSprintSnapshot({ boardId, sprintId = null, projectKeys = [], completionAnchor = 'resolution' } = {}) {
    const normalizedAnchor = ['resolution', 'lastsubtask', 'statusdone'].includes(String(completionAnchor).toLowerCase())
      ? String(completionAnchor).toLowerCase()
      : 'resolution';
    const normalizedSprint = sprintId == null || Number.isNaN(Number(sprintId)) ? 'current' : Number(sprintId);
    return [
      'currentSprintSnapshot:v2',
      `board:${Number(boardId) || 0}`,
      `sprint:${normalizedSprint}`,
      `projects:${normalizeProjectKeys(projectKeys).join(',')}`,
      `anchor:${normalizedAnchor}`,
    ].join('|');
  },
  leadershipHudSummary(projectKeys) {
    return `leadership:hud:summary:projects:${normalizeProjectKeys(projectKeys).join(',')}`;
  },
};

class UnifiedCache {
  constructor() {
    this.memory = new Map();
    this.namespaceMetrics = new Map();
    this.backend = 'memory';
    this.instanceId = appEnvConfig.instanceId;
    this.redisClient = null;
    this.redisReady = false;
    this.backendInitPromise = null;
    this.scanEnabled = redisEnvConfig.enableRemoteScan;
  }

  inferNamespace(cacheKey = '', explicitNamespace = '') {
    if (explicitNamespace) return explicitNamespace;
    const key = String(cacheKey || '');
    if (!key) return 'unknown';
    return key.split(':')[0].split('|')[0] || 'unknown';
  }

  getNamespaceMetrics(namespace) {
    if (!this.namespaceMetrics.has(namespace)) {
      this.namespaceMetrics.set(namespace, {
        namespace,
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
      });
    }
    return this.namespaceMetrics.get(namespace);
  }

  touchMetric(namespace, field) {
    const metrics = this.getNamespaceMetrics(namespace);
    metrics[field] += 1;
  }

  normalizeMemoryEntry(entry, key) {
    if (!entry || typeof entry.expiresAt !== 'number') {
      this.memory.delete(key);
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry;
  }

  setMemoryEntry(key, entry) {
    this.memory.set(key, entry);
  }

  async ensureBackend() {
    if (this.backendInitPromise) return this.backendInitPromise;
    this.backendInitPromise = this.initBackend();
    return this.backendInitPromise;
  }

  async initBackend() {
    const wantsRedis = redisEnvConfig.cacheBackend === 'redis' || redisEnvConfig.redisUrlProvided;
    if (!wantsRedis) {
      this.backend = 'memory';
      return;
    }
    try {
      const redisModule = await import('redis');
      const redisUrl = redisEnvConfig.redisUrl;
      const client = redisModule.createClient({ url: redisUrl });
      client.on('error', (error) => {
        this.redisReady = false;
        logger.warn('Redis cache client error, falling back to memory cache', { error: error.message });
      });
      await client.connect();
      this.redisClient = client;
      this.redisReady = true;
      this.backend = 'redis+memory';
      logger.info('Shared cache backend ready', {
        backend: this.backend,
        redisUrl,
        instanceId: this.instanceId,
      });
    } catch (error) {
      this.backend = 'memory';
      this.redisClient = null;
      this.redisReady = false;
      logger.warn('Redis unavailable, using in-memory cache only', { error: error.message });
    }
  }

  async get(key, options = {}) {
    await this.ensureBackend();
    const namespace = this.inferNamespace(key, options.namespace);
    const memoryEntry = this.normalizeMemoryEntry(this.memory.get(key), key);
    if (memoryEntry) {
      this.touchMetric(namespace, 'hits');
      return memoryEntry;
    }

    if (this.redisReady && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
            this.setMemoryEntry(key, parsed);
            this.touchMetric(namespace, 'hits');
            return parsed;
          }
          await this.redisClient.del(key).catch(() => {});
        }
      } catch (error) {
        this.touchMetric(namespace, 'errors');
        logger.warn('Cache read error', { key, namespace, backend: this.backend, error: error.message });
      }
    }

    this.touchMetric(namespace, 'misses');
    return null;
  }

  async set(key, value, ttlMs, options = {}) {
    await this.ensureBackend();
    const namespace = this.inferNamespace(key, options.namespace);
    const now = Date.now();
    const safeTtl = Math.max(1000, Number(ttlMs) || 1000);
    const entry = {
      value,
      cachedAt: now,
      expiresAt: now + safeTtl,
      namespace,
      backend: this.backend,
      instanceId: this.instanceId,
    };
    this.setMemoryEntry(key, entry);
    this.touchMetric(namespace, 'sets');

    if (this.redisReady && this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(entry), { PX: safeTtl });
      } catch (error) {
        this.touchMetric(namespace, 'errors');
        logger.warn('Cache write error', { key, namespace, backend: this.backend, error: error.message });
      }
    }
    return entry;
  }

  async delete(key, options = {}) {
    await this.ensureBackend();
    const namespace = this.inferNamespace(key, options.namespace);
    this.memory.delete(key);
    this.touchMetric(namespace, 'deletes');
    if (this.redisReady && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        this.touchMetric(namespace, 'errors');
        logger.warn('Cache delete error', { key, namespace, backend: this.backend, error: error.message });
      }
    }
  }

  async clear() {
    await this.ensureBackend();
    this.memory.clear();
    if (this.redisReady && this.redisClient) {
      try {
        await this.redisClient.flushDb();
      } catch (error) {
        logger.warn('Cache clear error', { backend: this.backend, error: error.message });
      }
    }
  }

  async has(key, options = {}) {
    const entry = await this.get(key, options);
    return !!entry;
  }

  async entries({ namespace } = {}) {
    await this.ensureBackend();
    const now = Date.now();
    const resultMap = new Map();

    for (const [key, entry] of this.memory.entries()) {
      const normalized = this.normalizeMemoryEntry(entry, key);
      if (!normalized) continue;
      if (namespace && this.inferNamespace(key, normalized.namespace) !== namespace) continue;
      resultMap.set(key, normalized);
    }

    if (this.redisReady && this.redisClient && this.scanEnabled) {
      try {
        const pattern = namespace ? `${namespace}*` : '*';
        for await (const key of this.redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
          if (resultMap.has(key)) continue;
          const raw = await this.redisClient.get(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= now) continue;
          if (namespace && this.inferNamespace(key, parsed.namespace) !== namespace) continue;
          resultMap.set(key, parsed);
          this.setMemoryEntry(key, parsed);
        }
      } catch (error) {
        logger.warn('Cache entries scan error', { namespace: namespace || 'all', error: error.message });
      }
    }

    return Array.from(resultMap.entries());
  }

  async invalidateByPrefix(prefix) {
    await this.ensureBackend();
    if (!prefix) return 0;
    let deleted = 0;

    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
        deleted += 1;
      }
    }

    if (this.redisReady && this.redisClient && this.scanEnabled) {
      try {
        for await (const key of this.redisClient.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
          await this.redisClient.del(key);
          deleted += 1;
        }
      } catch (error) {
        logger.warn('Cache prefix invalidation error', { prefix, error: error.message });
      }
    }

    return deleted;
  }

  async invalidateCurrentSprintSnapshot({ boardId = null } = {}) {
    if (boardId == null) {
      return this.invalidateByPrefix('currentSprintSnapshot:v2|');
    }
    return this.invalidateByPrefix(`currentSprintSnapshot:v2|board:${Number(boardId) || 0}|`);
  }

  getMetricsSnapshot() {
    const namespaces = Array.from(this.namespaceMetrics.values())
      .map((entry) => {
        const lookups = entry.hits + entry.misses;
        const hitRate = lookups === 0 ? null : Number((entry.hits / lookups).toFixed(4));
        return { ...entry, lookups, hitRate };
      })
      .sort((a, b) => (b.lookups || 0) - (a.lookups || 0));

    return {
      backend: this.backend,
      redisReady: this.redisReady,
      instanceId: this.instanceId,
      namespaceCount: namespaces.length,
      namespaces,
    };
  }
}

export const cache = new UnifiedCache();

export function buildCurrentSprintSnapshotCacheKey({ boardId, sprintId = null, projectKeys = [], completionAnchor = 'resolution' } = {}) {
  return CACHE_KEYS.currentSprintSnapshot({ boardId, sprintId, projectKeys, completionAnchor });
}
