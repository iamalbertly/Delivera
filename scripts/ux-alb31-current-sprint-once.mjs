/**
 * Playwright capture for ALB-31 (current-sprint Take action / remediation strip).
 * Run with: node scripts/ux-alb31-current-sprint-once.mjs [label]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const label = process.argv[2] || 'after-ALB-31';
const date = new Date().toISOString().slice(0, 10);
const outDir = path.join('C:', 'Shared', 'Projects', 'output', 'ux-screenshots', date);
const base = 'http://127.0.0.1:3000/current-sprint';

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.setViewportSize({ width: 1280, height: 720 });
  const c1 = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') c1.push(msg.text());
  });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  const h1 = await page.evaluate(() => document.documentElement.scrollHeight);
  const png = path.join(outDir, `${label}-current-sprint-desktop.png`);
  await page.screenshot({ path: png, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  const hM = await page.evaluate(() => document.documentElement.scrollHeight);
  const pngM = path.join(outDir, `${label}-current-sprint-mobile.png`);
  await page.screenshot({ path: pngM, fullPage: true });
  const out = {
    label,
    desktopScrollHeight: h1,
    mobileScrollHeight: hM,
    desktop: png,
    mobile: pngM,
    console_errors: c1,
  };
  console.log(JSON.stringify(out, null, 2));
} finally {
  await browser.close();
}
