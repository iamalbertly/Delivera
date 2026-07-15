import { createModalBehavior } from './Delivera-Core-UI-02Primitives-Modal.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import {
  paintInstantShell,
  clearInstantShell,
  setDeliveraSurfaceState,
} from './Delivera-Shared-Instant-Shell-01UI.js';
import { mountSharedStickyScope, ensureSharedStickyScopeMount } from './Delivera-Shared-Sticky-Scope-01Mount-UI.js';

const state = {
  cockpit: null,
  summary: null,
  contributions: [],
};
let drawerController = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.code || `Request failed ${res.status}`);
  return data;
}

function setLoading(isLoading) {
  const loading = document.getElementById('eos-loading');
  if (isLoading) {
    if (loading) loading.hidden = false;
    paintInstantShell('evidence');
    setDeliveraSurfaceState('evidence', 'loading');
  } else {
    clearInstantShell();
    if (loading) loading.hidden = true;
    setDeliveraSurfaceState('evidence', 'live');
  }
}

function renderAttention() {
  const mount = document.getElementById('eos-attention');
  if (!mount) return;
  const items = state.cockpit?.attentionItems || [];
  if (!items.length) {
    mount.innerHTML = '<article class="evidence-os-attention-card"><strong>No urgent action</strong><span>Agents are watching Jira, commitments, validation gaps, and manager visibility.</span></article>';
    return;
  }
  mount.innerHTML = items.map((item) => `
    <article class="evidence-os-attention-card evidence-os-attention-card--${escapeHtml(item.type)}">
      <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div>
      <div class="evidence-os-attention-actions">
        <button type="button" class="btn btn-primary btn-compact" data-eos-intent="${escapeHtml(item.type)}">${escapeHtml(item.primaryAction || 'Confirm')}</button>
        <button type="button" class="btn btn-secondary btn-compact" data-eos-action="capture">${escapeHtml(item.secondaryAction || 'Add context')}</button>
      </div>
    </article>
  `).join('');
}

function renderManagerBrief() {
  const mount = document.getElementById('eos-manager-brief');
  if (!mount) return;
  const brief = state.cockpit?.managerBrief || {};
  mount.innerHTML = `
    <div class="evidence-os-brief-grid">
      <article><span>Purpose</span><strong>${escapeHtml(brief.purpose || 'Decision-ready manager visibility')}</strong></article>
      <article><span>What changed</span><strong>${escapeHtml(brief.whatChanged || 'No material change captured yet.')}</strong></article>
      <article><span>At risk</span><strong>${escapeHtml(brief.whatIsAtRisk || 'No urgent risk detected.')}</strong></article>
      <article><span>Decision</span><strong>${escapeHtml(brief.decisionRequired || 'No decision required now.')}</strong></article>
      <article><span>What I enabled</span><strong>${escapeHtml(brief.whatIEnabled || 'No confirmed enablement yet.')}</strong></article>
      <article><span>Missing evidence</span><strong>${escapeHtml((brief.missingEvidence || []).join(', ') || 'None flagged')}</strong></article>
    </div>
  `;
}

function renderCommitments() {
  const mount = document.getElementById('eos-commitments');
  if (!mount) return;
  const commitments = state.cockpit?.commitments || [];
  mount.innerHTML = commitments.length ? commitments.map((item) => `
    <article>
      <strong>${escapeHtml(item.sourceGoal)}</strong>
      <span>${escapeHtml(item.sourceSystem)} - ${escapeHtml(item.owner)} - effective ${escapeHtml(item.effectiveDate || '')}</span>
      <span>${escapeHtml((item.linkedDeliveryItems || []).join(', ') || 'No delivery item linked yet')}</span>
    </article>
  `).join('') : '<div class="evidence-os-empty">No source commitments detected yet.</div>';
}

