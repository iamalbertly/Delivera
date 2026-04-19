function csvEscape(val) {
  const s = String(val == null ? '' : val).trim();
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function exportLeadershipBoardsCsv(root = document) {
  const content = root.getElementById ? root.getElementById('leadership-content') : document.getElementById('leadership-content');
  if (!content) return;
  const table = content.querySelector('.leadership-card table.data-table');
  if (!table) return;
  const headers = Array.from(table.querySelectorAll('thead tr:first-child th')).map((th) => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim())
  );
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map((row) => row.map(csvEscape).join(','));
  const csv = [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const metaEl = content.querySelector('.leadership-meta-attrs');
  const rangeStart = metaEl?.getAttribute('data-range-start') || '';
  const rangeEnd = metaEl?.getAttribute('data-range-end') || '';
  const projects = (metaEl?.getAttribute('data-projects') || '').replace(/\s+/g, '');
  let filename = 'leadership-boards';
  if (projects) filename += '_' + projects;
  if (rangeStart && rangeEnd) filename += '_' + rangeStart + '_' + rangeEnd;
  filename += '.csv';
  if (filename === 'leadership-boards.csv') filename = 'leadership-boards-' + new Date().toISOString().slice(0, 10) + '.csv';
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => window.URL.revokeObjectURL(url), 500);
}

