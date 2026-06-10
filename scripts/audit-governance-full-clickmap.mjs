/**
 * Full governance click-map audit — every interactive control, desktop + mobile.
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

async function setupPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const telemetry = { errors: [], warnings: [], pageErrors: [], apiFails: [], networkSlow: [] };
  page.on('console', (m) => {
    const t = m.type();
    const text = m.text();
    if (t === 'error') telemetry.errors.push(text);
    if (t === 'warning') telemetry.warnings.push(text);
  });
  page.on('pageerror', (e) => telemetry.pageErrors.push(e.message));
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/') && r.status() >= 400) {
      telemetry.apiFails.push({ url, status: r.status() });
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  });
  return { ctx, page, telemetry };
}

async function loadBrief(page) {
  const t0 = Date.now();
  await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await page.waitForSelector('.gov-command-answer, .gov-portfolio-banner-line', { timeout: 30000 }).catch(() => {});
  return Date.now() - t0;
}

async function clickAll(page, mode) {
  const results = [];
  const selectors = [
    '#gov-scope-refresh',
    '#gov-copy-answer-scope',
    '#gov-copy-answer-inline',
    '[data-copy-answer]',
    '#gov-scope-advanced',
    '#gov-scope-change',
    '[data-scope-status-action="1"]',
    '[data-period-chip]',
    '[data-period-preset="pi-quarter"]',
    '[data-project]',
    '[data-compare-add]',
    '[data-compare-add-tray] button',
    '[data-proof-cluster]',
    '[data-proof-squad]',
    '[data-grouped-nudge]',
    '[data-squad-nudge]',
    '[data-queue-open]',
    '[data-inbox-inline-approve]',
    '[data-setup-action]',
    '[data-setup-baseline-ssot="1"]',
    '[data-heat-tile]',
    '[data-comparison-filter]',
    '[data-cluster-toggle]',
    '[data-mark-wrong]',
    '[data-why]',
    '[data-nudge]',
    '[data-evidence-tab]',
    '#gov-supporting-evidence summary',
    '[data-investment-open]',
    '[data-hover-proof]',
    '#gov-right-rail-proof-mount button',
    '.gov-inbox-inline-open',
    '[data-inline-open]',
    '[data-top-action="notifications"]',
    '[data-top-action="create-work"]',
    '.app-sidebar a.sidebar-link',
    '[data-surface-switch]',
  ];

  for (const sel of selectors) {
    const loc = page.locator(sel);
    const count = await loc.count();
    if (!count) {
      results.push({ selector: sel, count: 0, skipped: true });
      continue;
    }
    const max = Math.min(count, mode === 'mobile' ? 2 : 3);
    for (let i = 0; i < max; i++) {
      const item = loc.nth(i);
      const visible = await item.isVisible().catch(() => false);
      const enabled = visible ? !(await item.isDisabled().catch(() => false)) : false;
      const label = visible ? (await item.getAttribute('aria-label').catch(() => null)
        || await item.textContent().catch(() => '')).trim().slice(0, 60) : '';
      if (!visible || !enabled) {
        results.push({ selector: sel, index: i, label, visible, enabled, skipped: true });
        continue;
      }
      const before = await page.evaluate(() => ({
        drawers: document.querySelectorAll('.gov-right-drawer-panel').length,
        sheets: document.querySelectorAll('#delivera-jira-nudge-review-sheet, .gov-nudge-sheet').length,
        evidenceOpen: document.querySelector('#gov-supporting-evidence')?.open || false,
      }));
      const t0 = Date.now();
      let clickOk = false;
      let clickErr = '';
      try {
        await item.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await item.click({ timeout: 5000 });
        clickOk = true;
      } catch (e) {
        clickErr = String(e.message || e).slice(0, 200);
      }
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({
        drawers: document.querySelectorAll('.gov-right-drawer-panel').length,
        sheets: document.querySelectorAll('#delivera-jira-nudge-review-sheet:not([hidden]), .gov-nudge-sheet:not([hidden])').length,
        evidenceOpen: document.querySelector('#gov-supporting-evidence')?.open || false,
        briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
        errorVisible: !document.getElementById('gov-error')?.hidden,
      }));
      const changed = JSON.stringify(before) !== JSON.stringify({ drawers: after.drawers, sheets: before.sheets, evidenceOpen: after.evidenceOpen });
      results.push({
        selector: sel,
        index: i,
        label,
        clickOk,
        clickErr,
        ms: Date.now() - t0,
        before,
        after,
        stateChanged: changed || after.drawers > before.drawers || after.sheets > before.sheets || after.evidenceOpen !== before.evidenceOpen,
      });
      if (after.drawers > 0 || after.sheets > 0) {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  }
  return results;
}

async function runNegative(page) {
  const neg = [];
  neg.push({
    test: 'empty-project-selection',
    result: await page.evaluate(async () => {
      localStorage.setItem('delivera_selectedProjects', '');
      return 'set';
    }),
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  neg.push({
    test: 'empty-project-selection',
    briefState: await page.locator('#main-content').getAttribute('data-gov-brief-state'),
    error: await page.locator('#gov-error:not([hidden])').textContent().catch(() => null),
  });

  await page.addInitScript(() => localStorage.setItem('delivera_selectedProjects', 'SD'));
  await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});

  neg.push({
    test: 'rapid-refresh-5x',
    result: await (async () => {
      for (let i = 0; i < 5; i++) {
        await page.locator('#gov-scope-refresh').click({ timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(2000);
      return {
        briefState: await page.locator('#main-content').getAttribute('data-gov-brief-state'),
        loading: await page.locator('#gov-loading').isVisible(),
      };
    })(),
  });

  neg.push({
    test: 'click-disabled-inbox-tab',
    result: await (async () => {
      const tab = page.locator('[data-queue-tab][disabled]').first();
      if (!(await tab.count())) return { skipped: true };
      await tab.click({ force: true, timeout: 2000 }).catch((e) => ({ err: e.message }));
      return { forced: true };
    })(),
  });

  return neg;
}

async function measurePerf(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime;
    const hero = document.querySelector('.gov-command-answer, .gov-portfolio-banner-line');
    const heroY = hero?.getBoundingClientRect?.()?.y ?? null;
    const scrollH = document.documentElement.scrollHeight;
    const vh = window.innerHeight;
    const foldClicks = document.querySelectorAll('button, [role="button"], a.btn, summary').length;
    return {
      domContentLoaded: nav?.domContentLoadedEventEnd,
      loadEvent: nav?.loadEventEnd,
      fcp,
      heroAboveFold: heroY != null && heroY < vh * 0.35,
      heroY,
      scrollDepthRatio: scrollH / vh,
      interactiveCount: foldClicks,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const report = { auditedAt: new Date().toISOString(), baseUrl: BASE, suites: [] };

for (const suite of [
  { mode: 'desktop', viewport: { width: 1440, height: 900 } },
  { mode: 'mobile', viewport: { width: 375, height: 812 } },
]) {
  const { ctx, page, telemetry } = await setupPage(browser, suite.viewport);
  const loadMs = await loadBrief(page);
  const perf = await measurePerf(page);
  const clicks = await clickAll(page, suite.mode);
  const negatives = suite.mode === 'desktop' ? await runNegative(page) : [];
  report.suites.push({ ...suite, loadMs, perf, clicks, negatives, telemetry });
  await ctx.close();
}

await browser.close();
writeFileSync('test-results/governance-full-clickmap.json', JSON.stringify(report, null, 2));

for (const s of report.suites) {
  console.log(`\n=== ${s.mode} load=${s.loadMs}ms fcp=${Math.round(s.perf.fcp || 0)} scrollRatio=${s.perf.scrollDepthRatio?.toFixed(1)} ===`);
  const fails = s.clicks.filter((c) => c.clickOk === false);
  const noOp = s.clicks.filter((c) => c.clickOk && !c.stateChanged && !c.skipped);
  console.log(`clicks: ${s.clicks.length} fail=${fails.length} no-op=${noOp.length} consoleErrors=${s.telemetry.errors.length} apiFails=${s.telemetry.apiFails.length}`);
  for (const f of fails.slice(0, 8)) console.log(`  FAIL ${f.selector}[${f.index}] ${f.clickErr?.slice(0, 70)}`);
  for (const n of noOp.slice(0, 10)) console.log(`  NO-OP ${n.selector}[${n.index}] "${n.label}"`);
}