function renderPortfolio() {
  const mount = document.getElementById('eos-portfolio');
  if (!mount) return;
  const rows = state.cockpit?.portfolioMetrics || [];
  mount.innerHTML = rows.length ? rows.map((row) => `
    <article class="evidence-os-portfolio-row">
      <strong>${escapeHtml(row.projectKey)}</strong>
      <span>Predictability ${row.sprintPredictability}%</span>
      <span>Readiness ${row.backlogReadiness}%</span>
      <span>Release confidence ${row.releaseConfidence}%</span>
      <span>Decision delay ${row.decisionDelay}d</span>
    </article>
  `).join('') : '<div class="evidence-os-empty">Portfolio agents need Jira signals or confirmed contributions.</div>';
}

function streamTitle(key) {
  return ({
    value_generation: 'Value generation',
    value_protection: 'Value protection',
    capability_multiplication: 'Capability multiplication',
  })[key] || key;
}

function renderValueStreams() {
  const mount = document.getElementById('eos-value-streams');
  if (!mount) return;
  const streams = state.cockpit?.valueStreams || {};
  mount.innerHTML = ['value_generation', 'value_protection', 'capability_multiplication'].map((key) => {
    const rows = streams[key] || [];
    return `<article class="evidence-os-stream">
      <h3>${streamTitle(key)}</h3>
      ${rows.length ? rows.slice(0, 3).map((r) => `<p><strong>${escapeHtml(r.workItemKey)}</strong> ${escapeHtml(r.action)}</p>`).join('') : '<p>No classified work yet.</p>'}
    </article>`;
  }).join('');
}

function renderAgentActivity() {
  const mount = document.getElementById('eos-agent-activity');
  if (!mount) return;
  const rows = state.cockpit?.agentActivity || [];
  mount.innerHTML = rows.map((row) => `
    <article>
      <strong>${escapeHtml(row.agent)} - ${escapeHtml(row.action)}</strong>
      <span>${escapeHtml(row.detail)} (${escapeHtml(row.status)})</span>
    </article>
  `).join('');
}

function renderTimeline() {
  const mount = document.getElementById('eos-timeline');
  if (!mount) return;
  const rows = state.cockpit?.structuredContributions || [];
  if (!rows.length) {
    mount.innerHTML = '<div class="evidence-os-empty">Evidence will appear here after agents detect or you confirm meaningful delivery work.</div>';
    return;
  }
  mount.innerHTML = rows.map((item) => `
    <article class="evidence-os-timeline-item">
      <div class="evidence-os-timeline-meta"><strong>${escapeHtml(item.workItemKey || 'Manual')}</strong><span>Structured proof</span></div>
      <dl class="evidence-os-proof-model">
        <div><dt>Situation</dt><dd>${escapeHtml(item.situation)}</dd></div>
        <div><dt>My action</dt><dd>${escapeHtml(item.myAction)}</dd></div>
        <div><dt>Stakeholders</dt><dd>${escapeHtml(item.stakeholders)}</dd></div>
        <div><dt>Result</dt><dd>${escapeHtml(item.result)}</dd></div>
        <div><dt>Strategic relevance</dt><dd>${escapeHtml(item.strategicRelevance)}</dd></div>
        <div><dt>Evidence</dt><dd>${escapeHtml(item.evidence)}</dd></div>
      </dl>
    </article>
  `).join('');
}

function render() {
  const counts = document.getElementById('eos-counts');
  if (counts && state.summary) {
    const c = state.summary.counts || {};
    counts.textContent = `${c.contributions || 0} contributions preserved in background`;
  }
  renderAttention();
  renderManagerBrief();
  renderCommitments();
  renderPortfolio();
  renderValueStreams();
  renderAgentActivity();
  renderTimeline();
}

async function load() {
  setLoading(true);
  const [summary, contributions, cockpit] = await Promise.all([
    api('/api/evidence-os/summary'),
    api('/api/evidence-os/contributions'),
    api('/api/evidence-os/cockpit'),
  ]);
  state.summary = summary;
  state.contributions = contributions.contributions || [];
  state.cockpit = cockpit;
  render();
  setLoading(false);
}

