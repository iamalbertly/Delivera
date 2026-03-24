/** ALB-82: Playwright scrollHeight + screenshots for /current-sprint. */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const url = 'http://127.0.0.1:3000/current-sprint';
const phase = process.argv[2] || 'after';
const label = phase === 'before' ? 'before-ALB-82-current-sprint' : 'after-ALB-82-current-sprint';
const date = new Date().toISOString().slice(0, 10);
const outDir = path.join('C:\\Shared\\Projects\\output\\ux-screenshots', date);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const out = { label, url, viewports: [] };
for (const [name, viewport] of [['desktop', { width: 1280, height: 720 }], ['mobile', { width: 375, height: 812 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  out.viewports.push({
    name,
    scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight),
    consoleErrors: errs,
  });
  await page.screenshot({ path: path.join(outDir, `${label}-${name}.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(outDir, `${label}-metrics.json`), JSON.stringify(out, null, 2));
