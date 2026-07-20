import { test, expect } from '@playwright/test';

/**
 * Validates Fix 18: Spotlight renders instantly from cached brief data.
 * No "Loading squad story…" text should appear.
 */

const MOCK_BRIEF = {
  answer: 'Test squad needs attention.',
  sourceLine: 'Compared with test contract · 1 promise checked',
  deliveraDid: 'Delivera matched the contract to Jira.',
  missionHeader: 'Test PI contract governance',
  verifiedAt: new Date().toISOString(),
  freshness: { state: 'calm' },
  scope: { complete: true, verifiedSquads: 1, expectedSquads: 1 },
  contract: { source: 'test' },
  decisionCoverage: { closed: 0, total: 1, preparedOwnerAsks: 1 },
  squads: [{
    squad: 'TEST',
    displayName: 'Test Squad',
    attentionCount: 1,
    topState: 'Needs attention',
    contractState: { label: 'Needs attention' },
    sprintReality: { state: 'active', daysRemaining: 5, sprint: { name: 'Sprint 1' } },
    sprintCadence: { label: 'Active' },
    trustFactor: { label: 'Limited' },
    baselineCoverage: { state: 'verified', sourceLabel: 'Approved' },
    nextAction: { label: 'Review evidence' },
    proofState: 'Fresh',
    workSplit: { unknownPct: 0, explanation: 'No diversion.' },
    doingInstead: { copy: 'No diversion.' },
  }],
  promises: [],
  lensSummaries: { overall: 'Test squad needs attention.' },
  excludedOperationalGroups: [],
};

test.describe('Governance loading state extermination', () => {
  test('spotlight renders instantly without Loading squad story', async ({ page }) => {
    await page.route('**/api/governance-brief.json*', (route) => {
      route.fulfill({ json: MOCK_BRIEF });
    });
    // Delay the detail.json response to simulate slow fetch
    await page.route('**/api/governance/squads/*/detail.json*', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({ json: { squad: MOCK_BRIEF.squads[0], promises: [], currentWork: [], sprintReality: { copy: 'Active sprint.' } } });
    });
    await page.route('**/api/boards.json*', (route) => route.fulfill({ json: [] }));

    await page.goto('http://localhost:3001/governance?spotlight=TEST&view=squad', { waitUntil: 'domcontentloaded' });

    // The spotlight should render within 500ms (from cache, not the 2s-delayed fetch)
    await page.waitForSelector('.gov-spotlight-readout', { timeout: 5000 });

    // "Loading squad story…" should NOT appear
    const loadingText = page.locator('text=Loading squad story');
    await expect(loadingText).toHaveCount(0);

    // The spotlight should show the squad name
    await expect(page.locator('.gov-spotlight-head h2')).toContainText('Test Squad');
  });
});
