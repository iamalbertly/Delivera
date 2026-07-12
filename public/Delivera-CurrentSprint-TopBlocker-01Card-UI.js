/**
 * Sticky Top Blocker Card — surfaces the #1 blocker at the top of the Current
 * Sprint page with a one-click nudge CTA. Reduces the primary unblock flow from
 * 5-6 clicks to 1-2. Reuses resolvePrimaryBlockerKey + existing nudge infrastructure.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { resolvePrimaryBlockerKey } from './Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';

function findBlockerData(data = {}, blockerKey = '') {
  if (!blockerKey) return null;
  const key = blockerKey.toUpperCase();
  const cockpit = data?.decisionCockpit || {};
  const nba = cockpit?.nextBestAction;
  if (nba && String(nba.issueKey || '').toUpperCase() === key) return nba;
  const topRisks = Array.isArray(cockpit.topRisks) ? cockpit.topRisks : [];
  const risk = topRisks.find((r) => String(r.issueKey || '').toUpperCase() === key);
  if (risk) return risk;
  const stuck = (data?.stuckCandidates || []).find(
    (s) => String(s.issueKey || s.key || '').toUpperCase() === key,
  );
  return stuck || null;
}

export function renderTopBlockerCard(data = {}) {
  const blockerKey = resolvePrimaryBlockerKey(data);
  if (!blockerKey) return '';
  const blocker = findBlockerData(data, blockerKey);
  if (!blocker) return '';

  const issueKey = escapeHtml(blocker.issueKey || blocker.key || blockerKey);
  const title = escapeHtml(String(blocker.title || blocker.summary || '').slice(0, 120));
  const assignee = escapeHtml(blocker.assignee || blocker.owner || blocker.assigneeName || '');
  const status = escapeHtml(blocker.status || blocker.state || '');
  const reason = escapeHtml(String(blocker.reason || blocker.riskType || blocker.flag || '').slice(0, 160));
  const issueUrl = blocker.issueUrl || blocker.url || '';

  return `
    <section class="top-blocker-card" aria-label="Top blocker" data-testid="top-blocker-card" data-blocker-key="${issueKey}" data-blocker-nudge="${issueKey}" tabindex="0" role="button">
      <div class="top-blocker-card-icon" aria-hidden="true">🚫</div>
      <div class="top-blocker-card-body">
        <p class="top-blocker-card-eyebrow">Top blocker · tap to nudge</p>
        <strong class="top-blocker-card-title">
          ${issueUrl ? `<a href="${escapeHtml(issueUrl)}" target="_blank" rel="noopener" data-testid="top-blocker-link">${issueKey}</a>` : issueKey}
          ${title ? ` · ${title}` : ''}
        </strong>
        ${reason ? `<p class="top-blocker-card-reason" data-testid="top-blocker-reason">${reason}</p>` : ''}
        <div class="top-blocker-card-meta">
          ${assignee ? `<span class="top-blocker-card-assignee">@${assignee}</span>` : ''}
          ${status ? `<span class="top-blocker-card-status">${status}</span>` : ''}
        </div>
      </div>
    </section>`;
}
