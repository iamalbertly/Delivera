import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';

function formatCachedFreshness(cachedAt) {
  if (!cachedAt) return '';
  const ms = new Date(cachedAt).getTime();
  if (!Number.isFinite(ms)) return '';
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  return mins < 60 ? `Updated ${mins}m ago` : `Updated ${Math.round(mins / 60)}h ago`;
}

export function quarterDayLabel(decision = {}, brief = {}) {
  const range = decision.timebox || brief?.meta?.timebox || {};
  const total = Number(range.totalDays) || 0;
  const elapsed = Number(range.elapsedDays) || 0;
  // Guard: missing timebox → return zeros so callers can show "Time-box not set".
  if (!total || !elapsed) return { total: 0, elapsed: 0, pct: 0, isSet: false };
  const safeTotal = Math.max(1, total);
  const safeElapsed = Math.max(1, Math.min(safeTotal, elapsed));
  return { total: safeTotal, elapsed: safeElapsed, pct: Math.round((safeElapsed / safeTotal) * 100), isSet: true };
}

/**
 * Compact time-box chip for the scope bar — "Q2 2026 · Day 38/90 · 42% time elapsed".
 * Returns empty string when time-box is not set (caller shows "Time-box not set" CTA).
 */
export function renderTimeboxChip(decision = {}, brief = {}) {
  const tb = quarterDayLabel(decision, brief);
  const periodKey = decision.periodKey || brief?.meta?.quarter || 'Current';
  if (!tb.isSet) {
    return `<span class="gov-scope-timebox-chip gov-scope-timebox-chip--unset" data-portfolio-timebox title="Set PI baseline to enable time-box">Time-box not set</span>`;
  }
  return `<span class="gov-scope-timebox-chip" data-portfolio-timebox>${escapeHtml(periodKey)} · Day ${tb.elapsed}/${tb.total} · ${tb.pct}% time elapsed</span>`;
}

/**
 * Compact "Since last check" chip for the scope bar.
 */
export function renderSinceLastCheckChip(brief = {}) {
  const summary = brief?.meta?.sinceLastRun?.summary || '';
  if (!summary) return '';
  return `<span class="gov-scope-since-chip" data-gov-since-chip title="Changes since your last visit">Since last check: ${escapeHtml(String(summary).slice(0, 60))}</span>`;
}

function statusLabel(id = '') {
  const map = {
    'material-risk': 'Material risk',
    'evidence-gap': 'Evidence gap',
    'decision-required': 'Decision required',
    'not-assessed': 'Not assessed',
    healthy: 'Healthy',
  };
  return map[id] || 'Decision required';
}

function renderSourceBadge(label = 'Derived metric') {
  return `<span class="portfolio-source-badge">${escapeHtml(label)}</span>`;
}

function renderSummaryMetric(label, value, hint = '', source = 'Derived metric', status = '') {
  return `
    <div class="portfolio-summary-metric${status ? ` portfolio-summary-metric--${escapeHtml(status)}` : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      ${hint ? `<small>${escapeHtml(hint)}</small>` : ''}
      ${renderSourceBadge(source)}
    </div>`;
}

function renderTimeboxRail(decision = {}, brief = {}) {
  const tb = quarterDayLabel(decision, brief);
  const epic = decision.epicLineage || {};
  const workPct = Number(decision.metrics?.delivery?.value) || 0;
  const method = decision.metrics?.delivery?.methodLabel
    || (workPct === 0 ? 'Progress by issue count when estimates are missing' : 'Progress by delivery evidence');
  return `
    <div class="portfolio-timebox-rail" data-portfolio-timebox-rail>
      <div class="portfolio-timebox-copy">
        <strong>${escapeHtml(decision.periodKey || brief?.meta?.quarter || 'Current quarter')}</strong>
        <span>Q progress: ${tb.pct}% time elapsed</span>
      </div>
      <strong class="portfolio-timebox-day">Day ${tb.elapsed} of ${tb.total}</strong>
      <span class="portfolio-timebox-method">${escapeHtml(method)}</span>
      ${epic.label ? `<span class="portfolio-timebox-epic">${escapeHtml(epic.count || 1)} epic${Number(epic.count) === 1 ? '' : 's'} mapped</span>` : ''}
    </div>`;
}

