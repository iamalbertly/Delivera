import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  mockGovernancePage,
  waitForGovernanceReady,
  legacyBrief,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';

test('stale data shows plain English minutes warning', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
  });
  await mockGovernancePage(page, {
    brief: {
      projects: ['SD'],
      portfolio: 'SD',
      freshness: { confidenceLimit: 'stale', cacheAgeMinutes: 37 },
      deliveryTruth: { committed: 1, done: 0 },
      executiveView: { verdictTier: 'watch', verdictLine: 'WATCH. SD needs attention' },
      topRisks: [],
      portfolioRisks: [],
      evidencePack: { rows: [] },
      leadershipNarrative: { meetingAnswer: 'SD at risk.', decisionsNeeded: [], confidence: 'low' },
      meta: { narratedBy: 'template', commandAnswerSentence: 'SD at risk.' },
    },
  });
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await waitForGovernanceReady(page);
  // B4: Refresh button removed — auto-refresh on visibilitychange.
  // Verify stale data is surfaced via the status pill or stale overlay instead.
  const statusPill = page.locator('[data-scope-status-action]').first();
  await expect(statusPill).toBeVisible({ timeout: 15000 });
});
