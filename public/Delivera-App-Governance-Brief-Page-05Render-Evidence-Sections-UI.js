/**
 * Governance brief — evidence, proof risks, readiness, baseline, scorecard sections.
 */
import { escapeHtml, truthChip, renderStructuredEvidence } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { govPage, projectsCsv, whyItMatters } from './Delivera-Governance-Brief-Page-01Context.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import {
  GOV_EVIDENCE_TAB_KEY,
  activateTabStrip,
  bindTabStrip,
  readStoredTab,
} from './Delivera-Shared-TabStrip-01Activate-Helper.js';

const evidenceFocusState = globalThis.__deliveraGovernanceEvidenceFocus ||= {
  spotlightKey: new URL(location.href).searchParams.get('spotlight') || '',
  activeLens: new URL(location.href).searchParams.get('view') || 'overall',
  scope: new URL(location.href).searchParams.get('evidenceScope') || '',
};

function effectiveEvidenceScope() {
  if (evidenceFocusState.scope === 'portfolio') return 'portfolio';
  if (evidenceFocusState.spotlightKey) return 'spotlight';
  return 'portfolio';
}

function evidenceRowsForScope(brief) {
  const rows = brief?.evidencePack?.rows || [];
  if (effectiveEvidenceScope() !== 'spotlight' || !evidenceFocusState.spotlightKey) return rows;
  return rows.filter((row) => String(row.squad || row.projectKey || '').trim().toUpperCase() === evidenceFocusState.spotlightKey);
}

function renderEvidenceScopeToggle(brief, totalRows, scopedRows) {
  if (!evidenceFocusState.spotlightKey) return '';
  const squad = [...(brief?.squadInsights || []), ...(brief?.squads || [])]
    .find((item) => String(item.projectKey || item.squad || '').trim().toUpperCase() === evidenceFocusState.spotlightKey);
  const squadLabel = squad?.displayName || squad?.squadName || squad?.friendlyName || evidenceFocusState.spotlightKey;
  return `<div class="gov-evidence-scope-toggle" data-evidence-scope-toggle>
    <span class="gov-loop-kicker">Evidence scope</span>
    <div class="gov-evidence-scope-actions">
      <button type="button" class="btn btn-compact ${effectiveEvidenceScope() === 'spotlight' ? 'btn-secondary' : 'btn-link'}" data-evidence-scope="spotlight" aria-pressed="${effectiveEvidenceScope() === 'spotlight'}">${escapeHtml(squadLabel)} (${scopedRows})</button>
      <button type="button" class="btn btn-link btn-compact gov-evidence-scope-secondary ${effectiveEvidenceScope() === 'portfolio' ? 'is-active' : ''}" data-evidence-scope="portfolio" aria-pressed="${effectiveEvidenceScope() === 'portfolio'}">All portfolio (${totalRows})</button>
    </div>
  </div>`;
}

function bindEvidenceScopeToggle() {
  document.querySelectorAll('[data-evidence-scope]').forEach((button) => {
    button.addEventListener('click', () => {
      evidenceFocusState.scope = button.dataset.evidenceScope || '';
      const url = new URL(location.href);
      if (evidenceFocusState.scope) url.searchParams.set('evidenceScope', evidenceFocusState.scope);
      else url.searchParams.delete('evidenceScope');
      history.replaceState(history.state || {}, '', url);
      if (govPage.lastBrief) {
        renderEvidencePreview(govPage.lastBrief);
        renderEvidenceTable(govPage.lastBrief);
      }
    });
  });
}

window.addEventListener('delivera:governance-focus', (event) => {
  evidenceFocusState.spotlightKey = String(event.detail?.spotlightKey || '').trim().toUpperCase();
  evidenceFocusState.activeLens = String(event.detail?.activeLens || 'overall');
  if (evidenceFocusState.spotlightKey) evidenceFocusState.scope = 'spotlight';
  else if (evidenceFocusState.scope === 'spotlight') evidenceFocusState.scope = 'portfolio';
  if (govPage.lastBrief) {
    renderEvidencePreview(govPage.lastBrief);
    renderEvidenceTable(govPage.lastBrief);
  }
});

function evidenceRowFor(brief, issueKey) {
  if (!issueKey) return null;
  return (brief?.evidencePack?.rows || []).find(
    (r) => String(r.issueKey).toUpperCase() === String(issueKey).toUpperCase(),
  ) || null;
}

