import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

test('stale data shows plain English minutes warning', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
  });
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
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
    }),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"quarters":[]}' }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }),
  }));
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await expect(page.locator('.gov-trust-chip-row')).toContainText(/Stale 37m|37 minutes|Refresh before/i);
});
