import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { buildCalibrationExcerpt } from './Delivera-App-Portfolio-Actions-01Bridge.js';
import { portfolioCanonicalCounts } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';

const MAX_HEADLINE = 92;

function cleanOperationalHeadline(raw = '') {
  const text = String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^DELIVERY\s+BLOCKED\.?\s*/i, '')
    .replace(/^BLOCKED\.?\s*/i, '')
    .trim();
  const base = text || 'Delivery needs intervention';
  const sentence = base.split(/(?<=[.!?])\s+/)[0] || base;
  const clipped = sentence.length > MAX_HEADLINE
    ? `${sentence.slice(0, MAX_HEADLINE - 1).replace(/\s+\S*$/, '')}...`
    : sentence;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

function formatCachedFreshness(cachedAt) {
  if (!cachedAt) return '';
  const ms = new Date(cachedAt).getTime();
  if (!Number.isFinite(ms)) return '';
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  return mins < 60 ? `Updated ${mins}m ago` : `Updated ${Math.round(mins / 60)}h ago`;
}

function quarterDayLabel(decision = {}, brief = {}) {
  const range = decision.timebox || brief?.meta?.timebox || {};
  const total = Math.max(1, Number(range.totalDays) || 90);
  const elapsed = Math.max(1, Math.min(total, Number(range.elapsedDays) || Math.round(total / 2)));
  return { total, elapsed, pct: Math.round((elapsed / total) * 100) };
}

