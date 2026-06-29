/**
 * Fold viewport density — left whitespace vs right content (live page sample).
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildTargetUrl, gotoGovernance, loadTarget, resolveBaseUrl, resolveProjectRoot, resolveRunDir, seedPageState,
} from './autohacker-collector-lib.mjs';

const root = resolveProjectRoot(import.meta.url);
const runDir = resolveRunDir(root);
const headless = process.env.HEADLESS === '1' || process.env.CI === '1';
const maxLeftWhite = Number(process.env.MAX_SCREENSHOT_LEFT_WHITESPACE_RATIO || 0.55);
const target = loadTarget(root);
const url = buildTargetUrl(resolveBaseUrl(root), target);
const foldPath = join(runDir, 'screenshots', 'desktop-fold.png');

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await seedPageState(page, {
  localStorage: { delivera_selectedProjects: 'SD' },
  sessionStorage: { 'gov-pi-auto-open-dismissed': '1' },
});
await gotoGovernance(page, url);
if (existsSync(join(runDir, 'screenshots'))) {
  await page.screenshot({ path: foldPath, fullPage: false }).catch(() => {});
}

const density = await page.evaluate(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const leftEnd = vw * 0.45;
  const rightStart = vw * 0.55;
  let leftEmpty = 0;
  let leftCells = 0;
  let rightFilled = 0;
  let rightCells = 0;
  const yStart = Math.floor(vh * 0.1);
  const yEnd = Math.floor(vh * 0.85);
  const step = 40;
  const hasContent = (x, y) => {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el === document.documentElement || el === document.body) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const t = (el.textContent || '').trim();
      const tag = el.tagName.toLowerCase();
      if (tag === 'main' || tag === 'div' && !t && !el.id && !(el.className || '').toString().includes('gov')) continue;
      if (t.length > 0 || el.querySelector('button, a, [data-direct-value], .gov-command-answer, .gov-scope-chip')) return true;
    }
    return false;
  };
  for (let y = yStart; y < yEnd; y += step) {
    for (let x = 20; x < leftEnd; x += step) {
      leftCells += 1;
      if (!hasContent(x, y)) leftEmpty += 1;
    }
    for (let x = rightStart; x < vw - 20; x += step) {
      rightCells += 1;
      if (hasContent(x, y)) rightFilled += 1;
    }
  }
  return {
    leftWhitespaceRatio: leftCells > 0 ? Math.round((leftEmpty / leftCells) * 1000) / 1000 : 1,
    rightContentRatio: rightCells > 0 ? Math.round((rightFilled / rightCells) * 1000) / 1000 : 0,
  };
});

await browser.close();

const out = {
  capturedAt: new Date().toISOString(),
  url,
  screenshotPath: existsSync(foldPath) ? foldPath : null,
  maxLeftWhitespaceRatio: maxLeftWhite,
  ...density,
  pass: density.leftWhitespaceRatio <= maxLeftWhite,
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'screenshot-density-report.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ leftWhitespaceRatio: out.leftWhitespaceRatio, pass: out.pass }, null, 2));
