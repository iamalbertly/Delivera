export const appEnvConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
};

export const jiraEnvConfig = {
  host: process.env.JIRA_HOST || '',
  email: process.env.JIRA_EMAIL || '',
  apiToken: process.env.JIRA_API_TOKEN || '',
};

export const redisEnvConfig = {
  cacheBackend: (process.env.CACHE_BACKEND || '').toLowerCase(),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
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

