import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { openPromiseDrawer } from './Delivera-App-Governance-ActiveLoop-01UI.js?v=20260729k';
import {
  governanceSpotlightHref,
  currentSprintSquadHref,
  renderSquadIdentityStrip,
} from './Delivera-Shared-Continuity-Link-01Build.js';
import { isOwnerMissing } from './Delivera-Shared-Attention-Queue.js';

const mount = document.getElementById('actions-queue-mount');
const summary = document.getElementById('actions-queue-summary');
const stateFilter = document.getElementById('actions-state-filter');
const ownerFilter = document.getElementById('actions-owner-filter');
const clearFilters = document.getElementById('actions-filter-clear');
const identityMount = document.getElementById('actions-identity-links');
let cases = [];
const routeContext = new URLSearchParams(location.search);
const selectedSquad = String(routeContext.get('squad') || '').trim().toUpperCase();
if (stateFilter) stateFilter.value = routeContext.get('state') || '';
if (ownerFilter) ownerFilter.value = routeContext.get('owner') || '';

function syncFilterUrl() {
  const next = new URL(location.href);
  if (stateFilter?.value) next.searchParams.set('state', stateFilter.value); else next.searchParams.delete('state');
  if (ownerFilter?.value) next.searchParams.set('owner', ownerFilter.value); else next.searchParams.delete('owner');
  history.replaceState(null, '', `${next.pathname}${next.search}${next.hash}`);
}

function topUrgencyLabel(items) {
  const ranked = items
    .map((item) => String(item.urgencyLabel || item.dueState || item.state || 'review').trim())
    .filter(Boolean);
  return ranked[0] || 'review';
}

function renderIdentityStrip() {
  if (!identityMount) return;
  if (!selectedSquad) {
    identityMount.innerHTML = '';
    identityMount.hidden = true;
    return;
  }
  identityMount.hidden = false;
  identityMount.innerHTML = renderSquadIdentityStrip(selectedSquad, {
    ariaLabel: 'Actions continuity links',
    primaryReturnTo: '/actions',
    primaryLabelForSquad: (k) => `${k} evidence`,
    secondaryLabelForSquad: (k) => `${k} today`,
  });
  identityMount.hidden = !identityMount.innerHTML;
}

function casePickerHtml(group) {
  if (!group || !group.length) return '';
  if (group.length <= 1) return '';
  const options = group.map((entry, index) => {
    const id = entry.promiseId || '';
    if (!id) return '';
    const label = entry.issueKey || entry.title || `Case ${index + 1}`;
    const selected = index === 0 ? ' selected' : '';
    return `<option value="${escapeHtml(id)}" data-detail-href="${escapeHtml(entry.detailHref || '')}"${selected}>${escapeHtml(label)}</option>`;
  }).filter(Boolean).join('');
  if (!options) return '';
  return `<label class="action-case-picker"><span class="visually-hidden">Choose case</span><select data-action-case-picker aria-label="Choose which promise to open">${options}</select></label>`;
}

