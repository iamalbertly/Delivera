import { test, expect } from '@playwright/test';

/**
 * Validates Fix 4: Quarter-hours-elapsed counter renders next to "Portfolio mission".
 * Asserts the .gov-quarter-pulse element contains a number + "working hours elapsed in Q".
 */

const MOCK_BRIEF = {
  answer: 'Portfolio is on track.',
  sourceLine: 'Compared with test contract · 1 promise checked',
  deliveraDid: 'Delivera matched the contract to Jira.',
  missionHeader: 'Test PI contract governance',
  verifiedAt: new Date().toISOString(),
  freshness: { state: 'calm' },
  scope: { complete: true, verifiedSquads: 1, expectedSquads: 1 },
  contract: { source: 'test' },
  decisionCoverage: { closed: 1, total: 1, preparedOwnerAsks: 1 },
  squads: [],
  promises: [],
  lensSummaries: { overall: 'All aligned.' },
  excludedOperationalGroups: [],
};

test.describe('Governance quarter pulse', () => {
  test('quarter pulse counter renders with working hours', async ({ page }) => {
    await page.route('**/api/governance-brief.json*', (route) => {
      route.fulfill({ json: MOCK_BRIEF });
    });
    await page.route('**/api/boards.json*', (route) => route.fulfill({ json: [] }));

    await page.goto('http://localhost:3001/governance', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-quarter-pulse]', { timeout: 10000 });

    const pulse = page.locator('[data-quarter-pulse]');
    await expect(pulse).toBeVisible();
    // Should contain a number and "working hours elapsed in Q"
    await expect(pulse).toContainText(/\d+\s+working hours elapsed in Q[1-4]/);
  });

  test('quarter pulse value is reasonable for current date', async ({ page }) => {
    await page.route('**/api/governance-brief.json*', (route) => {
      route.fulfill({ json: MOCK_BRIEF });
    });
    await page.route('**/api/boards.json*', (route) => route.fulfill({ json: [] }));

    await page.goto('http://localhost:3001/governance', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-quarter-pulse]', { timeout: 10000 });

    const pulse = page.locator('[data-quarter-pulse]');
    const text = await pulse.textContent();
    const match = text?.match(/(\d+)\s+working hours/);
    expect(match).toBeTruthy();
    const hours = Number(match[1]);
    // Q2 2026 started July 1. Today is July 20 = ~13 working days × 8 hours = ~104 hours
    // Allow a wide range to avoid flakiness across different test dates
    expect(hours).toBeGreaterThanOrEqual(8);
    expect(hours).toBeLessThanOrEqual(480);
  });
});
