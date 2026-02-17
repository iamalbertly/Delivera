
import { test, expect } from '@playwright/test';

// Marked for deletion: this experimental growth/velocity HUD spec is not part of the
// current SSOT test orchestration and should not gate full Playwright runs.
// File is already prefixed with DeleteThisFile_ as a deletion marker.
test.describe.skip('Growth & Velocity Plan Validation', () => {

    test('1. Executive HUD: Zero Config Load', async ({ page }) => {
        // Navigate to HUD
        const response = await page.goto('/leadership');
        expect(response.status()).toBe(200);

        // Initial State: Loading
        // Wait for "Live" indicator
        await expect(page.locator('#connection-status')).toContainText('Live', { timeout: 10000 });

        // Verify Metrics Loaded (Mock data or Real)
        // We expect non-empty values
        const velocityValue = page.locator('.hud-card:has-text("Velocity") .metric-value');
        await expect(velocityValue).not.toHaveText('--');

        // Check "Smart Context" Default (MPSA, MAS)
        await expect(page.locator('#project-context')).toContainText('MPSA, MAS');
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

        // Verify inputs hydrated
        // Assuming start-date input exists
        // await expect(page.locator('#start-date')).toHaveValue('2023-01-01T00:00'); // Check format if needed

        // Trigger Preview
        await page.click('#preview-btn');

        // Wait for Done Stories tab to be populated
        // Check if Virtual Scroller initialized
        // We'll look for the class .virtual-body-container or just check that rows exist
        // If we have little data, it might be standard table.
        // Let's assume test environment has some mock data or empty state.

        // Wait for preview to finish
        await expect(page.locator('#loading')).toBeHidden({ timeout: 15000 });
        await expect(page.locator('#export-trigger')).toBeEnabled();

        // Check Insight Share Button
        await page.click('#export-trigger');
        await expect(page.locator('#share-insight-btn')).toBeVisible();
    });

    test.skip('3. Edge Case: Permission / Auth Redirect', async ({ page, context }) => {
        // Clear cookies to simulate stale session
        await context.clearCookies();
        const response = await page.goto('/current-sprint');
        // Expect redirect to login
        expect(response.url()).toContain('/login');
    });

});
