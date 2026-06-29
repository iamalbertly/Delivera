/**
 * Content overlap — direct-value blocks obscured by drawers, docks, sticky layers.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildTargetUrl, gotoGovernance, loadStates, loadTarget, resolveBaseUrl, resolveProjectRoot, resolveRunDir, seedPageState,
} from './autohacker-collector-lib.mjs';

const root = resolveProjectRoot(import.meta.url);
const runDir = resolveRunDir(root);
const headless = process.env.HEADLESS === '1' || process.env.CI === '1';
const maxOverlap = Number(process.env.MAX_CONTENT_OVERLAP_PX || 500);
const maxObscured = Number(process.env.MAX_OBSCURED_VALUE_COUNT || 0);
const target = loadTarget(root);
const url = buildTargetUrl(resolveBaseUrl(root), target);
const states = loadStates(root);

const OVERLAP_GROUPS = {
  value: ['[data-direct-value]', '.gov-command-answer', '#gov-answer-mount', '.gov-owner-cluster', '.gov-portfolio-banner-line'],
  floating: ['#work-draft-drawer', '#work-draft-backdrop', '.gov-right-drawer-host', '.app-notification-dock', '.gov-proof-popover', '.gov-scope-drawer-panel'],
};

function overlapArea(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (w <= 0 || h <= 0) return 0;
  return Math.round(w * h);
}

function measureOverlap(page) {
  return page.evaluate(({ groups }) => {
    const pickVisible = (sels) => {
      const out = [];
      for (const sel of sels) {
        document.querySelectorAll(sel).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) return;
          if (el.closest('[hidden]')) return;
          out.push({ sel, label: (el.id || el.className || '').toString().slice(0, 40), rect: { top: r.top, left: r.left, right: r.right, bottom: r.bottom } });
        });
      }
      return out;
    };
    const values = pickVisible(groups.value);
    const blockers = pickVisible(groups.floating);
    let overlapPxTotal = 0;
    const pairs = [];
    for (const v of values) {
      for (const b of blockers) {
        if (v.sel === b.sel && v.label === b.label) continue;
        const w = Math.min(v.rect.right, b.rect.right) - Math.max(v.rect.left, b.rect.left);
        const h = Math.min(v.rect.bottom, b.rect.bottom) - Math.max(v.rect.top, b.rect.top);
        if (w > 0 && h > 0) {
          const px = Math.round(w * h);
          overlapPxTotal += px;
          pairs.push({ value: v.label, blocker: b.label, overlapPx: px });
        }
      }
    }
    const obscuredValueCount = pairs.filter((p) => p.overlapPx > 120).length;
    return { overlapPxTotal, obscuredValueCount, pairs: pairs.slice(0, 20) };
  }, { groups: OVERLAP_GROUPS });
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
  const metrics = await measureOverlap(page);
  byState.push({ stateId: state.id, ...metrics });
  await page.close();
}

await browser.close();

const worst = byState.filter((s) => !s.redirectedToLogin).reduce((acc, s) => {
  if (!acc || (s.overlapPxTotal || 0) > (acc.overlapPxTotal || 0)) return s;
  return acc;
}, null) || {};

const out = {
  capturedAt: new Date().toISOString(),
  url,
  maxContentOverlapPx: maxOverlap,
  maxObscuredValueCount: maxObscured,
  byState,
  overlapPxTotal: worst.overlapPxTotal ?? 0,
  obscuredValueCount: worst.obscuredValueCount ?? 0,
  pairs: worst.pairs ?? [],
  pass: (worst.overlapPxTotal ?? 0) <= maxOverlap && (worst.obscuredValueCount ?? 0) <= maxObscured,
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'content-overlap-report.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ overlapPxTotal: out.overlapPxTotal, pass: out.pass }, null, 2));
