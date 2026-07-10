/**
 * Intervention case client SSOT — list, seed, load, approve (fetchJson).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

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

// Dedup cache — seedFromBrief is called from both the load controller and the
// intervention renderer with the same brief. Cache by brief fingerprint for 30s.
let _seedCache = null;
let _seedCacheKey = '';
const SEED_CACHE_TTL_MS = 30000;

export async function seedFromBrief({ brief, projectsCsv, periodKey, anchorOnly = '' } = {}) {
  const risks = briefRisks(brief);
  if (!risks.length) return { cases: [] };
  const projects = anchorOnly || projectsCsv;
  const cacheKey = `${projects}|${periodKey}|${brief?.meta?.briefId || brief?.generatedAt || ''}|${risks.length}`;
  const now = Date.now();
  if (_seedCache && cacheKey === _seedCacheKey && (now - _seedCache._cachedAt) < SEED_CACHE_TTL_MS) {
    return _seedCache;
  }
  const result = await fetchJson('/api/governance/interventions/seed-from-brief', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ brief, risks, projects, periodKey }),
  }, 'intervention-seed');
  result._cachedAt = now;
  _seedCache = result;
  _seedCacheKey = cacheKey;
  return result;
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

export function renderInterventionCaseCard(row = {}, { surface = 'actions', highlight = false, selected = false } = {}) {
  const proof = row.proofLevel || 'Medium';
  const action = row.primaryAction || {};
  const factLine = `${Number(row.factCount || 0)} facts checked · ${Number(row.unknownCount || 0)} gaps`;
  const issueCount = (row.issueKeys || []).length;
  const squadLink = row.project
    ? `<a class="actions-case-squad-link" href="/current-sprint?projects=${encodeURIComponent(row.project)}">${escapeHtml(row.project)}</a>`
    : '';
  const governanceChip = surface === 'actions'
    ? `<a class="actions-case-portfolio-chip" href="/governance">Portfolio decision</a>`
    : '';

  if (surface === 'governance') {
    return `
    <article class="gov-intervention-card" data-case-id="${escapeHtml(row.id)}">
      <div class="gov-intervention-card-main">
        <p class="gov-intervention-kicker">${escapeHtml(caseVerb(row.state))} today</p>
        <h3>${escapeHtml(compactTitle(row))}</h3>
        <p class="gov-intervention-facts">${escapeHtml(factLine)} · ${escapeHtml(row.triggerType || 'delivery risk')}</p>
        <p class="gov-intervention-action">${escapeHtml(action.action || 'Review the intervention case and confirm next step.')}</p>
      </div>
      <div class="gov-intervention-card-actions">
        <button type="button" class="btn btn-primary btn-compact" data-case-action="review" data-case-id="${escapeHtml(row.id)}">Review</button>
        <button type="button" class="btn btn-secondary btn-compact" data-case-action="details" data-case-id="${escapeHtml(row.id)}">Proof</button>
      </div>
      <div class="gov-intervention-detail" data-case-detail="${escapeHtml(row.id)}" hidden></div>
    </article>`;
  }

  return `
    <article class="actions-case-card${highlight ? ' is-highlighted' : ''}${selected ? ' is-selected' : ''}" data-case-id="${escapeHtml(row.id)}" id="case-${escapeHtml(row.id)}">
      <div class="actions-case-card-main">
        ${squadLink ? `<p class="actions-case-squad">${squadLink}</p>` : ''}
        <h2>${escapeHtml(row.title || compactTitle(row))}</h2>
        <p>${issueCount} related issues · ${row.needsApproval ? '1+ nudges ready' : 'monitoring'} · Proof: ${escapeHtml(proof)}</p>
        ${governanceChip}
      </div>
      <div class="actions-case-card-actions">
        ${row.needsApproval ? `<button type="button" class="btn btn-primary btn-compact" data-approve-case="${escapeHtml(row.id)}">${escapeHtml(COPY.actionsApproveInline)}</button>` : ''}
        <button type="button" class="btn btn-secondary btn-compact" data-open-case="${escapeHtml(row.id)}">Review case</button>
      </div>
    </article>`;
}

export function renderGovCaseCard(row = {}) {
  return renderInterventionCaseCard(row, { surface: 'governance' });
}

export function renderActionsCaseCard(row = {}, { highlight = false, selected = false } = {}) {
  return renderInterventionCaseCard(row, { surface: 'actions', highlight, selected });
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
        ${visible.map((row) => renderGovCaseCard(row)).join('')}
      </div>
    </section>`;
}
