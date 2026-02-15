
import express from 'express';
import { requireAuth, authEnabled, legacyAuthEnabled, superTokensEnabled, APP_LOGIN_USER, APP_LOGIN_PASSWORD } from '../lib/middleware.js';
import { logger } from '../lib/Jira-Reporting-App-Server-Logging-Utility.js';

const router = express.Router();
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const loginFailuresByIp = new Map(); // ip -> { count, resetAt }

// Login: first screen for unauthenticated users
router.get('/', (req, res) => {
    if (superTokensEnabled && !legacyAuthEnabled) return res.redirect('/auth');
    if (!authEnabled) return res.redirect('/report');
    if (req.session && req.session.user) return res.redirect(req.query.redirect || '/report');
    res.sendFile('login.html', { root: './public' });
});

router.get('/login', (req, res) => {
    if (superTokensEnabled && !legacyAuthEnabled) return res.redirect('/auth');
    if (!authEnabled) return res.redirect('/report');
    if (req.session && req.session.user) return res.redirect(req.query.redirect || '/report');
    res.sendFile('login.html', { root: './public' });
});

router.post('/login', (req, res) => {
    if (superTokensEnabled && !legacyAuthEnabled) return res.redirect('/auth');
    if (!authEnabled) return res.redirect('/report');
    const redirect = (req.body.redirect && req.body.redirect.startsWith('/')) ? req.body.redirect : '/report';
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
    res.sendFile('report.html', { root: './public' });
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
    res.sendFile('current-sprint.html', { root: './public' });
});

/**
 * GET /leadership - Executive HUD
 */
router.get('/leadership', requireAuth, (req, res) => {
    res.redirect('/report#trends');
});

// Legacy Redirect
router.get('/sprint-leadership', requireAuth, (req, res) => {
    res.redirect('/report#trends');
});

export default router;
