import { test, expect } from '@playwright/test';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';

test.describe('DMS production write and cleanup gate', () => {
  test('Albert validates SD-5314 and always removes the temporary Jira comment', async ({ page }) => {
    test.skip(process.env.DELIVERA_RUN_DMS_WRITE_VALIDATION !== 'true', 'Real Jira write gate is explicitly opt-in.');
    test.setTimeout(180000);
    const runId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const commitSha = String(process.env.GITHUB_SHA || process.env.DELIVERA_RELEASE_ID || 'local').slice(0, 40);
    const truthHash = String(process.env.DELIVERA_VALIDATION_TRUTH_HASH || '000000000000000000000000').slice(0, 64);
    let activityId = '';

    await loginIfRequired(page, '/settings', { rootSelector: 'body.settings-page, #gov-settings-registry-mount', timeout: 30000 });

    const api = async (path, options = {}) => page.evaluate(async ({ path, options }) => {
      const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    }, { path, options });

    // Bounded janitor: clear only this actor's stale Delivera validation entries.
    const before = await api('/api/jira-activity?limit=100');
    for (const row of before.body.entries || []) {
      if (row.issueKey === 'SD-5314' && row.validationRunId && row.status !== 'undone') {
        const staleUndo = await api(`/api/jira-activity/${encodeURIComponent(row.id)}/undo`, { method: 'POST', body: '{}' });
        expect(staleUndo.status, `Preflight cleanup failed for ${row.id}`).toBeLessThan(300);
      }
    }

    try {
      const marker = `[Delivera validation:${runId}]`;
      const sent = await api('/api/issues/SD-5314/comment', {
        method: 'POST',
        body: JSON.stringify({
          squadKey: 'SD',
          validationRunId: runId,
          commitSha,
          truthHash,
          commentBody: `${marker} Release ${commitSha}; truth ${truthHash}; ${new Date().toISOString()}. Temporary automated validation—cleanup is mandatory.`,
        }),
      });
      expect(sent.status, JSON.stringify(sent.body)).toBe(200);
      expect(sent.body).toMatchObject({ success: true, validationRunId: runId, cleanupRequired: true, cleanupStatus: 'pending' });
      activityId = sent.body.activityId;
      expect(activityId).toBeTruthy();

      await page.goto('/settings');
      await expect(page.locator('body')).toContainText('SD-5314', { timeout: 15000 });
    } finally {
      if (activityId) {
        const undone = await api(`/api/jira-activity/${encodeURIComponent(activityId)}/undo`, { method: 'POST', body: '{}' });
        expect(undone.status, JSON.stringify(undone.body)).toBeLessThan(300);
        await expect.poll(async () => {
          const activity = await api('/api/jira-activity?limit=100');
          return activity.body.entries?.find((row) => row.id === activityId)?.cleanupStatus;
        }, { timeout: 30000 }).toBe('confirmed');
      }
    }
  });
});
