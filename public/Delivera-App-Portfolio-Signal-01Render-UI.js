import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';
import { COPY, formatHumanAge } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { decisionActionLabel } from './Delivera-App-Portfolio-Decision-01Panel-UI.js';

function formatCachedFreshness(cachedAt) {
  const age = formatHumanAge(cachedAt);
  return age ? `Updated ${age}` : '';
}

export function renderStatusHonestyBar(brief = {}, decision = {}, { cached = false, cachedAt = '' } = {}) {
  const chips = [];
  const verdict = String(brief?.executiveView?.verdictTier || '').toLowerCase();
  if (verdict === 'blocked') chips.push({ key: 'blocked', label: 'Delivery blocked', tone: 'critical' });
  if (brief?.meta?.piFocus?.synergy === 'low') chips.push({ key: 'pi-mismatch', label: 'PI not aligned', tone: 'warn' });
  if (cached || cachedAt) chips.push({ key: 'cached', label: formatCachedFreshness(cachedAt) || 'Cached view', tone: 'muted' });
  const status = decision?.statusSemantics?.primary;
  if (status === 'watch' && verdict !== 'blocked') chips.push({ key: 'watch', label: 'Watch', tone: 'watch' });
  const visible = chips.slice(0, 2);
  const overflow = chips.slice(2);
  if (!visible.length) return '';
  return `
    <div class="portfolio-status-honesty-bar" data-testid="portfolio-status-honesty-bar">
      ${visible.map((c) => `<span class="portfolio-status-honesty-chip portfolio-status-honesty-chip--${escapeHtml(c.tone)}">${escapeHtml(c.label)}</span>`).join('')}
      ${overflow.length ? `<span class="portfolio-status-honesty-more" title="${escapeHtml(overflow.map((c) => c.label).join(' · '))}">+${overflow.length}</span>` : ''}
    </div>`;
}

