import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import UserRoles from 'supertokens-node/recipe/userroles';
import Dashboard from 'supertokens-node/recipe/dashboard';
import { middleware as supertokensMiddleware, errorHandler as supertokensErrorHandler } from 'supertokens-node/framework/express';
import { appEnvConfig, superTokensEnvConfig } from './Jira-Reporting-App-Config-Env-Services-Core-SSOT.js';

const SUPERTOKENS_ENABLED = superTokensEnvConfig.enabled;
const SUPERTOKENS_HYBRID_MODE = superTokensEnvConfig.hybridMode;
let initialized = false;

function getAppInfo(port) {
  const appName = superTokensEnvConfig.appName;
  const apiDomain = superTokensEnvConfig.apiDomain || `http://localhost:${port}`;
  const websiteDomain = superTokensEnvConfig.websiteDomain || `http://localhost:${port}`;
  const apiBasePath = superTokensEnvConfig.apiBasePath;
  const websiteBasePath = superTokensEnvConfig.websiteBasePath;
  return { appName, apiDomain, websiteDomain, apiBasePath, websiteBasePath };
}

export function initSuperTokens(port, logger) {
  if (!SUPERTOKENS_ENABLED || initialized) return false;

  const connectionURI = superTokensEnvConfig.connectionURI;
  const apiKey = superTokensEnvConfig.apiKey || undefined;

  supertokens.init({
    supertokens: {
      connectionURI,
      ...(apiKey ? { apiKey } : {}),
    },
    appInfo: getAppInfo(port),
    recipeList: [
      EmailPassword.init(),
      Session.init(),
      UserRoles.init(),
      Dashboard.init(),
    ],
  });

  initialized = true;
  if (logger && typeof logger.info === 'function') {
    logger.info('SuperTokens auth enabled', {
      connectionURI,
      hybridMode: SUPERTOKENS_HYBRID_MODE,
    });
  }
  return true;
}

export function isSuperTokensEnabled() {
  return SUPERTOKENS_ENABLED;
}

export function isSuperTokensHybridMode() {
  return SUPERTOKENS_HYBRID_MODE;
}

export function getSuperTokensExpressMiddleware() {
  if (!SUPERTOKENS_ENABLED) return null;
  return supertokensMiddleware();
}

export function getSuperTokensExpressErrorHandler() {
  if (!SUPERTOKENS_ENABLED) return null;
  return supertokensErrorHandler();
}

export async function getSuperTokensSessionIfPresent(req, res) {
  if (!SUPERTOKENS_ENABLED) return null;
  return Session.getSession(req, res, { sessionRequired: false });
}
