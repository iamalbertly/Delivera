import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';
import {
  buildDeliveryTruthContext,
  buildDeliveryTruthProjection,
  toScopeTruth,
} from '../lib/Delivera-Governance-Delivery-Truth-01SSOT.js';

const registry = {
  version: 8,
  squads: [
    { squadKey: 'SD', friendlyName: 'DMS Squad', participationState: 'pi-governed', boardMapping: [230], revision: 4, productOwner: { displayName: 'Husna' }, scrumMaster: { displayName: 'Albert' } },
    { squadKey: 'MPSA', friendlyName: 'M-SQUAD', participationState: 'pending-consent', boardMapping: [], revision: 2 },
    { squadKey: 'VB', friendlyName: 'Vodacom Business', participationState: 'pending-consent', boardMapping: [], revision: 2 },
  ],
  auditHistory: [],
};

async function mockShared(page) {
  await page.route('**/api/session-meta.json**', (route) => route.fulfill({ json: { initials: 'AL', emailMasked: 'r***@gmail.com', canManageOrganizationSettings: true } }));
  await page.route('**/api/governance/registry.json**', (route) => route.fulfill({ json: registry }));
  await page.route('**/api/governance/registry', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fulfill({ json: registry });
    return route.fulfill({ json: { ...registry, version: 9, receipt: { id: 'masterplan-policy' } } });
  });
  await page.route('**/api/governance/actions.json**', (route) => route.fulfill({ json: {
    schemaVersion: 4,
    truthHash: '0123456789abcdef01234567',
    cases: [
      { promiseId: 'sd-5314', commitmentId: 'sd-5314', squad: 'SD', squadId: 'SD', issueKey: 'SD-5314', title: 'NBA integration', diagnosisLabel: 'Delivery date needs confirmation', urgencyLabel: 'overdue', ownerRoute: { displayName: 'Husna' }, nextAction: { label: 'Confirm SD-5314 forecast' }, detailHref: '/api/governance/cases/sd-5314/detail.json?projects=SD' },
      { promiseId: 'sd-5317', commitmentId: 'sd-5317', squad: 'SD', squadId: 'SD', issueKey: 'SD-5317', title: 'Soga pilot', diagnosisLabel: 'Owner evidence needs review', urgencyLabel: 'stale', ownerRoute: { displayName: 'Albert' }, nextAction: { label: 'Review SD-5317 evidence' }, detailHref: '/api/governance/cases/sd-5317/detail.json?projects=SD' },
    ],
  } }));
  await page.route('**/api/governance/cases/**', (route) => route.fulfill({ json: { promise: { promiseId: 'sd-5314', squad: 'SD', issueKey: 'SD-5314' } } }));
}