async function submitCapture(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('eos-form-status');
  const data = Object.fromEntries(new FormData(form).entries());
  if (status) status.textContent = 'Saving context...';
  await api('/api/evidence-os/contributions', { method: 'POST', body: JSON.stringify({
    workItemKey: data.workItemKey,
    teamStatement: data.teamStatement,
    individualActionStatement: data.individualActionStatement,
    impactStatement: data.impactStatement,
    typeNames: [data.typeName],
    evidence: { tier: data.tier, sourceType: data.workItemKey ? 'jira_issue_context' : 'manual_context', title: data.workItemKey || 'Manual context', statement: data.individualActionStatement },
  }) });
  form.reset();
  if (status) status.textContent = 'Context saved.';
  drawerController?.close();
  await load();
}

async function runAgents() {
  await api('/api/evidence-os/agents/run', {
    method: 'POST',
    body: JSON.stringify({ agent: 'Delivery Observer', action: 'Preprocessed delivery signals', detail: 'Scanned Jira-linked work, commitments, validation gaps, portfolio signals, and manager brief needs.' }),
  });
  await load();
}

async function linkCommitment() {
  const commitments = state.cockpit?.commitments || [];
  const first = commitments[0];
  if (!first) return;
  await api('/api/evidence-os/commitments/link', { method: 'POST', body: JSON.stringify(first) });
  await load();
}

async function handleIntent(event) {
  const intent = event.target?.closest?.('[data-eos-intent]')?.dataset?.eosIntent;
  if (!intent) return;
  if (intent === 'link_commitment') return linkCommitment();
  if (intent === 'validation_gap') {
    const contribution = state.contributions[0];
    await api('/api/evidence-os/validation-requests/draft', { method: 'POST', body: JSON.stringify({ contributionId: contribution?.id }) });
    await runAgents();
    return;
  }
  if (intent === 'manager_visibility') {
    await api('/api/evidence-os/reports', { method: 'POST', body: JSON.stringify({
      variant: 'manager_monthly',
      audience: 'Nuru',
      purpose: 'Give Nuru the evidence needed to understand, support, and defend delivery impact.',
      nextDecisionMoment: 'monthly_manager_check_in',
      sourceRecordIds: state.contributions.flatMap((c) => (c.evidence || []).map((e) => e.id)).filter(Boolean),
      narrative: state.cockpit?.managerBrief?.whatIEnabled || 'Manager brief generated from verified and pending evidence.',
    }) });
    await load();
    return;
  }
  drawerController?.open({ triggerEl: event.target });
}

document.addEventListener('DOMContentLoaded', () => {
  paintInstantShell('evidence');
  try {
    mountSharedStickyScope({
      mount: ensureSharedStickyScopeMount(document.querySelector('.evidence-os-header')),
      profile: 'pi',
      onRefresh: () => { void load(); },
    });
  } catch (_) { /* non-fatal */ }
  drawerController = createModalBehavior('#eos-capture-drawer', { mode: 'drawer' });
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-eos-action="capture"]')) drawerController.open({ triggerEl: event.target });
  });
  document.querySelector('[data-eos-action="run-agents"]')?.addEventListener('click', runAgents);
  document.querySelector('[data-eos-action="link-commitment"]')?.addEventListener('click', linkCommitment);
  document.getElementById('eos-attention')?.addEventListener('click', handleIntent);
  document.getElementById('eos-capture-form')?.addEventListener('submit', submitCapture);
  load().catch((err) => {
    setLoading(false);
    const mount = document.getElementById('eos-attention');
    if (mount) mount.innerHTML = `<article class="evidence-os-attention-card"><strong>Impact cockpit unavailable</strong><span>${escapeHtml(err.message)}</span></article>`;
  });
});
