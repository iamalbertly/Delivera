/**
 * AutoHacker evidence pipeline — metric-driven UX validation (fail-fast).
 * Validates geometry metrics, console telemetry, and journey-value UI state.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getLayoutOverlapReport,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const VALUE_ANCHORS = [
  '#gov-answer-mount',
  '.gov-command-answer',
  '#gov-verdict-mount',
  '.gov-portfolio-banner-line',
];
const CHROME_ANCHORS = ['#app-top-chrome', '#gov-scope-bar-mount'];

async function seedGovernanceScope(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('delivera_selectedProjects', 'SD'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
  });
}

async function loadGovernanceBrief(page) {
  await seedGovernanceScope(page);
  const telemetry = captureBrowserTelemetry(page);
  await page.goto('/governance', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await skipIfRedirectedToLogin(page, test)) return null;
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', /content|loading|error/, { timeout: 60000 });
  return telemetry;
}

async function collectUxMetrics(page) {
  return page.evaluate(({ valueAnchors, chromeAnchors }) => {
    const pick = (sels) => {
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect().height > 2) return el;
      }
      return null;
    };
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const vh = window.innerHeight;
    const valueEl = pick(valueAnchors);
    const valueRect = rect(valueEl);
    let chromeBottom = 0;
    let stickyChromePx = 0;
    for (const sel of chromeAnchors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = rect(el);
      if (!r || r.height < 2) continue;
      stickyChromePx += r.height;
      chromeBottom = Math.max(chromeBottom, r.bottom);
    }
    const foldDeadBandPx = valueRect ? Math.max(0, Math.round(valueRect.top - chromeBottom)) : 9999;
    const stickyChromeRatio = vh > 0 ? stickyChromePx / vh : 1;
    const scrollToPrimaryValuePx = valueRect && valueRect.top > vh - 40
      ? Math.round(valueRect.top + window.scrollY - stickyChromePx)
      : 0;
    return {
      briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
      valueAnchor: valueEl ? (valueEl.id || String(valueEl.className).slice(0, 40)) : null,
      foldDeadBandPx,
      scrollToPrimaryValuePx,
      stickyChromeRatio,
      docScrollHeight: document.documentElement.scrollHeight,
      viewportH: vh,
      hasCopyControl: !!document.querySelector('#gov-copy-answer-scope, [data-copy-answer]'),
      hasScopeBar: !!document.querySelector('#gov-scope-bar-mount'),
    };
  }, { valueAnchors: VALUE_ANCHORS, chromeAnchors: CHROME_ANCHORS });
}

test.describe('AutoHacker evidence pipeline @autohacker', () => {
  test('governance loads with journey-value anchor visible on desktop', async ({ page }) => {
    const telemetry = await loadGovernanceBrief(page);
    if (!telemetry) return;
    const metrics = await collectUxMetrics(page);
    expect(metrics.briefState).toBe('content');
    expect(metrics.valueAnchor, 'primary value block must be present').toBeTruthy();
    expect(metrics.foldDeadBandPx).toBeLessThan(900);
    expect(metrics.stickyChromeRatio).toBeLessThan(0.62);
    assertTelemetryClean(telemetry);
  });

  test('mobile viewport keeps value anchor reachable without excessive scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const telemetry = await loadGovernanceBrief(page);
    if (!telemetry) return;
    const metrics = await collectUxMetrics(page);
    expect(metrics.valueAnchor).toBeTruthy();
    expect(metrics.scrollToPrimaryValuePx).toBeLessThan(1200);
    assertTelemetryClean(telemetry);
  });

  test('chrome regions do not overlap primary content band', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const telemetry = await loadGovernanceBrief(page);
    if (!telemetry) return;
    const overlap = await getLayoutOverlapReport(page, {
      selectors: ['#app-top-chrome', '#gov-scope-bar-mount', '#main-content'],
      maxPairs: 12,
    });
    const bad = overlap.overlaps.filter((o) => o.overlapPx > 4000);
    expect(bad, JSON.stringify(bad)).toHaveLength(0);
    assertTelemetryClean(telemetry);
  });

  test('negative: scope refresh remains actionable after brief load', async ({ page }) => {
    const telemetry = await loadGovernanceBrief(page);
    if (!telemetry) return;
    const refresh = page.locator('#gov-scope-refresh');
    await expect(refresh).toBeVisible({ timeout: 15000 });
    await refresh.click({ timeout: 10000 });
    await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'content', { timeout: 60000 });
    assertTelemetryClean(telemetry);
  });

  test('negative: escape dismisses proof drawer without locking body scroll', async ({ page }) => {
    const telemetry = await loadGovernanceBrief(page);
    if (!telemetry) return;
    const proof = page.locator('[data-proof-cluster]').first();
    if (await proof.count() === 0) test.skip();
    await proof.click({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/gov-right-drawer-open/, { timeout: 5000 });
    assertTelemetryClean(telemetry);
  });

  test('synthesize-ux-metrics collector output is valid when run via npm', async () => {
    test.skip(!existsSync(join(process.cwd(), '.autohacker', 'config', 'targets.json')), 'autohacker config missing');
    const cfg = JSON.parse(readFileSync(join(process.cwd(), '.autohacker', 'config', 'targets.json'), 'utf8'));
    expect(cfg.governance?.valueAnchors?.length).toBeGreaterThan(0);
    expect(cfg.governance?.chromeAnchors?.length).toBeGreaterThan(0);
  });
});