function renderCommitmentReconciler(decision = {}) {
  const epic = decision.epicLineage || {};
  if (!epic.label) return '';
  const confidence = epic.hasLineage ? 'Aligned' : 'Needs mapping';
  return `
    <div class="portfolio-reconciler-strip" data-portfolio-reconciler>
      <span><strong>Baseline commitment</strong>${escapeHtml(decision.periodKey || 'Current PI')}</span>
      <span><strong>Live Jira epic</strong>${escapeHtml(epic.label)}</span>
      <span class="portfolio-reconciler-status">${escapeHtml(confidence)}</span>
    </div>`;
}

function renderDataTrust(dataTrust = {}, freshness = '') {
  const boards = dataTrust.boardsConnected || {};
  const mapped = dataTrust.commitmentsMapped || {};
  return `
    <div class="portfolio-trust-bar" data-portfolio-data-trust>
      <span><strong>Last Jira sync</strong>${escapeHtml(freshness || dataTrust.lastSync || 'Live')}</span>
      <span><strong>Boards connected</strong>${Number(boards.connected) || 0} of ${Number(boards.total) || 0}</span>
      <span><strong>Commitments mapped</strong>${Number(mapped.mapped) || 0} of ${Number(mapped.total) || 0}</span>
      <span><strong>Data gaps</strong>${Number(dataTrust.dataGaps) || 0}</span>
      <span class="portfolio-trust-confidence"><strong>Confidence</strong>${escapeHtml(dataTrust.confidenceLabel || 'Medium')}</span>
    </div>`;
}