function compactMetric(label, metric = {}) {
  const value = Math.max(0, Math.min(100, Number(metric.value) || 0));
  const peer = Number(metric.peerMedian) || 0;
  const expected = Math.max(0, Math.min(100, Number(metric.expectedTarget) || peer || 0));
  const method = metric.methodLabel || (value === 0 && peer === 0 ? 'Needs baseline' : 'Live');
  return `
    <div class="portfolio-progress-row" data-metric="${escapeHtml(label.toLowerCase().replace(/\s+/g, '-'))}">
      <span class="portfolio-metric-label">${escapeHtml(label)}</span>
      <span class="portfolio-progress-track" aria-hidden="true">
        <span class="portfolio-progress-expected" style="width:${expected}%"></span>
        <span class="portfolio-progress-value" style="width:${value}%"></span>
      </span>
      <strong class="portfolio-metric-value">${value}%</strong>
      <span class="portfolio-metric-peer">${expected ? `target ${expected}%` : method}</span>
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

function bulletizeSummary(summary = '', peer = {}) {
  const bullets = [];
  if (peer.sentence) bullets.push(peer.sentence.replace(/[.!?]+$/, ''));
  for (const line of String(summary || '').split(/(?<=[.!?])\s+/)) {
    const cleaned = line.trim().replace(/[.!?]+$/, '');
    if (cleaned && !bullets.includes(cleaned)) bullets.push(cleaned);
  }
  return bullets.slice(0, 4);
}

function renderSummaryBullets(summary = '', peer = {}) {
  const bullets = bulletizeSummary(summary, peer);
  if (!bullets.length) return '';
  return `
    <ul class="portfolio-signal-bullets" data-portfolio-signal-bullets>
      ${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
    </ul>`;
}

function trustOneLiner(trust = {}) {
  const proof = trust.proofLevel || 'Medium';
  const verified = trust.claimsVerified ? 'verified' : 'needs review';
  const source = trust.wordingSource === 'template' ? 'template wording' : 'AI-polished when available';
  return `Proof ${proof} - claims ${verified} - ${source} - human approval always required`;
}

function renderCalibrationShield(calibrationExcerpt = '') {
  if (!calibrationExcerpt || !calibrationExcerpt.trim()) return '';
  return `
    <aside class="portfolio-calibration-shield" data-portfolio-calibration-inline aria-label="Calibration shield">
      <p class="portfolio-calibration-inline-label">Calibration shield</p>
      <div class="portfolio-calibration-formats" aria-label="Format calibration defense">
        <button type="button" class="is-active" data-calibration-format="successfactors">SuccessFactors</button>
        <button type="button" data-calibration-format="hr-review">HR Review</button>
        <button type="button" data-calibration-format="hod-briefing">HOD Briefing</button>
      </div>
      <p class="portfolio-calibration-inline-excerpt">${escapeHtml(calibrationExcerpt)}</p>
      <button type="button" class="btn btn-secondary btn-compact" data-portfolio-action="copy-calibration-defense">Copy defense</button>
    </aside>`;
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
  const m = decision.metrics || {};
  const trust = decision.trust || {};
  const narrative = decision.narrative || {};
  const above = decision.aboveFold || {};
  const peer = decision.peerComparison || {};
  const epic = decision.epicLineage || {};
  const canonical = portfolioCanonicalCounts(decision);
  const rawHeadline = narrative.headline || decision.headline || 'Portfolio signal';
  const headline = cleanOperationalHeadline(rawHeadline);
  const summary = narrative.summary || decision.summary || '';
  const freshness = cached || cachedAt ? formatCachedFreshness(cachedAt) : '';
  const calibrationExcerpt = buildCalibrationExcerpt(brief, decision);

  return `
    <section class="portfolio-signal" aria-label="AI portfolio signal" data-portfolio-signal>
      <div class="portfolio-signal-top">
        <p class="portfolio-signal-kicker">AI portfolio signal${freshness ? ` - <span class="portfolio-signal-freshness">${escapeHtml(freshness)}</span>` : ''}</p>
        <span id="portfolio-signal-ai-mount" class="portfolio-signal-ai-mount"></span>
      </div>
      <div class="portfolio-signal-grid">
        <div class="portfolio-signal-primary">
          <h2 class="portfolio-signal-headline" title="${escapeHtml(rawHeadline)}">${escapeHtml(headline)}</h2>
          <div class="portfolio-above-fold" data-portfolio-above-fold>
            <span class="portfolio-fold-stat"><strong>${canonical.exposedCommitments}</strong> commitment${canonical.exposedCommitments === 1 ? '' : 's'} exposed</span>
            <span class="portfolio-fold-stat"><strong>${canonical.actionsReady}</strong> action${canonical.actionsReady === 1 ? '' : 's'} ready</span>
            <span class="portfolio-fold-stat"><strong>${canonical.poResponsesRequired}</strong> PO response${canonical.poResponsesRequired === 1 ? '' : 's'} required</span>
            ${above.nextDeadline ? `<span class="portfolio-fold-stat">Next deadline: <strong>${escapeHtml(above.nextDeadline)}</strong></span>` : ''}
          </div>
          <p class="portfolio-signal-main-issue"><strong>Main issue:</strong> ${escapeHtml(above.mainIssue || narrative.mainIssue || '')}</p>
          ${epic.label ? `<p class="portfolio-signal-epic" data-portfolio-epic-lineage><strong>Epic context:</strong> ${escapeHtml(epic.label)}${epic.coveredStoryCount ? ` - ${Number(epic.coveredStoryCount)} user stor${Number(epic.coveredStoryCount) === 1 ? 'y' : 'ies'} tied to this decision` : ''}</p>` : ''}
          ${renderCommitmentReconciler(decision)}
          ${renderUnalignedStories(epic)}
          ${renderTimeboxRail(decision, brief)}
          <div class="portfolio-signal-metrics portfolio-metric-row portfolio-alignment-rail" role="group" aria-label="PI alignment progress rail">
            ${compactMetric('Delivery', m.delivery)}
            ${compactMetric('Off-plan', m.offPlanLoad)}
            ${compactMetric('Proof', m.proofConfidence)}
          </div>
          ${renderSummaryBullets(summary, peer)}
          <div class="portfolio-signal-trust portfolio-signal-trust--inline" data-portfolio-trust>
            <span class="portfolio-trust-item" data-trust-live-cases>${trust.liveCases || 0} live case${trust.liveCases === 1 ? '' : 's'}</span>
            <span class="portfolio-trust-item" data-trust-proof>Proof: ${escapeHtml(canonical.proofLevel)}</span>
            ${narrative.escalationReady ? '<span class="portfolio-trust-item portfolio-trust-escalation">Escalation ready if no response</span>' : ''}
          </div>
          <p class="portfolio-signal-trust-line">${escapeHtml(trustOneLiner(trust))}</p>
        </div>
        ${renderCalibrationShield(calibrationExcerpt)}
      </div>
    </section>`;
}