function render() {
  const state = stateFilter?.value || '';
  const owner = ownerFilter?.value || '';
  const visible = cases.filter((item) => !state || item.state === state)
    .filter((item) => {
      if (!owner) return true;
      const missing = isOwnerMissing({ ownerRoute: item.ownerRoute });
      return owner === 'unresolved' ? missing : !missing;
    });
  const urgency = topUrgencyLabel(visible);
  renderIdentityStrip();
  const grouped = new Map();
  visible.forEach((item) => {
    const squad = item.squadId || item.squad;
    const ownerUnresolved = isOwnerMissing({ ownerRoute: item.ownerRoute });
    const key = ownerUnresolved
      ? `${squad}|owner-route|${item.dueState || item.state}`
      : item.groupKey || `${squad}|${item.actionType || 'review'}|${item.sourceEntityId || item.promiseId}|${item.dueState || item.state}`;
    const group = grouped.get(key) || [];
    group.push(item); grouped.set(key, group);
  });
  summary.textContent = `${visible.length} commitment${visible.length === 1 ? '' : 's'} in ${grouped.size} action group${grouped.size === 1 ? '' : 's'} · top urgency: ${urgency}`;
  mount.innerHTML = visible.length ? [...grouped.values()].map((group) => {
    const item = group[0];
    const title = group.length > 1
      ? `${group.length} commitments · ${item.diagnosisLabel || 'promises share this correction'}`
      : (item.diagnosisLabel || item.title);
    const affected = group.length > 1 ? `<small>${escapeHtml(group.map((entry) => entry.title).slice(0, 3).join(' · '))}</small>` : '';
    const sourceHref = governanceSpotlightHref(item.squadId || item.squad, { returnTo: `${location.pathname}${location.search}` });
    const ownerLine = item.ownerRoute?.displayName || item.ownerRoute?.role || 'Owner route missing';
    const proofLine = item.proofAge?.copy || 'Proof age unavailable.';
    const ownerUnresolved = isOwnerMissing({ ownerRoute: item.ownerRoute });
    const confidenceLine = ownerUnresolved ? 'Owner route needs confirmation' : `Owner route: ${item.ownerConfidence || 'verified'}`;
    const titleAttr = `${proofLine} · ${confidenceLine}`;
    const rowSquad = String(item.squadId || item.squad || '').trim().toUpperCase();
    // When identity strip already locks the squad, show issue key only (cut repeated squad eye-travel).
    const identityLine = selectedSquad && rowSquad === selectedSquad
      ? (item.issueKey ? escapeHtml(item.issueKey) : 'Case')
      : `${escapeHtml(item.squadDisplayName || item.squad)}${item.issueKey ? ` · ${escapeHtml(item.issueKey)}` : ''}`;
    const shortCta = (() => {
      const code = String(item.diagnosisCode || '').toLowerCase();
      const keys = group.map((entry) => entry.issueKey).filter(Boolean);
      if (code.includes('metadata') || /fy\/quarter|metadata/i.test(String(item.recommendedAction || item.nextAction?.label || ''))) {
        return keys.length > 1 ? `Confirm FY/Q · ${keys.length} epics` : `Confirm FY/Q · ${keys[0] || item.issueKey || 'commitment'}`;
      }
      const raw = item.recommendedAction || item.nextAction?.label || 'Review missing proof';
      return raw.length > 48 ? `${raw.slice(0, 46).trimEnd()}…` : raw;
    })();
    const missing = Array.isArray(item.readiness?.missing) ? item.readiness.missing : [];
    const metadata = missing.length ? `Missing: ${missing.join(', ')}` : 'Required metadata verified';
    return `<article class="action-case-row" data-action-case="${escapeHtml(item.promiseId)}" data-action-detail="${escapeHtml(item.detailHref || '')}" data-action-squad="${escapeHtml(item.squadId || item.squad)}" title="${escapeHtml(titleAttr)}"><div><span>${identityLine}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(item.customerOrPiImpact || item.lifecycle || 'Needs governance attention.')}</p><p class="action-case-metadata"><strong>${escapeHtml(metadata)}</strong> · ${escapeHtml(ownerLine)} · affects Governance, Sprint and PI reporting</p><div class="action-case-signals"><span>${escapeHtml(item.urgencyLabel || 'review')}</span>${item.diagnosisConfidence != null ? `<span>${Math.round(Number(item.diagnosisConfidence) * 100)}% evidence confidence</span>` : ''}</div>${affected}${casePickerHtml(group)}<a class="action-case-source action-case-source--text" href="${sourceHref}">Squad evidence</a></div><div class="action-case-next"><small>${escapeHtml(proofLine)}</small><button type="button" class="btn btn-primary btn-compact">${escapeHtml(shortCta)}</button></div></article>`;
  }).join('') : (() => {
    const emptyHref = governanceSpotlightHref(selectedSquad || '', { returnTo: '/actions' });
    return `<div class="empty-state"><h3>No actions match this view</h3><p><a href="${escapeHtml(emptyHref)}">${selectedSquad ? `Open ${escapeHtml(selectedSquad)} spotlight on Governance` : 'Return to Governance'}</a> for the portfolio answer.</p></div>`;
  })();
  mount.querySelectorAll('[data-action-case-picker]').forEach((picker) => {
    picker.addEventListener('change', () => {
      const row = picker.closest('[data-action-case]');
      if (!row) return;
      const option = picker.selectedOptions?.[0];
      row.dataset.actionCase = picker.value || row.dataset.actionCase;
      if (option?.dataset?.detailHref != null) row.dataset.actionDetail = option.dataset.detailHref;
    });
  });
  mount.querySelectorAll('[data-action-case] button').forEach((button) => button.addEventListener('click', () => {
    const row = button.closest('[data-action-case]');
    const picker = row?.querySelector('[data-action-case-picker]');
    const caseId = picker?.value || row?.dataset.actionCase;
    const detailHref = picker?.selectedOptions?.[0]?.dataset?.detailHref || row?.dataset.actionDetail;
    return openPromiseDrawer(caseId, { detailHref });
  }));
}

async function load() {
  summary.textContent = selectedSquad
    ? `${selectedSquad} actions · refreshing verified queue`
    : 'Actions · refreshing verified queue';
  mount.innerHTML = '<div class="empty-state" role="status"><h3>Verified action queue is refreshing</h3><p>The selected squad remains locked while Delivera checks for newer evidence.</p></div>';
  try {
    const query = new URLSearchParams();
    if (selectedSquad) query.set('squad', selectedSquad);
    const response = await fetch(`/api/governance/actions.json${query.size ? `?${query}` : ''}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    cases = (await response.json()).cases || [];
    render();
  } catch (error) {
    mount.innerHTML = `<div class="empty-state" role="status"><h3>Last verified action queue is unavailable</h3><p>Governance evidence remains read-only until the queue can be restored. ${escapeHtml(error.message || 'Typed queue failure.')}</p></div>`;
    summary.textContent = 'Queue unavailable · verified Governance evidence remains available.';
  }
}

stateFilter?.addEventListener('change', () => { syncFilterUrl(); render(); });
ownerFilter?.addEventListener('change', () => { syncFilterUrl(); render(); });
clearFilters?.addEventListener('click', () => {
  if (stateFilter) stateFilter.value = '';
  if (ownerFilter) ownerFilter.value = '';
  syncFilterUrl(); render(); stateFilter?.focus();
});
void load();
