import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

const TABS = [
  { id: 'ready', label: 'Ready' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'proof', label: 'Proof' },
  { id: 'closed', label: 'Closed' },
];

function activeTab() {
  try {
    return new URLSearchParams(window.location.search).get('tab') || 'ready';
  } catch (_) {
    return 'ready';
  }
}

function filterCases(cases = [], tab = 'ready') {
  if (tab === 'closed') return cases.filter((c) => c.state === 'closed');
  if (tab === 'escalations') return cases.filter((c) => String(c.state || '').includes('escalation'));
  if (tab === 'waiting') return cases.filter((c) => String(c.state || '').includes('clarification') || String(c.state || '').includes('decision'));
  if (tab === 'proof') return cases;
  return cases.filter((c) => c.state !== 'closed');
}

function renderCaseCard(row = {}) {
  return `
    <article class="actions-case-card" data-case-id="${escapeHtml(row.id)}">
      <h2>${escapeHtml(row.title || `${row.project} scope review`)}</h2>
      <p>${escapeHtml((row.issueKeys || []).length)} related issues · ${row.needsApproval ? '1+ nudges ready' : 'monitoring'} · Proof: Medium</p>
      <button type="button" class="btn btn-primary btn-compact" data-open-case="${escapeHtml(row.id)}">Review case</button>
    </article>`;
}

async function loadCases() {
  const project = new URLSearchParams(window.location.search).get('project') || '';
  const qs = project ? `?project=${encodeURIComponent(project)}&status=open` : '?status=open';
  const res = await fetch(`/api/governance/interventions.json${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.cases || [];
}

function renderTabs(tab) {
  const mount = document.getElementById('actions-tabs');
  if (!mount) return;
  mount.innerHTML = TABS.map((t) => `
    <button type="button" class="actions-tab${t.id === tab ? ' is-active' : ''}" data-tab="${t.id}">${escapeHtml(t.label)}</button>
  `).join('');
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
  renderTabs(tab);
  const list = document.getElementById('actions-list');
  const proof = document.getElementById('actions-proof');
  const cases = await loadCases();
  const visible = filterCases(cases, tab);
  if (tab === 'proof') {
    if (list) list.hidden = true;
    if (proof) {
      proof.hidden = false;
      proof.innerHTML = '<p>Proof packs load from the same intervention evidence contract used on Portfolio.</p>';
    }
    return;
  }
  if (proof) proof.hidden = true;
  if (list) {
    list.hidden = false;
    list.innerHTML = visible.length
      ? visible.map(renderCaseCard).join('')
      : '<p class="actions-empty">No action needed now — monitoring continues.</p>';
  }
}

async function init() {
  document.title = 'Actions | Delivera';
  await paint();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
