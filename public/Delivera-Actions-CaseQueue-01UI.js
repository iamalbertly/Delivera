import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openPromiseDrawer } from './Delivera-App-Governance-ActiveLoop-01UI.js?v=20260719e';

const mount = document.getElementById('actions-queue-mount');
const summary = document.getElementById('actions-queue-summary');
const stateFilter = document.getElementById('actions-state-filter');
let cases = [];

function render() {
  const state = stateFilter?.value || '';
  const visible = cases.filter((item) => !state || item.state === state);
  summary.textContent = `${visible.length} action${visible.length === 1 ? '' : 's'} ready from the shared governance ledger.`;
  mount.innerHTML = visible.length ? visible.map((item) => `<article class="action-case-row" data-action-case="${escapeHtml(item.promiseId)}" data-action-detail="${escapeHtml(item.detailHref || '')}"><div><span>${escapeHtml(item.squadDisplayName || item.squad)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.lifecycle || 'Needs governance attention.')}</p></div><div class="action-case-next"><small>${escapeHtml(item.ownerRoute?.displayName || item.ownerRoute?.role || 'PI Team queue')}</small><button type="button" class="btn btn-primary btn-compact">${escapeHtml(item.nextAction?.label || 'Review missing proof')}</button></div></article>`).join('') : '<div class="empty-state"><h3>No actions match this view</h3><p>Change the state filter or return to Governance for the portfolio answer.</p></div>';
  mount.querySelectorAll('[data-action-case] button').forEach((button) => button.addEventListener('click', () => {
    const row = button.closest('[data-action-case]');
    return openPromiseDrawer(row.dataset.actionCase, { detailHref: row.dataset.actionDetail });
  }));
}

async function load() {
  try {
    const response = await fetch('/api/governance/actions.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    cases = (await response.json()).cases || [];
    render();
  } catch (_) {
    mount.innerHTML = '<div class="empty-state"><h3>Last verified action queue is unavailable</h3><p>Governance evidence remains read-only until the queue can be restored.</p></div>';
    summary.textContent = 'Queue unavailable.';
  }
}

stateFilter?.addEventListener('change', render);
void load();
