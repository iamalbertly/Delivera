import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

const mountTokens = new WeakMap();

function caseVerb(state = '') {
  const s = String(state || '').toLowerCase();
  if (s.includes('clarification')) return 'Confirm';
  if (s.includes('decision')) return 'Decide';
  if (s.includes('escalation')) return 'Escalate';
  if (s.includes('verified')) return 'Verified';
  return 'Act';
}

function compactTitle(row = {}) {
  const keys = (row.issueKeys || []).slice(0, 2).join(', ');
  return keys ? `${row.project} needs a decision on ${keys}` : row.title || `${row.project} needs a decision`;
}

function renderCaseCard(row = {}) {
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

function renderSummary(rows = []) {
  if (!rows.length) {
    return '';
  }
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
        ${visible.map(renderCaseCard).join('')}
      </div>
    </section>`;
}

function briefRisks(brief = {}) {
  return [
    ...(Array.isArray(brief.topRisks) ? brief.topRisks : []),
    ...(Array.isArray(brief?.leadershipNarrative?.decisionsNeeded) ? brief.leadershipNarrative.decisionsNeeded : []),
  ].slice(0, 8);
}

async function seedFromBrief({ brief, projectsCsv, periodKey }) {
  const risks = briefRisks(brief);
  if (!risks.length) return { cases: [] };
  const res = await fetch('/api/governance/interventions/seed-from-brief', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ brief, risks, projects: projectsCsv, periodKey }),
  });
  if (!res.ok) throw new Error(`Intervention seed failed (${res.status})`);
  return res.json();
}

async function loadCase(caseId) {
  const res = await fetch(`/api/governance/interventions/${encodeURIComponent(caseId)}`);
  if (!res.ok) throw new Error(`Case load failed (${res.status})`);
  return res.json();
}

async function approveDraft(caseId, confirmSend = false) {
  const res = await fetch(`/api/governance/interventions/${encodeURIComponent(caseId)}/approve-nudge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirmSend }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data?.draft) throw new Error(data?.reason || `Draft failed (${res.status})`);
  return data;
}

function renderCaseDetail(row = {}, draft = null) {
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

export async function mountGovernanceInterventionCases({ mount, brief, projectsCsv = '', periodKey = '' } = {}) {
  if (!mount || !brief) return;
  const token = Symbol('intervention-render');
  mountTokens.set(mount, token);
  mount.hidden = false;
  mount.innerHTML = `
    <section class="gov-intervention-stream gov-intervention-stream--loading" aria-label="What needs my attention">
      <div class="gov-intervention-skeleton"></div>
      <div class="gov-intervention-skeleton"></div>
    </section>`;
  try {
    const seeded = await seedFromBrief({ brief, projectsCsv, periodKey });
    if (mountTokens.get(mount) !== token) return;
    const cases = Array.isArray(seeded.cases) ? seeded.cases : [];
    mount.innerHTML = renderSummary(cases);
    mount.hidden = !cases.length;
  } catch (err) {
    if (mountTokens.get(mount) !== token) return;
    mount.hidden = false;
    mount.innerHTML = `
      <section class="gov-intervention-stream gov-intervention-stream--empty" aria-label="What needs my attention">
        <p class="gov-intervention-eyebrow">What needs my attention?</p>
        <h2>Intervention stream paused</h2>
        <p>${escapeHtml(err.message || 'Could not prepare intervention cases right now.')}</p>
      </section>`;
  }

  mount.onclick = async (event) => {
    const button = event.target.closest('[data-case-action]');
    if (!button) return;
    const caseId = button.getAttribute('data-case-id');
    const action = button.getAttribute('data-case-action');
    const detail = mount.querySelector(`[data-case-detail="${CSS.escape(caseId)}"]`);
    if (!caseId || !detail) return;
    button.disabled = true;
    try {
      if (action === 'details') {
        const data = await loadCase(caseId);
        detail.innerHTML = renderCaseDetail(data.case);
        detail.hidden = !detail.hidden;
      }
      if (action === 'review') {
        const data = await approveDraft(caseId, false);
        detail.innerHTML = renderCaseDetail(data.case, data.draft);
        detail.hidden = false;
      }
      if (action === 'confirm-send') {
        const data = await approveDraft(caseId, true);
        detail.innerHTML = `<p class="gov-intervention-sent">Approved and queued for existing channel follow-up. Receipt: ${escapeHtml(data.receipt?.id || 'ready')}</p>`;
        detail.hidden = false;
        button.closest('.gov-intervention-card')?.setAttribute('data-case-sent', 'true');
      }
    } catch (err) {
      detail.innerHTML = `<p class="gov-intervention-error">${escapeHtml(err.message || 'Action failed')}</p>`;
      detail.hidden = false;
    } finally {
      button.disabled = false;
    }
  };
}
