import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';

test.describe.configure({ mode: 'serial' });

const DMS_GOVERNANCE = '/governance?spotlight=SD&view=squad';
const EXPECTED_EXCEPTIONS = ['AMS2', 'BIO', 'MAS', 'MPSA', 'MVA', 'TRS', 'VB'];

async function visibleIssueKeys(page) {
  return page.locator('main a[href*="/browse/"]:visible').evaluateAll((links) => (
    links.map((link) => link.textContent.trim()).filter((text) => /^[A-Z0-9]+-\d+$/.test(text))
  ));
}

test.describe('Delivera customer speed and trust release', () => {
  test('1 governance renders one FY27 context and one canonical sprint truth', async ({ page }) => {
    const started = Date.now();
    await loginIfRequired(page, DMS_GOVERNANCE, { rootSelector: '[data-testid="governance-active-loop"]' });
    const usefulMs = Date.now() - started;
    const root = page.locator('[data-testid="governance-active-loop"]');
    await expect(root).toHaveAttribute('data-fiscal-period', 'FY27 Q2');
    await expect(root.locator('[data-loop-squad]')).toHaveCount(1);
    const sprintCopies = await page.locator('#gov-squad-spotlight').getByText(/FY27DMS06 is active, 3 days remaining\./).count();
    expect(sprintCopies).toBeGreaterThan(0);
    expect(await page.locator('#gov-squad-spotlight').getByText(/12 days remaining/).count()).toBe(0);
    expect(usefulMs).toBeLessThan(10_000);
  });

  test('2 DMS selection stays isolated across Answer, Today, Actions, and Proof', async ({ page }) => {
    await loginIfRequired(page, DMS_GOVERNANCE, { rootSelector: '[data-testid="governance-active-loop"]' });
    expect(await page.locator('[data-loop-squad]').count()).toBe(1);
    await page.goto('/current-sprint?squad=SD');
    await page.locator('.sprint-today-hero').waitFor({ state: 'visible' });
    expect((await visibleIssueKeys(page)).every((key) => key.startsWith('SD-'))).toBe(true);
    await page.goto('/actions?squad=SD');
    await expect(page.locator('[data-actions-root], main')).toContainText('Showing SD actions only');
    await page.goto('/report?squad=SD');
    await expect(page).toHaveURL(/squad=SD/);
  });

  test('3 rebaseline carries six visible promises, squad, and period into review', async ({ page }) => {
    await loginIfRequired(page, DMS_GOVERNANCE, { rootSelector: '[data-rebaseline="1"]' });
    await page.locator('[data-rebaseline="1"]').click();
    const drawer = page.locator('.gov-right-drawer-panel:visible');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('FY27 Q2');
    await expect(drawer.locator('[data-candidate]')).toHaveCount(6);
    await expect(drawer).toContainText(/DMS|SD/);
  });

  test('4 registry policy exposes exactly seven global pending-consent squads', async ({ page }) => {
    await loginIfRequired(page, '/settings', { rootSelector: '#gov-settings-registry-mount' });
    const registry = await page.evaluate(async () => (await fetch('/api/governance/registry.json')).json());
    const pending = registry.squads
      .filter((squad) => squad.participationState === 'pending-consent')
      .map((squad) => squad.squadKey)
      .sort();
    expect(pending).toEqual(EXPECTED_EXCEPTIONS);
    await expect(page.locator('.registry-band').filter({ hasText: 'Participation exceptions' }).locator('[data-registry-squad]')).toHaveCount(7);
  });

  test('5 Actions groups repeated corrections and keeps the DMS return lane', async ({ page }) => {
    await loginIfRequired(page, '/actions?squad=SD', { rootSelector: 'main' });
    await expect(page.locator('main')).toContainText('6 promises share this correction');
    const evidence = page.getByRole('link', { name: 'Open squad evidence', exact: true });
    await expect(evidence).toHaveAttribute('href', /spotlight=SD/);
    await expect(page.locator('main')).toContainText('Owner route missing');
  });

  test('6 Current Sprint exposes ranked value without prerequisite buttons', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint?squad=SD', { rootSelector: '.sprint-today-hero' });
    await expect(page.locator('.sprint-today-hero')).toContainText('Main blocker:');
    await expect(page.locator('.sprint-today-hero')).toContainText(/Who to chase:|Owner:/);
    await expect(page.getByRole('button', { name: 'Filter work', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Focus: Blockers', exact: true })).toHaveCount(0);
    expect((await visibleIssueKeys(page)).every((key) => key.startsWith('SD-'))).toBe(true);
  });

  test('7 responsive shell has no horizontal overflow or header/drawer collision', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await loginIfRequired(page, DMS_GOVERNANCE, { rootSelector: '[data-testid="governance-active-loop"]' });
    const audit = await page.evaluate(() => {
      const drawer = document.querySelector('.gov-right-drawer-panel:not([hidden])');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chromeHeight: document.querySelector('.app-top-chrome')?.getBoundingClientRect().height || 0,
        drawerTop: drawer?.getBoundingClientRect().top ?? null,
        shortTargets: [...document.querySelectorAll('.app-top-chrome a, .app-top-chrome button')]
          .filter((node) => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return style.display !== 'none' && style.visibility !== 'hidden'
              && box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
          }).length,
      };
    });
    expect(audit.overflow).toBeLessThanOrEqual(1);
    expect(audit.shortTargets).toBe(0);
    if (audit.drawerTop != null) expect(audit.drawerTop).toBeGreaterThanOrEqual(audit.chromeHeight);
  });

  test('8 degraded refresh preserves cached truth and credential-prone fields stay blank', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint?squad=SD', { rootSelector: '.sprint-today-hero' });
    await page.route('**/api/current-sprint.json**', (route) => route.abort('failed'));
    await page.reload();
    await expect(page.locator('.sprint-today-hero, [data-snapshot-state]')).toContainText(/Sprint|verified|refresh/i);
    await page.goto('/settings');
    await page.locator('#gov-settings-registry-mount').waitFor({ state: 'visible' });
    const unsafe = await page.locator('input[name="reason"], input[name="productOwner"], input[name="scrumMaster"], input[type="password"]').evaluateAll((inputs) => (
      inputs.filter((input) => input.value || !['off', 'new-password'].includes(input.autocomplete)).length
    ));
    expect(unsafe).toBe(0);
  });
});
