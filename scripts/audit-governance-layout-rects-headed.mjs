/**
 * Headed layout audit — main menu vs primary content bounding rects + overlap CSS trace.
 * Run: node scripts/audit-governance-layout-rects-headed.mjs
 * Env: BASE_URL (default http://127.0.0.1:3001), HEADLESS=1 to run headless
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT_JSON = 'test-results/governance-layout-rects-audit.json';
const OUT_MD = 'test-results/governance-layout-overlap-plan.md';
const VIEWPORTS = [
  { width: 1280, height: 900, label: 'desktop' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 390, height: 844, label: 'mobile' },
];

function roundRect(r) {
  return {
    x: Math.round(r.x * 100) / 100,
    y: Math.round(r.y * 100) / 100,
    width: Math.round(r.width * 100) / 100,
    height: Math.round(r.height * 100) / 100,
    top: Math.round(r.top * 100) / 100,
    right: Math.round(r.right * 100) / 100,
    bottom: Math.round(r.bottom * 100) / 100,
    left: Math.round(r.left * 100) / 100,
  };
}

function rectsOverlap(a, b) {
  const hit = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  if (!hit) return { overlaps: false, overlapPx: 0, overlapBox: null };
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  const w = right - left;
  const h = bottom - top;
  return {
    overlaps: w > 0 && h > 0,
    overlapPx: Math.round(w * h),
    overlapBox: { left, top, right, bottom, width: w, height: h },
  };
}

async function extractLayoutAudit(page) {
  return page.evaluate(() => {
    const TARGETS = {
      mainMenuSidebar: '#app-sidebar',
      mainMenuNav: '.app-sidebar-nav',
      topChrome: '#app-top-chrome',
      scopeBar: '#gov-scope-bar-mount',
      primaryContent: '#main-content',
    };

    function pick(selector) {
      const el = document.querySelector(selector);
      if (!el) return { selector, found: false };
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const visible = rect.width > 2 && rect.height > 2
        && cs.display !== 'none'
        && cs.visibility !== 'hidden'
        && Number(cs.opacity) > 0.05;
      return {
        selector,
        found: true,
        id: el.id || null,
        className: (el.className || '').toString().slice(0, 120),
        visible,
        rect: {
          x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left,
        },
        computed: {
          position: cs.position,
          zIndex: cs.zIndex,
          marginLeft: cs.marginLeft,
          marginTop: cs.marginTop,
          width: cs.width,
          transform: cs.transform,
          pointerEvents: cs.pointerEvents,
        },
      };
    }

    function matchingRules(el) {
      const hits = [];
      if (!el) return hits;
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        if (!rules) continue;
        for (const rule of Array.from(rules)) {
          if (rule.type !== CSSRule.STYLE_RULE) continue;
          try {
            if (!el.matches(rule.selectorText)) continue;
          } catch {
            continue;
          }
          const href = sheet.href ? sheet.href.replace(window.location.origin, '') : '(inline)';
          hits.push({
            href,
            selector: rule.selectorText,
            cssText: rule.style.cssText.slice(0, 240),
          });
        }
      }
      return hits.slice(0, 40);
    }

    const elements = {};
    for (const [key, sel] of Object.entries(TARGETS)) {
      const el = document.querySelector(sel);
      elements[key] = pick(sel);
      if (el) elements[key].cssRules = matchingRules(el);
    }

    const bodyClasses = document.body.className;
    const sidebarWidthVar = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width').trim();
    const topChromeHeight = getComputedStyle(document.documentElement).getPropertyValue('--top-chrome-height').trim();

    const domMap = {
      bodyClasses,
      cssVars: { sidebarWidth: sidebarWidthVar, topChromeHeight },
      tree: {
        topChrome: !!document.getElementById('app-top-chrome'),
        sidebar: !!document.getElementById('app-sidebar'),
        scopeBar: !!document.getElementById('gov-scope-bar-mount'),
        mainContent: !!document.getElementById('main-content'),
        briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
        stickyAnswer: !!document.querySelector('#gov-sticky-answer-mount.is-visible'),
        rightDrawerOpen: document.body.classList.contains('gov-right-drawer-open'),
      },
      stickyFixed: [...document.querySelectorAll('*')].filter((el) => {
        const s = getComputedStyle(el);
        return (s.position === 'fixed' || s.position === 'sticky')
          && el.getBoundingClientRect().height > 0
          && el.getBoundingClientRect().width > 0;
      }).slice(0, 25).map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        class: (el.className || '').toString().slice(0, 60),
        position: getComputedStyle(el).position,
        zIndex: getComputedStyle(el).zIndex,
        top: Math.round(el.getBoundingClientRect().top),
      })),
    };

    return { elements, domMap, viewport: { width: window.innerWidth, height: window.innerHeight } };
  });
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Governance layout overlap audit plan');
  lines.push('');
  lines.push(`Audited: \`${report.url}\` at ${report.auditedAt}`);
  lines.push('');
  lines.push('## Targets');
  lines.push('- **Main menu (sidebar):** `#app-sidebar` / `.app-sidebar-nav`');
  lines.push('- **Main menu (top chrome):** `#app-top-chrome`');
  lines.push('- **Primary content:** `#main-content` (`.governance-shell`)');
  lines.push('');
  for (const vp of report.viewports) {
    lines.push(`## Viewport: ${vp.label} (${vp.viewport.width}×${vp.viewport.height})`);
    lines.push('');
    const menu = vp.audit.elements.mainMenuSidebar;
    const content = vp.audit.elements.primaryContent;
    if (menu?.found && content?.found) {
      lines.push('### Bounding rects');
      lines.push('');
      lines.push('| Region | left | top | right | bottom | width | height |');
      lines.push('|--------|------|-----|-------|--------|-------|--------|');
      for (const [label, el] of [
        ['Sidebar (#app-sidebar)', menu],
        ['Primary (#main-content)', content],
        ['Top chrome', vp.audit.elements.topChrome],
        ['Scope bar', vp.audit.elements.scopeBar],
      ]) {
        if (!el?.found) continue;
        const r = el.rect;
        lines.push(`| ${label} | ${r.left} | ${r.top} | ${r.right} | ${r.bottom} | ${r.width} | ${r.height} |`);
      }
      lines.push('');
      lines.push(`**Overlap (sidebar × primary):** ${vp.overlap.overlaps ? `YES — ${vp.overlap.overlapPx}px²` : 'NO'}`);
      if (vp.overlap.overlapBox) {
        lines.push(`Overlap box: \`${JSON.stringify(vp.overlap.overlapBox)}\``);
      }
      lines.push(`Body classes: \`${vp.audit.domMap.bodyClasses}\``);
      lines.push('');
      if (vp.overlap.overlaps && vp.cssSuspects?.length) {
        lines.push('### CSS suspects (matched rules on overlapping elements)');
        lines.push('');
        for (const s of vp.cssSuspects) {
          lines.push(`- \`${s.href}\` — \`${s.selector}\``);
          if (s.cssText) lines.push(`  - \`${s.cssText}\``);
        }
        lines.push('');
      }
    }
  }
  lines.push('## Expected geometry (SSOT)');
  lines.push('');
  lines.push('- Desktop (>1200px): sidebar fixed 240px; content `margin-left: var(--sidebar-width)` in `public/css/09-governance.css`');
  lines.push('- Top chrome: fixed full-width; body `padding-top: var(--top-chrome-height)` in `public/styles.css`');
  lines.push('- ≤1200px: sidebar off-canvas; governance shell `margin-left: 0`');
  lines.push('');
  lines.push('## Regression gate');
  lines.push('`npm run test:journey:layout-overlap`');
  return lines.join('\n');
}

mkdirSync('test-results', { recursive: true });

const headless = process.env.HEADLESS === '1';
const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 100 });
const report = { auditedAt: new Date().toISOString(), url: `${BASE}/governance`, viewports: [] };

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  });
  await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (page.url().includes('/login')) {
    report.loginRedirect = true;
    await context.close();
    break;
  }
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));

  const audit = await extractLayoutAudit(page);
  const menuEl = audit.elements.mainMenuSidebar;
  const contentEl = audit.elements.primaryContent;
  const menuRect = menuEl?.found ? roundRect(menuEl.rect) : null;
  const contentRect = contentEl?.found ? roundRect(contentEl.rect) : null;
  const overlap = menuRect && contentRect ? rectsOverlap(menuRect, contentRect) : { overlaps: false, overlapPx: 0, overlapBox: null };

  const cssSuspects = [];
  if (overlap.overlaps) {
    for (const key of ['mainMenuSidebar', 'primaryContent', 'topChrome', 'scopeBar']) {
      const el = audit.elements[key];
      if (!el?.cssRules) continue;
      for (const rule of el.cssRules) {
        if (/margin|width|left|transform|position|padding-top|sidebar/.test(rule.cssText + rule.selector)) {
          cssSuspects.push(rule);
        }
      }
    }
  }

  report.viewports.push({
    label: vp.label,
    viewport: audit.viewport,
    audit,
    overlap,
    cssSuspects: cssSuspects.slice(0, 20),
  });

  if (!headless) await page.waitForTimeout(2000);
  await context.close();
}

writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
writeFileSync(OUT_MD, buildMarkdown(report));
console.log('Wrote', OUT_JSON);
console.log('Wrote', OUT_MD);
for (const vp of report.viewports) {
  console.log(`${vp.label}: sidebar×content overlap=${vp.overlap.overlaps} (${vp.overlap.overlapPx}px²)`);
}
if (!headless) await new Promise((r) => setTimeout(r, 2500));
await browser.close();
