import { COPY, firstNameFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { proofChipSummary, sendReadinessBadge } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';

export function renderOwnerActionClusters(brief, groups = []) {
  if (!groups.length) {
    return `<section class="gov-action-clusters" aria-label="Actions"><p class="governance-empty">No urgent person actions — check setup gaps if data looks wrong.</p></section>`;
  }
  const cards = groups.map((g, gi) => {
    const name = firstNameFromDisplay(g.assigneeName) || g.ownerKey || COPY.unassigned;
    const keys = g.issues.map((i) => i.issueKey).filter(Boolean);
    const proofText = proofChipSummary(brief, keys);
    const clusterReadiness = sendReadinessBadge(brief);
    const issueRows = g.issues.map((r) => {
      const age = Number(r.ageHours) || 0;
      const ageChip = age >= 48 ? `<span class="gov-age-chip">${Math.round(age / 24)}d no movement</span>` : '';
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
    return `
      <article class="gov-owner-cluster" data-cluster-index="${gi}">
        <header class="gov-owner-cluster-head">
          <div>
            <h3 class="gov-owner-cluster-name">${escapeHtml(name)} · ${g.issues.length} action${g.issues.length > 1 ? 's' : ''}</h3>
            <p class="gov-owner-cluster-meta">Assignee: ${escapeHtml(g.assigneeName || '—')} · Decision lane: ${escapeHtml(g.decisionLane || '—')}</p>
            <p class="gov-owner-cluster-reason">Common: ${escapeHtml(g.commonReason || '')}</p>
          </div>
          <span class="gov-send-badge gov-send-badge--${clusterReadiness.tier}" data-hover-proof="safe-send">${escapeHtml(clusterReadiness.label)}</span>
        </header>
        <button type="button" class="btn btn-link btn-compact gov-proof-chip" data-proof-cluster="${gi}" data-hover-proof="evidence-count">${escapeHtml(proofText)}</button>
        <div class="gov-owner-cluster-actions">
          <button type="button" class="btn btn-primary btn-compact" data-grouped-nudge="${gi}">Review grouped nudge</button>
          <button type="button" class="btn btn-secondary btn-compact" data-cluster-toggle="${gi}" aria-expanded="false">Show issues</button>
          <select class="gov-cluster-dismiss-reason" data-cluster-dismiss-reason="${gi}" aria-label="Dismiss reason">
            <option value="handled">Handled</option>
            <option value="wrong-owner">Wrong owner</option>
            <option value="bad-data">Bad data</option>
            <option value="irrelevant">Irrelevant</option>
          </select>
          <button type="button" class="btn btn-link btn-compact" data-cluster-dismiss="${gi}">Dismiss</button>
        </div>
        <ul class="gov-cluster-issues" data-cluster-issues="${gi}" hidden>${issueRows}</ul>
      </article>`;
  }).join('');
  return `<section class="gov-action-clusters" aria-label="${escapeHtml(COPY.doNow)}">${cards}</section>`;
}
