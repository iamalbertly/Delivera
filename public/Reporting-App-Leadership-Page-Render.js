import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { SPRINT_COPY } from './Reporting-App-CurrentSprint-Copy.js';
import { formatNumber, formatDateShort, parseISO, addMonths } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { renderEmptyStateHtml, renderNoBoardsForRangeEmptyState, renderNoProjectsSelectedEmptyState } from './Reporting-App-Shared-Empty-State-Helpers.js';
import { buildDataTableHtml } from './Reporting-App-Shared-Table-Renderer.js';
import { deriveDeliveryGrade, DELIVERY_GRADE_TOOLTIP } from './Reporting-App-Report-Page-Render-Boards-Summary-Helpers.js';
import { buildTrustBadge, formatCostPerSPDisplay, formatOverheadDisplay, buildUtilizationDisplay } from './Reporting-App-Shared-Cost-Capacity-Calc.js';
import { renderContextSummaryStrip } from './Reporting-App-Shared-Context-Summary-Strip.js';
import { renderAttentionQueue } from './Reporting-App-Shared-Attention-Queue.js';
import { KPI_TREND_VISIBILITY_HINT } from './Reporting-App-Shared-KPI-Card-Renderer.js';

export function getLeadershipTrendVisibilityHint() {
  return KPI_TREND_VISIBILITY_HINT;
}

export function getLeadershipIndexedDeliveryHint(windowSize = 6) {
  return `Indexed Delivery = current SP/day vs own baseline (last ${windowSize} closed sprints).`;
}

function formatPct(value, decimals = 0) {
  return value == null || Number.isNaN(Number(value)) ? '-' : `${formatNumber(value, decimals, '-') }%`;
}

function buildLeadershipRecommendation(data) {
  const outlierEpics = Array.isArray(data?.kpis?.outlierEpics) ? data.kpis.outlierEpics : [];
  const outlierSprints = Array.isArray(data?.kpis?.outlierSprints) ? data.kpis.outlierSprints : [];
  const trustBand = data?.kpis?.dataQuality?.trustBand || '';
  let headline = 'Portfolio looks readable.';
  let body = 'Use board trends to compare delivery movement, then jump straight into current sprint for intervention.';
  let repairAction = 'open-current-sprint';

  if (trustBand === 'Weak') {
    headline = 'Data quality needs repair before this becomes a board-ranking conversation.';
    body = 'Fix missing epic dates or timesheets first so cost, utilization, and predictability stay trustworthy.';
    repairAction = 'fix-excluded-sprints';
  } else if (outlierEpics.length > 0) {
    headline = 'Long-running epics are the clearest leadership intervention right now.';
    body = `Start with ${outlierEpics[0].label} and tighten scope, owner decisions, or slicing before it drags another quarter.`;
  } else if (outlierSprints.length > 0) {
    headline = 'Sprint reliability is the fastest place to recover trust.';
    body = `Review ${outlierSprints[0].label} and stop scope churn before it becomes systemic drag.`;
  }

  return { headline, body, repairAction, trustBand };
}

