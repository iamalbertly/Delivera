import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import {
  listCases,
  loadCase,
  approveDraft,
  renderActionsCaseCard,
} from './Delivera-App-Governance-InterventionCase-02Client-SSOT.js';
import { fetchSprintBlockerSignal } from './Delivera-CurrentSprint-Action-Bridge.js';
import { openJiraNudgeReviewSheet } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';

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

function formatBlockerAge(hours) {
  const h = Number(hours) || 0;
  if (h <= 0) return 'needs review';
  if (h < 24) return `${Math.round(h)}h stale`;
  return `${Math.round(h / 24)}d stale`;
}

function renderBlockerQueueHtml(signal = {}) {
  const items = signal.items || [];
  if (!items.length) return '';
  const cacheNote = signal.source === 'cache'
    ? '<p class="actions-blocker-queue-note">From cached brief — refresh Squads for live state.</p>'
    : '';
  return `
    <section class="actions-blocker-queue" data-testid="actions-blocker-queue" aria-label="Sprint blockers">
      <h2 class="actions-blocker-queue-title">Sprint blockers</h2>
      ${cacheNote}
      <ul class="actions-blocker-queue-list">
        ${items.map((row) => `
          <li class="actions-blocker-queue-item">
            <div class="actions-blocker-queue-main">
              <strong>${escapeHtml(row.issueKey)}</strong>
              <span class="actions-blocker-queue-summary">${escapeHtml(row.summary || 'Blocked work')}</span>
              <span class="actions-blocker-queue-meta">${escapeHtml(row.assignee || 'Unassigned')} · ${escapeHtml(formatBlockerAge(row.hoursInStatus))}</span>
            </div>
            <button type="button" class="btn btn-primary btn-compact" data-actions-nudge="${escapeHtml(row.issueKey)}">Nudge ${escapeHtml(row.issueKey)}</button>
          </li>`).join('')}
      </ul>
    </section>`;
}

async function applyBlockerUx(readyCount = 0, signal = null) {
  const resolved = signal || await fetchSprintBlockerSignal();
  const hasBlockers = Boolean(resolved.hasBlockers);
  document.body.classList.toggle('actions-empty-ready', readyCount === 0);
  document.body.classList.toggle('actions-has-blockers', hasBlockers);
  document.getElementById('actions-blocker-banner')?.remove();
  return resolved;
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
  const visibleTabs = TABS.filter((t) => (counts[t.id] || 0) > 0 || t.id === 'ready');
  mount.innerHTML = visibleTabs.map((t) => {
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

function renderProofPacks(cases = []) {
  const withProof = cases.filter((c) => (c.facts || []).length || (c.issueKeys || []).length).slice(0, 8);
  if (!withProof.length) {
    return `<p class="actions-proof-lead">${escapeHtml(COPY.actionsCaseNudgeLabel)} — no open proof packs yet.</p>`;
  }
  return `
    <p class="actions-proof-lead">${escapeHtml(COPY.actionsCaseNudgeLabel)} evidence (same contract as Portfolio)</p>
    <ul class="actions-proof-list">
      ${withProof.map((c) => `
        <li class="actions-proof-item">
          <strong>${escapeHtml(c.title || c.project || c.id)}</strong>
          <span>${escapeHtml((c.issueKeys || []).slice(0, 3).join(', ') || '—')}</span>
          <span>Proof: ${escapeHtml(c.proofLevel || 'Medium')}</span>
        </li>`).join('')}
    </ul>`;
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
  const signal = await applyBlockerUx(counts.ready || 0);
  if (tab === 'proof') {
    if (list) list.hidden = true;
    if (proof) {
      proof.hidden = false;
      proof.innerHTML = renderProofPacks(visible);
    }
    return;
  }
  if (proof) proof.hidden = true;
  if (list) {
    list.hidden = false;
    const caseHtml = visible.length
      ? visible.map((row) => renderActionsCaseCard(row, { highlight: row.id === highlightId })).join('')
      : '';
    const blockerHtml = (counts.ready === 0 && signal.hasBlockers)
      ? renderBlockerQueueHtml(signal)
      : '';
    list.innerHTML = caseHtml || blockerHtml || '<p class="actions-empty">No action needed now — monitoring continues.</p>';
    if (caseHtml && blockerHtml) {
      list.insertAdjacentHTML('afterbegin', blockerHtml);
    }
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
  const canApprove = Boolean(row.needsApproval);
  panel.innerHTML = `
    <p class="actions-case-kind"><strong>${escapeHtml(COPY.actionsCaseNudgeLabel)}</strong> (not a Squads Jira comment nudge)</p>
    <p><strong>State:</strong> ${escapeHtml(row.state || 'open')}</p>
    <p><strong>Issues:</strong> ${escapeHtml(issues || '—')}</p>
    <p>${escapeHtml(row.primaryAction?.action || 'Review facts and approve the next nudge when ready.')}</p>
    <div class="actions-case-inline-actions">
      ${canApprove ? `<button type="button" class="btn btn-primary btn-compact" data-approve-case="${escapeHtml(caseId)}">${escapeHtml(COPY.actionsApproveInline)}</button>` : ''}
      <button type="button" class="btn btn-secondary btn-compact" data-decline-case="${escapeHtml(caseId)}">${escapeHtml(COPY.actionsDeclineInline)}</button>
      <a class="btn btn-link btn-compact" href="/governance">${escapeHtml('Portfolio context')}</a>
    </div>
    <p class="actions-case-status" data-case-status hidden></p>`;
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
    const nudgeBtn = ev.target.closest('[data-actions-nudge]');
    if (nudgeBtn) {
      const issueKey = nudgeBtn.getAttribute('data-actions-nudge');
      if (issueKey) {
        openJiraNudgeReviewSheet({ issueKey, prefillContext: `Unblock ${issueKey} today.` });
      }
      return;
    }
    const approve = ev.target.closest('[data-approve-case]');
    if (approve) {
      const id = approve.getAttribute('data-approve-case');
      const status = approve.closest('.actions-case-detail')?.querySelector('[data-case-status]');
      try {
        await approveDraft(id, true);
        if (status) { status.hidden = false; status.textContent = 'Approved'; }
        await paint(activeTab());
      } catch (err) {
        if (status) { status.hidden = false; status.textContent = err?.message || 'Approve failed'; }
      }
      return;
    }
    const decline = ev.target.closest('[data-decline-case]');
    if (decline) {
      const panel = decline.closest('.actions-case-detail');
      if (panel) panel.hidden = true;
      decline.closest('.actions-case-card')?.classList.remove('is-expanded');
      return;
    }
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
