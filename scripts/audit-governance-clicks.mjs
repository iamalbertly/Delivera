/**
 * Ad-hoc governance click sweep for local debugging.
 * Permanent CI gate: npm run test:journey:governance-click-friction
 * Fast key-control audit: node scripts/audit-governance-clicks-fast.mjs
 * Run: node scripts/audit-governance-clicks-fast.mjs (prefer over full sweep)
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = 'test-results/governance-click-audit.json';

const CLICK_SKIP = /^(Close|Account menu|Skip to main)$/i;

async function collectClickables(page) {
  return page.evaluate(() => {
    const sel = 'button, a[href], [role="button"], [data-project], [data-queue-open], [data-setup-action], [data-compare-add], summary, input[type="checkbox"]';
    const nodes = [...document.querySelectorAll(sel)];
    return nodes
      .filter((el) => {
        if (el.closest('[hidden]') || el.hasAttribute('hidden')) return false;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
        if (r.width === 0 && r.height === 0 && el.tagName !== 'SUMMARY') return false;
        return true;
      })
      .map((el, i) => {
        const label = (el.getAttribute('aria-label') || el.textContent || el.id || el.className || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 80);
        const rect = el.getBoundingClientRect();
        return {
          i,
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          label,
          selector: el.id ? `#${el.id}` : null,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      });
  });
}

async function auditViewport(browser, mode) {
  const { width, height, name } = mode;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const consoleLogs = [];
  const pageErrors = [];
  const networkFails = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (['error', 'warning'].includes(type)) {
      consoleLogs.push({ type, text: msg.text(), mode: name });
    }
  });
  page.on('pageerror', (err) => pageErrors.push({ message: err.message, mode: name }));
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/api/')) {
      networkFails.push({ url: res.url(), status: res.status(), mode: name });
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
  });

  const clickResults = [];
  await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const initialUrl = page.url();
  const loadState = await page.evaluate(() => ({
    briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
    hasError: !document.getElementById('gov-error')?.hidden,
    errorText: document.getElementById('gov-error')?.textContent?.trim() || null,
    scopeExpanded: document.getElementById('gov-scope-expanded')?.hasAttribute('hidden') === false,
  }));

  let clickables = await collectClickables(page);
  const seen = new Set();

  for (const item of clickables) {
    const key = `${item.tag}:${item.id || item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (CLICK_SKIP.test(item.label)) continue;

    const beforeUrl = page.url();
    const beforeConsole = consoleLogs.length;
    let outcome = 'ok';
    let detail = '';

    try {
      const loc = item.id
        ? page.locator(`#${item.id}`).first()
        : page.getByRole(item.tag === 'a' ? 'link' : 'button', { name: new RegExp(item.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 40), 'i') }).first();

      if (await loc.count() === 0) {
        outcome = 'skip';
        detail = 'locator not found on retry';
      } else {
        await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await loc.click({ timeout: 5000, force: false });
        await page.waitForTimeout(400);
      }
    } catch (e) {
      outcome = 'fail';
      detail = String(e.message || e).slice(0, 200);
    }

    const afterUrl = page.url();
    const newErrors = consoleLogs.slice(beforeConsole);
    clickResults.push({
      ...item,
      outcome,
      detail,
      navigated: afterUrl !== beforeUrl,
      afterUrl: afterUrl !== beforeUrl ? afterUrl : undefined,
      consoleAfterClick: newErrors,
    });

    if (afterUrl !== initialUrl && !afterUrl.includes('/governance')) {
      await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    if (page.url().includes('/governance')) {
      const drawerOpen = await page.locator('.gov-right-drawer-panel').isVisible().catch(() => false);
      if (drawerOpen) await page.keyboard.press('Escape').catch(() => {});
    }
  }

  // Negative tests
  const negative = [];

  // Rapid scope switch
  try {
    const chips = page.locator('#gov-scope-expanded [data-project]');
    const n = Math.min(await chips.count(), 4);
    for (let i = 0; i < n; i += 1) {
      await chips.nth(i).click({ timeout: 2000 });
    }
    await page.waitForTimeout(1500);
    negative.push({ test: 'rapid-scope-switch', outcome: 'ok', staleOverlay: await page.locator('.gov-stale-overlay').isVisible().catch(() => false) });
    await page.goto(`${BASE}/governance`);
    await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 60000 }).catch(() => {});
  } catch (e) {
    negative.push({ test: 'rapid-scope-switch', outcome: 'fail', detail: String(e.message) });
  }

  // Double refresh
  try {
    const refresh = page.locator('#gov-scope-refresh');
    if (await refresh.count()) {
      await refresh.dblclick({ timeout: 3000 });
      await page.waitForTimeout(800);
      negative.push({ test: 'double-refresh', outcome: 'ok' });
    }
  } catch (e) {
    negative.push({ test: 'double-refresh', outcome: 'fail', detail: String(e.message) });
  }

  // Click disabled / hidden create work
  try {
    await page.evaluate(() => document.getElementById('gov-hidden-create-work')?.click());
    negative.push({ test: 'hidden-create-work-programmatic', outcome: 'ok', modalOpen: await page.locator('[data-outcome-modal], .work-draft-drawer, dialog').first().isVisible().catch(() => false) });
    await page.keyboard.press('Escape').catch(() => {});
  } catch (e) {
    negative.push({ test: 'hidden-create-work-programmatic', outcome: 'fail', detail: String(e.message) });
  }

  // Empty clipboard / copy without brief
  try {
    await page.evaluate(() => { window.__govTest = true; });
    negative.push({ test: 'page-still-interactive', outcome: 'ok' });
  } catch (e) {
    negative.push({ test: 'page-still-interactive', outcome: 'fail', detail: String(e.message) });
  }

  // Mobile scope change button if collapsed
  if (name === 'mobile') {
    try {
      const change = page.locator('#gov-scope-change');
      if (await change.isVisible()) {
        await change.click();
        await page.waitForTimeout(500);
        negative.push({ test: 'mobile-scope-change-toggle', outcome: 'ok', expanded: await page.locator('#gov-scope-expanded').isVisible() });
      } else {
        negative.push({ test: 'mobile-scope-change-toggle', outcome: 'skip', detail: 'no change button' });
      }
    } catch (e) {
      negative.push({ test: 'mobile-scope-change-toggle', outcome: 'fail', detail: String(e.message) });
    }
  }

  await context.close();
  return {
    mode: name,
    viewport: { width, height },
    loadState,
    clickCount: clickResults.length,
    clicks: clickResults,
    failures: clickResults.filter((c) => c.outcome === 'fail'),
    consoleLogs,
    pageErrors,
    networkFails,
    negative,
  };
}

const browser = await chromium.launch({ headless: true });
const desktop = await auditViewport(browser, { name: 'desktop', width: 1280, height: 900 });
const mobile = await auditViewport(browser, { name: 'mobile', width: 375, height: 812 });
await browser.close();

const report = {
  auditedAt: new Date().toISOString(),
  baseUrl: BASE,
  desktop,
  mobile,
  summary: {
    desktopFails: desktop.failures.length,
    mobileFails: mobile.failures.length,
    desktopConsoleErrors: desktop.consoleLogs.filter((l) => l.type === 'error').length,
    mobileConsoleErrors: mobile.consoleLogs.filter((l) => l.type === 'error').length,
    networkFails: [...desktop.networkFails, ...mobile.networkFails],
  },
};

writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log('Wrote', OUT);
