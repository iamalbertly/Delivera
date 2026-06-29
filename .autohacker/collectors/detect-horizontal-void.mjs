/**
 * Horizontal void — left band empty while direct-value clusters right.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
  buildTargetUrl, gotoGovernance, loadStates, loadTarget, resolveBaseUrl, resolveProjectRoot, resolveRunDir, seedPageState,
} from './autohacker-collector-lib.mjs';

const root = resolveProjectRoot(import.meta.url);
const runDir = resolveRunDir(root);
const headless = process.env.HEADLESS === '1' || process.env.CI === '1';
const maxRatio = Number(process.env.MAX_HORIZONTAL_VOID_RATIO || 0.35);
const minLeft = Number(process.env.MIN_LEFT_BAND_CONTENT_RATIO || 0.08);
const target = loadTarget(root);
const url = buildTargetUrl(resolveBaseUrl(root), target);
const states = loadStates(root);

const VALUE_SELECTORS = [
  '[data-direct-value]',
  '.gov-command-answer',
  '#gov-answer-mount',
  '.gov-portfolio-banner-line',
  '.gov-owner-cluster',
  '[data-grouped-send]',
];

function measureHorizontal(page) {
  return page.evaluate(({ valueSels, leftBandEnd }) => {
    const mainCol = document.querySelector('.gov-main-column') || document.querySelector('#main-content');
    const colRect = mainCol?.getBoundingClientRect();
    const bandRight = colRect ? colRect.right : window.innerWidth * leftBandEnd;
    const bandLeft = colRect ? colRect.left : 0;
    const vh = window.innerHeight;
    let leftContentPx = 0;
    let leftBandArea = Math.max(1, (bandRight - bandLeft) * vh * 0.75);
    const scan = (el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 6 || r.width < 6) return;
      if (r.left > bandRight || r.right < bandLeft) return;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') return;
      if (el.closest('[hidden]')) return;
      const visibleH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (visibleH <= 0) return;
      const visibleW = Math.min(r.right, bandRight) - Math.max(r.left, bandLeft);
      if (visibleW <= 0) return;
      leftContentPx += visibleW * visibleH;
    };
    for (const sel of valueSels) document.querySelectorAll(sel).forEach(scan);
    document.querySelectorAll('.gov-scope-summary-strip, .gov-command-answer, .gov-portfolio-grid-wrap').forEach(scan);
    const leftBandContentRatio = leftContentPx / leftBandArea;
    const horizontalVoidRatio = Math.max(0, 1 - leftBandContentRatio);
    const scopeBar = document.querySelector('#gov-scope-bar-mount');
    const scopeRect = scopeBar?.getBoundingClientRect();
    return {
      viewportW: window.innerWidth,
      leftBandContentRatio: Math.round(leftBandContentRatio * 1000) / 1000,
      horizontalVoidRatio: Math.round(horizontalVoidRatio * 1000) / 1000,
      contentCentroidX: colRect ? Math.round(colRect.left + colRect.width / 2) : null,
      scopeBarWidthPx: scopeRect ? Math.round(scopeRect.width) : null,
      scopeBarRightPx: scopeRect ? Math.round(scopeRect.right) : null,
      valueBlockCount: document.querySelectorAll(valueSels.join(',')).length,
    };
  }, { valueSels: VALUE_SELECTORS, leftBandEnd: 0.45 });
}

const browser = await chromium.launch({ headless });
const byState = [];

for (const state of states) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await seedPageState(page, state);
  const nav = await gotoGovernance(page, url);
  if (nav.redirectedToLogin) {
    byState.push({ stateId: state.id, redirectedToLogin: true });
    await page.close();
    continue;
  }
  const metrics = await measureHorizontal(page);
  byState.push({ stateId: state.id, label: state.label, ...metrics });
  await page.close();
}

await browser.close();

const worst = byState.filter((s) => !s.redirectedToLogin).reduce((acc, s) => {
  if (!acc || (s.horizontalVoidRatio || 0) > (acc.horizontalVoidRatio || 0)) return s;
  return acc;
}, null) || {};

const out = {
  capturedAt: new Date().toISOString(),
  url,
  maxHorizontalVoidRatio: maxRatio,
  minLeftBandContentRatio: minLeft,
  byState,
  horizontalVoidRatio: worst.horizontalVoidRatio ?? 1,
  leftBandContentRatio: worst.leftBandContentRatio ?? 0,
  contentCentroidX: worst.contentCentroidX,
  scopeBarWidthPx: worst.scopeBarWidthPx,
  pass: (worst.horizontalVoidRatio ?? 1) <= maxRatio && (worst.leftBandContentRatio ?? 0) >= minLeft,
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'horizontal-void-report.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ horizontalVoidRatio: out.horizontalVoidRatio, pass: out.pass }, null, 2));

