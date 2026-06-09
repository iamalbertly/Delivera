import { COPY, firstNameFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { proofChipSummary, sendReadinessBadge } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';

export function renderOwnerActionClusters(brief, groups = []) {
  if (!groups.length) {
    const gaps = brief?.meta?.setupGaps || [];
    const hasGaps = gaps.length > 0;
    const highGapAuto = gaps.some((g) => String(g.severity || '').toLowerCase() === 'high');
    const link = hasGaps && !highGapAuto
      ? `<button type="button" class="btn btn-link btn-compact" id="gov-owner-check-setup">${escapeHtml(COPY.checkSetup)}</button>`
      : (hasGaps
        ? '<span class="gov-inbox-hint" data-setup-shown-above="1">Setup gaps shown above.</span>'
        : '<span class="gov-inbox-hint">Brief is healthy.</span>');
    return `<section class="gov-action-clusters" aria-label="Actions"><p class="governance-empty">No urgent person actions.</p>${link}</section>`;
  }
  const cards = groups.map((g, gi) => {
    const name = firstNameFromDisplay(g.assigneeName) || g.ownerKey || COPY.unassigned;
    const keys = g.issues.map((i) => i.issueKey).filter(Boolean);
    const proofText = proofChipSummary(brief, keys);
    const clusterReadiness = sendReadinessBadge(brief);
    const [leadIssue, ...restIssues] = g.issues;
    const renderIssueRow = (r) => {
      const age = Number(r.ageHours) || 0;
      const ageChip = age >= 48 ? `<span class="gov-age-chip">${Math.round(age / 24)}d</span>` : '';
      const keyHtml = r.issueKey
        ? `<a href="/current-sprint?issue=${encodeURIComponent(r.issueKey)}" class="gov-cluster-issue-key gov-issue-key-link" data-issue-key="${escapeHtml(r.issueKey)}">${escapeHtml(r.issueKey)}</a>`
        : '';
      return `
      <li class="gov-cluster-issue">
        ${keyHtml}
        <span>${escapeHtml(r.displayTitle || r.summary || '')}</span>
        ${ageChip}
      </li>`;
    };
    const leadRow = leadIssue ? `
      <div class="gov-cluster-lead-issue" data-cluster-lead="${gi}">
        ${leadIssue.issueKey ? `<a href="/current-sprint?issue=${encodeURIComponent(leadIssue.issueKey)}" class="gov-cluster-issue-key gov-issue-key-link" data-issue-key="${escapeHtml(leadIssue.issueKey)}">${escapeHtml(leadIssue.issueKey)}</a>` : ''}
        <span class="gov-cluster-lead-title">${escapeHtml(leadIssue.displayTitle || leadIssue.summary || '')}</span>
      </div>` : '';
    const issueRows = restIssues.map(renderIssueRow).join('');
    const toggleBtn = restIssues.length
      ? `<button type="button" class="btn btn-secondary btn-compact" data-cluster-toggle="${gi}" aria-expanded="false">+${restIssues.length} more</button>`
      : '';
    return `
      <article class="gov-owner-cluster" data-cluster-index="${gi}">
        <header class="gov-owner-cluster-head">
          <div>
            <h3 class="gov-owner-cluster-name">${escapeHtml(name)} · ${g.issues.length} action${g.issues.length > 1 ? 's' : ''}</h3>
            <p class="gov-owner-cluster-meta">${escapeHtml(g.decisionLane || 'Decision lane')} · ${escapeHtml(g.commonReason || '')}</p>
          </div>
          <span class="gov-send-badge gov-send-badge--${clusterReadiness.tier}" data-hover-proof="safe-send">${escapeHtml(clusterReadiness.label)}</span>
        </header>
        ${leadRow}
        <button type="button" class="btn btn-link btn-compact gov-proof-chip" data-proof-cluster="${gi}" data-hover-proof="evidence-count">${escapeHtml(proofText)}</button>
        <div class="gov-owner-cluster-actions">
          <button type="button" class="btn btn-primary btn-compact gov-cluster-nudge-primary" data-grouped-nudge="${gi}" title="${escapeHtml(COPY.inboxReview)}">✉ ${escapeHtml(COPY.draftNudge)}</button>
          ${toggleBtn}
          <div class="gov-cluster-dismiss-chips" role="group" aria-label="Dismiss">
            <button type="button" class="gov-inbox-dismiss-chip" data-cluster-dismiss="${gi}" data-dismiss-reason="handled" title="Handled">✓</button>
            <button type="button" class="gov-inbox-dismiss-chip" data-cluster-dismiss="${gi}" data-dismiss-reason="irrelevant" title="Irrelevant">✕</button>
          </div>
        </div>
        <ul class="gov-cluster-issues" data-cluster-issues="${gi}" hidden>${issueRows}</ul>
      </article>`;
  }).join('');
  return `<section class="gov-action-clusters" aria-label="${escapeHtml(COPY.doNow)}">${cards}</section>`;
}
