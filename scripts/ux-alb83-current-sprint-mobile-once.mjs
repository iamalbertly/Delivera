/**
 * ALB-83: before/after scroll height + screenshots for current-sprint mobile (375x812).
 * Run from repo root: node scripts/ux-alb83-current-sprint-mobile-once.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const url = 'http://127.0.0.1:3000/current-sprint';
const date = new Date().toISOString().slice(0, 10);
const outDir = path.join('C:\\Shared\\Projects\\output\\ux-screenshots', date);
fs.mkdirSync(outDir, { recursive: true });

const phase = process.argv[2] || 'capture';
const label = phase === 'before' ? 'before-ALB-83-current-sprint' : 'after-ALB-83-current-sprint';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
const innerHeight = await page.evaluate(() => window.innerHeight);
await page.screenshot({
  path: path.join(outDir, `${label}-mobile.png`),
  fullPage: true,
});
await browser.close();

const report = { label, url, scrollHeight, innerHeight, consoleErrors: errors, outDir };
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, `${label}-metrics.json`), JSON.stringify(report, null, 2), 'utf8');
