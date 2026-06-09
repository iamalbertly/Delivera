/**
 * Governance brief — evidence, proof risks, readiness, baseline, scorecard sections.
 */
import { escapeHtml, truthChip, renderStructuredEvidence } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { govPage, projectsCsv, whyItMatters } from './Delivera-Governance-Brief-Page-01Context.js';

function evidenceRowFor(brief, issueKey) {
  if (!issueKey) return null;
  return (brief?.evidencePack?.rows || []).find(
    (r) => String(r.issueKey).toUpperCase() === String(issueKey).toUpperCase(),
  ) || null;
}

export function renderProofRisks(risks) {
  govPage.proofRisks = risks;
  if (!risks.length) {
    govPage.els.proofRisks.innerHTML = '<p class="governance-empty">Nothing needs attention in this window.</p>';
    return;
  }
  const items = risks.map((r, idx) => {
    const ev = evidenceRowFor(govPage.lastBrief, r.issueKey);
    const keyLabel = r.issueKey
      ? (r.issueUrl
        ? `<a href="${escapeHtml(r.issueUrl)}" target="_blank" rel="noopener" id="gov-risk-${escapeHtml(r.issueKey)}" data-issue-key="${escapeHtml(r.issueKey)}" class="gov-issue-key-link">${escapeHtml(r.issueKey)}</a>`
        : escapeHtml(r.issueKey))
      : escapeHtml(r.squad || 'Portfolio');
    const proofLine = r.evidence || ev?.whyFlagged || '';
    return `
      <li class="governance-risk" data-escalation="${escapeHtml(r.escalation || 'watch')}" id="gov-risk-card-${idx}">
        <div class="governance-risk-head">
          <span class="governance-risk-key">${keyLabel}</span>
          <span class="governance-risk-lane">${escapeHtml(r.decisionNeededFrom || 'Scrum Master')}</span>
        </div>
        <p><strong>${escapeHtml(COPY.problem)}:</strong> ${escapeHtml(r.displayTitle || r.summary || r.riskLabel || '')}</p>
        <p><strong>${escapeHtml(COPY.whyItMatters)}:</strong> ${escapeHtml(whyItMatters(r))}</p>
        <p><strong>${escapeHtml(COPY.owner)}:</strong> ${escapeHtml(r.decisionNeededFrom || r.assigneeName || '')}</p>
        <p><strong>${escapeHtml(COPY.nextMove)}:</strong> ${escapeHtml(r.recommendedAction || '')}</p>
        <p class="gov-risk-proof-line"><strong>${escapeHtml(COPY.proofLine)}:</strong> ${escapeHtml(proofLine)}</p>
        <div class="governance-risk-tools">
          ${r.issueKey ? `<button type="button" class="btn btn-link btn-compact" data-copy-msg="${idx}">Copy message</button>` : ''}
          ${r.issueKey ? `<button type="button" class="btn btn-link btn-compact" data-nudge="${idx}">${escapeHtml(COPY.draftNudge)}</button>` : ''}
          <button type="button" class="btn btn-link btn-compact" data-mark-wrong="${idx}">${escapeHtml(COPY.markAsWrong)}</button>
          <button type="button" class="btn btn-link btn-compact" data-why="${idx}" aria-expanded="false">Why flagged?</button>
        </div>
        <div class="gov-mark-wrong-panel" data-wrong-panel="${idx}" hidden></div>
        <div class="governance-risk-detail" data-detail="${idx}" hidden>${renderStructuredEvidence(ev, r)}</div>
      </li>`;
  }).join('');
  govPage.els.proofRisks.innerHTML = `<ol class="governance-risk-list">${items}</ol>`;
}

