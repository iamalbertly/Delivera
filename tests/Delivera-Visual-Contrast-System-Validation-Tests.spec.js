import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  mockGovernancePage,
  waitForGovernanceReady,
  waitForPortfolioReady,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';

function parseColor(input) {
  const value = String(input || '').trim().toLowerCase();
  const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1].split(',').map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] == null ? 1 : parts[3] };
}

function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(foreground, background) {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function effectiveBg(el) {
  let node = el;
  while (node) {
    const style = getComputedStyle(node);
    const bg = parseColor(style.backgroundColor);
    if (bg && bg.a > 0.65) return bg;
    node = node.parentElement;
  }
  return { r: 246, g: 248, b: 251, a: 1 };
}

function isNearBlack(rgb) {
  if (!rgb) return true;
  return rgb.r < 40 && rgb.g < 40 && rgb.b < 40;
}

async function auditPageContrast(page, selectorMap) {
  return page.evaluate(({ selectorMap }) => {
    function parseColor(input) {
      const value = String(input || '').trim().toLowerCase();
      const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
      if (!rgbMatch) return null;
      const parts = rgbMatch[1].split(',').map((part) => Number(part.trim()));
      if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] == null ? 1 : parts[3] };
    }
    function toLinear(channel) {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }
    function luminance({ r, g, b }) {
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }
    function contrastRatio(foreground, background) {
      const l1 = luminance(foreground);
      const l2 = luminance(background);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }
    function effectiveBg(el) {
      let node = el;
      while (node) {
        const style = getComputedStyle(node);
        const bg = parseColor(style.backgroundColor);
        if (bg && bg.a > 0.65) return bg;
        node = node.parentElement;
      }
      return { r: 246, g: 248, b: 251, a: 1 };
    }
    const failures = [];
    const samples = [];
    for (const [name, selector] of Object.entries(selectorMap)) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const style = getComputedStyle(el);
      const fg = parseColor(style.color);
      const bg = effectiveBg(el);
      const opacity = Number(style.opacity) || 1;
      if (opacity < 0.65) {
        failures.push({ name, selector, issue: `opacity ${opacity}` });
        continue;
      }
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      samples.push({ name, selector, ratio: Number(ratio.toFixed(2)), fg: style.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})` });
      if (ratio < 4.5) failures.push({ name, selector, ratio: Number(ratio.toFixed(2)), fg: style.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})` });
    }
    const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor);
    return { samples, failures, bodyBg };
  }, { selectorMap });
}

const PAGE_SPECS = [
  {
    path: '/governance',
    name: 'governance',
    ready: async (page) => {
      await mockGovernancePage(page);
      await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'SD'); });
      await page.goto('/governance');
      if (page.url().includes('/login')) return false;
      await waitForGovernanceReady(page);
      return true;
    },
    selectors: {
      heading: '[data-portfolio-signal] .portfolio-signal-headline, [data-portfolio-signal] h2',
      muted: '.portfolio-trust-bar, .portfolio-decision-required-row span',
      pill: '.portfolio-status-pill',
      card: '[data-portfolio-signal].portfolio-signal',
      sidebar: '.portfolio-rail .portfolio-why, .portfolio-decision',
      disabled: '[data-testid="portfolio-primary-cta"]:disabled, .btn:disabled',
    },
  },
  {
    path: '/report',
    name: 'report',
    ready: async (page) => {
      await page.goto('/report');
      if (page.url().includes('/login')) return false;
      await page.waitForSelector('body.report-page, .report-shell-top, #filters-panel', { timeout: 30000 }).catch(() => {});
      return true;
    },
    selectors: {
      heading: 'body.report-page header h1, .report-shell-title-block h1',
      muted: '.subtitle, .preview-summary-sticky',
      card: '.transparency-card, .delivera-card, .surface-card',
      context: '.header-context-strip, .shared-context-bar',
      disabled: '.btn:disabled',
    },
  },
  {
    path: '/current-sprint',
    name: 'current-sprint',
    ready: async (page) => {
      await page.goto('/current-sprint?boardId=1&sprintId=7358');
      if (page.url().includes('/login')) return false;
      await page.waitForSelector('header h1, .current-sprint-header-bar, body.current-sprint-page', { timeout: 45000 }).catch(() => {});
      return true;
    },
    selectors: {
      heading: 'header h1, .current-sprint-header-bar .header-sprint-name, .section-inline-header h2',
      muted: '.subtitle, .header-context-segment-label, .metric-label',
      alert: '.alert-banner',
      card: '.transparency-card, .delivera-card, main .container',
      risk: '.stories-risk-chip, .story-risk-pill, .status-pill',
      disabled: '.btn:disabled',
    },
  },
  {
    path: '/leadership.html',
    name: 'leadership',
    ready: async (page) => {
      await page.goto('/leadership.html');
      if (page.url().includes('/login')) return false;
      await page.waitForSelector('body.hud-mode .hud-title, .hud-shell', { timeout: 30000 }).catch(() => {});
      return true;
    },
    selectors: {
      heading: '.hud-title',
      muted: '.hud-subtitle, .hud-summary-line',
      pill: '.hud-status-pill',
      card: '.hud-card, .leadership-direct-value-card',
      disabled: '.btn:disabled',
    },
  },
];

test.describe('Delivera visual contrast system', () => {
  for (const spec of PAGE_SPECS) {
    test(`${spec.name} page uses light surface and readable hierarchy`, async ({ page }, testInfo) => {
      const ready = await spec.ready(page);
      if (!ready) {
        test.skip(true, 'Auth required or page did not load');
        return;
      }

      const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const bodyRgb = parseColor(bodyBg);
      expect(isNearBlack(bodyRgb), `body background should not be near-black: ${bodyBg}`).toBe(false);

      await page.screenshot({
        path: testInfo.outputPath(`contrast-${spec.name}.png`),
        fullPage: false,
      });

      const audit = await auditPageContrast(page, spec.selectors);
      expect(audit.samples.length, `expected contrast samples on ${spec.name}`).toBeGreaterThanOrEqual(2);

      if (audit.failures.length) {
        throw new Error(`Contrast failures on ${spec.name}: ${JSON.stringify(audit.failures, null, 2)}`);
      }
    });
  }

  test('shared component selectors meet WCAG AA contrast', async ({ page }) => {
    await mockGovernancePage(page);
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'SD'); });
    await page.goto('/governance');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    await waitForPortfolioReady(page);

    const componentSelectors = {
      card: '.card, .delivera-card, [data-portfolio-signal].portfolio-signal',
      'status-pill': '.status-pill, .portfolio-status-pill',
      'alert-banner': '.alert-banner, .alert-error, .portfolio-signal-error',
      'context-strip': '.context-strip, .header-context-strip, .portfolio-trust-bar',
      'sidebar-card': '.sidebar-card, .context-card, .portfolio-rail .portfolio-why',
      btn: '.btn.btn-primary, [data-testid="portfolio-primary-cta"]',
      'btn-secondary': '.btn.btn-secondary',
      'btn-disabled': '.btn:disabled, .btn-disabled',
      muted: '.muted, .text-muted, .portfolio-trust-bar',
      'risk-chip': '.risk-chip, .portfolio-status-pill--material-risk, .portfolio-status-pill--evidence-gap',
    };

    const audit = await auditPageContrast(page, componentSelectors);
    const checked = audit.samples.filter((s) => s.ratio > 0);
    expect(checked.length).toBeGreaterThanOrEqual(4);
    if (audit.failures.length) {
      throw new Error(`Component contrast failures: ${JSON.stringify(audit.failures, null, 2)}`);
    }
  });
});
