/**
 * Governance brief — evidence, proof risks, readiness, baseline, scorecard sections.
 */
import { escapeHtml, truthChip, renderStructuredEvidence } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { govPage, projectsCsv, whyItMatters } from './Delivera-Governance-Brief-Page-01Context.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';

function evidenceRowFor(brief, issueKey) {
  if (!issueKey) return null;
  return (brief?.evidencePack?.rows || []).find(
    (r) => String(r.issueKey).toUpperCase() === String(issueKey).toUpperCase(),
  ) || null;
}

export function renderProofRisks(risks, opts = {}) {
  govPage.proofRisks = risks;
  if (!govPage.els.proofRisks) return;
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
          <button type="button" class="btn btn-link btn-compact" data-why="${idx}" aria-expanded="true">Why flagged?</button>
        </div>
        <div class="gov-mark-wrong-panel" data-wrong-panel="${idx}" hidden></div>
        <div class="governance-risk-detail" data-detail="${idx}">${renderStructuredEvidence(ev, r)}</div>
      </li>`;
  }).join('');
  govPage.els.proofRisks.innerHTML = `<ol class="governance-risk-list">${items}</ol>`;
}

export function renderEvidenceTable(brief) {
  if (!govPage.els.evidence) return;
  const rows = brief?.evidencePack?.rows || [];
  if (!rows.length) {
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
  govPage.els.evidence.innerHTML = `<table class="governance-evidence-table"><thead><tr><th>Issue</th><th>Status</th><th>Last week</th><th>Why</th></tr></thead><tbody>${body}</tbody></table>`;
}

function issueUrlForBriefRow(brief, issueKey) {
  const k = String(issueKey || '').toUpperCase();
  const risk = [...(brief?.topRisks || []), ...(brief?.risks || [])].find((r) => String(r.issueKey).toUpperCase() === k);
  return risk?.issueUrl || `/current-sprint?issue=${encodeURIComponent(issueKey || '')}`;
}

/** SSOT compact proof table rows (cluster inline + right-rail preview). */
export function renderCompactProofTableRows(brief, rows = [], { linkKeys = false } = {}) {
  return rows.map((r) => {
    const keyCell = linkKeys && r.issueKey
      ? (() => {
        const href = issueUrlForBriefRow(brief, r.issueKey);
        const ext = href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${escapeHtml(href)}" class="gov-issue-key-link gov-proof-row-link" data-issue-key="${escapeHtml(r.issueKey || '')}"${ext}>${escapeHtml(r.issueKey || '')}</a>`;
      })()
      : escapeHtml(r.issueKey || '');
    return `
    <tr>
      <td>${keyCell}</td>
      <td>${escapeHtml(r.statusNow || '')}</td>
      <td>${escapeHtml(r.whyFlagged || '')}</td>
    </tr>`;
  }).join('');
}

/** Compact inline proof preview for owner clusters (SSOT rows from evidence pack). */
export function renderClusterProofPreviewHtml(brief, issueKeys = [], maxRows = 3) {
  const keys = new Set((issueKeys || []).map((k) => String(k).toUpperCase()).filter(Boolean));
  const rows = (brief?.evidencePack?.rows || []).filter((r) => keys.has(String(r.issueKey).toUpperCase())).slice(0, maxRows);
  if (!rows.length) return '';
  const body = renderCompactProofTableRows(brief, rows);
  return `
    <div class="gov-cluster-proof-preview" data-direct-value="evidence" aria-label="Proof preview">
      <table class="governance-evidence-table gov-cluster-proof-table">
        <thead><tr><th>Issue</th><th>Status</th><th>Why</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

/** Above-fold proof preview — top rows without opening supporting evidence. */
/** Scroll proof rail into view with brief highlight — durable outcome, not flash-only. */
export function focusProofRail(rail) {
  if (!rail) return;
  rail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  rail.setAttribute('data-proof-active', '1');
  rail.classList.add('gov-proof-rail-highlight');
  setTimeout(() => {
    rail.removeAttribute('data-proof-active');
    rail.classList.remove('gov-proof-rail-highlight');
  }, 1200);
}

export function renderEvidencePreview(brief, maxRows = 2, mountEl = null) {
  const mount = mountEl || document.getElementById('gov-evidence-preview-mount')
    || document.getElementById('gov-right-rail-proof-mount');
  if (!mount) return;
  const rows = (brief?.evidencePack?.rows || []).slice(0, maxRows);
  if (!rows.length) {
    mount.innerHTML = '';
    mount.hidden = true;
    return;
  }
  const total = brief?.evidencePack?.rows?.length || rows.length;
  const body = renderCompactProofTableRows(brief, rows, { linkKeys: true });
  mount.hidden = false;
  mount.innerHTML = `
    <section class="gov-evidence-preview" data-direct-value="evidence" aria-label="Proof preview">
      <header class="gov-evidence-preview-head">
        <h3 class="gov-evidence-preview-title">Proof preview</h3>
        <button type="button" class="btn btn-link btn-compact" id="gov-evidence-preview-more">All proof (${total})</button>
      </header>
      <div class="gov-evidence-preview-table">
        <table class="governance-evidence-table"><thead><tr><th>Issue</th><th>Status</th><th>Why</th></tr></thead><tbody>${body}</tbody></table>
      </div>
    </section>`;
  mount.querySelector('#gov-evidence-preview-more')?.addEventListener('click', () => {
    const rail = document.getElementById('gov-right-rail-proof-mount');
    if (rail && !rail.hidden && rail.querySelector('.gov-evidence-preview')) {
      focusProofRail(rail);
      return;
    }
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

let scorecardBound = false;

function unwrapLegacyEvidenceTabs(wrap) {
  if (wrap.dataset.evidenceTabsMounted !== '1') return;
  const panels = wrap.querySelector('.gov-evidence-tab-panels');
  if (panels) {
    panels.querySelectorAll('[id]').forEach((node) => wrap.appendChild(node));
    panels.remove();
  }
  wrap.querySelector('.gov-evidence-tabs')?.remove();
  wrap.dataset.evidenceTabsMounted = '';
}

function ensureFlatEvidenceSections(wrap) {
  unwrapLegacyEvidenceTabs(wrap);
  wrap.querySelectorAll('.governance-subsection-title').forEach((el) => { el.style.display = ''; });
  wrap.dataset.evidenceLayout = 'flat';
}

export function deferScorecardUntilEvidenceOpen() {
  if (!govPage.els.scorecard || scorecardBound) return;
  scorecardBound = true;
  renderScorecard();
}

/** Keeps legacy call sites; evidence mounts stay always-visible in `#gov-supporting-evidence`. */
export function mountEvidenceTabShell() {
  const wrap = document.getElementById('gov-supporting-evidence');
  if (!wrap) return;
  ensureFlatEvidenceSections(wrap);
  deferScorecardUntilEvidenceOpen();
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