test.describe('Delivera Customer Realism Simplicity Speed Trust Master Plan', () => {
  test.describe.configure({ retries: 0 });

  test('@focused shared truth, safe policy, atomic actions, geometry and logcat', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockShared(page);
    const context = buildDeliveryTruthContext({
      squad: { squad: 'SD', sprintReality: { sprint: { id: 9024, name: 'FY27DMS07', state: 'active' } } },
      registry,
      contract: { contractId: 'FY27-Q2-r4', fiscalPeriod: 'FY27 Q2', revision: 4 },
      projectKeys: ['SD'],
      dataAsOf: '2026-08-10T09:00:00.000Z',
    });
    const commitments = [{
      promiseId: 'sd-5314', issueKey: 'SD-5314', squad: 'SD', startDate: '2026-07-01', endDate: '2026-07-31',
      children: [
        { key: 'SD-5401', status: 'Done', created: '2026-07-02', resolutionDate: '2026-07-12' },
        { key: 'SD-5402', status: 'In Progress', created: '2026-07-03', dueDate: '2026-08-05' },
      ],
    }];

    await test.step('01 Governance truth separates commitment, child, evidence, forecast, deviation and outcome semantics', async () => {
      const truth = buildDeliveryTruthProjection({ context, commitments, workItems: [{ category: 'pi' }, { category: 'unplanned' }] });
      expect(truth.commitmentCompletion).toEqual({ completed: 0, total: 1 });
      expect(truth.childStoryCompletion).toEqual({ completed: 1, total: 2 });
      expect(truth.deviation).toEqual({ unplannedItems: 1, totalItems: 2 });
      expect(truth.verifiedOutcomes).toBe(0);
    });

    await test.step('02 Scope truth is immutable and epic dates/counts derive from scoped children', async () => {
      const scope = toScopeTruth(context);
      const forecast = buildDeliveryTruthProjection({ context, commitments }).epicForecasts[0];
      expect(scope).toMatchObject({ squadKey: 'SD', projectKeys: ['SD'], pi: 'FY27 Q2', boardIds: [230], sprintIds: [9024], registryRevision: 8 });
      expect(scope.truthHash).toMatch(/^[a-f0-9]{24}$/);
      expect(forecast).toMatchObject({ issueKey: 'SD-5314', childTotal: 2, childCompleted: 1, scheduleVarianceDays: 5 });
    });

    await test.step('03 Settings pending-consent preset is reversible and never invents policy or rationale', async () => {
      await loginIfRequired(page, '/settings', { rootSelector: '#governance-registry-title' });
      const preset = page.locator('[data-select-pending]');
      await preset.click();
      await expect(page.locator('[data-bulk-participation]')).toHaveValue('');
      await expect(page.locator('[data-bulk-reason]')).toHaveValue('');
      await expect(page.locator('[data-bulk-preview]')).toBeDisabled();
      await expect(page.locator('[data-bulk-diff]')).toContainText('nothing has changed');
      await preset.click();
      await expect(page.locator('[data-selected-count]')).toContainText('0 squads');
    });

    await test.step('04 Settings publishes one versioned, idempotent organization diff', async () => {
      await page.locator('[data-select-pending]').click();
      await page.locator('[data-bulk-participation]').selectOption('operational-exception');
      await page.locator('[data-bulk-reason]').fill('Consent not yet recorded');
      const requestPromise = page.waitForRequest((request) => request.url().endsWith('/api/governance/registry') && request.method() === 'PATCH');
      await page.locator('[data-bulk-preview]').click();
      await page.locator('[data-bulk-apply]').click();
      const request = await requestPromise;
      expect(request.headers()['if-match']).toBe('"8"');
      expect(request.headers()['idempotency-key']).toBeTruthy();
    });

    await test.step('05 Actions renders one commitment per row with no mixed selector identity', async () => {
      await loginIfRequired(page, '/actions?squad=SD', { rootSelector: '#actions-queue-mount' });
      await expect(page.locator('[data-action-case]')).toHaveCount(2);
      await expect(page.locator('[data-action-case-picker]')).toHaveCount(0);
      await expect(page.locator('[data-action-case="sd-5314"]')).toContainText('SD-5314');
      await expect(page.locator('[data-action-case="sd-5317"]')).toContainText('SD-5317');
    });

    await test.step('06 Mobile geometry has no clipped content, overlap or false horizontal overflow', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      const geometry = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        width: document.documentElement.clientWidth,
        rows: [...document.querySelectorAll('[data-action-case]')].map((node) => node.getBoundingClientRect()).map((box) => ({ left: box.left, right: box.right })),
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
      expect(geometry.rows.every((box) => box.left >= -1 && box.right <= geometry.width + 1)).toBe(true);
    });

    await test.step('07 Desktop uses available width and interactive targets remain operable', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      const rows = page.locator('[data-action-case]');
      await expect(rows.first()).toBeVisible();
      const target = await rows.first().locator('button').boundingBox();
      expect(target.width).toBeGreaterThanOrEqual(24);
      expect(target.height).toBeGreaterThanOrEqual(24);
    });

    await test.step('08 Console, page errors and failed realtime requests remain clean', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
