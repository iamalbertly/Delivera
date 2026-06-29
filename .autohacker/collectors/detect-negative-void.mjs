/**
 * Negative void / stacking — value overlapping scope chrome vertically.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildTargetUrl, gotoGovernance, loadTarget, resolveBaseUrl, resolveProjectRoot, resolveRunDir, seedPageState,
} from './autohacker-collector-lib.mjs';

const root = resolveProjectRoot(import.meta.url);
const runDir = resolveRunDir(root);
const headless = process.env.HEADLESS === '1' || process.env.CI === '1';
const target = loadTarget(root);
const url = buildTargetUrl(resolveBaseUrl(root), target);

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await seedPageState(page, {
  localStorage: { delivera_selectedProjects: 'SD' },
  sessionStorage: { 'gov-pi-auto-open-dismissed': '1' },
});
await gotoGovernance(page, url);

const metrics = await page.evaluate(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect() : null;
  };
  const scope = rect('#gov-scope-bar-mount') || rect('#gov-scope-expanded');
  const scopeBottom = scope ? scope.bottom : 0;
  const valueSelectors = [
    '[data-direct-value]',
    '[data-grouped-send]',
    '.gov-owner-cluster',
    '.gov-command-answer',
    '#gov-answer-mount .gov-command-answer',
    '.gov-portfolio-banner-line',
  ];
  let firstValue = null;
  for (const sel of valueSelectors) {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.closest('[hidden], #gov-secondary-chrome, .gov-secondary-chrome')) return;
      const r = el.getBoundingClientRect();
      if (r.height <= 8 || r.width <= 8) return;
      if (r.top + 4 < scopeBottom) return;
      if (!firstValue || r.top < firstValue.top) {
        firstValue = { sel, top: r.top, bottom: r.bottom };
      }
    });
  }
  const mainColumnVoidPx = firstValue ? Math.round(firstValue.top - scopeBottom) : 9999;
  return {
    scopeBottomPx: Math.round(scopeBottom),
    firstValueSelector: firstValue?.sel || null,
    firstValueTopPx: firstValue ? Math.round(firstValue.top) : null,
    mainColumnVoidPx,
    stackingDetected: mainColumnVoidPx < 0,
  };
});

await browser.close();

const out = {
  capturedAt: new Date().toISOString(),
  url,
  ...metrics,
  pass: !metrics.stackingDetected,
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'negative-void-report.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ stackingDetected: out.stackingDetected, mainColumnVoidPx: out.mainColumnVoidPx, pass: out.pass }, null, 2));
