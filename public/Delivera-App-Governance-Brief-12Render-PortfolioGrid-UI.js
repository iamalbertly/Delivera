import { COPY, initialsFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { renderPulseBars, squadVerdictLabel } from './Delivera-App-Governance-Brief-07Render-VerdictZone-UI.js';

export function renderPortfolioBanner(rollup = {}) {
  const line = rollup.summaryLine || COPY.portfolioRollupOk;
  return `
    <section class="gov-portfolio-banner" aria-label="${escapeHtml(COPY.portfolioRisksBanner)}">
      <h2 class="gov-portfolio-banner-title">${escapeHtml(COPY.portfolioRisksBanner)}</h2>
      <p class="gov-portfolio-banner-line">${escapeHtml(line)}</p>
    </section>`;
}

function tierIcon(tier) {
  if (tier === 'blocked') return '!';
  if (tier === 'onTrack') return '✓';
  return '◐';
}

function renderSquadCardRisks(squad = {}) {
  const risks = Array.isArray(squad.cardRisks) ? squad.cardRisks : [];
  if (!risks.length) return '';
  const pk = squad.projectKey || 'squad';
  const visible = risks.slice(0, 3);
  const hidden = risks.slice(3);
  const rows = visible.map((r) => {
    const label = r.displayTitle || r.issueKey || 'Risk';
    return `<li class="gov-squad-risk-item" data-escalation="${escapeHtml(r.escalation || 'watch')}">${escapeHtml(label)}</li>`;
  }).join('');
  const hiddenRows = hidden.map((r) => {
    const label = r.displayTitle || r.issueKey || 'Risk';
    return `<li class="gov-squad-risk-item gov-squad-risk-item--extra" data-escalation="${escapeHtml(r.escalation || 'watch')}">${escapeHtml(label)}</li>`;
  }).join('');
  const more = hidden.length
    ? `<button type="button" class="btn btn-link btn-compact gov-squad-risks-more" data-squad-risks="${escapeHtml(pk)}" aria-expanded="false">+${hidden.length} more</button>`
    : '';
  return `
    <ul class="gov-squad-risks" data-squad-risks-list="${escapeHtml(pk)}">${rows}${hiddenRows}</ul>
    ${more}`;
}

export function renderSquadInsightCard(squad = {}) {
  const tier = squad.verdictTier || 'watch';
  const pulse = squad.sprintPulse || {};
  const initials = initialsFromDisplay(squad.assigneeHighlight);
  const avatar = squad.assigneeHighlight
    ? `<div class="gov-squad-avatar" title="${escapeHtml(squad.assigneeHighlight)}" aria-hidden="true">${escapeHtml(initials)}</div>`
    : '';
  const capacity = squad.capacityLine
    ? `<p class="gov-squad-metric gov-squad-metric--warn"><span aria-hidden="true">!</span> ${escapeHtml(squad.capacityLine)}</p>`
    : '';
  const leadTrend = squad.leadTimeTrend === 'worsening' ? 'gov-squad-metric--warn' : 'gov-squad-metric--ok';
  const lead = squad.leadTimeLine
    ? `<p class="gov-squad-metric ${leadTrend}">${escapeHtml(squad.leadTimeLine)}</p>`
    : '';
  const productivityClass = /stale|stuck|unavailable/i.test(squad.productivityLine || '')
    ? 'gov-squad-metric--warn'
    : 'gov-squad-metric--ok';

  return `
    <article class="gov-squad-card" data-verdict-tier="${escapeHtml(tier)}" data-project="${escapeHtml(squad.projectKey || '')}">
      <header class="gov-squad-card-head">
        <div class="gov-squad-card-title-row">
          <span class="gov-squad-key">${escapeHtml(COPY.squadLabel)} ${escapeHtml(squad.projectKey || '')}</span>
          ${avatar}
        </div>
        <span class="gov-squad-tier-badge">${escapeHtml(squadVerdictLabel(squad))}</span>
      </header>
      ${renderPulseBars(pulse)}
      <p class="gov-squad-status">${escapeHtml(squad.statusLine || '')}</p>
      <p class="gov-squad-bottleneck"><span class="gov-squad-metric-label">${escapeHtml(COPY.bottleneck)}:</span> ${escapeHtml(squad.bottleneckLine || COPY.bottleneckNone)}</p>
      ${renderSquadCardRisks(squad)}
      <div class="gov-squad-metrics">
        ${squad.sprintStartLabel ? `<p class="gov-squad-metric">${escapeHtml(squad.sprintStartLabel)}</p>` : ''}
        ${capacity}
        ${lead}
        <p class="gov-squad-metric ${productivityClass}">${escapeHtml(squad.productivityLine || '')}</p>
      </div>
      <span class="gov-squad-tier-icon" aria-hidden="true">${tierIcon(tier)}</span>
    </article>`;
}

export function renderPortfolioGrid(brief) {
  const rollup = brief?.portfolioRollup || {};
  const squads = Array.isArray(brief?.squadInsights) ? brief.squadInsights : [];
  const cards = squads.map((s) => renderSquadInsightCard(s)).join('');
  return `
    <div class="gov-portfolio-grid-wrap" aria-label="${escapeHtml(COPY.executiveLeaderboard)}">
      ${renderPortfolioBanner(rollup)}
      <div class="gov-squad-grid" role="list">${cards}</div>
    </div>`;
}
