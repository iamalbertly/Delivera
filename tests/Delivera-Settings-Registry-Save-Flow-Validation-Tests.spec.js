import { test, expect } from '@playwright/test';

/**
 * Validates Fixes 9-13: Settings save flow.
 * - Auto-suggests participation (PI-governed) + pre-fills reason
 * - Uses in-app drawer preview (not native confirm())
 * - Broadcasts registry version via localStorage
 */

const MOCK_REGISTRY = {
  version: 3,
  updatedAt: new Date().toISOString(),
  squads: [
    { squadKey: 'MPSA', friendlyName: 'M-SQUAD', participationState: 'pending-consent', productOwner: null, scrumMaster: null, streamLead: null, boardMapping: [], revision: 1, suggestions: { boardMapping: [], people: [] } },
    { squadKey: 'MAS', friendlyName: 'Mini - Apps Squad', participationState: 'pending-consent', productOwner: null, scrumMaster: null, streamLead: null, boardMapping: [], revision: 1, suggestions: { boardMapping: [], people: [] } },
    { squadKey: 'FIN', friendlyName: 'Finance Squad', participationState: 'pi-governed', productOwner: { displayName: 'Jane Doe' }, scrumMaster: { displayName: 'John Smith' }, streamLead: null, boardMapping: [], revision: 1, suggestions: { boardMapping: [], people: [] } },
  ],
  auditHistory: [],
};

test.describe('Settings registry save flow', () => {
  test('auto-suggests participation and pre-fills reason after selecting pending', async ({ page }) => {
    await page.route('**/api/governance/registry.json*', (route) => {
      route.fulfill({ json: MOCK_REGISTRY });
    });

    await page.goto('http://localhost:3001/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-select-pending]', { timeout: 10000 });

    // Click "Select pending consent"
    await page.locator('[data-select-pending]').click();

    // Wait for auto-suggest to kick in
    await page.waitForTimeout(500);

    // Participation should be auto-suggested to "pi-governed"
    const participationSelect = page.locator('[data-bulk-participation]');
    await expect(participationSelect).toHaveValue('pi-governed');

    // Reason should be pre-filled
    const reasonInput = page.locator('[data-bulk-reason]');
    await expect(reasonInput).toHaveValue('Onboarding into PI governance');

    // Preview button should be enabled
    const previewBtn = page.locator('[data-bulk-preview]');
    await expect(previewBtn).toBeEnabled();
  });

  test('uses in-app drawer preview instead of native confirm()', async ({ page }) => {
    let confirmCalled = false;
    await page.route('**/api/governance/registry.json*', (route) => {
      route.fulfill({ json: MOCK_REGISTRY });
    });
    await page.route('**/api/governance/registry', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({ json: { ...MOCK_REGISTRY, version: 4, receipt: { id: 'test-receipt' } } });
      } else {
        route.fulfill({ json: MOCK_REGISTRY });
      }
    });

    // Intercept native confirm to detect if it's called
    page.on('dialog', () => { confirmCalled = true; });

    await page.goto('http://localhost:3001/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-select-pending]', { timeout: 10000 });

    await page.locator('[data-select-pending]').click();
    await page.waitForTimeout(500);

    // Click "Preview and apply"
    await page.locator('[data-bulk-preview]').click();

    // Should open an in-app drawer (not native confirm)
    const drawer = page.locator('.gov-right-drawer-panel:visible');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    expect(confirmCalled).toBe(false);

    // Click "Apply" in the drawer
    await page.locator('[data-bulk-apply]').click();

    // Should broadcast registry version via localStorage
    const version = await page.evaluate(() => localStorage.getItem('delivera:registry-version'));
    expect(version).toBeTruthy();
  });
});
