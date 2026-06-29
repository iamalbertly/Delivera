/**
 * Governance Brief render helpers — KPI strip, decisions table, evidence detail, export.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export function truthChip(label, value, tone) {
  const v = value == null ? '-' : value;
  return `<div class="governance-truth-chip${tone ? ' tone-' + tone : ''}"><span class="gov-chip-value">${escapeHtml(v)}</span><span class="gov-chip-label">${escapeHtml(label)}</span></div>`;
}

export function buildDecisionsRows(brief) {
  const rows = [];
  const fromNarrative = Array.isArray(brief?.leadershipNarrative?.decisionsNeeded)
    ? brief.leadershipNarrative.decisionsNeeded : [];
  for (const d of fromNarrative) {
    if (!d?.action && !d?.issueKey) continue;
    rows.push({
      issueKey: d.issueKey || '—',
      owner: d.decisionNeededFrom || '—',
      action: d.action || '',
      decision: d.riskLabel || 'Decision needed',
    });
  }
  for (const r of (brief?.topRisks || [])) {
    const dup = rows.some((x) => x.issueKey === r.issueKey && r.issueKey);
    if (dup && r.issueKey) continue;
    rows.push({
      issueKey: r.issueKey || r.squad || 'Portfolio',
      owner: r.decisionNeededFrom || 'Scrum Master',
      action: r.recommendedAction || '',
      decision: r.riskLabel || r.riskType || 'Risk',
    });
  }
  return rows.slice(0, 8);
}

export function renderKpiStrip(brief) {
  const n = brief?.leadershipNarrative || {};
  const conf = String(n.confidence || 'low');
  const decisions = buildDecisionsRows(brief).length;
  const risks = (brief?.topRisks?.length || 0) + (brief?.portfolioRisks?.length || 0);
  const trust = brief?.freshness?.confidenceLimit || 'live';
  return `
    <div class="governance-kpi-strip" role="group" aria-label="Brief summary">
      ${truthChip('Confidence', conf, conf === 'high' ? 'good' : conf === 'medium' ? 'warn' : 'bad')}
      ${truthChip('Decisions', decisions, decisions > 0 ? 'warn' : 'good')}
      ${truthChip('Active risks', risks, risks > 0 ? 'warn' : '')}
      ${truthChip('Data confidence', trust, trust === 'live' ? 'good' : 'warn')}
    </div>`;
}

export function renderDecisionsTable(brief) {
  const rows = buildDecisionsRows(brief);
  if (!rows.length) {
    return '<p class="governance-empty">No decisions flagged for this scope. Refresh after sprint data loads.</p>';
  }
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.decision)}</td>
      <td>${escapeHtml(r.owner)}</td>
      <td>${escapeHtml(r.action)}</td>
      <td>${escapeHtml(r.issueKey)}</td>
    </tr>`).join('');
  return `<table class="governance-decisions-table"><thead><tr><th>#</th><th>Decision</th><th>Owner</th><th>Action</th><th>Ref</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function renderStructuredEvidence(ev, risk) {
  const rule = risk?.ruleFired || risk?.riskType || 'delivery-risk';
  const inputs = [
    risk?.squad ? `Squad: ${risk.squad}` : '',
    risk?.status ? `Status: ${risk.status}` : '',
    risk?.evidence || '',
    ev?.statusLastWeek ? `Status last week: ${ev.statusLastWeek}` : '',
  ].filter(Boolean);
  return `
    <dl class="governance-evidence governance-evidence--structured">
      <div><dt>Rule fired</dt><dd>${escapeHtml(rule)}</dd></div>
      <div><dt>Inputs</dt><dd>${inputs.map((l) => escapeHtml(l)).join('<br>') || '—'}</dd></div>
      <div><dt>Interpretation</dt><dd>${escapeHtml(risk?.evidence || '')}</dd></div>
      <div><dt>Recommended action</dt><dd>${escapeHtml(risk?.recommendedAction || '')}</dd></div>
    </dl>`;
}

export function briefToMarkdown(brief, projectsCsv, impactSection = '') {
  const n = brief?.leadershipNarrative || {};
  const d = brief?.deliveryTruth || {};
  const lines = [];
  lines.push(`# ${brief.portfolio} — Today's delivery answer`);
  lines.push(`Scope: ${projectsCsv || brief.portfolio}`);
  lines.push('');
  lines.push(n.meetingAnswer || n.oneParagraph || '');
  if (n.whatToSay) {
    lines.push('');
    lines.push(`What to say: "${n.whatToSay}"`);
  }
  lines.push(`Fetched: ${brief?.freshness?.jiraFetchedAt || brief.generatedAt}`);
  lines.push('');
  lines.push(`## Headline`);
  lines.push(n.headline || '');
  lines.push('');
  lines.push(n.oneParagraph || '');
  lines.push('');
  lines.push('## Top decisions');
  for (const r of buildDecisionsRows(brief)) {
    lines.push(`- **${r.owner}** (${r.issueKey}): ${r.action}`);
  }
  lines.push('');
  lines.push('## Risks');
  for (const r of (brief?.topRisks || [])) {
    lines.push(`- ${r.issueKey || r.squad}: ${r.evidence} — owner: ${r.decisionNeededFrom}`);
  }
  for (const r of (brief?.portfolioRisks || [])) {
    lines.push(`- [Portfolio] ${r.squad}: ${r.evidence}`);
  }
  lines.push('');
  lines.push('## Delivery truth');
  const removed = d.removed != null ? d.removed : 'n/a';
  const carry = d.carryover != null ? d.carryover : 'n/a';
  lines.push(`Committed ${d.committed}, delivered ${d.done}, stale ${d.staleInProgress}, blocked ${d.blocked}, added mid-sprint ${d.lateAdded}, removed vs PI ${removed}, carryover/delayed ${carry}.`);
  lines.push('');
  lines.push('## Evidence appendix');
  for (const row of (brief?.evidencePack?.rows || [])) {
    lines.push(`- ${row.issueKey}: ${row.whyFlagged}`);
  }
  if (impactSection) {
    lines.push('');
    lines.push(impactSection);
  }
  return lines.join('\n');
}
