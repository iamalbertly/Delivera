import { test, expect } from '@playwright/test';

/**
 * Validates Fix 1: Spotlight "Save baseline" button opens the PI Baseline Wizard.
 * Mocks a governance brief with a squad whose nextAction.action === 'set-baseline'.
 * Clicks the spotlight button and asserts the wizard drawer opens.
 */

const MOCK_BRIEF = {
  answer: 'Test squad needs baseline.',
  sourceLine: 'Compared with test contract · 1 promise checked',
  deliveraDid: 'Delivera matched the contract to Jira.',
  missionHeader: 'Test PI contract governance',
  verifiedAt: new Date().toISOString(),
  freshness: { state: 'calm' },
  scope: { complete: true, verifiedSquads: 1, expectedSquads: 1 },
  contract: null,
  decisionCoverage: { closed: 0, total: 1, preparedOwnerAsks: 1 },
  squads: [{
    squad: 'TEST',
    displayName: 'Test Squad',
    attentionCount: 1,
    topState: 'Cannot verify',
    contractState: { label: 'Cannot verify' },
    sprintReality: { state: 'unverified' },
    sprintCadence: { label: 'Unverified' },
    trustFactor: { label: 'Limited, baseline missing' },
    baselineCoverage: { state: 'missing', sourceLabel: 'Baseline missing', copy: 'Baseline missing.' },
    nextAction: { action: 'set-baseline', label: 'Save baseline to compare' },
    proofState: 'Evidence unverified',
    workSplit: { unknownPct: 100, explanation: 'Cannot classify.' },
    doingInstead: { copy: 'No major diversion is proven.' },
  }],
  promises: [],
  lensSummaries: { overall: 'Test squad needs attention.' },
  excludedOperationalGroups: [],
};

test.describe('Governance baseline wiring', () => {
  test('spotlight Save baseline button opens the wizard', async ({ page }) => {
    await page.route('**/api/governance-brief.json*', (route) => {
      route.fulfill({ json: MOCK_BRIEF });
    });
    await page.route('**/api/governance/squads/*/detail.json*', (route) => {
      route.fulfill({ json: { squad: MOCK_BRIEF.squads[0], promises: [], currentWork: [], sprintReality: { copy: 'No sprint evidence.' } } });
    });
    await page.route('**/api/governance/profile*', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('**/api/boards.json*', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/governance/pi-baseline/propose*', (route) => {
      route.fulfill({ json: { method: 'board-cache', candidates: [], unmatched: [], aiContributed: false, guidance: 'Upload a slide.' } });
    });

    await page.goto('http://localhost:3001/governance?spotlight=TEST&view=squad', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.gov-spotlight-readout', { timeout: 10000 });

    // The "Next safe action" should be a button with data-setup-baseline-ssot
    const baselineBtn = page.locator('[data-setup-baseline-ssot]').first();
    await expect(baselineBtn).toBeVisible({ timeout: 5000 });
    await expect(baselineBtn).toContainText('Save baseline to compare');

    // Click it — should open the wizard drawer
    await baselineBtn.click();
    const drawer = page.locator('.gov-right-drawer-panel:visible');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    // The wizard should mention slide upload
    await expect(drawer).toContainText(/upload|slide|PI plan/i, { timeout: 5000 });
  });
});
