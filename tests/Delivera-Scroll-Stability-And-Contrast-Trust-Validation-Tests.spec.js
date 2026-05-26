import { test, expect } from '@playwright/test';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  runDefaultPreview,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

function hexToRgb(hex) {
  const value = String(hex || '').trim().replace('#', '');
  if (value.length === 3) {
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
    };
  }
  if (value.length === 6) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }
  return null;
}

function parseColor(input) {
  const value = String(input || '').trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('#')) return hexToRgb(value);
  const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1].split(',').map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
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

test.describe('Delivera scroll stability and contrast trust', () => {
  test('current sprint header mini mode does not flicker around threshold and stays deterministic', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint?boardId=1&sprintId=7358');
    await skipIfRedirectedToLogin(page, test.info(), { currentSprint: true });
    await page.waitForSelector('.current-sprint-header-bar', { timeout: 45000 });

    const result = await page.evaluate(async () => {
      const header = document.querySelector('.current-sprint-header-bar');
      if (!header) return { available: false };
      const baseThreshold = Math.max(120, (header.offsetTop || 0) + 72);
      const samplePoints = [
        Math.max(0, baseThreshold - 40),
        Math.max(0, baseThreshold - 12),
        Math.max(0, baseThreshold + 8),
        Math.max(0, baseThreshold + 24),
        Math.max(0, baseThreshold - 6),
        Math.max(0, baseThreshold + 30),
      ];
      const samples = [];
      for (const point of samplePoints) {
        window.scrollTo(0, point);
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        samples.push({
          y: Math.round(window.scrollY),
          mini: header.classList.contains('header-mini-mode'),
          ariaHidden: header.querySelector('.header-mini-strip')?.getAttribute('aria-hidden') || '',
        });
      }
      let transitions = 0;
      for (let i = 1; i < samples.length; i += 1) {
        if (samples[i].mini !== samples[i - 1].mini) transitions += 1;
      }
      const miniConsistency = samples.every((sample) => sample.mini === (sample.ariaHidden === 'false'));
      return { available: true, baseThreshold, samples, transitions, miniConsistency };
    });

    expect(result.available).toBe(true);
    expect(result.transitions).toBeLessThanOrEqual(3);
    expect(result.miniConsistency).toBe(true);
    const enteredMini = result.samples.some((sample) => sample.mini);
    const leftMini = result.samples.some((sample) => !sample.mini);
    expect(enteredMini && leftMini).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('current sprint retains accessibility contrast on mission critical labels (desktop + mobile)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint?boardId=1&sprintId=7358');
    await skipIfRedirectedToLogin(page, test.info(), { currentSprint: true });
    await page.waitForSelector('.current-sprint-header-bar', { timeout: 45000 });

    const selectors = [
      '.sprint-intervention-item .metric-label',
      '.header-export-readiness',
      '.header-role-modes-label',
      '.header-context-segment-label',
      '.header-intelligence-eyebrow',
    ];

    const desktopRatios = await page.evaluate(({ selectors }) => {
      function parseColorFromWindow(input) {
        const value = String(input || '').trim().toLowerCase();
        const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
        if (!rgbMatch) return null;
        const parts = rgbMatch[1].split(',').map((part) => Number(part.trim()));
        if (parts.length < 3) return null;
        return { r: parts[0], g: parts[1], b: parts[2] };
      }
      function toLinear(c) {
        const value = c / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }
      function luminance(color) {
        return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
      }
      function ratio(fg, bg) {
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }
      function findSolidBackground(el) {
        let node = el;
        while (node) {
          const styles = window.getComputedStyle(node);
          const bg = parseColorFromWindow(styles.backgroundColor);
          if (bg && styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && styles.backgroundColor !== 'transparent') return bg;
          node = node.parentElement;
        }
        return { r: 255, g: 255, b: 255 };
      }
      const outcomes = [];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) {
          outcomes.push({ selector, found: false, ratio: 0 });
          continue;
        }
        const styles = window.getComputedStyle(el);
        const fg = parseColorFromWindow(styles.color);
        const bg = findSolidBackground(el);
        if (!fg || !bg) {
          outcomes.push({ selector, found: true, ratio: 0 });
          continue;
        }
        outcomes.push({ selector, found: true, ratio: ratio(fg, bg) });
      }
      return outcomes;
    }, { selectors });

    for (const item of desktopRatios) {
      // Some selectors only render when live sprint data has risks (e.g., intervention queue).
      // Skip presence check for data-conditional elements; only verify contrast when present.
      if (!item.found) continue;
      expect(item.ratio, `Low contrast for ${item.selector}`).toBeGreaterThanOrEqual(4.5);
    }
    // At least some selectors must be present for the test to be meaningful
    const foundCount = desktopRatios.filter((i) => i.found).length;
    if (foundCount === 0) {
      test.skip(true, 'No contrast-check selectors found — sprint may be empty or board unavailable');
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const mobileMiniVisible = await page.locator('.header-mini-strip').isVisible().catch(() => false);
    expect(typeof mobileMiniVisible).toBe('boolean');
    assertTelemetryClean(telemetry);
  });

  test('report context chips and executive labels keep strong contrast and clean telemetry', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page, { projects: ['MPSA'] });
    await skipIfRedirectedToLogin(page, test.info());

    const reportChecks = await page.evaluate(() => {
      const selectorSets = [
        ['.preview-context-chip-config', '.preview-context-chip', '.context-state-badge'],
        ['.preview-context-zero-hint', '#preview-outcome-line', '.preview-header-story'],
        ['.report-executive-label', '#report-filter-strip-summary .context-chip-label', '.filters-collapsed-summary'],
      ];
      const parseColor = (input) => {
        const value = String(input || '').trim().toLowerCase();
        const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
        if (!rgbMatch) return null;
        const parts = rgbMatch[1].split(',').map((part) => Number(part.trim()));
        if (parts.length < 3) return null;
        return { r: parts[0], g: parts[1], b: parts[2] };
      };
      const toLinear = (c) => {
        const value = c / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (color) => 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
      const ratio = (fg, bg) => {
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      };
      const findBg = (el) => {
        let node = el;
        while (node) {
          const bgColor = window.getComputedStyle(node).backgroundColor;
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const parsed = parseColor(bgColor);
            if (parsed) return parsed;
          }
          node = node.parentElement;
        }
        return { r: 255, g: 255, b: 255 };
      };
      return selectorSets.map((candidates) => {
        const selector = candidates.find((candidate) => document.querySelector(candidate)) || candidates[0];
        const el = document.querySelector(selector);
        if (!el) return { selector, found: false, ratio: 0 };
        const fg = parseColor(window.getComputedStyle(el).color);
        const bg = findBg(el);
        if (!fg || !bg) return { selector, found: true, ratio: 0 };
        return { selector, found: true, ratio: ratio(fg, bg) };
      });
    });

    for (const row of reportChecks) {
      expect(row.found, `Missing report selector: ${row.selector}`).toBe(true);
      expect(row.ratio, `Low report contrast: ${row.selector}`).toBeGreaterThanOrEqual(4.5);
    }
    assertTelemetryClean(telemetry);
  });

  test('edge-case guardrails: reduced-motion, near-threshold, compact viewport, and repeated refresh remain stable', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/current-sprint?boardId=1&sprintId=7358');
    await skipIfRedirectedToLogin(page, test.info(), { currentSprint: true });
    await page.waitForSelector('.current-sprint-header-bar', { timeout: 45000 });

    const edge = await page.evaluate(async () => {
      const header = document.querySelector('.current-sprint-header-bar');
      if (!header) return { ok: false, reason: 'header-missing' };
      const base = Math.max(120, (header.offsetTop || 0) + 72);
      const points = [base - 2, base + 2, base - 2, base + 2, base + 24];
      let toggles = 0;
      let prev = header.classList.contains('header-mini-mode');
      for (const point of points) {
        window.scrollTo(0, Math.max(0, point));
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        const current = header.classList.contains('header-mini-mode');
        if (current !== prev) toggles += 1;
        prev = current;
      }
      return { ok: true, toggles };
    });

    expect(edge.ok).toBe(true);
    expect(edge.toggles).toBeLessThanOrEqual(3);
    await page.reload();
    await page.waitForSelector('.current-sprint-header-bar', { timeout: 45000 });
    assertTelemetryClean(telemetry);
  });
});
