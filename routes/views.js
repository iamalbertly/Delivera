
import express from 'express';
import { requireAuth, authEnabled, legacyAuthEnabled, superTokensEnabled, APP_LOGIN_USER, APP_LOGIN_PASSWORD } from '../lib/middleware.js';
import { logger } from '../lib/Delivera-Server-Logging-Utility.js';
import { buildReportUrlFromContext, readReportContextFromSession } from '../lib/Delivera-User-Context-SSOT.js';
import { PUBLIC_DIR } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';

const PUBLIC_ROOT = PUBLIC_DIR;

const router = express.Router();
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const loginFailuresByIp = new Map(); // ip -> { count, resetAt }

const DEFAULT_APP_LANDING = '/governance';

function resolveExplicitRedirect(explicitRedirect = '') {
    const raw = String(explicitRedirect || '').trim();
    if (!raw || !raw.startsWith('/')) return '';
    if (raw.startsWith('/report')) return raw;
    if (raw.startsWith('/governance') || raw.startsWith('/brief')) return raw.startsWith('/brief') ? '/governance' : raw;
    if (raw.startsWith('/current-sprint') || raw.startsWith('/sprints')) return raw;
    if (raw.startsWith('/settings')) return raw;
    if (raw.startsWith('/evidence')) return raw;
    if (raw.startsWith('/dashboard') || raw.startsWith('/home')) return raw;
    return '';
}

function getPreferredAppRedirect(req, explicitRedirect = '') {
    const safeRedirect = resolveExplicitRedirect(explicitRedirect);
    if (safeRedirect) return safeRedirect;
    return buildReportUrlFromContext(readReportContextFromSession(req) || {}, DEFAULT_APP_LANDING);
}

/** @deprecated use getPreferredAppRedirect */
function getPreferredReportRedirect(req, explicitRedirect = '') {
    return getPreferredAppRedirect(req, explicitRedirect);
}

// Login: first screen for unauthenticated users
router.get('/', (req, res) => {
    if (superTokensEnabled && !legacyAuthEnabled) return res.redirect('/auth');
    if (!authEnabled) return res.redirect(getPreferredReportRedirect(req));
    if (req.session && req.session.user) return res.redirect(getPreferredReportRedirect(req, req.query.redirect));
    res.sendFile('login.html', { root: PUBLIC_ROOT });
});

router.get('/login', (req, res) => {
    if (superTokensEnabled && !legacyAuthEnabled) return res.redirect('/auth');
    if (!authEnabled) return res.redirect(getPreferredReportRedirect(req));
    if (req.session && req.session.user) return res.redirect(getPreferredReportRedirect(req, req.query.redirect));
    res.sendFile('login.html', { root: PUBLIC_ROOT });
});

router.post('/login', (req, res) => {
    if (superTokensEnabled && !legacyAuthEnabled) return res.redirect('/auth');
    if (!authEnabled) return res.redirect(DEFAULT_APP_LANDING);
    const redirect = getPreferredReportRedirect(req, req.body.redirect);
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let record = loginFailuresByIp.get(ip);
    if (record && now > record.resetAt) {
        loginFailuresByIp.delete(ip);
        record = null;
    }
    if (record && record.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
        logger.warn('Login rate limit exceeded', { ip });
        return res.redirect(`/login?redirect=${encodeURIComponent(redirect)}&error=invalid`);
    }
    const honeypot = (req.body.website || '').trim();
    if (honeypot) {
        logger.warn('Login honeypot filled, rejecting', { ip });
        return res.redirect(`/login?redirect=${encodeURIComponent(redirect)}&error=bot`);
    }
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    if (username !== APP_LOGIN_USER || password !== APP_LOGIN_PASSWORD) {
        if (!record) loginFailuresByIp.set(ip, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS });
        else record.count += 1;
        return res.redirect(`/login?redirect=${encodeURIComponent(redirect)}&error=invalid`);
    }
    loginFailuresByIp.delete(ip);
    req.session.user = username;
    req.session.lastActivity = Date.now();
    return res.redirect(redirect);
});

router.post('/logout', (req, res) => {
    if (req.session && typeof req.session.destroy === 'function') {
        req.session.destroy(() => {
            res.redirect('/login');
        });
        return;
    }
    res.redirect(superTokensEnabled && !legacyAuthEnabled ? '/auth' : '/login');
});

/**
 * GET /report - Serve the main report page (protected when auth enabled)
 */
router.get('/report', requireAuth, (req, res) => {
    res.sendFile('report.html', { root: PUBLIC_ROOT });
});

// Legacy alias — /home → /dashboard 301 (keep for bookmarks and nav history).
router.get('/home', requireAuth, (req, res) => {
    res.redirect(301, '/dashboard');
});

router.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile('home.html', { root: PUBLIC_ROOT });
});

// Legacy alias — /backlog-intake merged into /value-delivery (2025-05). Keep for bookmarks.
router.get('/backlog-intake', requireAuth, (req, res) => {
    res.redirect('/value-delivery');
});

// Legacy alias — /roadmap → /program-increment (2025-03). Keep for bookmarks.
router.get('/roadmap', requireAuth, (req, res) => {
    res.redirect('/program-increment');
});

router.get('/program-increment', requireAuth, (req, res) => {
    res.redirect(302, '/leadership');
});

router.get('/value-delivery', requireAuth, (req, res) => {
    res.redirect(302, '/report');
});

router.get('/risks-blockers', requireAuth, (req, res) => {
    res.redirect(302, '/current-sprint#stuck-card');
});

router.get('/teams', requireAuth, (req, res) => {
    res.redirect(302, '/current-sprint');
});

router.get('/settings', requireAuth, (req, res) => {
    res.sendFile('settings.html', { root: PUBLIC_ROOT });
});

router.get('/evidence', requireAuth, (req, res) => {
    const suffix = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(302, `/actions${suffix}`);
});

router.get('/impact', requireAuth, (req, res) => {
    const suffix = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(302, `/actions${suffix}`);
});

router.get('/actions', requireAuth, (req, res) => {
    res.sendFile('actions.html', { root: PUBLIC_ROOT });
});

router.get('/portfolio', requireAuth, (req, res) => {
    res.redirect(302, '/governance');
});

/**
 * GET /reports - backward-compatible alias for report page
 */
router.get('/reports', requireAuth, (req, res) => {
    const suffix = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/report${suffix}`);
});

/**
 * GET /current-sprint - Current sprint transparency page (squad view)
 */
router.get('/current-sprint', requireAuth, (req, res) => {
    res.sendFile('current-sprint.html', { root: PUBLIC_ROOT });
});

// Legacy alias — /sprints → /current-sprint (2025-01). Keep for bookmarks.
router.get('/sprints', requireAuth, (req, res) => {
    res.redirect('/current-sprint');
});

/**
 * GET /leadership - merged into Brief decision snapshot (bookmark-safe redirect)
 */
router.get('/leadership', requireAuth, (req, res) => {
    res.redirect(302, '/governance#portfolio-decision');
});

/**
 * GET /governance - Weekly Delivery Intelligence Brief (governance layer)
 */
router.get('/governance', requireAuth, (req, res) => {
    res.sendFile('governance.html', { root: PUBLIC_ROOT });
});

// Alias — /brief → /governance for memorable links.
router.get('/brief', requireAuth, (req, res) => {
    res.redirect('/governance');
});

// Legacy alias — /sprint-leadership → /leadership (2024-12). Keep for bookmarks.
router.get('/sprint-leadership', requireAuth, (req, res) => {
    res.redirect(302, '/governance#portfolio-decision');
});

export default router;
