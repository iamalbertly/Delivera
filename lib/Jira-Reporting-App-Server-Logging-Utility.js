import { appEnvConfig } from './Jira-Reporting-App-Config-Env-Services-Core-SSOT.js';

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
      ...(error.cause && { cause: error.cause }),
      ...(error.statusCode && { statusCode: error.statusCode }),
      ...(error.code && { code: error.code }),
    };
  }
  return error;
}

export function buildLogContext(data = {}) {
  const out = { ...data };
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
      const dataStr = typeof data === 'object' ? JSON.stringify(buildLogContext(data), null, 2) : String(data);
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
