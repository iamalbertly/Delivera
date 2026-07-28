import { logger } from './Delivera-Server-Logging-Utility.js';

const LISTEN_RETRY_DELAYS_MS = [500, 1000, 1500, 2000, 2000];
const SHUTDOWN_TIMEOUT_MS = 15000;
const FAST_SHUTDOWN_TIMEOUT_MS = 4000;

/**
 * Recoverable request races must not kill the whole process (Customer / Speed & Trust).
 * @param {unknown} reason
 */
export function isRecoverableRejection(reason) {
  const err = reason instanceof Error ? reason : null;
  const code = err?.code || reason?.code || '';
  const message = err?.message || String(reason || '');
  if (code === 'ERR_HTTP_HEADERS_SENT') return true;
  if (/Cannot set headers after they are sent/i.test(message)) return true;
  if (/ECONNRESET|EPIPE|ERR_STREAM_WRITE_AFTER_END/i.test(message) || /ECONNRESET|EPIPE/.test(String(code))) {
    return true;
  }
  return false;
}

function shouldFatalOnRecoverable() {
  return String(process.env.DELIVERA_FATAL_ON_HEADERS_SENT || '').trim() === '1';
}

/**
 * Bind HTTP with EADDRINUSE retry (nodemon restarts on Windows).
 * @param {import('express').Application} app
 * @param {number} port
 * @returns {Promise<import('http').Server>}
 */
export async function listenWithRetry(app, port) {
  const maxAttempts = LISTEN_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const server = await new Promise((resolve, reject) => {
        const srv = app.listen(port, () => resolve(srv));
        srv.once('error', reject);
      });
      return server;
    } catch (err) {
      if (err?.code !== 'EADDRINUSE' || attempt >= maxAttempts) {
        if (err?.code === 'EADDRINUSE') {
          logger.error('Port already in use after retries. Stop the other process or set PORT=...', {
            port,
            code: err.code,
            attempts: attempt,
          });
        }
        throw err;
      }

      const delayMs = LISTEN_RETRY_DELAYS_MS[attempt - 1] || 2000;
      logger.warn('Port in use, retrying listen', { port, attempt, delayMs });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Failed to bind port ${port}`);
}

/**
 * @param {import('http').Server | null | undefined} server
 * @param {{ onShutdown?: () => void | Promise<void> }} [options]
 */
export function registerGracefulShutdown(server, options = {}) {
  let shuttingDown = false;

  async function gracefulShutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Graceful shutdown started', { signal });

    const connections = typeof server?.getConnections === 'function'
      ? await new Promise((resolve) => {
        try {
          server.getConnections((err, count) => resolve(err ? null : count));
        } catch (_) {
          resolve(null);
        }
      })
      : null;
    const timeoutMs = connections === 0 ? FAST_SHUTDOWN_TIMEOUT_MS : SHUTDOWN_TIMEOUT_MS;

    const forceTimer = setTimeout(() => {
      logger.warn('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, timeoutMs);

    try {
      if (typeof options.onShutdown === 'function') {
        await options.onShutdown();
      }
    } catch (error) {
      logger.warn('Shutdown hook failed', { error: error?.message });
    }

    if (!server) {
      clearTimeout(forceTimer);
      process.exit(exitCode);
      return;
    }

    server.close((err) => {
      clearTimeout(forceTimer);
      if (err) {
        logger.warn('Error during server.close', { error: err.message });
        process.exit(1);
        return;
      }
      process.exit(exitCode);
    });
  }

  gracefulShutdown.isShuttingDown = () => shuttingDown;

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
  process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));

  return gracefulShutdown;
}

/**
 * @param {import('http').Server | null | undefined} server
 * @param {(signal: string, exitCode?: number) => void | Promise<void>} gracefulShutdown
 */
export function registerFatalHandlers(server, gracefulShutdown) {
  process.on('uncaughtException', (error) => {
    if (typeof gracefulShutdown?.isShuttingDown === 'function' && gracefulShutdown.isShuttingDown()) {
      logger.warn('Ignoring secondary uncaughtException during shutdown', { error: error?.message });
      return;
    }
    // Headers races can surface as uncaughtException on some Node versions — stay alive.
    if (isRecoverableRejection(error) && !shouldFatalOnRecoverable()) {
      logger.warn('Recoverable uncaughtException (headers/stream race) — continuing', {
        error: error?.message,
        code: error?.code,
      });
      return;
    }
    logger.error('Uncaught exception', { error: error?.message, stack: error?.stack });
    gracefulShutdown('uncaughtException', 1);
  });

  process.on('unhandledRejection', (reason) => {
    if (typeof gracefulShutdown?.isShuttingDown === 'function' && gracefulShutdown.isShuttingDown()) {
      logger.warn('Ignoring secondary unhandledRejection during shutdown', {
        error: reason instanceof Error ? reason.message : String(reason),
      });
      return;
    }
    const message = reason instanceof Error ? reason.message : String(reason);
    if (isRecoverableRejection(reason) && !shouldFatalOnRecoverable()) {
      logger.warn('Recoverable unhandledRejection (headers/stream race) — continuing', {
        error: message,
        code: reason?.code,
        env: process.env.NODE_ENV || 'development',
      });
      return;
    }
    logger.error('Unhandled rejection', { error: message });
    gracefulShutdown('unhandledRejection', 1);
  });
}
