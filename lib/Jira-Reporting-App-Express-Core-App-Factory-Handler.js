import express from 'express';
import session from 'express-session';
import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { authEnabled, legacyAuthEnabled, superTokensEnabled, APP_LOGIN_USER, APP_LOGIN_PASSWORD } from './middleware.js';
import { startSnapshotScheduler } from './snapshot-worker.js';
import { cache } from './cache.js';
import viewRoutes from '../routes/views.js';
import apiRoutes from '../routes/api.js';
import {
  initSuperTokens,
  getSuperTokensExpressMiddleware,
  getSuperTokensExpressErrorHandler,
} from './Jira-Reporting-App-Auth-SuperTokens-Provider.js';
import {
  appEnvConfig,
  jiraEnvConfig,
  legacySessionEnvConfig,
  validateRuntimeConfiguration,
} from './Jira-Reporting-App-Config-Env-Services-Core-SSOT.js';
import { buildRequestLogContext } from './Jira-Reporting-App-Server-Logging-Utility.js';

export function createJiraReportingExpressCoreApp({ port, enableBackgroundWorkers = false } = {}) {
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
  // Disable caching for JS modules in dev so module changes are picked up immediately
  // Prevents "does not provide export" errors when a file is updated but browser serves stale cache
  app.use((req, res, next) => {
    if (!appEnvConfig.isProduction && req.path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });
  app.use(express.static('public', { etag: !appEnvConfig.isProduction }));

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

  app.use('/', viewRoutes);
  app.use('/', apiRoutes);

  if (superTokensEnabled) {
    const stErrorHandler = getSuperTokensExpressErrorHandler();
    if (stErrorHandler) app.use(stErrorHandler);
  }

  app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
      ...buildRequestLogContext(req, { status: 500 }),
      error: err,
    });
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  if (enableBackgroundWorkers) {
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

    startSnapshotScheduler();
  }

  return app;
}
