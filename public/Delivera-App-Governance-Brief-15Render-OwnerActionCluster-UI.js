import { COPY, firstNameFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { proofChipSummary, sendReadinessBadge } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';

export function renderOwnerActionClusters(brief, groups = []) {
  if (!groups.length) {
    const hasGaps = (brief?.meta?.setupGaps || []).length > 0;
    const link = hasGaps
      ? `<button type="button" class="btn btn-link btn-compact" id="gov-owner-check-setup">${escapeHtml(COPY.checkSetup)}</button>`
      : '<span class="gov-inbox-hint">Brief is healthy.</span>';
    return `<section class="gov-action-clusters" aria-label="Actions"><p class="governance-empty">No urgent person actions.</p>${link}</section>`;
  }
  const cards = groups.map((g, gi) => {
    const name = firstNameFromDisplay(g.assigneeName) || g.ownerKey || COPY.unassigned;
    const keys = g.issues.map((i) => i.issueKey).filter(Boolean);
    const proofText = proofChipSummary(brief, keys);
    const clusterReadiness = sendReadinessBadge(brief);
    const firstUrl = g.issues.find((r) => r.issueUrl)?.issueUrl || '';
    const issueRows = g.issues.map((r) => {
      const age = Number(r.ageHours) || 0;
      const ageChip = age >= 48 ? `<span class="gov-age-chip">${Math.round(age / 24)}d</span>` : '';
      const keyHtml = r.issueKey
        ? `<a href="#" class="gov-cluster-issue-key gov-issue-key-link" data-issue-key="${escapeHtml(r.issueKey)}">${escapeHtml(r.issueKey)}</a>`
        : '';
      return `
      <li class="gov-cluster-issue">
        ${keyHtml}
        <span>${escapeHtml(r.displayTitle || r.summary || '')}</span>
        ${ageChip}
      </li>`;
    }).join('');
    const jiraBtn = firstUrl
      ? `<a class="btn btn-link btn-compact gov-cluster-jira" href="${escapeHtml(firstUrl)}" target="_blank" rel="noopener" data-cluster-jira="${gi}">${escapeHtml(COPY.openInJira)}</a>`
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
        <button type="button" class="btn btn-link btn-compact gov-proof-chip" data-proof-cluster="${gi}" data-hover-proof="evidence-count">${escapeHtml(proofText)}</button>
        <div class="gov-owner-cluster-actions">
          <button type="button" class="btn btn-primary btn-compact gov-cluster-nudge-primary" data-grouped-nudge="${gi}" title="${escapeHtml(COPY.inboxReview)}">✉ ${escapeHtml(COPY.draftNudge)}</button>
          <button type="button" class="btn btn-secondary btn-compact" data-cluster-toggle="${gi}" aria-expanded="false">${g.issues.length} issues</button>
          ${jiraBtn}
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