export function renderProofRisks(risks, opts = {}) {
  govPage.proofRisks = risks;
  if (opts.hideWhenPreview && risks.length) {
    govPage.els.proofRisks.innerHTML = '';
    govPage.els.proofRisks.hidden = true;
    return;
  }
  govPage.els.proofRisks.hidden = false;
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
  const rows = evidenceRowsForScope(brief);
  const totalRows = brief?.evidencePack?.rows?.length || rows.length;
  if (!rows.length) {
    govPage.els.evidence.classList.remove('data-table-scroll-wrap');
    govPage.els.evidence.innerHTML = `${renderEvidenceScopeToggle(brief, totalRows, 0)}<p class="governance-empty">No proof rows for this evidence scope.</p>`;
    bindEvidenceScopeToggle();
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
  govPage.els.evidence.innerHTML = `${renderEvidenceScopeToggle(brief, totalRows, rows.length)}<table class="governance-evidence-table"><thead><tr><th>Issue</th><th>Status</th><th>Last week</th><th>Why</th></tr></thead><tbody>${body}</tbody></table>`;
  bindEvidenceScopeToggle();
}

/** Above-fold proof preview — top rows without opening supporting evidence. */
export function renderEvidencePreview(brief, maxRows = 2, mountEl = null) {
  const mount = mountEl || document.getElementById('gov-evidence-preview-mount')
    || document.getElementById('gov-right-rail-proof-mount');
  if (!mount) return;
  const scopedRows = evidenceRowsForScope(brief);
  const rows = scopedRows.slice(0, maxRows);
  if (!rows.length) {
    mount.innerHTML = '';
    mount.hidden = true;
    return;
  }
  const total = brief?.evidencePack?.rows?.length || rows.length;
  const issueUrlFor = (key) => {
    const k = String(key || '').toUpperCase();
    const risk = [...(brief?.topRisks || []), ...(brief?.risks || [])].find((r) => String(r.issueKey).toUpperCase() === k);
    return risk?.issueUrl || `/current-sprint?issue=${encodeURIComponent(key || '')}`;
  };
  const body = rows.map((r) => {
    const href = issueUrlFor(r.issueKey);
    const ext = href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    return `
    <tr>
      <td><a href="${escapeHtml(href)}" class="gov-issue-key-link gov-proof-row-link" data-issue-key="${escapeHtml(r.issueKey || '')}"${ext}>${escapeHtml(r.issueKey || '')}</a></td>
      <td>${escapeHtml(r.statusNow || '')}</td>
      <td>${escapeHtml(r.whyFlagged || '')}</td>
    </tr>`;
  }).join('');
  mount.hidden = false;
  mount.innerHTML = `
    <section class="gov-evidence-preview" aria-label="Proof preview">
      <header class="gov-evidence-preview-head">
        <h3 class="gov-evidence-preview-title">Proof preview</h3>
        <button type="button" class="btn btn-link btn-compact" id="gov-evidence-preview-more">All proof (${total})</button>
      </header>
      ${renderEvidenceScopeToggle(brief, total, scopedRows.length)}
      <div class="gov-evidence-preview-table data-table-scroll-wrap">
        <table class="governance-evidence-table"><thead><tr><th>Issue</th><th>Status</th><th>Why</th></tr></thead><tbody>${body}</tbody></table>
      </div>
    </section>`;
  bindEvidenceScopeToggle();
  mount.querySelector('#gov-evidence-preview-more')?.addEventListener('click', () => {
    openEvidenceDrawer(brief, brief?.evidencePack?.rows || []);
  });
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
  if (!govPage.els.readiness) return;
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
  if (!govPage.els.baseline) return;
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

const EVIDENCE_TAB_KEYS = ['proof'];
let scorecardBound = false;

function restoreEvidenceTabFromSession(wrap) {
  const shell = wrap?.querySelector('.gov-evidence-tabs');
  if (!shell) return;
  const key = readStoredTab(GOV_EVIDENCE_TAB_KEY, EVIDENCE_TAB_KEYS, 'proof');
  activateTabStrip(shell.parentElement || shell, {
    tabAttr: 'data-evidence-tab',
    panelAttr: 'data-evidence-panel',
    activeKey: key,
  });
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
  const proof = document.getElementById('gov-proof-risks');
  const evidence = document.getElementById('gov-evidence');
  const technical = document.getElementById('gov-technical-details');
  if (!proof || !evidence) return;

  const shell = document.createElement('div');
  shell.className = 'gov-evidence-tabs';
  shell.setAttribute('role', 'tablist');
  shell.innerHTML = `<button type="button" class="gov-evidence-tab is-active" data-evidence-tab="proof" role="tab" aria-selected="true">Proof audit</button>`;

  const panels = document.createElement('div');
  panels.className = 'gov-evidence-tab-panels';

  const proofPanel = document.createElement('div');
  proofPanel.className = 'gov-evidence-tab-panel gov-tab-panel is-active';
  proofPanel.dataset.evidencePanel = 'proof';
  proofPanel.appendChild(proof);
  proofPanel.appendChild(evidence);
  if (technical) proofPanel.appendChild(technical);

  panels.append(proofPanel);
  wrap.querySelectorAll('.governance-subsection-title').forEach((el) => { el.style.display = 'none'; });
  wrap.insertBefore(shell, wrap.firstChild?.nextSibling || null);
  wrap.appendChild(panels);

  bindTabStrip(wrap, {
    tabAttr: 'data-evidence-tab',
    panelAttr: 'data-evidence-panel',
    storageKey: GOV_EVIDENCE_TAB_KEY,
    validKeys: EVIDENCE_TAB_KEYS,
    defaultKey: 'proof',
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
