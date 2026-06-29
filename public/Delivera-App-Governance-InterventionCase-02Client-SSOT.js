/**
 * Intervention case client SSOT — list, seed, load, approve (fetchJson).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';

export function caseVerb(state = '') {
  const s = String(state || '').toLowerCase();
  if (s.includes('clarification')) return 'Confirm';
  if (s.includes('decision')) return 'Decide';
  if (s.includes('escalation')) return 'Escalate';
  if (s.includes('verified')) return 'Verified';
  return 'Act';
}

export function compactTitle(row = {}) {
  const keys = (row.issueKeys || []).slice(0, 2).join(', ');
  return keys ? `${row.project} needs a decision on ${keys}` : row.title || `${row.project} needs a decision`;
}

export function briefRisks(brief = {}) {
  return [
    ...(Array.isArray(brief.topRisks) ? brief.topRisks : []),
    ...(Array.isArray(brief?.leadershipNarrative?.decisionsNeeded) ? brief.leadershipNarrative.decisionsNeeded : []),
    ...(Array.isArray(brief?.meta?.actionPlan?.groupedActions) ? brief.meta.actionPlan.groupedActions : []),
  ].slice(0, 12);
}

export async function seedFromBrief({ brief, projectsCsv, periodKey, anchorOnly = '' } = {}) {
  const risks = briefRisks(brief);
  if (!risks.length) return { cases: [] };
  const projects = anchorOnly || projectsCsv;
  return fetchJson('/api/governance/interventions/seed-from-brief', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ brief, risks, projects, periodKey }),
  }, 'intervention-seed');
}

export async function listCases({ project = '', status = 'open' } = {}) {
  const params = new URLSearchParams();
  if (project) params.set('project', project);
  if (status) params.set('status', status);
  const qs = params.toString() ? `?${params}` : '';
  const data = await fetchJson(`/api/governance/interventions.json${qs}`, {}, 'intervention-list');
  return data.cases || [];
}

export async function loadCase(caseId) {
  const data = await fetchJson(`/api/governance/interventions/${encodeURIComponent(caseId)}`, {}, 'intervention-load');
  return data.case || data;
}

export async function approveDraft(caseId, confirmSend = false) {
  try {
    return await fetchJson(`/api/governance/interventions/${encodeURIComponent(caseId)}/approve-nudge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmSend }),
    }, 'intervention-approve');
  } catch (err) {
    if (err.body?.draft) return err.body;
    throw err;
  }
}

export function renderGovCaseCard(row = {}) {
  const action = row.primaryAction || {};
  const factLine = `${Number(row.factCount || 0)} facts checked - ${Number(row.unknownCount || 0)} gaps`;
  return `
    <article class="gov-intervention-card" data-case-id="${escapeHtml(row.id)}">
      <div class="gov-intervention-card-main">
        <p class="gov-intervention-kicker">${escapeHtml(caseVerb(row.state))} today</p>
        <h3>${escapeHtml(compactTitle(row))}</h3>
        <p class="gov-intervention-facts">${escapeHtml(factLine)} - ${escapeHtml(row.triggerType || 'delivery risk')}</p>
        <p class="gov-intervention-action">${escapeHtml(action.action || 'Review the intervention case and confirm next step.')}</p>
      </div>
      <div class="gov-intervention-card-actions">
        <button type="button" class="btn btn-primary btn-compact" data-case-action="review" data-case-id="${escapeHtml(row.id)}">Review</button>
        <button type="button" class="btn btn-secondary btn-compact" data-case-action="details" data-case-id="${escapeHtml(row.id)}">Proof</button>
      </div>
      <div class="gov-intervention-detail" data-case-detail="${escapeHtml(row.id)}" hidden></div>
    </article>`;
}

export function renderActionsCaseCard(row = {}, { highlight = false } = {}) {
  const proof = row.proofLevel || 'Medium';
  return `
    <article class="actions-case-card${highlight ? ' is-highlighted' : ''}" data-case-id="${escapeHtml(row.id)}" id="case-${escapeHtml(row.id)}">
      <h2>${escapeHtml(row.title || `${row.project} scope review`)}</h2>
      <p>${escapeHtml((row.issueKeys || []).length)} related issues · ${row.needsApproval ? '1+ nudges ready' : 'monitoring'} · Proof: ${escapeHtml(proof)}</p>
      <button type="button" class="btn btn-primary btn-compact" data-open-case="${escapeHtml(row.id)}">Review case</button>
    </article>`;
}

export function renderGovCaseDetail(row = {}, draft = null) {
  const facts = (row.facts || []).slice(0, 6).map((f) => `<li>${escapeHtml(f.label || f.key)}: ${escapeHtml(f.value || f.source || '')}</li>`).join('');
  const unknowns = (row.unknowns || []).slice(0, 4).map((u) => `<li>${escapeHtml(u.label || u.key)}</li>`).join('');
  const draftHtml = draft ? `
    <div class="gov-intervention-draft">
      <p class="gov-intervention-detail-label">Human-approved channel draft</p>
      <pre>${escapeHtml(draft.text || '')}</pre>
      <button type="button" class="btn btn-primary btn-compact" data-case-action="confirm-send" data-case-id="${escapeHtml(row.id)}">Approve for Teams/email</button>
    </div>` : '';
  return `
    <div class="gov-intervention-proof-grid">
      <div>
        <p class="gov-intervention-detail-label">Evidence</p>
        <ul>${facts || '<li>No checked facts yet.</li>'}</ul>
      </div>
      <div>
        <p class="gov-intervention-detail-label">Gaps</p>
        <ul>${unknowns || '<li>No major gaps detected.</li>'}</ul>
      </div>
    </div>
    ${draftHtml}`;
}

export function renderGovInterventionSummary(rows = []) {
  if (!rows.length) return '';
  const visible = rows.slice(0, 3);
  const hiddenCount = Math.max(0, rows.length - visible.length);
  return `
    <section class="gov-intervention-stream" aria-label="What needs my attention">
      <div class="gov-intervention-head">
        <div>
          <p class="gov-intervention-eyebrow">What needs my attention?</p>
          <h2>${visible.length} intervention${visible.length === 1 ? '' : 's'} ready</h2>
        </div>
        <span class="gov-intervention-count">${hiddenCount ? `${hiddenCount} more in queue` : 'Brief-linked'}</span>
      </div>
      <div class="gov-intervention-grid">
        ${visible.map(renderGovCaseCard).join('')}
      </div>
    </section>`;
}