export function renderEvidenceTable(brief) {
  const rows = brief?.evidencePack?.rows || [];
  if (!rows.length) {
    govPage.els.evidence.classList.remove('data-table-scroll-wrap');
    govPage.els.evidence.innerHTML = '<p class="governance-empty">No proof rows for flagged items.</p>';
    return;
  }
  const body = rows.map((r) => `
    <tr>
      <td><a href="/governance#gov-risk-${escapeHtml(r.issueKey)}">${escapeHtml(r.issueKey)}</a></td>
      <td>${escapeHtml(r.statusNow || '')}</td>
      <td>${escapeHtml(r.statusLastWeek || '')}</td>
      <td>${escapeHtml(r.whyFlagged || '')}</td>
    </tr>`).join('');
  govPage.els.evidence.classList.add('data-table-scroll-wrap');
  govPage.els.evidence.innerHTML = `<table class="governance-evidence-table"><thead><tr><th>Issue</th><th>Status</th><th>Last week</th><th>Why</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function renderTechnicalDetails(brief) {
  if (!govPage.els.technical) return;
  const n = brief?.leadershipNarrative || {};
  govPage.els.technical.innerHTML = `
    <p class="governance-empty" style="margin-top:8px;font-size:0.78rem;">
      Technical: Brief ${escapeHtml(brief.briefId || '')} · narrated by ${escapeHtml(brief?.meta?.narratedBy || 'template')}
      ${n.whatChanged ? ` · ${escapeHtml(n.whatChanged)}` : ''}
    </p>`;
}

export function renderReadiness(brief) {
  const po = brief?.poReadiness;
  if (!po) { govPage.els.readiness.innerHTML = ''; return; }
  const s = po.signals || {};
  const chips = Object.entries(s)
    .filter(([, v]) => Number(v) > 0)
    .map(([label, v]) => `<span class="governance-readiness-chip">${escapeHtml(label)}: ${escapeHtml(String(v))}</span>`).join('');
  govPage.els.readiness.innerHTML = `
    <h3 class="governance-subsection-title">${escapeHtml(COPY.backlogReadiness)}</h3>
    <p class="governance-readiness-label">${escapeHtml(po.readinessLabel || '')}</p>
    <div class="governance-readiness-chips">${chips || '<span class="governance-empty">No signals.</span>'}</div>`;
}

export function renderBaseline(brief) {
  const b = brief?.baselineComparison;
  if (!b) { govPage.els.baseline.innerHTML = ''; return; }
  const s = b.summary || {};
  govPage.els.baseline.innerHTML = `
    <h3 class="governance-subsection-title">${escapeHtml(COPY.planVsNow)}${b.piName ? ' · ' + escapeHtml(b.piName) : ''}</h3>
    <div class="governance-truth-grid">
      ${truthChip('Delivered', s.delivered, 'good')}
      ${truthChip('On track', s.onTrack, '')}
      ${truthChip('Delayed', s.delayed, s.delayed > 0 ? 'warn' : '')}
    </div>`;
}

const EVIDENCE_TAB_STORAGE_KEY = 'gov-evidence-active-tab';

let scorecardBound = false;

function activateEvidenceTab(shell, panels, key) {
  if (!shell || !panels || !key) return;
  shell.querySelectorAll('[data-evidence-tab]').forEach((b) => {
    const on = b.getAttribute('data-evidence-tab') === key;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  panels.querySelectorAll('[data-evidence-panel]').forEach((panel) => {
    const on = panel.dataset.evidencePanel === key;
    panel.classList.toggle('is-active', on);
    panel.hidden = !on;
  });
}

function restoreEvidenceTabFromSession(wrap) {
  const shell = wrap?.querySelector('.gov-evidence-tabs');
  const panels = wrap?.querySelector('.gov-evidence-tab-panels');
  if (!shell || !panels) return;
  let saved = 'proof';
  try { saved = sessionStorage.getItem(EVIDENCE_TAB_STORAGE_KEY) || 'proof'; } catch (_) { /* ignore */ }
  const valid = ['proof', 'plan', 'pilot'].includes(saved) ? saved : 'proof';
  activateEvidenceTab(shell, panels, valid);
}

export function deferScorecardUntilEvidenceOpen() {
  if (!govPage.els.scorecard || scorecardBound) return;
  const details = document.getElementById('gov-supporting-evidence');
  if (!details) {
    renderScorecard();
    return;
  }
  scorecardBound = true;
  const run = () => {
    renderScorecard();
    details.removeEventListener('toggle', onToggle);
  };
  const onToggle = () => {
    if (details.open) run();
  };
  if (details.open) run();
  else details.addEventListener('toggle', onToggle);
}

export function mountEvidenceTabShell() {
  const wrap = document.getElementById('gov-supporting-evidence');
  if (!wrap) return;
  if (wrap.dataset.evidenceTabsMounted === '1') {
    restoreEvidenceTabFromSession(wrap);
    return;
  }
  const measurement = document.getElementById('gov-measurement-mount');
  const script = document.getElementById('gov-meeting-script-mount');
  const proof = document.getElementById('gov-proof-risks');
  const evidence = document.getElementById('gov-evidence');
  const technical = document.getElementById('gov-technical-details');
  const readiness = document.getElementById('gov-readiness');
  const baseline = document.getElementById('gov-baseline');
  const scorecard = document.getElementById('gov-scorecard');
  if (!proof || !evidence) return;

  const shell = document.createElement('div');
  shell.className = 'gov-evidence-tabs';
  shell.setAttribute('role', 'tablist');
  shell.innerHTML = ''
    + `<button type="button" class="gov-evidence-tab is-active" data-evidence-tab="proof" role="tab" aria-selected="true">${escapeHtml(COPY.evidenceTabProof)}</button>`
    + `<button type="button" class="gov-evidence-tab" data-evidence-tab="plan" role="tab" aria-selected="false">${escapeHtml(COPY.evidenceTabPlan)}</button>`
    + `<button type="button" class="gov-evidence-tab" data-evidence-tab="pilot" role="tab" aria-selected="false">${escapeHtml(COPY.evidenceTabPilot)}</button>`;

  const panels = document.createElement('div');
  panels.className = 'gov-evidence-tab-panels';

  const proofPanel = document.createElement('div');
  proofPanel.className = 'gov-evidence-tab-panel is-active';
  proofPanel.dataset.evidencePanel = 'proof';
  if (measurement) proofPanel.appendChild(measurement);
  if (script) proofPanel.appendChild(script);
  proofPanel.appendChild(proof);
  proofPanel.appendChild(evidence);
  if (technical) proofPanel.appendChild(technical);

  const planPanel = document.createElement('div');
  planPanel.className = 'gov-evidence-tab-panel';
  planPanel.dataset.evidencePanel = 'plan';
  planPanel.hidden = true;
  if (readiness) planPanel.appendChild(readiness);
  if (baseline) planPanel.appendChild(baseline);

  const pilotPanel = document.createElement('div');
  pilotPanel.className = 'gov-evidence-tab-panel';
  pilotPanel.dataset.evidencePanel = 'pilot';
  pilotPanel.hidden = true;
  if (scorecard) pilotPanel.appendChild(scorecard);

  panels.append(proofPanel, planPanel, pilotPanel);
  wrap.querySelectorAll('.governance-subsection-title').forEach((el) => { el.style.display = 'none'; });
  wrap.insertBefore(shell, wrap.firstChild?.nextSibling || null);
  wrap.appendChild(panels);

  shell.querySelectorAll('[data-evidence-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-evidence-tab');
      activateEvidenceTab(shell, panels, key);
      try { sessionStorage.setItem(EVIDENCE_TAB_STORAGE_KEY, key || 'proof'); } catch (_) { /* ignore */ }
    });
  });

  wrap.dataset.evidenceTabsMounted = '1';
  restoreEvidenceTabFromSession(wrap);
  if (new URLSearchParams(window.location.search).get('from') === 'proof') {
    wrap.open = true;
  }
}

export async function renderScorecard() {
  if (!govPage.els.scorecard) return;
  let summary = { byMetric: {}, total: 0 };
  try {
    const res = await fetch(`/api/governance/adoption-metrics.json?project=${encodeURIComponent(projectsCsv().split(',')[0] || '')}`);
    if (res.ok) summary = await res.json();
  } catch (_) { /* empty */ }
  govPage.els.scorecard.innerHTML = summary.total
    ? `<p class="governance-empty">Pilot metrics: ${summary.total} entries logged.</p>`
    : '<p class="governance-empty">No pilot data yet.</p>';
}
