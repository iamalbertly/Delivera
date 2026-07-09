/**
 * SSOT: Governance inbox + feedback summary API routes.
 */
import express from 'express';
import { requireAuth } from '../lib/middleware.js';
import { logger } from '../lib/Delivera-Server-Logging-Utility.js';
import {
  readPendingInboxItems,
  resolveInboxItem,
  groupInboxByType,
} from '../lib/Delivera-Governance-Worker-02Jobs-IO.js';
import { buildFeedbackTriageSummary } from '../lib/Delivera-Governance-FeedbackTriage-01Agents-SSOT.js';

const router = express.Router();

function parseProjectsParam(raw) {
  if (raw == null || raw === '') return [];
  return Array.from(new Set(String(raw).split(',').map((p) => p.trim().toUpperCase()).filter(Boolean)));
}

function primaryProject(projects) {
  return projects[0] || '';
}

router.get('/api/governance/inbox.json', requireAuth, async (req, res, next) => {
  try {
    const projects = parseProjectsParam(req.query.projects);
    const project = primaryProject(projects);
    const items = await readPendingInboxItems({ project: project || null, maxAgeHours: 168 });
    const grouped = groupInboxByType(items);
    const total = items.length;
    return res.json({
      ...grouped,
      total,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('governance inbox read failed', { error: err?.message });
    next(err);
  }
});

router.post('/api/governance/inbox/:id/resolve', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'missing-id' });
    const resolution = String(req.body?.resolution || 'dismissed').trim();
    const dismissReason = String(req.body?.dismissReason || '').trim();
    const editedContent = String(req.body?.editedContent || '').trim();
    const userId = String(req.session?.user?.id || req.body?.userId || 'unknown').trim();
    const updated = await resolveInboxItem(id, {
      resolution,
      dismissReason,
      editedContent,
      userId,
    });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    if (String(err?.message || '').includes('not found')) {
      return res.status(404).json({ ok: false, error: 'inbox-item-not-found' });
    }
    logger.warn('governance inbox resolve failed', { error: err?.message });
    next(err);
  }
});

router.get('/api/governance/feedback-summary.json', requireAuth, async (req, res, next) => {
  try {
    const projects = parseProjectsParam(req.query.projects);
    const project = primaryProject(projects);
    const summary = await buildFeedbackTriageSummary({ project });
    return res.json({
      ...summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('governance feedback-summary failed', { error: err?.message });
    next(err);
  }
});

export default router;
