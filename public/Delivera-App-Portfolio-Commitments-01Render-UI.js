import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';
import { dedupeCommitmentsByIssueKey } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

const MAX_INLINE = 5;

function renderCommitmentRow(c, decision, { compact = false } = {}) {
  const issueKey = c.issueKey || c.issueKeys?.[0] || c.id || '';
  const titleLink = renderJiraWorkItemLink({
    issueKey,
    title: c.title || '',
    issueUrl: c.issueUrl || '',
    kind: 'epic',
    className: 'portfolio-commitment-link',
  });
  if (compact) {
    return `
      <li class="portfolio-rail-commitment-row" data-commitment-issue="${escapeHtml(issueKey)}" tabindex="0" role="button">
        <strong>${titleLink}</strong>
        <span class="portfolio-commitment-status portfolio-commitment-status--${escapeHtml(String(c.status || '').toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(c.status || '')}</span>
      </li>`;
  }
  return `
    <li class="portfolio-commitment-row" data-commitment-id="${escapeHtml(c.id || '')}" data-commitment-issue="${escapeHtml(issueKey)}" tabindex="0" role="button">
      <div class="portfolio-commitment-head">
        <strong class="portfolio-commitment-title">${titleLink}</strong>
        <span class="portfolio-commitment-status portfolio-commitment-status--${escapeHtml(String(c.status || '').toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(c.status || '')}</span>
      </div>
      <p class="portfolio-commitment-meta">${escapeHtml(c.periodKey || decision.periodKey || '')}${c.projectKey ? ` · ${escapeHtml(c.projectKey)}` : ''}</p>
      ${(() => {
        const reason = String(c.reason || '').trim();
        const move = String(c.decisionNeeded || '').trim();
        if (reason && move && reason === move) {
          return `<p class="portfolio-commitment-next-move"><span>Next move:</span> ${escapeHtml(move)}</p>`;
        }
        return `<p class="portfolio-commitment-reason"><span>Reason:</span> ${escapeHtml(reason)}</p>
      <p class="portfolio-commitment-decision"><span>Decision:</span> ${escapeHtml(move)}</p>`;
      })()}
    </li>`;
}

export function renderPortfolioRailCommitments(_decision = {}) {
  // Decision rail owns focus — at-risk list lives once in main commitments (no duplicate).
  return '';
}

export function renderPortfolioCommitments(decision = {}) {
  const rows = dedupeCommitmentsByIssueKey(decision.affectedCommitments || []);
  const visible = rows.slice(0, MAX_INLINE);
  if (!rows.length) {
    return `
      <section class="portfolio-commitments portfolio-commitments--empty" aria-label="Affected commitments" data-portfolio-commitments>
        <h2 class="portfolio-commitments-title">Affected commitments</h2>
        <p class="portfolio-commitments-empty">No exposed commitments detected for the selected squad.</p>
      </section>`;
  }
  return `
    <section class="portfolio-commitments" aria-label="Affected commitments" data-portfolio-commitments>
      <h2 class="portfolio-commitments-title">Affected commitments</h2>
      <ul class="portfolio-commitments-list portfolio-commitments-list--scroll">
        ${visible.map((c) => renderCommitmentRow(c, decision)).join('')}
      </ul>
    </section>`;
}
