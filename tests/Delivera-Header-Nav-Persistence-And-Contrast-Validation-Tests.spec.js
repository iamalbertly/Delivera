import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text() || '';
    if (/HUD Fetch Error/i.test(text)) return;
    errors.push(`[console:${type}] ${text}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`[pageerror] ${error?.message || String(error)}`);
  });
  page.__deliveraCapturedConsole = errors;
});

test.afterEach(async ({ page }) => {
  const captured = page.__deliveraCapturedConsole || [];
  expect(captured, captured.join('\n')).toEqual([]);
});

test.describe('Header and nav persistence with contrast trust', () => {
  test('all key pages keep top header and left menu persistent', async ({ page }) => {
    const paths = ['/report', '/current-sprint', '/leadership', '/teams', '/home', '/value-delivery', '/risks-blockers'];
    for (const path of paths) {
      await page.goto(path);
      if (page.url().includes('login')) {
        test.skip(true, 'Redirected to login');
        return;
      }
      await expect(page.locator('.app-sidebar')).toHaveCount(1);
      await expect(page.locator('header')).toHaveCount(1);
      const contract = await page.locator('header').evaluate((node) => ({
        sticky: getComputedStyle(node).position,
        shared: node.getAttribute('data-shared-header'),
      }));
      expect(contract.sticky).toBe('sticky');
      expect(contract.shared).toBe('true');
    }
  });

  test('sidebar and primary header text contrast meets AA minimum', async ({ page }) => {
    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    const samples = await page.evaluate(() => {
      const parse = (input) => {
        const match = String(input || '').match(/rgba?\(([^)]+)\)/i);
        if (!match) return null;
        const parts = match[1].split(',').map((part) => Number(part.trim()));
        return {
          r: parts[0] || 0,
          g: parts[1] || 0,
          b: parts[2] || 0,
          a: parts[3] == null ? 1 : parts[3],
        };
      };
      const firstBgColorFromGradient = (input) => {
        const match = String(input || '').match(/rgba?\([^)]*\)/i);
        return match ? parse(match[0]) : null;
      };
      const lum = (rgb) => {
        const c = (v) => {
          const x = v / 255;
          return x <= 0.03928 ? (x / 12.92) : Math.pow((x + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * c(rgb.r) + 0.7152 * c(rgb.g) + 0.0722 * c(rgb.b);
      };
      const ratio = (fg, bg) => {
        const a = lum(fg);
        const b = lum(bg);
        const hi = Math.max(a, b);
        const lo = Math.min(a, b);
        return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
      };
      const effectiveBg = (el) => {
        let node = el;
        while (node) {
          const style = getComputedStyle(node);
          const bg = parse(style.backgroundColor);
          if (bg && bg.a > 0) return bg;
          const fromGradient = firstBgColorFromGradient(style.backgroundImage);
          if (fromGradient) return fromGradient;
          node = node.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      };
      const getSample = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const style = getComputedStyle(el);
        const fg = parse(style.color);
        const bg = effectiveBg(el);
        if (!fg || !bg) return null;
        return {
          selector,
          fg: style.color,
          bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
          ratio: ratio(fg, bg),
        };
      };
      return [
        getSample('.app-sidebar .sidebar-link:not(.active):not(.current)'),
        getSample('.app-sidebar .sidebar-link.active, .app-sidebar .sidebar-link.current'),
        getSample('.sidebar-context-card .context-card-segment'),
        getSample('header h1'),
        getSample('header .btn.btn-primary'),
      ].filter(Boolean);
    });

    expect(samples.length).toBeGreaterThanOrEqual(4);
    for (const sample of samples) {
      if (sample.ratio < 4.5) {
        throw new Error(`Contrast below AA for ${sample.selector}: ${sample.ratio} (fg=${sample.fg}, bg=${sample.bg})`);
      }
    }
  });

  test('nav-driven route changes keep shared header contract', async ({ page }) => {
    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    const routeByKey = ['teams', 'report', 'sprints', 'leadership', 'dashboard'];
    for (const key of routeByKey) {
      const selector = `a[data-nav-key="${key}"], .sidebar-more-link[data-nav-key="${key}"]`;
      const targetCount = await page.locator(selector).count();
      if (targetCount < 1) continue;
      if (key === 'leadership' || key === 'dashboard') {
        const moreSummary = page.locator('.sidebar-more-summary');
        if (await moreSummary.count()) {
          await moreSummary.first().click().catch(() => null);
        }
      }
      await page.locator(selector).first().click();
      await expect(page.locator('.app-sidebar')).toHaveCount(1);
      await expect(page.locator('header')).toHaveCount(1);
      const isShared = await page.locator('header').first().getAttribute('data-shared-header');
      expect(isShared).toBe('true');
    }
  });

  test('accent cards keep readable contrast on executive pages', async ({ page }) => {
    const pages = ['/value-delivery', '/risks-blockers'];
    for (const path of pages) {
      await page.goto(path);
      if (page.url().includes('login')) {
        test.skip(true, 'Redirected to login');
        return;
      }
      const audit = await page.evaluate(() => {
        const parse = (input) => {
          const match = String(input || '').match(/rgba?\(([^)]+)\)/i);
          if (!match) return null;
          const parts = match[1].split(',').map((part) => Number(part.trim()));
          return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] == null ? 1 : parts[3] };
        };
        const lum = (rgb) => {
          const c = (v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * c(rgb.r) + 0.7152 * c(rgb.g) + 0.0722 * c(rgb.b);
        };
        const ratio = (fg, bg) => {
          const a = lum(fg);
          const b = lum(bg);
          return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
        };
        const card = document.querySelector('.surface-card-accent');
        if (!card) return null;
        const cardStyle = getComputedStyle(card);
        const bg = parse(cardStyle.backgroundColor);
        const heading = card.querySelector('h2');
        const body = card.querySelector('p');
        const hColor = parse(getComputedStyle(heading).color);
        const pColor = parse(getComputedStyle(body).color);
        return {
          bg: cardStyle.backgroundColor,
          headingRatio: hColor && bg ? ratio(hColor, bg) : null,
          bodyRatio: pColor && bg ? ratio(pColor, bg) : null,
        };
      });
      expect(audit).toBeTruthy();
      expect(audit.bg).not.toContain('rgba(0, 0, 0, 0)');
      expect(audit.headingRatio).toBeGreaterThanOrEqual(4.5);
      expect(audit.bodyRatio).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('executive header avoids duplicate create-work actions in same viewport', async ({ page }) => {
    const pages = ['/home', '/risks-blockers'];
    for (const path of pages) {
      await page.goto(path);
      if (page.url().includes('login')) {
        test.skip(true, 'Redirected to login');
        return;
      }
      const count = await page.locator('header [data-open-outcome-modal]:visible').count();
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});
