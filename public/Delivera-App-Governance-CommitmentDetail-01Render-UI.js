/**
 * Below-fold commitment detail table — baseline-first unsupported promises.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

const MAX_INLINE = 5;

function nextDecisionLabel(row = {}) {
  if (row.scopeAfterPlanning) return COPY.governanceRecordScopeDecision;
  if (row.matchScore != null && row.matchScore < 55) return COPY.governanceConfirmExtracted;
  if (!row.hasJiraMatch) return COPY.governanceLinkJiraWork;
  if (!row.owner) return COPY.governanceAssignOwner;
  if (row.governanceState === 'done-unproven') return COPY.governanceReviewAcceptance;
  if (row.verdict === 'removed') return COPY.governanceRecordRemoval;
  return COPY.governanceRecordDecision;
}

function renderDetailRow(row = {}) {
  const issueKey = row.issueKey || '';
  const title = issueKey
    ? renderJiraWorkItemLink({ issueKey, title: row.title || issueKey, kind: 'epic', className: 'gov-commitment-detail-link' })
    : escapeHtml(row.title || 'Commitment');
  const actionLabel = nextDecisionLabel(row);
  const tone = row.governanceState === 'done-unproven' ? 'watch' : 'critical';
  return `
    <tr class="gov-commitment-detail-row gov-commitment-detail-row--${escapeHtml(tone)}"
      data-testid="governance-commitment-row"
      data-commitment-issue="${escapeHtml(issueKey)}"
      tabindex="0" role="button">
      <td>${escapeHtml(row.projectKey || '')}</td>
      <td><span class="gov-status-rail gov-status-rail--${escapeHtml(tone)}">${escapeHtml(row.reality || '')}</span></td>
      <td>${title}</td>
      <td>${escapeHtml(row.baselinePromise || '')}</td>
      <td>${row.hasJiraMatch ? escapeHtml(row.statusNow || 'Linked') : '0 matching items'}</td>
      <td>${escapeHtml(row.owner || '—')}</td>
      <td><button type="button" class="btn btn-link btn-compact" data-governance-action="commitment-decision" data-commitment-issue="${escapeHtml(issueKey)}">${escapeHtml(actionLabel)}</button></td>
    </tr>`;
}

export function renderCommitmentDetail(priorityBrief = {}) {
  const rows = priorityBrief?.detailRows || [];
  if (!rows.length) return '';

  const visible = rows.slice(0, MAX_INLINE);
  const overflow = rows.slice(MAX_INLINE);

  return `
    <section class="gov-commitment-detail" data-testid="governance-commitment-detail" aria-label="Missing or unproven PI commitments">
      <h2 class="gov-below-fold-title">Missing or unproven PI commitments</h2>
      <div class="gov-above-fold-marker" aria-hidden="true"><span>Below the fold</span></div>
      <table class="gov-commitment-detail-table">
        <thead>
          <tr>
            <th scope="col">Squad</th>
            <th scope="col">Status</th>
            <th scope="col">PI reference</th>
            <th scope="col">PI commitment</th>
            <th scope="col">Board work found</th>
            <th scope="col">Owner</th>
            <th scope="col">Next decision</th>
          </tr>
        </thead>
        <tbody>
          ${visible.map(renderDetailRow).join('')}
        </tbody>
      </table>
      ${overflow.length ? `<button type="button" class="btn btn-link btn-compact" data-governance-action="expand-commitment-detail">+${overflow.length} more commitments</button>
        <table class="gov-commitment-detail-table gov-commitment-detail-overflow" hidden><tbody>${overflow.map(renderDetailRow).join('')}</tbody></table>` : ''}
    </section>`;
}
