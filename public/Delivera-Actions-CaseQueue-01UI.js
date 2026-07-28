import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openPromiseDrawer } from './Delivera-App-Governance-ActiveLoop-01UI.js?v=20260719e';
import { governanceSpotlightHref } from './Delivera-Shared-Continuity-Link-01Build.js';

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
  summary.textContent = selectedSquad
    ? `Showing ${selectedSquad} actions only. Return links stay pinned to this squad lane.`
    : `${visible.length} action${visible.length === 1 ? '' : 's'} ready from the shared governance ledger.`;
  const grouped = new Map();
  visible.forEach((item) => {
    const squad = item.squadId || item.squad;
    const ownerUnresolved = item.ownerRoute?.unresolved || !item.ownerRoute?.displayName;
    const key = ownerUnresolved
      ? `${squad}|owner-route|${item.dueState || item.state}`
      : item.groupKey || `${squad}|${item.actionType || 'review'}|${item.sourceEntityId || item.promiseId}|${item.dueState || item.state}`;
    const group = grouped.get(key) || [];
    group.push(item); grouped.set(key, group);
  });
  mount.innerHTML = visible.length ? [...grouped.values()].map((group) => {
    const item = group[0];
    const title = group.length > 1 ? `${group.length} promises share this correction` : item.title;
    const affected = group.length > 1 ? `<small>${escapeHtml(group.map((entry) => entry.title).slice(0, 3).join(' · '))}</small>` : '';
    const sourceHref = governanceSpotlightHref(item.squadId || item.squad, { returnTo: '/actions' });
    const ownerLine = item.ownerRoute?.displayName || item.ownerRoute?.role || 'Owner route missing';
    const proofLine = item.proofAge?.copy || 'Proof age unavailable.';
    const confidenceLine = item.ownerRoute?.unresolved ? 'Owner route needs confirmation' : `Owner route: ${item.ownerConfidence || 'verified'}`;
    return `<article class="action-case-row" data-action-case="${escapeHtml(item.promiseId)}" data-action-detail="${escapeHtml(item.detailHref || '')}" data-action-squad="${escapeHtml(item.squadId || item.squad)}"><div><span>${escapeHtml(item.squadDisplayName || item.squad)}${item.issueKey ? ` · ${escapeHtml(item.issueKey)}` : ''}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(item.lifecycle || 'Needs governance attention.')}</p><div class="action-case-signals"><span>${escapeHtml(item.urgencyLabel || 'review')}</span><span>${escapeHtml(proofLine)}</span><span>${escapeHtml(confidenceLine)}</span></div>${affected}<a class="action-case-source action-case-source--text" href="${sourceHref}">Squad evidence</a></div><div class="action-case-next"><small>${escapeHtml(ownerLine)}</small><button type="button" class="btn btn-primary btn-compact">${escapeHtml(item.nextAction?.label || 'Review missing proof')}</button></div></article>`;
  }).join('') : (() => {
    const emptyHref = governanceSpotlightHref(selectedSquad || '', { returnTo: '/actions' });
    return `<div class="empty-state"><h3>No actions match this view</h3><p><a href="${escapeHtml(emptyHref)}">${selectedSquad ? `Open ${escapeHtml(selectedSquad)} spotlight on Governance` : 'Return to Governance'}</a> for the portfolio answer.</p></div>`;
  })();
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
    render();
  } catch (_) {
    mount.innerHTML = '<div class="empty-state"><h3>Last verified action queue is unavailable</h3><p>Governance evidence remains read-only until the queue can be restored.</p></div>';
    summary.textContent = 'Queue unavailable.';
  }
}

stateFilter?.addEventListener('change', render);
ownerFilter?.addEventListener('change', render);
void load();
