import { logger } from './Delivera-Server-Logging-Utility.js';

const SHUTDOWN_TIMEOUT_MS = 15000;
const LISTEN_RETRY_DELAYS_MS = [500, 1000, 1500, 2000, 2000];

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

    const forceTimer = setTimeout(() => {
      logger.warn('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

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

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
  process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));

  return gracefulShutdown;
}

/**
 * @param {import('http').Server | null | undefined} server
 * @param {(signal: string, exitCode?: number) => void | Promise<void>} gracefulShutdown
 */
export function registerFatalHandlers(server, gracefulShutdown) {
  let rejectionBurst = 0;
  let rejectionWindowStart = Date.now();

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error?.message, stack: error?.stack });
    gracefulShutdown('uncaughtException', 1);
  });

  // Non-fatal: log rejections and keep serving — prevents brief Jira/worker flakes from killing the site.
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const now = Date.now();
    if (now - rejectionWindowStart > 60_000) {
      rejectionBurst = 0;
      rejectionWindowStart = now;
    }
    rejectionBurst += 1;
    logger.error('Unhandled rejection (process kept alive)', {
      error: message,
      burst: rejectionBurst,
    });
    if (rejectionBurst >= 25) {
      logger.error('Unhandled rejection burst threshold exceeded — shutting down');
      gracefulShutdown('unhandledRejection', 1);
    }
  });
}
