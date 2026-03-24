/**
 * One-off: scroll height + screenshots for /current-sprint (ALB-28 UX gate).
 * Usage: node scripts/ux-gate-current-sprint-once.mjs [before|after]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const label = process.argv[2] || 'run';
const date = new Date().toISOString().slice(0, 10);
const outDir = path.join('C:', 'Shared', 'Projects', 'output', 'ux-screenshots', date);
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = 'http://127.0.0.1:3000/current-sprint';

async function capture(viewport, name, bust) {
  const url = `${baseUrl}${bust ? `?uxgate=${bust}` : ''}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err.message || err)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', { timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(500);
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const png = path.join(outDir, `${label}-ALB-28-current-sprint-${name}.png`);
  await page.screenshot({ path: png, fullPage: true });
  await browser.close();
  return { scrollHeight, png, consoleErrors };
}

const bust = `${Date.now()}-${label}`;
const desktop = await capture({ width: 1280, height: 720 }, 'desktop', bust);
const mobile = await capture({ width: 375, height: 812 }, 'mobile', bust);

const report = {
  label,
  url: `${baseUrl}?uxgate=${bust}`,
  desktopScrollHeight: desktop.scrollHeight,
  mobileScrollHeight: mobile.scrollHeight,
  desktopPng: desktop.png,
  mobilePng: mobile.png,
  consoleErrors: [...desktop.consoleErrors, ...mobile.consoleErrors],
};
const reportPath = path.join(outDir, `ALB-28-gate-${label}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
