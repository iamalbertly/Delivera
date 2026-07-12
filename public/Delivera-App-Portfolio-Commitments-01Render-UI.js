import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';
import { dedupeCommitmentsByIssueKey, shouldMergeCommitmentLines } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

const MAX_INLINE = 1;

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
        if (shouldMergeCommitmentLines(reason, move)) {
          return `<p class="portfolio-commitment-next-move"><span>Next move:</span> ${escapeHtml(move || reason)}</p>`;
        }
        return `<p class="portfolio-commitment-reason"><span>Reason:</span> ${escapeHtml(reason)}</p>
      <p class="portfolio-commitment-decision"><span>Decision:</span> ${escapeHtml(move)}</p>`;
      })()}
    </li>`;
}

export function renderPortfolioRailCommitments(decision = {}) {
  // Rail commitments section removed — at-risk commitments are now pinned to the top
  // of the main commitments list via renderPortfolioCommitments(). This eliminates
  // duplicate data appearing in two places on the same viewport.
  return '';
}

export function renderPortfolioCommitments(decision = {}) {
  const allRows = dedupeCommitmentsByIssueKey(decision.affectedCommitments || []);
  // Pin at-risk commitments to the top — replaces the duplicate rail "At risk now" section.
  const atRisk = allRows.filter((c) => /risk|at/i.test(String(c.status || '')));
  const healthy = allRows.filter((c) => !/risk|at/i.test(String(c.status || '')));
  const sorted = [...atRisk, ...healthy];
  const visible = sorted.slice(0, MAX_INLINE);
  const overflow = sorted.slice(MAX_INLINE);
  if (!allRows.length) {
    return `
      <section class="portfolio-commitments portfolio-commitments--empty" aria-label="Affected commitments" data-portfolio-commitments>
        <h2 class="portfolio-commitments-title">Affected commitments</h2>
        <p class="portfolio-commitments-empty">No commitments mapped yet — connect a Jira board to see exposure.</p>
        <p class="portfolio-commitments-empty-cta">
          <a href="/settings#integrations" class="btn btn-link btn-compact">Connect Jira board →</a>
        </p>
      </section>`;
  }
  return `
    <section class="portfolio-commitments" aria-label="Affected commitments" data-portfolio-commitments>
      <h2 class="portfolio-commitments-title">Affected commitments${atRisk.length ? ` <span class="portfolio-commitments-at-risk-count">${atRisk.length} at risk</span>` : ''}</h2>
      <ul class="portfolio-commitments-list portfolio-commitments-list--scroll">
        ${visible.map((c) => renderCommitmentRow(c, decision)).join('')}
      </ul>
      ${overflow.length ? `
      <div class="portfolio-commitments-more">
        <button type="button" class="btn btn-link btn-compact" data-portfolio-action="expand-commitments">+${overflow.length} more</button>
        <ul class="portfolio-commitments-list portfolio-commitments-overflow" hidden>
          ${overflow.map((c) => renderCommitmentRow(c, decision)).join('')}
        </ul>
      </div>` : ''}
    </section>`;
}
