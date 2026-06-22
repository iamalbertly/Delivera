import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

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

function renderCaseCard(row = {}, { highlight = false } = {}) {
  const proof = row.proofLevel || 'Medium';
  return `
    <article class="actions-case-card${highlight ? ' is-highlighted' : ''}" data-case-id="${escapeHtml(row.id)}" id="case-${escapeHtml(row.id)}">
      <h2>${escapeHtml(row.title || `${row.project} scope review`)}</h2>
      <p>${escapeHtml((row.issueKeys || []).length)} related issues · ${row.needsApproval ? '1+ nudges ready' : 'monitoring'} · Proof: ${escapeHtml(proof)}</p>
      <button type="button" class="btn btn-primary btn-compact" data-open-case="${escapeHtml(row.id)}">Review case</button>
    </article>`;
}

async function loadCases() {
  const project = readQuery().get('project') || '';
  const qs = project ? `?project=${encodeURIComponent(project)}&status=open` : '?status=open';
  const res = await fetch(`/api/governance/interventions.json${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.cases || [];
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
  const cases = await loadCases();
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
      ? visible.map((row) => renderCaseCard(row, { highlight: row.id === highlightId })).join('')
      : '<p class="actions-empty">No action needed now — monitoring continues.</p>';
    if (highlightId) {
      document.getElementById(`case-${highlightId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

async function init() {
  document.title = 'Actions | Delivera';
  await paint();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
