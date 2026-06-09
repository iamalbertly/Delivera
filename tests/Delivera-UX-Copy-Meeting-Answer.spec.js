import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

const COPY_BRIEF = {
  briefId: 'COPY-UX-TEST',
  projects: ['SD'],
  portfolio: 'SD',
  freshness: { confidenceLimit: 'live' },
  baselineComparison: { committed: 1 },
  executiveView: { verdictTier: 'watch', verdictLine: 'SD is at risk.' },
  deliveryTruth: { committed: 2, done: 0 },
  topRisks: [],
  portfolioRisks: [],
  meta: {
    commandAnswerSentence: 'SD is at risk.',
    safeToSend: true,
    setupGaps: [],
  },
  leadershipNarrative: {
    confidence: 'low',
    meetingAnswer: 'SD is at risk.',
    whatToSay: 'Confirm scope today.',
    decisionsNeeded: [],
  },
};

async function mockCopyAnswerPage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(COPY_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ total: 0 }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [] }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ total: 0 }),
  }));
}

test('copy meeting answer has no technical labels', async ({ page, context }) => {
  await mockCopyAnswerPage(page);
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await expect(page.locator('#gov-loading')).toBeHidden({ timeout: 15000 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const copyBtn = page.locator('#gov-copy-answer-scope');
  await expect(copyBtn).toBeVisible({ timeout: 15000 });
  await copyBtn.click();
  await expect(copyBtn).toHaveText(/Copied/i, { timeout: 5000 });
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('at risk');
  expect(text).not.toMatch(/narrated by|Brief ID|template/i);
});
