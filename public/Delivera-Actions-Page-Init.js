import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { listCases, loadCase, renderActionsCaseCard } from './Delivera-App-Governance-InterventionCase-02Client-SSOT.js';

const TABS = [
  { id: 'ready', label: 'Ready' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'proof', label: 'Proof' },
  { id: 'closed', label: 'Closed' },
];

function readQuery() {
  try {
    return new URLSearchParams(window.location.search);
  } catch (_) {
    return new URLSearchParams();
  }
}

function activeTab() {
  return readQuery().get('tab') || 'ready';
}

function filterCases(cases = [], tab = 'ready') {
  if (tab === 'closed') return cases.filter((c) => c.state === 'closed');
  if (tab === 'escalations') return cases.filter((c) => String(c.state || '').includes('escalation'));
  if (tab === 'waiting') {
    return cases.filter((c) => String(c.state || '').includes('clarification') || String(c.state || '').includes('decision'));
  }
  if (tab === 'proof') return cases.filter((c) => c.state !== 'closed');
  if (tab === 'ready') return cases.filter((c) => c.needsApproval && c.state !== 'closed');
  return cases.filter((c) => c.state !== 'closed');
}

function tabCounts(cases = []) {
  return TABS.reduce((acc, tab) => {
    acc[tab.id] = filterCases(cases, tab.id).length;
    return acc;
  }, {});
}

function renderTabs(tab, counts = {}) {
  const mount = document.getElementById('actions-tabs');
  if (!mount) return;
  mount.innerHTML = TABS.map((t) => {
    const n = counts[t.id] || 0;
    const badge = n > 0 && t.id !== 'proof' ? ` <span class="actions-tab-count">${n}</span>` : '';
    return `<button type="button" class="actions-tab${t.id === tab ? ' is-active' : ''}" data-tab="${t.id}">${escapeHtml(t.label)}${badge}</button>`;
  }).join('');
  mount.onclick = (ev) => {
    const btn = ev.target.closest('[data-tab]');
    if (!btn) return;
    const next = btn.getAttribute('data-tab');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState({}, '', url);
    paint(next);
  };
}

async function paint(tab = activeTab()) {
  const project = readQuery().get('project') || '';
  const cases = await listCases({ project, status: 'open' });
  const counts = tabCounts(cases);
  renderTabs(tab, counts);
  const list = document.getElementById('actions-list');
  const proof = document.getElementById('actions-proof');
  const highlightId = readQuery().get('caseId') || '';
  const visible = filterCases(cases, tab);
  if (tab === 'proof') {
    if (list) list.hidden = true;
    if (proof) {
      proof.hidden = false;
      proof.innerHTML = '<p class="actions-proof-lead">Proof packs use the same intervention evidence contract as Portfolio.</p>';
    }
    return;
  }
  if (proof) proof.hidden = true;
  if (list) {
    list.hidden = false;
    list.innerHTML = visible.length
      ? visible.map((row) => renderActionsCaseCard(row, { highlight: row.id === highlightId })).join('')
      : '<p class="actions-empty">No action needed now — monitoring continues.</p>';
    if (highlightId) {
      document.getElementById(`case-${highlightId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

async function openCaseReview(caseId) {
  if (!caseId) return;
  let row;
  try {
    row = await loadCase(caseId);
  } catch (_) {
    return;
  }
  const list = document.getElementById('actions-list');
  const card = document.getElementById(`case-${caseId}`);
  if (!card || !list) return;
  let panel = card.querySelector('.actions-case-detail');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'actions-case-detail';
    card.appendChild(panel);
  }
  const issues = (row.issueKeys || []).join(', ');
  panel.innerHTML = `
    <p><strong>State:</strong> ${escapeHtml(row.state || 'open')}</p>
    <p><strong>Issues:</strong> ${escapeHtml(issues || '—')}</p>
    <p>${escapeHtml(row.primaryAction?.action || 'Review facts and approve the next nudge when ready.')}</p>
    <a class="btn btn-primary btn-compact" href="/governance">Open portfolio context</a>`;
  panel.hidden = false;
  card.classList.add('is-expanded');
  card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function init() {
  document.title = 'Actions | Delivera';
  await paint();
  const reviewId = readQuery().get('caseId');
  if (readQuery().get('review') === '1' && reviewId) await openCaseReview(reviewId);
  document.getElementById('actions-list')?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-open-case]');
    if (!btn) return;
    const id = btn.getAttribute('data-open-case');
    const url = new URL(window.location.href);
    url.searchParams.set('caseId', id);
    url.searchParams.set('review', '1');
    window.history.replaceState({}, '', url);
    await openCaseReview(id);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
