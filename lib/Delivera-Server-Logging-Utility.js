import { appEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLogLevel = appEnvConfig.logLevel ?
  LOG_LEVELS[appEnvConfig.logLevel.toUpperCase()] || LOG_LEVELS.INFO :
  LOG_LEVELS.INFO;

function normalizeError(error) {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      ...(error.cause && { cause: {
        message: error.cause?.message || String(error.cause),
        code: error.cause?.code || null,
        status: error.cause?.response?.status || error.cause?.status || null,
      } }),
      ...(error.statusCode && { statusCode: error.statusCode }),
      ...(error.response?.status && { responseStatus: error.response.status }),
      ...(error.code && { code: error.code }),
    };
  }
  return error;
}

const SENSITIVE_LOG_KEY = /authorization|cookie|token|secret|password|api[-_]?key|credential/i;

function sanitizeForLog(value, depth = 0, seen = new WeakSet()) {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Error) return sanitizeForLog(normalizeError(value), depth + 1, seen);
  if (depth > 5) return '[truncated]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeForLog(item, depth + 1, seen));
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_LOG_KEY.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = sanitizeForLog(entry, depth + 1, seen);
  }
  return out;
}

export function buildLogContext(data = {}) {
  const out = sanitizeForLog({ ...data });
  if (out.userId == null && out.user && typeof out.user === 'object') {
    out.userId = out.user.id || out.user.userId || null;
  }
  delete out.user;
  return out;
}

/**
 * Format log message with timestamp and level
 */
function formatLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  
  let logLine = `[${timestamp}] ${levelStr} ${message}`;
  
  if (data !== null && data !== undefined) {
    try {
      const dataStr = typeof data === 'object' ? JSON.stringify(sanitizeForLog(buildLogContext(data)), null, 2) : String(data);
      logLine += `\n${dataStr}`;
    } catch (e) {
      logLine += `\n[Unable to serialize data: ${e.message}]`;
    }
  }
  
  return logLine;
}

/**
 * Logger object with level-specific methods
 */
export const logger = {
  debug(message, data = null) {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.debug(formatLog('debug', message, data));
    }
  },

  info(message, data = null) {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log(formatLog('info', message, data));
    }
  },

  warn(message, data = null) {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(formatLog('warn', message, data));
    }
  },

  error(message, error = null) {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error(formatLog('error', message, normalizeError(error)));
    }
  },
};

export function buildRequestLogContext(req, extra = {}) {
  return buildLogContext({
    requestId: req?.requestId || req?.headers?.['x-request-id'] || '',
    userId: req?.authUser?.id || req?.session?.user || '',
    boardId: req?.query?.boardId || req?.body?.boardId || extra.boardId || '',
    sprintId: req?.query?.sprintId || req?.body?.sprintId || extra.sprintId || '',
    method: req?.method || '',
    path: req?.originalUrl || req?.path || '',
    ...extra,
  });
}