function renderLeadershipKpiStrip(data) {
  const projectKPIs = data?.kpis?.projectKPIs || {};
  const projectKeys = Object.keys(projectKPIs);
  if (!projectKeys.length) return '';

  const cards = projectKeys.map((projectKey) => {
    const kpi = projectKPIs[projectKey];
    const trustBadge = buildTrustBadge(kpi?.dataQuality);
    const utilization = buildUtilizationDisplay(kpi);
    return `
      <article class="leadership-kpi-project-card" data-kpi-project="${escapeHtml(projectKey)}">
        <header>
          <h3>${escapeHtml(projectKey)}</h3>
          ${trustBadge ? `<span class="kpi-trust-badge tone-${escapeHtml(trustBadge.tone)}" title="${escapeHtml(trustBadge.tooltip || '')}">${escapeHtml(trustBadge.label)}</span>` : ''}
        </header>
        <dl class="leadership-kpi-mini-grid">
          <div><dt>Cost / SP</dt><dd>${escapeHtml(formatCostPerSPDisplay(kpi) || 'No data')}</dd></div>
          <div><dt>Overhead</dt><dd>${escapeHtml(formatOverheadDisplay(kpi) || 'No data')}</dd></div>
          <div><dt>Utilization</dt><dd>${escapeHtml(utilization.text || 'No data')}</dd></div>
          <div><dt>Predictability</dt><dd>${escapeHtml(formatPct(kpi?.avgPredictabilityPct, 0))}</dd></div>
          <div><dt>Rework</dt><dd>${escapeHtml(formatPct(kpi?.reworkPct, 1))}</dd></div>
          <div><dt>Epic TTM</dt><dd>${escapeHtml(kpi?.epicTTMWorkingDays != null ? `${formatNumber(kpi.epicTTMWorkingDays, 0, '-') }d` : 'No data')}</dd></div>
        </dl>
      </article>
    `;
  }).join('');

  const csvRows = projectKeys.map((projectKey) => {
    const kpi = projectKPIs[projectKey];
    const utilization = buildUtilizationDisplay(kpi);
    return [
      projectKey,
      formatCostPerSPDisplay(kpi) || '',
      formatOverheadDisplay(kpi) || '',
      utilization.text || '',
      formatPct(kpi?.avgPredictabilityPct, 0),
      formatPct(kpi?.reworkPct, 1),
      kpi?.epicTTMWorkingDays != null ? `${formatNumber(kpi.epicTTMWorkingDays, 0, '-')}` : '',
      kpi?.dataQuality?.trustBand || '',
    ].join('|');
  }).join('\n');

  return `
    <section class="leadership-kpi-strip" aria-label="Quarterly KPI comparison">
      <div class="leadership-card-header leadership-card-header--compact">
        <div><h2>Investment and delivery KPIs</h2></div>
      </div>
      <div class="leadership-kpi-project-grid">${cards}</div>
      <pre class="visually-hidden" id="leadership-kpi-export-data">${escapeHtml(csvRows)}</pre>
    </section>
  `;
}

function renderLeadershipEvidenceFold(data) {
  const quality = data?.kpis?.dataQuality;
  const outlierEpics = Array.isArray(data?.kpis?.outlierEpics) ? data.kpis.outlierEpics : [];
  const outlierSprints = Array.isArray(data?.kpis?.outlierSprints) ? data.kpis.outlierSprints : [];
  if (!quality && !outlierEpics.length && !outlierSprints.length) return '';
  const costModelSource = data?.kpis?.meta?.costModelSource || quality.costModelSource || 'unavailable';

  const renderList = (items, sectionTitle) => {
    if (!items.length) return '';
    const rows = items.map((item) => `
      <li>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.metric)}: ${escapeHtml(formatNumber(item.value, 0, '-'))}${item.metric.includes('%') ? '%' : ''}</span>
        <span>${escapeHtml(item.rcaHint || '')}</span>
        ${item.jiraHref ? `<a href="${escapeHtml(item.jiraHref)}" target="_blank" rel="noopener noreferrer">Open in Jira</a>` : ''}
      </li>
    `).join('');
    return `
      <section class="leadership-outlier-panel">
        <h3>${escapeHtml(sectionTitle)}</h3>
        <ul>${rows}</ul>
      </section>
    `;
  };

  return `
    <details class="leadership-evidence-fold" data-mobile-collapse="true">
      <summary>Trust, assumptions, and outliers</summary>
      ${quality ? `
        <section class="leadership-trust-card" aria-label="Data quality and assumptions">
          <div>
            <p class="leadership-direct-value-eyebrow">Trust and assumptions</p>
            <h3>${escapeHtml(quality.trustBand || 'Weak')} evidence quality</h3>
          </div>
          <div class="leadership-trust-grid">
            <div><span>SP coverage</span><strong>${escapeHtml(formatPct((quality.spCoverage || 0) * 100, 0))}</strong></div>
            <div><span>Sprint dates</span><strong>${escapeHtml(formatPct((quality.dateCoverage || 0) * 100, 0))}</strong></div>
            <div><span>Timesheets</span><strong>${escapeHtml(formatPct((quality.timesheetCoverage || 0) * 100, 0))}</strong></div>
            <div><span>Epic hygiene</span><strong>${escapeHtml(formatPct((quality.epicHygiene || 0) * 100, 0))}</strong></div>
          </div>
          <p class="metrics-hint">Cost model source: ${escapeHtml(costModelSource)}. ${escapeHtml(quality.assumptions?.costPerSP || '')} ${escapeHtml(quality.assumptions?.utilization || '')}</p>
        </section>
      ` : ''}
      ${(outlierEpics.length || outlierSprints.length) ? `
        <section class="leadership-outliers" aria-label="Delivery outliers">
          ${renderList(outlierEpics, 'Epic outliers')}
          ${renderList(outlierSprints, 'Sprint outliers')}
        </section>
      ` : ''}
    </details>
  `;
}

