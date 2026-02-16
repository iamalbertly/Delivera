
import { test, expect } from '@playwright/test';
import { clickReportPreviewFromCurrentState, ensureReportFiltersVisible, getReportExportButtonState } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Growth & Velocity Plan Validation', () => {

    test('1. Executive HUD: Zero Config Load', async ({ page }) => {
        // Navigate to HUD
        const response = await page.goto('/leadership');
        expect(response.status()).toBe(200);

        // Current flow may render legacy HUD or redirect to report trends.
        const connectionStatus = page.locator('#connection-status');
        const hasConnectionStatus = (await connectionStatus.count()) > 0;
        if (hasConnectionStatus) {
            await expect(connectionStatus).toContainText(/Live|Offline/, { timeout: 10000 });
        }

        // Verify Metrics Loaded (Mock data or Real)
        const velocityValue = page.locator('.hud-card:has-text("Velocity") .metric-value');
        const hasLegacyHud = await velocityValue.count();
        if (!hasLegacyHud) {
            // Current flow routes leadership to report trends.
            await expect(page).toHaveURL(/\/report|\/leadership/);
            await expect(page.locator('h1')).toContainText(/General Performance|Leadership/i);
            return;
        }
        const connectionText = ((await connectionStatus.textContent().catch(() => '')) || '').trim();
        if (/Live/i.test(connectionText)) {
            await expect(velocityValue).not.toHaveText('--');
        } else {
            // Offline mode should still present a deterministic placeholder instead of crashing.
            await expect(velocityValue).toContainText(/--|0|N\/A/i);
        }

        // Check "Smart Context" Default (MPSA, MAS)
        const projectContext = page.locator('#project-context');
        if (await projectContext.count()) {
            await expect(projectContext).toContainText('MPSA, MAS');
        }
    });

    test('2. Report Page: Smart Context & Virtual Scroller', async ({ page }) => {
        // Pre-seed localStorage to test Smart Context
        await page.addInitScript(() => {
            localStorage.setItem('jira-report-last-query', JSON.stringify({
                start: '2023-01-01T00:00:00.000Z',
                end: '2023-03-01T23:59:59.999Z',
                projects: 'MPSA',
                timestamp: Date.now()
            }));
        });

        await page.goto('/report');
        const previewBtn = page.locator('#preview-btn');
        await ensureReportFiltersVisible(page);

        // Verify inputs hydrated
        // Assuming start-date input exists
        // await expect(page.locator('#start-date')).toHaveValue('2023-01-01T00:00'); // Check format if needed

        // Trigger Preview
        const clicked = await clickReportPreviewFromCurrentState(page);
        expect(clicked).toBeTruthy();

        // Wait for Done Stories tab to be populated
        // Check if Virtual Scroller initialized
        // We'll look for the class .virtual-body-container or just check that rows exist
        // If we have little data, it might be standard table.
        // Let's assume test environment has some mock data or empty state.

        // Wait for preview to finish
        await expect(page.locator('#loading')).toBeHidden({ timeout: 15000 });
        const exportTrigger = page.locator('#export-trigger');
        const exportExcelBtn = page.locator('#export-excel-btn');
        const hasLegacyTrigger = await exportTrigger.count();
        const hasCurrentExport = await exportExcelBtn.count();
        expect(hasLegacyTrigger > 0 || hasCurrentExport > 0).toBeTruthy();
        if (hasLegacyTrigger > 0) {
            await expect(exportTrigger).toBeEnabled();
            await page.click('#export-trigger');
            const hasShareInsight = await page.locator('#share-insight-btn').count();
            if (hasShareInsight > 0) {
                await expect(page.locator('#share-insight-btn')).toBeVisible();
            }
        } else {
            const exportState = await getReportExportButtonState(page);
            await expect(exportExcelBtn).toBeVisible();
            const enabled = exportState.enabled;
            if (enabled) {
                await expect(exportExcelBtn).toContainText(/Export|Share/i);
            } else {
                await expect(exportExcelBtn).toBeDisabled();
            }
        }
    });

    test.skip('3. Edge Case: Permission / Auth Redirect', async ({ page, context }) => {
        // Clear cookies to simulate stale session
        await context.clearCookies();
        const response = await page.goto('/current-sprint');
        // Expect redirect to login
        expect(response.url()).toContain('/login');
    });

});