function renderEvidenceSummary(evidence = {}) {
  const tiers = [
    ['Delivery evidence', evidence.delivery],
    ['Acceptance evidence', evidence.acceptance],
    ['Outcome evidence', evidence.outcome],
    ['Contribution evidence', evidence.contribution],
  ];
  return `
    <aside class="portfolio-evidence-summary" data-portfolio-evidence-summary aria-label="Decision evidence">
      <p class="portfolio-evidence-label">Decision evidence</p>
      <h3>${escapeHtml(evidence.confidenceLabel || 'Medium')} confidence</h3>
      <p>${escapeHtml(evidence.interpretation || `${Number(evidence.available) || 0} of ${Number(evidence.required) || 0} evidence points available`)}</p>
      <dl>
        ${tiers.map(([label, tier]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${Number(tier?.available) || 0}/${Number(tier?.required) || 0}</dd>
          </div>`).join('')}
      </dl>
      <div class="portfolio-evidence-actions">
        <button type="button" class="btn btn-secondary btn-compact" data-portfolio-action="view-governance-evidence">View evidence</button>
        <button type="button" class="btn btn-secondary btn-compact" data-portfolio-action="copy-evidence-summary">Copy evidence summary</button>
      </div>
    </aside>`;
}

function renderInterpretationRows(decision = {}) {
  const narrative = decision.narrative || {};
  const peer = decision.peerComparison || {};
  const rows = [
    ['Fact', decision.decisionRequired?.impact || 'No material commitment exposure detected'],
    ['Derived metric', decision.evidenceBreakdown?.interpretation || 'Evidence confidence is being calculated'],
    ['AI draft', peer.sentence || narrative.summary || 'No AI interpretation required for this view'],
    ['Human confirmation pending', decision.decisionRequired?.recommendedAction || 'Confirm the portfolio decision owner'],
  ];
  return `
    <div class="portfolio-interpretation-rows" data-portfolio-interpretation-rows>
      ${rows.map(([label, value]) => `
        <p><span>${escapeHtml(label)}</span>${escapeHtml(value)}</p>`).join('')}
    </div>`;
}

function renderUnalignedStories(epic = {}) {
  const count = Number(epic.unalignedStoryCount) || 0;
  if (!count) return '';
  const stories = Array.isArray(epic.unalignedStories) ? epic.unalignedStories.slice(0, 4) : [];
  const rows = stories.map((story) => `
    <li>
      ${renderJiraWorkItemLink({
        issueKey: story.issueKey,
        title: story.title,
        issueUrl: story.issueUrl || '',
        kind: 'story',
        className: 'portfolio-unaligned-story-link',
      })}
      <span>${escapeHtml(story.status || 'Needs epic')}</span>
    </li>`).join('');
  return `
    <div class="portfolio-unaligned-stories" data-portfolio-unaligned-stories>
      <strong>${count} user stor${count === 1 ? 'y' : 'ies'} missing aligned Epic</strong>
      <p>Governance cannot call this PI-safe until the story is tied to the committed Epic.</p>
      ${rows ? `<ul>${rows}</ul>` : ''}
    </div>`;
}

export function renderPortfolioSignal(decision = {}, { cachedAt = '', cached = false, brief = {} } = {}) {
  const epic = decision.epicLineage || {};
  const summary = decision.portfolioSummary || {};
  const evidence = decision.evidenceBreakdown || {};
  const required = decision.decisionRequired || {};
  const status = decision.statusSemantics?.primary || 'decision-required';
  const quarter = decision.periodKey || brief?.meta?.quarter || 'Current quarter';
  const tb = quarterDayLabel(decision, brief);
  const freshness = cached || cachedAt ? formatCachedFreshness(cachedAt) : '';

  return `
    <section class="portfolio-signal portfolio-decision-cockpit" aria-label="Portfolio decision cockpit" data-portfolio-signal data-status="${escapeHtml(status)}">
      <div class="portfolio-signal-top">
        <p class="portfolio-signal-kicker">Portfolio decision cockpit${freshness ? ` - <span class="portfolio-signal-freshness">${escapeHtml(freshness)}</span>` : ''}</p>
        <span class="portfolio-status-pill portfolio-status-pill--${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
        <span id="portfolio-signal-ai-mount" class="portfolio-signal-ai-mount"></span>
      </div>
      ${renderDataTrust(decision.dataTrust || {}, freshness)}
      <div class="portfolio-signal-grid">
        <div class="portfolio-signal-primary">
          <h2 class="portfolio-signal-headline">${escapeHtml(quarter)} Portfolio Delivery Health</h2>
          <div class="portfolio-summary-metrics" data-portfolio-summary>
            ${renderSummaryMetric('On track', `${Number(summary.commitmentsOnTrack) || 0} of ${Number(summary.commitmentsTotal) || 0}`, 'PI commitments', 'Derived metric', 'healthy')}
            ${renderSummaryMetric('At risk', `${Number(summary.commitmentsAtRisk) || 0} of ${Number(summary.commitmentsTotal) || 0}`, required.impact || 'Commitments needing decision', 'Derived metric', summary.commitmentsAtRisk ? 'evidence-gap' : 'healthy')}
            ${renderSummaryMetric('Blocked', Number(summary.commitmentsBlocked) || 0, 'Squads with blocked delivery tier', 'Fact', summary.commitmentsBlocked ? 'material-risk' : 'healthy')}
            ${renderSummaryMetric('Decisions overdue', Number(summary.decisionsOverdue) || 0, 'Owner response required', 'Fact', summary.decisionsOverdue ? 'decision-required' : 'healthy')}
            ${renderSummaryMetric('Evidence confidence', `${escapeHtml(evidence.confidenceLabel || 'Medium')}, ${Number(evidence.available) || 0} of ${Number(evidence.required) || 0}`, 'Required evidence points', 'Derived metric', evidence.confidenceLabel === 'Low' ? 'evidence-gap' : '')}
            ${renderSummaryMetric('Latest safe decision', required.dueAt || 'Set owner due date', `Day ${tb.elapsed} of ${tb.total}`, 'Derived metric', 'decision-required')}
          </div>
          <p class="portfolio-signal-main-issue"><strong>Decision needed:</strong> ${escapeHtml(required.issue || 'Confirm portfolio scope and owner')}</p>
          ${renderInterpretationRows(decision)}
          ${epic.label ? `<p class="portfolio-signal-epic" data-portfolio-epic-lineage><strong>Epic context:</strong> ${escapeHtml(epic.label)}${epic.coveredStoryCount ? ` - ${Number(epic.coveredStoryCount)} user stor${Number(epic.coveredStoryCount) === 1 ? 'y' : 'ies'} tied to this decision` : ''}</p>` : ''}
          ${renderCommitmentReconciler(decision)}
          ${renderUnalignedStories(epic)}
          ${renderTimeboxRail(decision, brief)}
        </div>
        ${renderEvidenceSummary(evidence)}
      </div>
    </section>`;
}