function renderLeadershipSummaryStrip(data, projectsLabel, rangeStart, rangeEnd) {
  const trustBand = data?.kpis?.dataQuality?.trustBand || 'Mixed';
  const boards = Array.isArray(data?.boards) ? data.boards.length : 0;
  const chips = [
    {
      label: SPRINT_COPY.segmentLabelProjects,
      value: projectsLabel || SPRINT_COPY.allProjects,
      action: 'refresh-context',
    },
    {
      label: SPRINT_COPY.segmentLabelRange,
      value: `${rangeStart} - ${rangeEnd}`,
      action: 'refresh-context',
    },
    {
      label: SPRINT_COPY.segmentLabelLens,
      value: SPRINT_COPY.lensLeadershipHud,
    },
    {
      label: SPRINT_COPY.segmentLabelTrust,
      value: trustBand,
      tone: trustBand === 'Weak' ? 'warning' : 'ok',
    },
    {
      label: SPRINT_COPY.segmentLabelBoards,
      value: String(boards),
    },
  ];
  return renderContextSummaryStrip({
    title: '',
    chips,
    secondary: '',
    actions: [],
    stripAriaLabel: SPRINT_COPY.leadershipHudStripAria,
  });
}

function renderLeadershipAttentionQueue(data) {
  const outlierEpics = Array.isArray(data?.kpis?.outlierEpics) ? data.kpis.outlierEpics : [];
  const outlierSprints = Array.isArray(data?.kpis?.outlierSprints) ? data.kpis.outlierSprints : [];
  const trustBand = data?.kpis?.dataQuality?.trustBand || '';
  return renderAttentionQueue({
    title: '',
    compact: true,
    items: [
      outlierEpics[0] ? {
        label: `Scope drift: ${outlierEpics[0].label}`,
        detail: outlierEpics[0].rcaHint || 'Longest-running epic in this window',
        tone: 'danger',
      } : null,
      outlierSprints[0] ? {
        label: `Delivery risk: ${outlierSprints[0].label}`,
        detail: outlierSprints[0].rcaHint || 'Reliability moved outside the normal band',
        tone: 'warning',
      } : null,
      trustBand === 'Weak' ? {
        label: 'Data quality is weak',
        detail: 'Repair epic hygiene or timesheet coverage before judging investment quality',
        tone: 'warning',
      } : null,
    ].filter(Boolean),
  });
}

function renderLeadershipMissionStrip(data, projectsLabel, rangeStart, rangeEnd, outcomeLine) {
  const recommendation = buildLeadershipRecommendation(data);
  let repairActionHtml = '<a class="btn btn-secondary btn-compact" href="/current-sprint">Open current sprint</a>';
  if (recommendation.repairAction === 'fix-excluded-sprints') {
    repairActionHtml = '<button type="button" class="btn btn-secondary btn-compact" data-preview-context-action="open-unusable-sprints">Fix excluded sprints</button>';
  }
  const trustBand = data?.kpis?.dataQuality?.trustBand || 'Mixed';
  return `
    <section class="leadership-mission-strip" aria-label="Leadership mission strip">
      ${renderLeadershipSummaryStrip(data, projectsLabel, rangeStart, rangeEnd)}
      <div class="leadership-mission-main">
        <div class="leadership-mission-copy">
          <p class="leadership-direct-value-eyebrow leadership-mission-eyebrow">${escapeHtml(SPRINT_COPY.leadershipMissionEyebrow)}</p>
          <h2>${escapeHtml(recommendation.headline)}</h2>
          <p class="leadership-mission-trust-line">${escapeHtml(SPRINT_COPY.segmentLabelTrust)}: ${escapeHtml(trustBand)}${outcomeLine ? ' | ' + escapeHtml(outcomeLine) : ''}</p>
        </div>
        <div class="leadership-mission-actions">
          <button type="button" class="btn btn-primary btn-compact" data-open-outcome-modal data-outcome-context="${escapeHtml(recommendation.headline)}" data-outcome-projects="${escapeHtml((projectsLabel || '').replace(/\s+/g, ''))}">Create work from insight</button>
          ${repairActionHtml}
          <details class="leadership-export-menu">
            <summary class="btn btn-secondary btn-compact">Export &amp; share</summary>
            <div class="leadership-export-menu-panel">
              <button type="button" class="btn btn-secondary btn-compact" data-action="export-leadership-manager-briefing">Copy manager briefing</button>
              <button type="button" class="btn btn-secondary btn-compact" data-action="export-leadership-quarterly-story">Copy portfolio summary</button>
              <button type="button" class="btn btn-secondary btn-compact" data-action="export-leadership-kpis-csv">Export KPI CSV</button>
              <button type="button" class="btn btn-secondary btn-compact" data-action="export-leadership-boards-csv">Export boards CSV</button>
            </div>
          </details>
        </div>
      </div>
      ${renderLeadershipAttentionQueue(data)}
    </section>
  `;
}

