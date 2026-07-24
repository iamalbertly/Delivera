import session from 'express-session';
import { cache } from './cache.js';
import { logger } from './Delivera-Server-Logging-Utility.js';

const SESSION_NAMESPACE = 'auth-session';
const DEFAULT_TTL_MS = 60 * 60 * 1000;

function sessionKey(sessionId) {
  return `${SESSION_NAMESPACE}:${String(sessionId || '')}`;
}

function sessionTtlMs(value) {
  const expiresAt = value?.cookie?.expires ? new Date(value.cookie.expires).getTime() : 0;
  if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return expiresAt - Date.now();
  return Number(value?.cookie?.maxAge) || DEFAULT_TTL_MS;
}

function complete(callback, error = null, value) {
  if (typeof callback === 'function') callback(error, value);
}

export class DeliveraLegacySessionRedisStore extends session.Store {
  get(sessionId, callback) {
    cache.get(sessionKey(sessionId), { namespace: SESSION_NAMESPACE })
      .then((entry) => complete(callback, null, entry?.value || null))
      .catch((error) => {
        logger.warn('Session read failed', { error: error.message });
        complete(callback, error);
      });
  }

  set(sessionId, value, callback) {
    cache.set(sessionKey(sessionId), value, sessionTtlMs(value), { namespace: SESSION_NAMESPACE })
      .then(() => complete(callback))
      .catch((error) => {
        logger.warn('Session write failed', { error: error.message });
        complete(callback, error);
      });
  }

  destroy(sessionId, callback) {
    cache.delete(sessionKey(sessionId), { namespace: SESSION_NAMESPACE })
      .then(() => complete(callback))
      .catch((error) => {
        logger.warn('Session delete failed', { error: error.message });
        complete(callback, error);
      });
  }

  touch(sessionId, value, callback) {
    this.set(sessionId, value, callback);
  }
}

export function createDeliveraLegacySessionStore() {
  return new DeliveraLegacySessionRedisStore();
}
