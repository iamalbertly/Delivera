async (page) => {
  const findings = { pages: {}, consoleErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') findings.consoleErrors.push({ url: page.url(), text: msg.text().slice(0, 240) });
  });
  page.on('pageerror', (err) => {
    findings.consoleErrors.push({ url: page.url(), text: String(err.message || err).slice(0, 240) });
  });

  async function skim(label) {
    await page.waitForTimeout(2000);
    findings.pages[label] = await page.evaluate(() => {
      const text = (document.body && document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000);
      const selects = Array.from(document.querySelectorAll('select')).map((s) => ({
        id: s.id, value: s.value, label: s.getAttribute('aria-label'),
      }));
      const headlines = Array.from(document.querySelectorAll('h1,h2,[class*="headline"]'))
        .slice(0, 10).map((el) => el.textContent.trim().slice(0, 140));
      const cards = Array.from(document.querySelectorAll('[data-testid="portfolio-bento-card"], [data-portfolio-card]'))
        .map((el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 180));
      const main = document.getElementById('main-content');
      const rightGap = main
        ? { unused: Math.max(0, window.innerWidth - main.getBoundingClientRect().right), vw: window.innerWidth }
        : null;
      return {
        title: document.title,
        url: location.href,
        text,
        dataState: (document.body && document.body.getAttribute('data-delivera-data-state')) || '',
        loading: !!document.querySelector('[data-testid="instant-shell"], .instant-shell[aria-busy="true"]'),
        selects,
        headlines,
        cards: cards.slice(0, 8),
        rightGap,
      };
    });
  }

  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    document.querySelectorAll('dialog').forEach((d) => { try { d.close(); } catch (e) { /* */ } });
    const btn = document.getElementById('wdd-close-btn');
    if (btn) btn.click();
  });

  await page.goto('http://localhost:3001/governance', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.removeItem('delivera_selectedProjects');
      localStorage.setItem('delivera_portfolio_peer_preset_v1', '1');
      localStorage.setItem('delivera_portfolio_anchor', '__ALL__');
    } catch (e) { /* */ }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await skim('gov1');

  const sel = page.locator('#portfolio-scope-selected');
  if (await sel.count()) {
    await sel.selectOption('__ALL__').catch(() => {});
    await page.waitForTimeout(1500);
  }
  await skim('gov_all');

  const compareAll = page.locator('[data-portfolio-compare-all]');
  if (await compareAll.count()) await compareAll.click().catch(() => {});

  for (const label of ['Inspect', 'Upload', 'Set baseline', 'More', 'Filters']) {
    const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
    if (await btn.count()) {
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
    }
  }
  await skim('gov_ctas');

  if (await sel.count()) {
    await sel.selectOption('SD').catch(() => {});
    await page.waitForTimeout(2500);
  }
  await skim('gov_dms');

  await page.goto('http://localhost:3001/current-sprint', { waitUntil: 'domcontentloaded' });
  await skim('sprint');
  for (const name of ['Board', 'Nudge', 'Stories', 'Refresh']) {
    const b = page.getByRole('button', { name: new RegExp(name, 'i') }).first();
    if (await b.count()) await b.click({ timeout: 1200 }).catch(() => {});
  }
  await skim('sprint2');

  await page.goto('http://localhost:3001/actions', { waitUntil: 'domcontentloaded' });
  await skim('actions');

  await page.goto('http://localhost:3001/settings', { waitUntil: 'domcontentloaded' });
  await skim('settings');

  await page.goto('http://localhost:3001/governance', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  findings.contradiction = await page.evaluate(() => {
    const t = document.body.innerText;
    const pb = t.match(/\d+\/\d+ plan-backed/);
    return {
      noDecision: /No governance decision required/i.test(t),
      blocked: /DELIVERY BLOCKED|Blocked|UPLOAD PI SLIDE/i.test(t),
      stalled: /Sprint stalled|0% movement|0% delivered/i.test(t),
      allDup: (t.match(/All Projects/g) || []).length,
      literalAll: /__ALL__/.test(t),
      dms: /DMS|SD-\d+/i.test(t),
      fin: /FIN|Finance|TowerCo/i.test(t),
      planBacked: pb ? pb[0] : null,
    };
  });
  findings.consoleErrors = findings.consoleErrors.slice(0, 50);
  return findings;
}
