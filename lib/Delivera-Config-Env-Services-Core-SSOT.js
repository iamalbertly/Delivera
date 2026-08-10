import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __configDir = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(__configDir, '..');
export const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
export const DELIVERA_CLIENT_RELEASE_SCHEMA = '20260730a';
const ROOT_DOTENV_PATH = join(PROJECT_ROOT, '.env');

if (existsSync(ROOT_DOTENV_PATH)) {
  const loaded = dotenv.config({ path: ROOT_DOTENV_PATH });
  if (!loaded.error && loaded.parsed) {
    try {
      process.env.DELIVERA_DOTENV_PATH = ROOT_DOTENV_PATH;
    } catch (_) {}
  }
}
dotenv.config();

function trimEnvValue(raw) {
  if (raw == null) return '';
  return String(raw).replace(/^\uFEFF/, '').trim();
}

function readDevPortFile() {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const path = join(PROJECT_ROOT, '.delivera-dev-port');
    if (!existsSync(path)) return null;
    const n = Number(readFileSync(path, 'utf8').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (_) {
    return null;
  }
}

const deploymentReleaseId = trimEnvValue(
  process.env.DELIVERA_RELEASE_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.RENDER_GIT_COMMIT
  || process.env.GITHUB_SHA,
);
const localBootReleaseId = `${DELIVERA_CLIENT_RELEASE_SCHEMA}-${Date.now().toString(36)}`;

export const appEnvConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || readDevPortFile() || 3001,
  instanceId: process.env.INSTANCE_ID || process.env.HOSTNAME || 'local-instance',
  logLevel: String(process.env.LOG_LEVEL || 'INFO').toUpperCase(),
  allowTestCacheClear: (process.env.NODE_ENV === 'test') || process.env.ALLOW_TEST_CACHE_CLEAR === '1',
  releaseId: (deploymentReleaseId || (
    (process.env.NODE_ENV || 'development') === 'production'
      ? DELIVERA_CLIENT_RELEASE_SCHEMA
      : localBootReleaseId
  )).slice(0, 40),
};

export const jiraEnvConfig = {
  host: trimEnvValue(process.env.JIRA_HOST),
  email: trimEnvValue(process.env.JIRA_EMAIL),
  apiToken: trimEnvValue(process.env.JIRA_API_TOKEN),
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
  appName: process.env.SUPERTOKENS_APP_NAME || 'Delivera',
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

function resolveDefaultAiProvider() {
  const explicit = trimEnvValue(process.env.AI_PROVIDER).toLowerCase();
  if (explicit) return explicit;
  if (trimEnvValue(process.env.OPENROUTER_API_KEY)) return 'openrouter';
  return 'built-in';
}

export const DELIVERA_CHEAP_CAPABLE_OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite';

export const aiProviderEnvConfig = {
  defaultProvider: resolveDefaultAiProvider(),
  claudeApiKey: trimEnvValue(process.env.ANTHROPIC_API_KEY),
  openaiApiKey: trimEnvValue(process.env.OPENAI_API_KEY),
  geminiApiKey: trimEnvValue(process.env.GOOGLE_API_KEY),
  openrouterApiKey: trimEnvValue(process.env.OPENROUTER_API_KEY),
  ollamaHost: trimEnvValue(process.env.OLLAMA_HOST) || 'http://localhost:11434',
  openrouterModelDefault: trimEnvValue(process.env.OPENROUTER_MODEL_DEFAULT) || DELIVERA_CHEAP_CAPABLE_OPENROUTER_MODEL,
  openrouterModelGovernance: trimEnvValue(process.env.OPENROUTER_MODEL_GOVERNANCE),
  openrouterModelVision: trimEnvValue(process.env.OPENROUTER_MODEL_VISION),
  openrouterModelSimpleCopy: trimEnvValue(process.env.OPENROUTER_MODEL_SIMPLE_COPY),
  openrouterModelFeedback: trimEnvValue(process.env.OPENROUTER_MODEL_FEEDBACK),
  openrouterModelPiOcr: trimEnvValue(process.env.OPENROUTER_MODEL_PI_OCR) || 'baidu/qianfan-ocr-fast:free',
  openrouterModelPiVision: trimEnvValue(process.env.OPENROUTER_MODEL_PI_VISION) || 'qwen/qwen2.5-vl-32b-instruct:free',
  openrouterModelPiReconcile: trimEnvValue(process.env.OPENROUTER_MODEL_PI_RECONCILE) || 'google/gemma-4-31b-it:free',
  openrouterModelPiEmergency: trimEnvValue(process.env.OPENROUTER_MODEL_PI_EMERGENCY) || 'openrouter/free',
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

  const emailLocal = !jiraEnvConfig.email
    ? '(not set)'
    : (jiraEnvConfig.email.includes('@')
      ? `${jiraEnvConfig.email.split('@')[0].slice(0, 3)}***`
      : '***');

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
      jiraEmailPrefix: emailLocal,
      jiraApiTokenLength: jiraEnvConfig.apiToken.length,
      jiraDotenvPath: process.env.DELIVERA_DOTENV_PATH || '',
      redisBackend: redisEnvConfig.cacheBackend || (redisEnvConfig.redisUrl ? 'redis-url' : 'memory'),
      superTokensApiDomain: superTokensEnvConfig.apiDomain || '',
      superTokensWebsiteDomain: superTokensEnvConfig.websiteDomain || '',
      instanceId: appEnvConfig.instanceId,
    },
  };
}