export function quarterDayLabel(decision = {}, brief = {}) {
  const range = decision.timebox || brief?.meta?.timebox || {};
  const total = Number(range.totalDays) || 0;
  const elapsed = Number(range.elapsedDays) || 0;
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

function renderCompactChip(label, value, status = '') {
  return `
    <span class="portfolio-summary-chip${status ? ` portfolio-summary-chip--${escapeHtml(status)}` : ''}" data-portfolio-summary-chip>
      <span class="portfolio-summary-chip-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </span>`;
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
    <div class="portfolio-trust-bar" data-portfolio-data-trust data-testid="portfolio-data-trust">
      <span><strong>Last Jira sync</strong>${escapeHtml(freshness || dataTrust.lastSync || 'Live')}</span>
      <span><strong>Boards connected</strong>${Number(boards.connected) || 0} of ${Number(boards.total) || 0}</span>
      <span><strong>Commitments mapped</strong>${Number(mapped.mapped) || 0} of ${Number(mapped.total) || 0}</span>
      <span><strong>Data gaps</strong>${Number(dataTrust.dataGaps) || 0}</span>
      <span class="portfolio-trust-confidence"><strong>Confidence</strong>${escapeHtml(dataTrust.confidenceLabel || 'Medium')}</span>
    </div>`;
}

export function renderPortfolioDataTrust(decision = {}, freshness = '') {
  return renderDataTrust(decision.dataTrust || {}, freshness);
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

function renderHeroCompactMetrics(summary = {}, evidence = {}, required = {}) {
  const onTrack = `${Number(summary.commitmentsOnTrack) || 0}/${Number(summary.commitmentsTotal) || 0}`;
  const atRisk = `${Number(summary.commitmentsAtRisk) || 0}/${Number(summary.commitmentsTotal) || 0}`;
  const evidenceLabel = `${evidence.confidenceLabel || 'Medium'} · ${Number(evidence.available) || 0}/${Number(evidence.required) || 0}`;
  return `
    <div class="portfolio-summary-metrics portfolio-summary-metrics--compact" data-portfolio-summary>
      ${renderCompactChip('On track', onTrack, 'healthy')}
      ${renderCompactChip('At risk', atRisk, summary.commitmentsAtRisk ? 'evidence-gap' : 'healthy')}
      ${renderCompactChip('Evidence', evidenceLabel, evidence.confidenceLabel === 'Low' ? 'evidence-gap' : '')}
    </div>`;
}

function movementLabel(delivered = 0) {
  const d = Number(delivered) || 0;
  if (d >= 60) return 'High';
  if (d >= 30) return 'Medium';
  return 'Low';
}

function renderHeroPrimaryActions(decision = {}, brief = {}) {
  const recommended = decision.recommendation?.id || 'track-commitments';
  const synergyLow = brief?.meta?.piFocus?.synergy === 'low';
  const anchor = decision.anchorProject || '';
  const squadHref = anchor
    ? `/current-sprint?projects=${encodeURIComponent(anchor)}${decision.periodKey ? `&period=${encodeURIComponent(decision.periodKey)}` : ''}`
    : '/current-sprint';
  const primaryAttr = synergyLow
    ? 'data-portfolio-action="open-alignment-studio"'
    : `data-portfolio-action="confirm-decision" data-decision-id="${escapeHtml(recommended)}"`;
  const primaryLabel = synergyLow ? COPY.alignmentStudioOpen : decisionActionLabel(decision, brief);
  const cachedDisabled = decision._cachedView ? ' disabled aria-disabled="true"' : '';
  return `
    <div class="portfolio-signal-actions portfolio-signal-actions--hero-cta" data-testid="portfolio-hero-ctas">
      <button type="button" class="btn btn-primary btn-compact" data-testid="portfolio-primary-cta" ${primaryAttr}${cachedDisabled}>${escapeHtml(primaryLabel)}</button>
      <div class="portfolio-signal-link-row">
        <button type="button" class="btn btn-link btn-compact" data-portfolio-action="focus-compare">Compare peers</button>
        <button type="button" class="btn btn-link btn-compact" data-portfolio-action="view-governance-evidence">Evidence</button>
        <a class="btn btn-link btn-compact" href="${escapeHtml(squadHref)}">Squad work</a>
      </div>
    </div>`;
}

function renderHeroDetails(decision = {}, brief = {}, { epic = {}, summary = {}, evidence = {}, required = {}, tb = {} } = {}) {
  const unalignedCount = Number(epic.unalignedStoryCount) || 0;
  if (!unalignedCount && !epic.label) return '';
  return `
    <div class="portfolio-signal-details portfolio-signal-details--open" data-portfolio-signal-details>
      ${epic.label ? `<p class="portfolio-signal-epic" data-portfolio-epic-lineage><strong>Epic context:</strong> ${escapeHtml(epic.label)}</p>` : ''}
      ${renderUnalignedStories(epic)}
    </div>`;
}

function renderPortfolioSignalHero(decision = {}, brief = {}, { cachedAt = '', cached = false } = {}) {
  const synergyLow = brief?.meta?.piFocus?.synergy === 'low';
  const epic = decision.epicLineage || {};
  const summary = decision.portfolioSummary || {};
  const evidence = decision.evidenceBreakdown || {};
  const required = decision.decisionRequired || {};
  const status = decision.statusSemantics?.primary || 'decision-required';
  const tb = quarterDayLabel(decision, brief);
  const freshness = cached || cachedAt ? formatCachedFreshness(cachedAt) : '';
  const headline = decision.recommendation?.label
    || decision.narrative?.headline
    || required.issue
    || 'Confirm portfolio decision';
  const subtext = decision.peerComparison?.sentence
    || decision.narrative?.summary
    || required.impact
    || '';

  if (synergyLow) {
    return `
      <section class="portfolio-signal portfolio-signal--hero portfolio-signal--synergy-low" aria-label="Portfolio decision cockpit" data-portfolio-signal data-status="${escapeHtml(status)}">
        ${renderStatusHonestyBar(brief, decision, { cached, cachedAt })}
        <div class="portfolio-signal-hero-row">
          <span class="portfolio-signal-verdict-icon" aria-hidden="true">⚖</span>
          <div class="portfolio-signal-hero-copy">
            <div class="portfolio-signal-top">
              <p class="portfolio-signal-kicker">Portfolio decision${freshness ? ` · <span class="portfolio-signal-freshness">${escapeHtml(freshness)}</span>` : ''}</p>
              <span class="portfolio-status-pill portfolio-status-pill--${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
              <span id="portfolio-signal-ai-mount" class="portfolio-signal-ai-mount"></span>
            </div>
            <h1 class="portfolio-signal-headline portfolio-signal-headline--hero">${escapeHtml(COPY.alignmentStudioOpen)}</h1>
            <p class="portfolio-signal-verdict">${escapeHtml(brief?.meta?.piFocus?.summary || 'PI baseline is not aligned with live board work.')}</p>
            ${renderHeroPrimaryActions(decision, brief)}
          </div>
        </div>
      </section>`;
  }

  return `
    <section class="portfolio-signal portfolio-signal--hero portfolio-decision-cockpit" aria-label="Portfolio decision cockpit" data-portfolio-signal data-status="${escapeHtml(status)}">
      ${renderStatusHonestyBar(brief, decision, { cached, cachedAt })}
      <div class="portfolio-signal-hero-row">
        <span class="portfolio-signal-verdict-icon" aria-hidden="true">⚖</span>
        <div class="portfolio-signal-hero-copy">
          <div class="portfolio-signal-top">
            <p class="portfolio-signal-kicker">Portfolio decision${freshness ? ` · <span class="portfolio-signal-freshness">${escapeHtml(freshness)}</span>` : ''}</p>
            <span class="portfolio-status-pill portfolio-status-pill--${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
            <span id="portfolio-signal-ai-mount" class="portfolio-signal-ai-mount"></span>
          </div>
          <h1 class="portfolio-signal-headline portfolio-signal-headline--hero">${escapeHtml(headline)}</h1>
          ${subtext ? `<p class="portfolio-signal-verdict">${escapeHtml(subtext)}</p>` : ''}
          ${renderHeroCompactMetrics(summary, evidence, required)}
          ${renderHeroPrimaryActions(decision, brief)}
          ${unalignedBadge(epic)}
          ${renderDataTrust(decision.dataTrust || {}, freshness)}
        </div>
      </div>
      ${renderHeroDetails(decision, brief, { epic, summary, evidence, required, tb })}
    </section>`;
}

export { movementLabel };

function unalignedBadge(epic = {}) {
  const count = Number(epic.unalignedStoryCount) || 0;
  if (!count) return '';
  return `<span class="portfolio-signal-warning-badge" data-portfolio-unaligned-badge title="Stories missing aligned epic">${count} unaligned</span>`;
}

export function renderPortfolioSignal(decision = {}, { cachedAt = '', cached = false, brief = {} } = {}) {
  return renderPortfolioSignalHero(decision, brief, { cachedAt, cached });
}
