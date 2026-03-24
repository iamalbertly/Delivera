/**
 * ALB-78: before/after full-page scrollHeight + console errors (desktop + mobile).
 * Usage: node scripts/ux-alb78-current-sprint-sticky-once.mjs [before|after]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const url = 'http://127.0.0.1:3000/current-sprint';
const phase = process.argv[2] || 'capture';
const label = phase === 'before' ? 'before-ALB-78-current-sprint' : 'after-ALB-78-current-sprint';
const date = new Date().toISOString().slice(0, 10);
const outDir = path.join('C:\\Shared\\Projects\\output\\ux-screenshots', date);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = { label, url, viewports: [] };

for (const [vpName, size] of [
  ['desktop', { width: 1280, height: 720 }],
  ['mobile', { width: 375, height: 812 }],
]) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const innerHeight = await page.evaluate(() => window.innerHeight);
  await page.screenshot({
    path: path.join(outDir, `${label}-${vpName}.png`),
    fullPage: true,
  });
  results.viewports.push({
    vpName,
    scrollHeight,
    innerHeight,
    consoleErrors: errors,
  });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(outDir, `${label}-metrics.json`), JSON.stringify(results, null, 2), 'utf8');
