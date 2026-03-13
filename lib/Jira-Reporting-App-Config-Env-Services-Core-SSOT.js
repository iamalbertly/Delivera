import 'dotenv/config';

export const appEnvConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || 3000,
  instanceId: process.env.INSTANCE_ID || process.env.HOSTNAME || 'local-instance',
  logLevel: String(process.env.LOG_LEVEL || 'INFO').toUpperCase(),
  allowTestCacheClear: (process.env.NODE_ENV === 'test') || process.env.ALLOW_TEST_CACHE_CLEAR === '1',
};

export const jiraEnvConfig = {
  host: process.env.JIRA_HOST || '',
  email: process.env.JIRA_EMAIL || '',
  apiToken: process.env.JIRA_API_TOKEN || '',
};

export const redisEnvConfig = {
  cacheBackend: (process.env.CACHE_BACKEND || '').toLowerCase(),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  redisUrlProvided: Boolean(process.env.REDIS_URL),
  enableRemoteScan: process.env.CACHE_ENABLE_REMOTE_SCAN !== '0',
};

export const superTokensEnvConfig = {
  enabled: process.env.SUPERTOKENS_ENABLED === 'true',
  hybridMode: process.env.SUPERTOKENS_HYBRID_MODE !== 'false',
  connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
  apiKey: process.env.SUPERTOKENS_API_KEY || '',
  appName: process.env.SUPERTOKENS_APP_NAME || 'VodaAgileBoard',
  apiDomain: process.env.SUPERTOKENS_API_DOMAIN || '',
  websiteDomain: process.env.SUPERTOKENS_WEBSITE_DOMAIN || '',
  apiBasePath: process.env.SUPERTOKENS_API_BASE_PATH || '/auth',
  websiteBasePath: process.env.SUPERTOKENS_WEBSITE_BASE_PATH || '/auth',
};

export const legacySessionEnvConfig = {
  sessionSecret: process.env.SESSION_SECRET,
  loginUser: process.env.APP_LOGIN_USER,
  loginPassword: process.env.APP_LOGIN_PASSWORD,
  sessionIdleMs: Number(process.env.SESSION_IDLE_MS) || 30 * 60 * 1000,
};

function isLocalhostLike(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw.includes('localhost') || raw.includes('127.0.0.1');
}

function pushMissingEnv(errors, key, value, reason = 'is required') {
  if (!String(value || '').trim()) {
    errors.push(`${key} ${reason}`);
  }
}

export function getRuntimeModeLabel() {
  if (appEnvConfig.nodeEnv === 'test') return 'test';
  if (appEnvConfig.isProduction) return 'production';
  if (process.env.CI) return 'ci';
  return 'local';
}

export function validateRuntimeConfiguration() {
  const mode = getRuntimeModeLabel();
  const errors = [];
  const warnings = [];

  const legacyAuthConfigured = Boolean(
    legacySessionEnvConfig.sessionSecret
    && legacySessionEnvConfig.loginUser
    && legacySessionEnvConfig.loginPassword
  );

  if (!superTokensEnvConfig.enabled && !legacyAuthConfigured) {
    warnings.push('Authentication is disabled because neither legacy auth nor SuperTokens is fully configured.');
  }

  pushMissingEnv(errors, 'JIRA_HOST', jiraEnvConfig.host, 'is required for Jira-backed pages');
  pushMissingEnv(errors, 'JIRA_EMAIL', jiraEnvConfig.email, 'is required for Jira-backed pages');
  pushMissingEnv(errors, 'JIRA_API_TOKEN', jiraEnvConfig.apiToken, 'is required for Jira-backed pages');

  if (superTokensEnvConfig.enabled) {
    pushMissingEnv(errors, 'SUPERTOKENS_CONNECTION_URI', superTokensEnvConfig.connectionURI, 'is required when SuperTokens is enabled');
    pushMissingEnv(errors, 'SUPERTOKENS_API_DOMAIN', superTokensEnvConfig.apiDomain, 'is required when SuperTokens is enabled');
    pushMissingEnv(errors, 'SUPERTOKENS_WEBSITE_DOMAIN', superTokensEnvConfig.websiteDomain, 'is required when SuperTokens is enabled');
  }

  if (mode === 'production') {
    if (superTokensEnvConfig.enabled) {
      if (isLocalhostLike(superTokensEnvConfig.connectionURI)) {
        errors.push('SUPERTOKENS_CONNECTION_URI must not point to localhost in production');
      }
      if (isLocalhostLike(superTokensEnvConfig.apiDomain)) {
        errors.push('SUPERTOKENS_API_DOMAIN must not point to localhost in production');
      }
      if (isLocalhostLike(superTokensEnvConfig.websiteDomain)) {
        errors.push('SUPERTOKENS_WEBSITE_DOMAIN must not point to localhost in production');
      }
    }
    if (redisEnvConfig.cacheBackend === 'redis' && isLocalhostLike(redisEnvConfig.redisUrl)) {
      warnings.push('REDIS_URL points to localhost in production; verify this is intentional.');
    }
  }

  return {
    ok: errors.length === 0,
    mode,
    errors,
    warnings,
    summary: {
      authMode: superTokensEnvConfig.enabled
        ? (superTokensEnvConfig.hybridMode ? 'supertokens-hybrid' : 'supertokens')
        : (legacyAuthConfigured ? 'legacy-session' : 'disabled'),
      jiraHost: jiraEnvConfig.host || '',
      redisBackend: redisEnvConfig.cacheBackend || (redisEnvConfig.redisUrl ? 'redis-url' : 'memory'),
      superTokensApiDomain: superTokensEnvConfig.apiDomain || '',
      superTokensWebsiteDomain: superTokensEnvConfig.websiteDomain || '',
      instanceId: appEnvConfig.instanceId,
    },
  };
}
