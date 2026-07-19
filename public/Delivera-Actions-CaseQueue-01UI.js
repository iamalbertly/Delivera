import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openPromiseDrawer } from './Delivera-App-Governance-ActiveLoop-01UI.js?v=20260719e';

const mount = document.getElementById('actions-queue-mount');
const summary = document.getElementById('actions-queue-summary');
const stateFilter = document.getElementById('actions-state-filter');
const ownerFilter = document.getElementById('actions-owner-filter');
let cases = [];
const routeContext = new URLSearchParams(location.search);
const selectedSquad = String(routeContext.get('squad') || '').trim().toUpperCase();

function render() {
  const state = stateFilter?.value || '';
  const owner = ownerFilter?.value || '';
  const visible = cases.filter((item) => !state || item.state === state)
    .filter((item) => !owner || (owner === 'unresolved' ? item.ownerRoute?.unresolved || !item.ownerRoute?.displayName : item.ownerRoute?.displayName && !item.ownerRoute?.unresolved));
  summary.textContent = `${visible.length} action${visible.length === 1 ? '' : 's'} ready from the shared governance ledger.`;
  const grouped = new Map();
  visible.forEach((item) => {
    const key = item.groupKey || `${item.squadId || item.squad}|${item.actionType || 'review'}|${item.sourceEntityId || item.promiseId}|${item.dueState || item.state}`;
    const group = grouped.get(key) || [];
    group.push(item); grouped.set(key, group);
  });
  mount.innerHTML = visible.length ? [...grouped.values()].map((group) => {
    const item = group[0];
    const title = group.length > 1 ? `${group.length} promises share this correction` : item.title;
    const affected = group.length > 1 ? `<small>${escapeHtml(group.map((entry) => entry.title).slice(0, 3).join(' · '))}</small>` : '';
    const sourceHref = `/governance?spotlight=${encodeURIComponent(item.squadId || item.squad)}&view=squad`;
    return `<article class="action-case-row" data-action-case="${escapeHtml(item.promiseId)}" data-action-detail="${escapeHtml(item.detailHref || '')}" data-action-squad="${escapeHtml(item.squadId || item.squad)}"><div><span>${escapeHtml(item.squadDisplayName || item.squad)}${item.issueKey ? ` · ${escapeHtml(item.issueKey)}` : ''}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(item.lifecycle || 'Needs governance attention.')}</p>${affected}<a class="action-case-source" href="${sourceHref}">Open squad evidence</a></div><div class="action-case-next"><small>${escapeHtml(item.ownerRoute?.displayName || item.ownerRoute?.role || 'PI Team queue')}</small><button type="button" class="btn btn-primary btn-compact">${escapeHtml(item.nextAction?.label || 'Review missing proof')}</button></div></article>`;
  }).join('') : '<div class="empty-state"><h3>No actions match this view</h3><p>Change the state filter or return to Governance for the portfolio answer.</p></div>';
  mount.querySelectorAll('[data-action-case] button').forEach((button) => button.addEventListener('click', () => {
    const row = button.closest('[data-action-case]');
    return openPromiseDrawer(row.dataset.actionCase, { detailHref: row.dataset.actionDetail });
  }));
}

async function load() {
  try {
    const query = new URLSearchParams();
    if (selectedSquad) query.set('squad', selectedSquad);
    const response = await fetch(`/api/governance/actions.json${query.size ? `?${query}` : ''}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    cases = (await response.json()).cases || [];
    if (selectedSquad) summary.textContent = `Showing ${selectedSquad} actions only.`;
    render();
  } catch (_) {
    mount.innerHTML = '<div class="empty-state"><h3>Last verified action queue is unavailable</h3><p>Governance evidence remains read-only until the queue can be restored.</p></div>';
    summary.textContent = 'Queue unavailable.';
  }
}

stateFilter?.addEventListener('change', render);
ownerFilter?.addEventListener('change', render);
void load();
