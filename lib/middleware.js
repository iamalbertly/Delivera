import { logger } from './Delivera-Server-Logging-Utility.js';
import {
    isSuperTokensEnabled,
    isSuperTokensHybridMode,
    getSuperTokensSessionIfPresent,
} from './Delivera-Auth-SuperTokens-Provider.js';
import { legacySessionEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';

const SESSION_SECRET = legacySessionEnvConfig.sessionSecret;
const APP_LOGIN_USER = legacySessionEnvConfig.loginUser;
const APP_LOGIN_PASSWORD = legacySessionEnvConfig.loginPassword;
const testAuthDisabled = process.env.NODE_ENV === 'test'
    && process.env.DELIVERA_AUTH_DISABLED_FOR_TESTS === 'true';
const legacyAuthEnabled = !testAuthDisabled && Boolean(SESSION_SECRET && APP_LOGIN_USER && APP_LOGIN_PASSWORD);
const superTokensEnabled = isSuperTokensEnabled();
const authEnabled = legacyAuthEnabled || superTokensEnabled;
const SESSION_IDLE_MS = legacySessionEnvConfig.sessionIdleMs;

function buildAuthRedirectPath(req) {
    if (legacyAuthEnabled) return `/login?redirect=${encodeURIComponent(req.originalUrl)}`;
    return `/auth?redirectToPath=${encodeURIComponent(req.originalUrl)}`;
}

function unauthorizedApiPayload(code, provider) {
    return { error: 'Unauthorized', code, provider };
}

async function requireLegacySession(req, res, isApi) {
    if (!legacyAuthEnabled) return false;

    if (req.session && req.session.user) {
        const now = Date.now();
        const last = req.session.lastActivity || now;
        if (now - last > SESSION_IDLE_MS) {
            req.session.destroy(() => { });
            if (isApi) return res.status(401).json(unauthorizedApiPayload('SESSION_EXPIRED', 'legacy-session'));
            return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}&error=timeout`);
        }
        req.session.lastActivity = now;
        req.authUser = { id: req.session.user, via: 'legacy-session' };
        return true;
    }
    return false;
}

async function requireSuperTokensSession(req, res, isApi) {
    try {
        const session = await getSuperTokensSessionIfPresent(req, res);
        if (session) {
            req.authUser = { id: session.getUserId(), via: 'supertokens' };
            return true;
        }
    } catch (error) {
        logger.warn('SuperTokens session read failed', { error: error.message });
        if (isApi) {
            res.status(401).json(unauthorizedApiPayload('AUTH_PROVIDER_UNAVAILABLE', 'supertokens'));
            return false;
        }
        res.redirect(buildAuthRedirectPath(req));
        return false;
    }
    return false;
}

export async function requireAuth(req, res, next) {
    if (!authEnabled) return next();

    const isApi = req.path.startsWith('/api/')
        || req.path.endsWith('.json')
        || req.get('Accept')?.includes('application/json')
        || req.xhr;

    if (superTokensEnabled) {
        const hasSuperTokensSession = await requireSuperTokensSession(req, res, isApi);
        if (hasSuperTokensSession) return next();

        if (isSuperTokensHybridMode()) {
            const hasLegacySession = await requireLegacySession(req, res, isApi);
            if (hasLegacySession) return next();
        }

        if (isApi) return res.status(401).json(unauthorizedApiPayload('AUTH_REQUIRED', 'supertokens'));
        return res.redirect(buildAuthRedirectPath(req));
    }

    const hasLegacySession = await requireLegacySession(req, res, isApi);
    if (hasLegacySession) return next();
    if (isApi) return res.status(401).json(unauthorizedApiPayload('AUTH_REQUIRED', 'legacy-session'));
    return res.redirect(buildAuthRedirectPath(req));
}

export function isSuperAdminRequest(req) {
    if (!authEnabled && process.env.NODE_ENV !== 'production') return true;
    const userId = String(req.authUser?.id || req.session?.user || '').trim().toLowerCase();
    const configured = String(process.env.DELIVERA_SUPER_ADMIN_USERS || APP_LOGIN_USER || '')
        .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
    return Boolean(userId && configured.includes(userId));
}

export function requireSuperAdmin(req, res, next) {
    if (isSuperAdminRequest(req)) return next();
    return res.status(403).json({ error: 'Super-admin access is required for organization settings.', code: 'SUPER_ADMIN_REQUIRED' });
}

export { authEnabled, legacyAuthEnabled, superTokensEnabled, APP_LOGIN_USER, APP_LOGIN_PASSWORD };
