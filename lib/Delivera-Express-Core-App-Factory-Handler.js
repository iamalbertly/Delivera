import express from 'express';
import session from 'express-session';
import { logger } from './Delivera-Server-Logging-Utility.js';
import { authEnabled, legacyAuthEnabled, superTokensEnabled, APP_LOGIN_USER, APP_LOGIN_PASSWORD } from './middleware.js';
import { startSnapshotScheduler } from './snapshot-worker.js';
import { startGovernanceWorker } from './Delivera-Governance-Worker-01Scheduler.js';
import { sweepStaleRunningJobs } from './Delivera-Governance-Worker-02Jobs-IO.js';
import { cache } from './cache.js';
import { electWorkerLeader, releaseWorkerLeadership } from './Delivera-Worker-Leader-01Lock.js';
import viewRoutes from '../routes/views.js';
import apiRoutes from '../routes/api.js';
import evidenceOsRoutes from '../routes/evidence-os.js';
import governanceInterventionRoutes from '../routes/governance-interventions.js';
import governanceInboxRoutes from '../routes/Delivera-Governance-Inbox-01Routes.js';
import {
  initSuperTokens,
  getSuperTokensExpressMiddleware,
  getSuperTokensExpressErrorHandler,
} from './Delivera-Auth-SuperTokens-Provider.js';
import {
  appEnvConfig,
  jiraEnvConfig,
  legacySessionEnvConfig,
  validateRuntimeConfiguration,
} from './Delivera-Config-Env-Services-Core-SSOT.js';
import { buildRequestLogContext } from './Delivera-Server-Logging-Utility.js';

export function createDeliveraExpressCoreApp({ port, enableBackgroundWorkers = false } = {}) {
  const PORT = port || appEnvConfig.port;
  const SESSION_SECRET = legacySessionEnvConfig.sessionSecret;
  const runtimeValidation = validateRuntimeConfiguration();

  if (!runtimeValidation.ok) {
    throw new Error(`Invalid runtime configuration: ${runtimeValidation.errors.join(' | ')}`);
  }

  runtimeValidation.warnings.forEach((warning) => logger.warn('Runtime configuration warning', { warning }));
  logger.info('Runtime configuration ready', runtimeValidation.summary);

  if (appEnvConfig.nodeEnv === 'production' && SESSION_SECRET && (!APP_LOGIN_USER || !APP_LOGIN_PASSWORD) && !superTokensEnabled) {
    logger.warn('SESSION_SECRET is set but APP_LOGIN_USER/APP_LOGIN_PASSWORD are missing; auth middleware will remain disabled until both login env vars are configured.');
  }

  const app = express();

  app.use((req, res, next) => {
    req.requestId = req.get('x-request-id') || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const requestStartedAt = Date.now();
    res.setHeader('x-request-id', req.requestId);
    res.on('finish', () => {
      logger.info('HTTP request completed', buildRequestLogContext(req, {
        status: res.statusCode,
        durationMs: Date.now() - requestStartedAt,
      }));
    });
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));
  // This application serves non-fingerprinted module URLs. Vercel preserves old
  // file timestamps, so conditional caching can validate an unchanged root
  // module while leaving its changed dependency graph stale. That is why local
  // UAT and production previously disagreed after a successful deployment.
  // Correctness wins here: HTML, JS, and CSS are small and must represent one
  // atomic release. Images/fonts can still use normal static caching.
  app.use((req, res, next) => {
    const acceptsHtml = String(req.get('accept') || '').includes('text/html');
    if (acceptsHtml || /\.(html|js|css)$/i.test(req.path)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  if (legacyAuthEnabled) {
    app.use(session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: 'vodaagileboard.sid',
      cookie: { httpOnly: true, secure: appEnvConfig.isProduction, sameSite: 'lax', maxAge: 60 * 60 * 1000 },
    }));
  }

  if (superTokensEnabled) {
    initSuperTokens(PORT, logger);
    const stMiddleware = getSuperTokensExpressMiddleware();
    if (stMiddleware) app.use(stMiddleware);
  }

  // API before static HTML/views so /api/* is never shadowed by public/ assets and always hits Express handlers.
  app.use('/', evidenceOsRoutes);
  app.use('/', governanceInterventionRoutes);
  app.use('/', governanceInboxRoutes);
  app.use('/', apiRoutes);
  app.use('/', viewRoutes);
  app.use(express.static('public', { etag: false, lastModified: false }));

  if (superTokensEnabled) {
    const stErrorHandler = getSuperTokensExpressErrorHandler();
    if (stErrorHandler) app.use(stErrorHandler);
  }

  app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
      ...buildRequestLogContext(req, { status: 500 }),
      error: err,
    });
    const safeMessage = appEnvConfig.isProduction
      ? 'Unexpected server failure'
      : (err && err.message ? err.message : 'Unexpected server failure');
    res.status(500).json({
      error: 'Internal server error',
      message: safeMessage,
    });
  });

  return app;
}

/**
 * Start background workers after HTTP bind succeeds (leader-elected when multi-instance).
 * @param {{ port?: number }} [options]
 */
export async function startBackgroundWorkers({ port } = {}) {
  const PORT = port || appEnvConfig.port;
  const hasHost = !!jiraEnvConfig.host;
  const hasEmail = !!jiraEnvConfig.email;
  const hasToken = !!jiraEnvConfig.apiToken;

  if (hasHost && hasEmail && hasToken) {
    logger.info('Jira credentials loaded', {
      host: jiraEnvConfig.host,
      emailPrefix: `${jiraEnvConfig.email.substring(0, 3)}***`,
    });
  } else {
    logger.warn('Missing Jira credentials for background workers');
  }

  logger.info('Initializing cache backend and snapshot scheduler', { port: PORT });
  cache.ensureBackend().catch((error) => {
    logger.warn('Cache backend initialization failed, continuing with memory fallback', { error: error.message });
  });

  try {
    const swept = await sweepStaleRunningJobs({ maxAgeMinutes: 15 });
    if (swept > 0) {
      logger.info('Recovered stale governance jobs on startup', { count: swept });
    }
  } catch (error) {
    logger.warn('Stale governance job sweep failed', { error: error?.message });
  }

  await electWorkerLeader({
    onBecomeLeader: async () => {
      startSnapshotScheduler();
      startGovernanceWorker();
    },
  });
}

export function stopBackgroundWorkers() {
  releaseWorkerLeadership();
}
