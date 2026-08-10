import { test, expect } from '@playwright/test';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';

/**
 * Validates Settings save flow + band exclusivity.
 * - Presets selection only; policy and rationale remain explicit
 * - Uses in-app drawer preview (not native confirm())
 * - Broadcasts registry version via localStorage
 * - Each squad appears in exactly one band
 */

const MOCK_REGISTRY = {
  version: 3,
  updatedAt: new Date().toISOString(),
  squads: [
    { squadKey: 'MPSA', friendlyName: 'M-SQUAD', participationState: 'pending-consent', productOwner: null, scrumMaster: null, streamLead: null, boardMapping: [], revision: 1, suggestions: { boardMapping: [], people: [] } },
    { squadKey: 'MAS', friendlyName: 'Mini - Apps Squad', participationState: 'pending-consent', productOwner: null, scrumMaster: null, streamLead: null, boardMapping: [], revision: 1, suggestions: { boardMapping: [], people: [] } },
    { squadKey: 'FIN', friendlyName: 'Finance Squad', participationState: 'pi-governed', productOwner: { displayName: 'Jane Doe' }, scrumMaster: { displayName: 'John Smith' }, streamLead: null, boardMapping: [], revision: 1, suggestions: { boardMapping: [], people: [] } },
    { squadKey: 'DMS', friendlyName: 'DMS Squad', participationState: 'pi-governed', productOwner: { displayName: 'Irene' }, scrumMaster: null, streamLead: null, boardMapping: [], revision: 1, suggestions: { boardMapping: [], people: [] } },
  ],
  auditHistory: [],
};

test.describe('Settings registry save flow', () => {
  test('pending preset is reversible and does not invent participation or reason', async ({ page }) => {
    await page.route('**/api/governance/registry.json*', (route) => {
      route.fulfill({ json: MOCK_REGISTRY });
    });

    await loginIfRequired(page, '/settings', { rootSelector: '#governance-registry-title, .registry-bulk' });
    await expect(page.locator('[data-select-pending]')).toBeVisible();
    await page.locator('[data-select-pending]').click();

    const participationSelect = page.locator('[data-bulk-participation]');
    await expect(participationSelect).toHaveValue('');
    const reasonInput = page.locator('[data-bulk-reason]');
    await expect(reasonInput).toHaveValue('');
    const previewBtn = page.locator('[data-bulk-preview]');
    await expect(previewBtn).toBeDisabled();
    await page.locator('[data-select-pending]').click();
    await expect(page.locator('[data-selected-count]')).toContainText('0 squads');
  });

  test('uses in-app drawer preview instead of native confirm()', async ({ page }) => {
    let confirmCalled = false;
    await page.route('**/api/governance/registry.json*', (route) => {
      route.fulfill({ json: MOCK_REGISTRY });
    });
    await page.route('**/api/governance/registry', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_REGISTRY, version: 4, receipt: { id: 'test-receipt' } }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_REGISTRY) });
    });

    page.on('dialog', () => { confirmCalled = true; });

    await loginIfRequired(page, '/settings', { rootSelector: '#governance-registry-title, .registry-bulk' });
    await expect(page.locator('[data-select-pending]')).toBeVisible();
    await page.locator('[data-select-pending]').click();
    await page.locator('[data-bulk-participation]').selectOption('pi-governed');
    await page.locator('[data-bulk-reason]').fill('Consent verified');
    await page.locator('[data-bulk-preview]').click();

    const drawer = page.locator('.gov-right-drawer-panel:visible');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    expect(confirmCalled).toBe(false);

    await page.locator('[data-bulk-apply]').click();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('delivera:registry-version'))).toBeTruthy();
  });

  test('single squad save also broadcasts registry version', async ({ page }) => {
    await page.route('**/api/governance/registry.json*', (route) => {
      route.fulfill({ json: MOCK_REGISTRY });
    });
    await page.route('**/api/governance/registry', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          json: {
            ...MOCK_REGISTRY,
            version: 5,
            squads: MOCK_REGISTRY.squads.map((item) => (
              item.squadKey === 'FIN'
                ? {
                    ...item,
                    scrumMaster: { displayName: 'John Updated' },
                    revision: 2,
                  }
                : item
            )),
            receipt: { id: 'single-save' },
          },
        });
        return;
      }
      route.fulfill({ json: MOCK_REGISTRY });
    });

    await loginIfRequired(page, '/settings', { rootSelector: '[data-registry-squad="FIN"]' });
    await page.locator('[data-registry-squad="FIN"] [data-registry-edit]').click();
    await page.locator('[data-registry-squad="FIN"] input[name="scrumMaster"]').fill('John Updated');
    await page.locator('[data-registry-squad="FIN"] input[name="reason"]').fill('Refresh owner route');
    await page.locator('[data-registry-squad="FIN"] button[type="submit"]').click();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('delivera:registry-version'))).toBe('5');
  });

  test('registry bands are mutually exclusive and owner gaps appear before healthy rows', async ({ page }) => {
    await page.route('**/api/governance/registry.json*', (route) => {
      route.fulfill({ json: MOCK_REGISTRY });
    });
    await loginIfRequired(page, '/settings', { rootSelector: '#gov-settings-registry-mount' });
    const bands = page.locator('.registry-band:not([data-registry-org-policy])');
    await expect(bands).toHaveCount(3);
    await expect(bands.nth(0)).toContainText('Participation exceptions');
    await expect(bands.nth(1)).toContainText('Owner-route gaps');
    await expect(bands.nth(2)).toContainText('Platform health');
    await expect(bands.nth(0).locator('[data-registry-squad="MPSA"]')).toHaveCount(1);
    await expect(bands.nth(0).locator('[data-registry-squad="MAS"]')).toHaveCount(1);
    await expect(bands.nth(1).locator('[data-registry-squad="DMS"]')).toHaveCount(1);
    await expect(bands.nth(2).locator('[data-registry-squad="FIN"]')).toHaveCount(1);
    const allKeys = await page.locator('[data-registry-squad]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-registry-squad')));
    expect(new Set(allKeys).size).toBe(allKeys.length);
    const bulkBox = await page.locator('.registry-bulk').boundingBox();
    const ownerGapBox = await bands.nth(1).boundingBox();
    expect(bulkBox?.y || 0).toBeLessThan(ownerGapBox?.y || 0);
  });
});