function computeVelocityWindowStats(sprints, windowEnd, months) {
  const end = parseISO(windowEnd);
  if (!end) return null;
  const start = addMonths(end, -months);
  const closed = sprints.filter(s => (s.state || '').toLowerCase() === 'closed');
  const inWindow = closed.filter(s => {
    const endDate = parseISO(s.endDate);
    return endDate && endDate >= start && endDate <= end;
  });
  const totalSP = inWindow.reduce((sum, s) => sum + (s.doneSP || 0), 0);
  const totalDays = inWindow.reduce((sum, s) => sum + (s.sprintWorkDays || 0), 0);
  const avg = totalDays > 0 ? totalSP / totalDays : null;
  const doneStories = inWindow.reduce((sum, s) => sum + (s.doneStoriesNow || 0), 0);
  const doneByEnd = inWindow.reduce((sum, s) => sum + (s.doneStoriesBySprintEnd || 0), 0);
  const onTimePct = doneStories > 0 ? (doneByEnd / doneStories) * 100 : null;
  return { avg, sprintCount: inWindow.length, onTimePct, inWindow };
}

function computePredictabilityAverage(perSprint, inWindow) {
  if (!perSprint || !inWindow || inWindow.length === 0) return null;
  const values = inWindow
    .map(s => perSprint[s.id]?.predictabilitySP)
    .filter(v => v != null && !Number.isNaN(v));
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function gradeFromSignals(onTimePct, predictabilityPct, sprintCount = 0) {
  if (onTimePct == null || Number.isNaN(onTimePct)) return 'Insufficient data';
  const predictability = predictabilityPct == null || Number.isNaN(predictabilityPct)
    ? onTimePct
    : predictabilityPct;
  return deriveDeliveryGrade(onTimePct, predictability, sprintCount);
}

export function renderLeadershipPage(data) {
  const boards = data.boards || [];
  const meta = data.meta || {};
  const metrics = data.metrics || {};
  const predictability = metrics.predictability || {};
  const perSprint = predictability.perSprint || {};
  const sprintsIncluded = data.sprintsIncluded || [];
  const windowEnd = meta.windowEnd || new Date().toISOString();
  const windowEndDate = parseISO(windowEnd) || new Date();
  const windowEndIso = windowEndDate.toISOString();

  const rangeStart = meta.windowStart ? formatDateShort(meta.windowStart) : '-';
  const rangeEnd = meta.windowEnd ? formatDateShort(meta.windowEnd) : '-';
  const indexedDeliveryHint = getLeadershipIndexedDeliveryHint(6);
  const trendVisibilityHint = getLeadershipTrendVisibilityHint();
  const rangeStartAttr = meta.windowStart ? formatDateShort(meta.windowStart) : '';
  const rangeEndAttr = meta.windowEnd ? formatDateShort(meta.windowEnd) : '';
  const projectsAttr = (meta.projects || '').replace(/,/g, '-').replace(/\s+/g, '') || '';
  const projectsLabel = (meta.projects || '')
    .split(',')
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
  const generatedAtIso = (data.kpis?.meta?.generatedAt || data.generatedAt || '').trim();
  let html = '<div class="leadership-shell-top">';
  html += '<div class="leadership-meta-attrs" aria-hidden="true" data-range-start="' + escapeHtml(rangeStartAttr) + '" data-range-end="' + escapeHtml(rangeEndAttr) + '" data-projects="' + escapeHtml(projectsAttr) + '" data-projects-label="' + escapeHtml(projectsLabel) + '" data-generated-at="' + escapeHtml(generatedAtIso) + '"></div>';

  let outcomeLine = '';
  if (boards.length > 0) {
    const summaries = data.boardSummaries || new Map();
    let onTime80Plus = 0;
    let needAttention = 0;
    let totalDoneSP = 0;
    let totalRegisteredHours = 0;
    let totalEstimatedHours = 0;
    let minSprintCount = null;
    for (const board of boards) {
      const summary = summaries.get(board.id);
      const doneStories = summary?.doneStories || 0;
      const doneByEnd = summary?.doneBySprintEnd || 0;
      totalDoneSP += Number(summary?.doneSP || 0);
      totalRegisteredHours += Number(summary?.registeredWorkHours || 0);
      totalEstimatedHours += Number(summary?.estimatedWorkHours || 0);
      const onTimePct = doneStories > 0 ? (doneByEnd / doneStories) * 100 : null;
      if (onTimePct != null && onTimePct >= 80) onTime80Plus++;
      if (onTimePct == null || onTimePct < 80) needAttention++;
      const sprintCount = summary?.sprintCount;
      if (typeof sprintCount === 'number') {
        minSprintCount = minSprintCount == null ? sprintCount : Math.min(minSprintCount, sprintCount);
      }
    }
    outcomeLine = boards.length + ' boards | ' + onTime80Plus + ' on-time >=80% | ' + needAttention + ' need attention.';
    if (totalRegisteredHours > 0) {
      const spPerHour = totalDoneSP > 0 ? (totalDoneSP / totalRegisteredHours) : 0;
      outcomeLine += ' | ' + formatNumber(totalDoneSP, 0, '0') + ' SP delivered from ' + formatNumber(totalRegisteredHours, 0, '0') + 'h logged (' + formatNumber(spPerHour, 2, '0') + ' SP/h).';
    }
    if (totalEstimatedHours > 0 && totalRegisteredHours >= 0) {
      const hygienePct = Math.max(0, Math.min(999, (totalRegisteredHours / totalEstimatedHours) * 100));
      if (hygienePct < 60) {
        outcomeLine += ' | Time-tracking hygiene low: logged vs estimated ' + formatNumber(hygienePct, 0, '0') + '%.';
      }
    }
    if (minSprintCount != null && minSprintCount < 3) {
      outcomeLine += ' | Limited history on at least one board (<3 sprints).';
    }
    const recent3 = computeVelocityWindowStats(sprintsIncluded, windowEndIso, 3);
    const previous3End = addMonths(windowEndDate, -3).toISOString();
    const previous3 = computeVelocityWindowStats(sprintsIncluded, previous3End, 3);
    if (recent3?.avg != null && previous3?.avg != null && previous3.avg > 0) {
      const diffPct = ((recent3.avg - previous3.avg) / previous3.avg) * 100;
      const trendLabel = diffPct <= -10 ? 'velocity down' : (diffPct >= 10 ? 'velocity up' : 'velocity stable');
      outcomeLine += ' | 3-month trend: ' + trendLabel + ' (' + formatNumber(diffPct, 1, '0') + '%).';
    }
  }
  if (outcomeLine) {
    outcomeLine = outcomeLine.split('|').slice(0, 3).join(' | ').trim();
  }
  html += renderLeadershipMissionStrip(data, projectsLabel, rangeStart, rangeEnd, outcomeLine);
  html += '</div>';
  html += renderLeadershipKpiStrip(data);
  html += renderLeadershipEvidenceFold(data);

  html += '<div class="leadership-card">';
  html += '<div class="leadership-card-header">';
  html += '<h2>Boards at risk</h2>';
  html += '<p class="leadership-delivery-hint"><small>Use this to decide where to intervene next.</small></p>';
  html += '<div class="leadership-view-actions">';
  html += '<button type="button" class="btn btn-secondary btn-compact active" data-leadership-view="cards" aria-pressed="true">Cards</button>';
  html += '<button type="button" class="btn btn-secondary btn-compact" data-leadership-view="table" aria-pressed="false">Table</button>';
  html += '</div>';
  html += '</div>';
  if (boards.length === 0) {
    html += projectsLabel ? renderNoBoardsForRangeEmptyState() : renderNoProjectsSelectedEmptyState();
    html += '<section class="leadership-onboarding-empty" role="note">';
    html += '<h3>Your first report</h3>';
    html += '<p>Connect Jira projects in one step to unlock leadership trends.</p>';
    html += '<p><a class="btn btn-primary btn-compact" href="/report">Open report filters</a></p>';
    html += '</section>';
  } else {
    const summaries = data.boardSummaries || new Map();
    let allStrong = boards.length > 0;
    const boardCards = [];
    for (const board of boards) {
      const summary = summaries.get(board.id);
      const onTimePct = summary?.doneStories > 0 ? ((summary.doneBySprintEnd || 0) / summary.doneStories * 100) : null;
      const sprintCount = summary?.sprintCount ?? 0;
      const grade = gradeFromSignals(onTimePct ?? null, null, sprintCount);
      if (grade !== 'Strong') allStrong = false;
      boardCards.push({ board, summary, onTimePct, grade, sprintCount, hasLimitedHistory: sprintCount < 2 });
    }
    if (allStrong && boards.length > 0) {
      html += '<p class="leadership-all-strong">All boards delivering on track.</p>';
    }
    const sufficientCards = boardCards.filter(c => !c.hasLimitedHistory);
    const limitedCards = boardCards.filter(c => c.hasLimitedHistory);
    const topRiskBoards = [...boardCards]
      .filter((c) => c.grade !== 'Strong')
      .sort((a, b) => {
        const aScore = (a.onTimePct == null ? -1 : a.onTimePct);
        const bScore = (b.onTimePct == null ? -1 : b.onTimePct);
        return aScore - bScore;
      })
      .slice(0, 5);
    if (topRiskBoards.length > 0) {
      html += '<div class="leadership-risk-list" aria-label="Top risk boards">';
      html += '<h3>Intervention priority</h3><ul>';
      topRiskBoards.forEach((card) => {
        const reason = card.onTimePct == null
          ? 'Limited delivery evidence'
          : ('On-time ' + card.onTimePct.toFixed(0) + '%');
        html += '<li><strong>' + escapeHtml(card.board.name) + '</strong> · ' + escapeHtml(card.grade || 'Attention') + ' · ' + escapeHtml(reason) + '</li>';
      });
      html += '</ul></div>';
    }
    html += '<div id="leadership-boards-cards" class="leadership-boards-cards" role="region" aria-label="Boards overview">';
    for (const card of sufficientCards) {
      const onTimeStr = card.onTimePct != null ? card.onTimePct.toFixed(0) + '%' : '-';
      const gradeClass = (card.grade || '').toLowerCase().replace(/\s+/g, '-');
      html += '<div class="leadership-board-card">';
      html += '<div class="leadership-board-card-grade ' + gradeClass + '">' + escapeHtml(card.grade || '-') + '</div>';
      html += '<div class="leadership-board-card-name">' + escapeHtml(card.board.name) + '</div>';
      html += '<div class="leadership-board-card-metric">On-time ' + onTimeStr + '</div>';
      html += '</div>';
    }
    html += '</div>';
    if (limitedCards.length > 0) {
      if (sufficientCards.length === 0) {
        html += '<div class="leadership-all-limited-empty">';
        html += '<p>Trend analysis needs more history, but there is still immediate action available.</p>';
        html += '<div class="leadership-empty-actions">';
        html += '<a class="btn btn-secondary btn-compact" href="/current-sprint">Go to current sprint</a>';
        html += '<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal data-outcome-context="Create work from thin trend data." data-outcome-projects="' + escapeHtml(projectsLabel.replace(/\s+/g, '')) + '">Create work from insight</button>';
        html += '<button type="button" class="btn btn-secondary btn-compact" data-preview-context-action="open-unusable-sprints">Fix excluded sprints</button>';
        html += '</div>';
        html += '</div>';
        html += '<div id="leadership-limited-cards" class="leadership-boards-cards leadership-limited-cards">';
      } else {
        html += '<div class="leadership-limited-toggle-wrap">';
        html += '<button type="button" class="btn btn-secondary btn-compact" data-action="toggle-limited-boards" aria-expanded="false">' + limitedCards.length + ' board' + (limitedCards.length !== 1 ? 's' : '') + ' hidden (insufficient data) - Show all</button>';
        html += '</div>';
        html += '<div id="leadership-limited-cards" class="leadership-boards-cards leadership-limited-cards" hidden>';
      }
      for (const card of limitedCards) {
        const onTimeStr = card.onTimePct != null ? card.onTimePct.toFixed(0) + '%' : '-';
        const gradeClass = (card.grade || '').toLowerCase().replace(/\s+/g, '-');
        html += '<div class="leadership-board-card leadership-board-card--limited">';
        html += '<div class="leadership-board-card-grade ' + gradeClass + '">' + escapeHtml(card.grade || '-') + '</div>';
        html += '<div class="leadership-board-card-name">' + escapeHtml(card.board.name) + '</div>';
        html += '<div class="leadership-board-card-metric">On-time ' + onTimeStr + '</div>';
        html += '<div class="leadership-board-card-note">Needs 3+ sprints for trends</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    html += '<div id="leadership-boards-table-wrap" class="leadership-boards-table-wrap" hidden>';
    html += '<div id="leadership-sort-label" class="leadership-sort-label" aria-live="polite"></div>';
    html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table data-table--mobile-scroll leadership-boards-table"><thead><tr>';
    html += '<th class="sortable" data-sort="board" scope="col">Board</th>';
    html += '<th class="sortable" data-sort="projects" scope="col">Projects</th>';
    html += '<th class="sortable" data-sort="sprints" scope="col">Sprints</th>';
    html += '<th class="sortable" data-sort="doneStories" scope="col">Done Stories</th>';
    html += '<th class="sortable" data-sort="doneSP" scope="col">Done SP</th>';
    html += '<th class="sortable" data-sort="spPerDay" scope="col">SP / Day</th>';
    html += '<th class="sortable" data-sort="storiesPerDay" scope="col">Stories / Day</th>';
    html += '<th class="sortable" data-sort="indexedDelivery" scope="col" title="Current SP/day vs this board\'s baseline (last 6 sprints).">Indexed Delivery</th>';
    html += '<th class="sortable" data-sort="onTime" scope="col">On-time %</th>';
    html += '</tr></thead><tbody>';
    for (const board of boards) {
      const summary = (data.boardSummaries || new Map()).get(board.id);
      const totalSprintDays = summary?.totalSprintDays || 0;
      const doneStories = summary?.doneStories || 0;
      const doneSP = summary?.doneSP || 0;
      const spPerDay = totalSprintDays > 0 ? doneSP / totalSprintDays : null;
      const storiesPerDay = totalSprintDays > 0 ? doneStories / totalSprintDays : null;
      const idx = board.indexedDelivery;
      const indexStr = idx != null && idx.index != null ? formatNumber(idx.index, 2, '-') : '-';
      const onTimePct = summary?.doneStories > 0
        ? ((summary.doneBySprintEnd || 0) / summary.doneStories * 100)
        : null;
      const onTime = onTimePct != null ? onTimePct.toFixed(1) + '%' : '-';
      const sprintCount = summary?.sprintCount ?? '-';
      const isRiskRow = onTimePct != null && onTimePct < 80;
      const hasLimitedHistory = typeof sprintCount === 'number' && sprintCount < 2;
      const rowClass = isRiskRow ? ' class="leadership-board-row leadership-board-row--risk"' : ' class="leadership-board-row"';
      html += '<tr' + rowClass + '>';
      html += '<td>' + escapeHtml(board.name);
      if (hasLimitedHistory) {
        html += ' <span class="limited-history-note">(Limited history)</span>';
      }
      html += '</td>';
      html += '<td>' + escapeHtml((board.projectKeys || []).join(', ')) + '</td>';
      html += '<td>' + sprintCount + '</td>';
      html += '<td>' + doneStories + '</td>';
      html += '<td>' + doneSP + '</td>';
      html += '<td>' + (spPerDay != null ? formatNumber(spPerDay, 2, '-') : '-') + '</td>';
      html += '<td>' + (storiesPerDay != null ? formatNumber(storiesPerDay, 2, '-') : '-') + '</td>';
      html += '<td>' + indexStr + '</td>';
      html += '<td>' + onTime + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    html += '</div>';
  }
  html += '</div>';

  const velocityWindows = [1, 3, 6, 12].map(months => {
    const current = computeVelocityWindowStats(sprintsIncluded, windowEndIso, months);
    const previousEnd = addMonths(windowEndDate, -months).toISOString();
    const previous = computeVelocityWindowStats(sprintsIncluded, previousEnd, months);
    const diff = current?.avg != null && previous?.avg != null && previous.avg !== 0
      ? ((current.avg - previous.avg) / previous.avg) * 100
      : null;
    const predictabilityAvg = computePredictabilityAverage(perSprint, current?.inWindow || []);
    const grade = gradeFromSignals(current?.onTimePct ?? null, predictabilityAvg ?? null, current?.sprintCount || 0);
    return { months, current, diff, predictabilityAvg, grade };
  });

  html += '<details class="leadership-secondary-details" data-mobile-collapse="true">';
  html += '<summary>Velocity (SP/day) and trend</summary>';
  html += '<div class="leadership-card">';
  html += '<p class="metrics-hint">Rolling averages by sprint end date. Difference compares against the previous window of the same length.</p>';
  const velocityColumns = [
    { key: 'window', label: 'Window', title: '' },
    { key: 'sprintCount', label: 'Sprints', title: '' },
    { key: 'avg', label: 'Avg SP/day', title: '' },
    { key: 'diff', label: 'Difference', title: '' },
    { key: 'onTimePct', label: 'On-time %', title: '' },
    { key: 'grade', label: 'Delivery Grade', title: DELIVERY_GRADE_TOOLTIP },
    { key: 'quality', label: 'Data quality', title: '' },
  ];
  const velocityRows = velocityWindows.map((row) => {
    let diffLabel = '-';
    if (row.diff != null) {
      const arrow = row.diff >= 10 ? '\u2191' : (row.diff <= -10 ? '\u2193' : '\u2192');
      const color = row.diff >= 10 ? 'color:#166534' : (row.diff <= -10 ? 'color:#991b1b' : 'color:#6b7280');
      diffLabel = '<span style="' + color + '">' + arrow + ' ' + formatNumber(row.diff, 1, '-') + '%</span>';
    }
    return {
      window: row.months === 1 ? '1 month' : row.months + ' months',
      sprintCount: row.current?.sprintCount ?? 0,
      avg: row.current?.avg != null ? formatNumber(row.current.avg, 2, '-') : '-',
      diff: diffLabel,
      onTimePct: row.current?.onTimePct != null ? formatNumber(row.current.onTimePct, 1, '-') + '%' : '-',
      grade: row.grade || '-',
      quality: row.current?.sprintCount != null && row.current.sprintCount < 3 ? 'Low sample' : 'OK',
    };
  });
  html += buildDataTableHtml(velocityColumns, velocityRows);
  html += '</div>';
  html += '</details>';

  if (Object.keys(perSprint).length > 0) {
    const sprintIndex = new Map();
    for (const sprint of sprintsIncluded) {
      if (sprint?.id != null) sprintIndex.set(sprint.id, sprint);
    }
    const perSprintRows = Object.values(perSprint)
      .filter(Boolean)
      .map(row => {
        const sprint = sprintIndex.get(row.sprintId);
        return {
          ...row,
          endDate: sprint?.endDate || row.sprintEndDate || '',
          startDate: sprint?.startDate || row.sprintStartDate || '',
        };
      })
      .sort((a, b) => {
        const aTime = new Date(a.endDate || a.startDate || 0).getTime();
        const bTime = new Date(b.endDate || b.startDate || 0).getTime();
        return bTime - aTime;
      });

    html += '<details class="leadership-secondary-details" data-mobile-collapse="true">';
    html += '<summary>Predictability by sprint</summary>';
    html += '<div class="leadership-card">';
    html += '<h2>Predictability by sprint (committed vs delivered)</h2>';
    html += '<p class="metrics-hint">Planned = created before sprint start; unplanned = added after. Detection assumptions apply.</p>';
    html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table data-table--mobile-scroll"><thead><tr><th>Sprint</th><th>Start</th><th>End</th><th>Committed Stories</th><th>Delivered Stories</th><th>Committed SP</th><th>Delivered SP</th><th>Stories %</th><th>SP %</th></tr></thead><tbody>';
    for (const row of perSprintRows) {
      html += '<tr>';
      html += '<td>' + escapeHtml(row.sprintName) + '</td>';
      html += '<td>' + escapeHtml(formatDateShort(row.startDate)) + '</td>';
      html += '<td>' + escapeHtml(formatDateShort(row.endDate)) + '</td>';
      html += '<td>' + (row.committedStories ?? '-') + '</td>';
      html += '<td>' + (row.deliveredStories ?? '-') + '</td>';
      html += '<td>' + (row.committedSP ?? '-') + '</td>';
      html += '<td>' + (row.deliveredSP ?? '-') + '</td>';
      html += '<td>' + (row.predictabilityStories != null ? formatNumber(row.predictabilityStories, 1, '-') + '%' : '-') + '</td>';
      html += '<td>' + (row.predictabilitySP != null ? formatNumber(row.predictabilitySP, 1, '-') + '%' : '-') + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div></div>';
    html += '</details>';
  }

  if (data?.kpis?.meta?.generatedAt || data?.kpis?.dataQuality) {
    html += '<section class="leadership-governance-footer" aria-label="Leadership governance note">';
    html += '<p><strong>Leadership use:</strong> trend visibility, intervention prioritization, and investment hygiene. Do not use this page as a team-ranking scoreboard.</p>';
    if (data?.kpis?.meta?.generatedAt) {
      html += '<p class="metrics-hint">KPI snapshot generated ' + escapeHtml(formatDateShort(data.kpis.meta.generatedAt)) + ' for this report window.</p>';
    }
    html += '</section>';
  }

  return html;
}

/**
 * Render Leadership-style content into an arbitrary container.
 * This thin wrapper allows the Leadership view to be embedded
 * inside other pages (for example, the Report "Trends" tab)
 * without depending on the standalone leadership.html layout.
 */
export function renderLeadershipContent(data, container) {
  if (!container) return;
  container.innerHTML = renderLeadershipPage(data || {});
}
