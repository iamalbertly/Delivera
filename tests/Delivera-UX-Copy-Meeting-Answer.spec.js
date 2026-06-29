import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  mockGovernancePage,
  waitForGovernanceReady,
  clickLegacy,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';

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
  await mockGovernancePage(page, { brief: COPY_BRIEF });
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
}

test('copy meeting answer has no technical labels', async ({ page, context }) => {
  await mockCopyAnswerPage(page);
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await waitForGovernanceReady(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const copyBtn = page.locator('#gov-copy-answer-scope');
  await expect(copyBtn).toBeAttached({ timeout: 15000 });
  await clickLegacy(page, '#gov-copy-answer-scope');
  await expect(copyBtn).toHaveText(/Copied/i, { timeout: 5000 });
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('at risk');
  expect(text).not.toMatch(/narrated by|Brief ID|template/i);
});