export function exportLeadershipKpisCsv(root = document) {
  const raw = (root.getElementById ? root.getElementById('leadership-kpi-export-data') : document.getElementById('leadership-kpi-export-data'))?.textContent || '';
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return;
  const csv = [
    'Project,Cost per SP,Overhead,Utilization,Predictability,Rework,Epic TTM (days),Trust',
    ...lines.map((line) => line.split('|').map(csvEscape).join(',')),
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leadership-kpis-${stamp}.csv`;
  a.click();
  setTimeout(() => window.URL.revokeObjectURL(url), 500);
}

function buildLeadershipQuarterlyStory(root = document) {
  const container = root.getElementById ? root.getElementById('leadership-content') : document.getElementById('leadership-content');
  if (!container) return '';
  const recommendation = container.querySelector('.leadership-mission-copy h2')?.textContent?.trim() || 'Leadership snapshot';
  const recommendationBody = container.querySelector('.leadership-mission-copy p:last-of-type')?.textContent?.trim() || '';
  const kpiCards = Array.from(container.querySelectorAll('.leadership-kpi-project-card')).map((card) => {
    const title = card.querySelector('h3')?.textContent?.trim() || 'Project';
    const facts = Array.from(card.querySelectorAll('dd')).slice(0, 4).map((el) => el.textContent.trim()).filter(Boolean);
    return `- ${title}: ${facts.join(' | ')}`;
  });
  const outliers = Array.from(container.querySelectorAll('.leadership-outlier-panel li')).slice(0, 5).map((item) => {
    const text = item.textContent.replace(/\s+/g, ' ').trim();
    return `- ${text}`;
  });
  const trust = container.querySelector('.leadership-trust-card')?.textContent?.replace(/\s+/g, ' ')?.trim() || 'Trust details unavailable.';
  return [
    '# Quarterly leadership story',
    '',
    '## Recommendation',
    `- ${recommendation}`,
    recommendationBody ? `- ${recommendationBody}` : '',
    '',
    '## KPI snapshot',
    ...(kpiCards.length ? kpiCards : ['- KPI comparison unavailable for this context.']),
    '',
    '## Observations',
    ...(outliers.length ? outliers : ['- No delivery outliers crossed the active thresholds in this window.']),
    '',
    '## Trust and assumptions',
    `- ${trust}`,
  ].filter(Boolean).join('\n');
}

export async function exportLeadershipQuarterlyStory(root = document) {
  const story = buildLeadershipQuarterlyStory(root);
  if (!story) return;
  try {
    await navigator.clipboard.writeText(story);
  } catch (_) {
    const blob = new Blob([story], { type: 'text/markdown;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leadership-quarterly-story.md';
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 500);
  }
}

function buildManagerBriefing(root = document) {
  const container = root.getElementById ? root.getElementById('leadership-content') : document.getElementById('leadership-content');
  if (!container) return '';
  const metaEl = container.querySelector('.leadership-meta-attrs');
  const rangeStart = metaEl?.getAttribute('data-range-start') || '';
  const rangeEnd = metaEl?.getAttribute('data-range-end') || '';
  const projectsLabel = (metaEl?.getAttribute('data-projects-label') || '').trim();
  const generatedAt = metaEl?.getAttribute('data-generated-at') || '';
  const headline = container.querySelector('.leadership-mission-copy h2')?.textContent?.trim() || 'Leadership snapshot';
  const trustLine = container.querySelector('.leadership-mission-trust-line')?.textContent?.trim() || '';
  const topRisks = Array.from(container.querySelectorAll('.leadership-risk-list li')).slice(0, 3).map((li) => li.textContent.replace(/\s+/g, ' ').trim());
  const attentionItems = Array.from(container.querySelectorAll('.attention-queue-item')).slice(0, 2).map((el) => el.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const windowLine = `Window: ${rangeStart} – ${rangeEnd}` + (projectsLabel ? ` | Projects: ${projectsLabel}` : '');
  let genReadable = '';
  if (generatedAt) {
    const d = new Date(generatedAt);
    genReadable = !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : generatedAt;
  }
  const parts = [
    'MANAGER BRIEFING — Jira portfolio (reporting tool)',
    '',
    windowLine,
    '',
    `Priority: ${headline}`,
  ];
  if (trustLine) parts.push(trustLine);
  if (topRisks.length) {
    parts.push('');
    parts.push('Intervention priority:');
    topRisks.forEach((r) => parts.push('• ' + r));
  } else if (attentionItems.length) {
    parts.push('');
    parts.push('Signals:');
    attentionItems.forEach((r) => parts.push('• ' + r));
  }
  parts.push('');
  parts.push(`Manager link: ${origin}/leadership`);
  if (genReadable) parts.push(`KPI snapshot time: ${genReadable}`);
  return parts.join('\n');
}

export async function exportManagerBriefing(root = document) {
  const text = buildManagerBriefing(root);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manager-briefing.txt';
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 500);
  }
}

const LEADERSHIP_COL_LABELS = ['Board', 'Projects', 'Sprints', 'Done Stories', 'Done SP', 'SP / Day', 'Stories / Day', 'Indexed Delivery', 'On-time %'];

function updateLeadershipSortIndicator(table, colIndex, dir) {
  const thead = table && table.querySelector('thead');
  if (!thead) return;
  const ths = thead.querySelectorAll('th.sortable');
  ths.forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    const oldSpan = th.querySelector('.sort-indicator');
    if (oldSpan) oldSpan.remove();
  });
  const activeTh = ths[colIndex];
  if (activeTh) {
    activeTh.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
    const span = document.createElement('span');
    span.className = 'sort-indicator';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = dir === 'asc' ? ' ▲' : ' ▼';
    activeTh.appendChild(span);
  }
  const labelEl = document.getElementById('leadership-sort-label');
  if (labelEl) {
    const colName = LEADERSHIP_COL_LABELS[colIndex] || ('Column ' + (colIndex + 1));
    labelEl.textContent = 'Click any column header to sort. Sorted by ' + colName + (dir === 'asc' ? ' ▲' : ' ▼');
  }
}

export function wireLeadershipContentInteractions(root = document) {
  if (root?.body?.dataset?.leadershipContentInteractionsBound === '1') return;
  if (root?.body) root.body.dataset.leadershipContentInteractionsBound = '1';

  root.addEventListener('click', (ev) => {
    const contextActionEl = ev.target && ev.target.closest ? ev.target.closest('[data-context-action]') : null;
    if (contextActionEl && contextActionEl.getAttribute('data-context-action') === 'refresh-context') {
      const previewBtn = document.getElementById('leadership-preview') || document.getElementById('preview-btn');
      previewBtn?.click?.();
      return;
    }
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-action') === 'export-leadership-boards-csv') {
      exportLeadershipBoardsCsv(document);
      return;
    }
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-action') === 'export-leadership-kpis-csv') {
      exportLeadershipKpisCsv(document);
      return;
    }
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-action') === 'export-leadership-manager-briefing') {
      exportManagerBriefing(document);
      return;
    }
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-action') === 'export-leadership-quarterly-story') {
      exportLeadershipQuarterlyStory(document);
      return;
    }
    const viewBtn = ev.target && ev.target.closest ? ev.target.closest('#leadership-content [data-leadership-view]') : null;
    if (viewBtn) {
      const view = viewBtn.getAttribute('data-leadership-view');
      const cardsEl = document.getElementById('leadership-boards-cards');
      const tableWrap = document.getElementById('leadership-boards-table-wrap');
      const content = document.getElementById('leadership-content');
      const allViewBtns = content ? content.querySelectorAll('[data-leadership-view]') : [];
      allViewBtns.forEach((b) => {
        const active = b.getAttribute('data-leadership-view') === view;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (view === 'cards') {
        if (cardsEl) cardsEl.hidden = false;
        if (tableWrap) tableWrap.hidden = true;
      } else {
        if (cardsEl) cardsEl.hidden = true;
        if (tableWrap) tableWrap.hidden = false;
      }
      return;
    }
    const limitedToggle = ev.target && ev.target.closest ? ev.target.closest('[data-action="toggle-limited-boards"]') : null;
    if (limitedToggle) {
      const limitedWrap = document.getElementById('leadership-limited-cards');
      if (limitedWrap) {
        const show = limitedWrap.hidden;
        limitedWrap.hidden = !show;
        limitedToggle.setAttribute('aria-expanded', show ? 'true' : 'false');
        const count = limitedWrap.querySelectorAll('.leadership-board-card').length;
        limitedToggle.textContent = show
          ? count + ' board' + (count !== 1 ? 's' : '') + ' with insufficient data — Hide'
          : count + ' board' + (count !== 1 ? 's' : '') + ' hidden (insufficient data) — Show all';
      }
      return;
    }
    const th = ev.target && ev.target.closest ? ev.target.closest('#leadership-content th.sortable[data-sort]') : null;
    if (!th) return;
    const table = th.closest('table.leadership-boards-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const colIndex = Array.from(th.parentElement.children).indexOf(th);
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const lastSort = table.getAttribute('data-sort-col');
    const lastDir = table.getAttribute('data-sort-dir');
    const dir = lastSort === String(colIndex) && lastDir === 'asc' ? 'desc' : 'asc';
    table.setAttribute('data-sort-col', String(colIndex));
    table.setAttribute('data-sort-dir', dir);
    const numericCols = { 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true };
    const num = numericCols[colIndex];
    rows.sort((a, b) => {
      const aCell = (a.children[colIndex] && a.children[colIndex].textContent) || '';
      const bCell = (b.children[colIndex] && b.children[colIndex].textContent) || '';
      let aVal = aCell.trim();
      let bVal = bCell.trim();
      if (num) {
        const aNum = parseFloat(aVal.replace(/,/g, '')) || 0;
        const bNum = parseFloat(bVal.replace(/,/g, '')) || 0;
        return dir === 'asc' ? aNum - bNum : bNum - aNum;
      }
      return dir === 'asc' ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) : (bVal < aVal ? -1 : bVal > aVal ? 1 : 0);
    });
    rows.forEach((r) => tbody.appendChild(r));
    updateLeadershipSortIndicator(table, colIndex, dir);
  });
}
