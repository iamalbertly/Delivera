/**
 * Sprint Navigation Carousel Component
 * Visual quick-switch tabs showing last 8 sprints with mini health indicators.
 */

import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDate } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';

function computeDurationDays(startDate, endDate) {
  const start = startDate ? new Date(startDate).getTime() : NaN;
  const end = endDate ? new Date(endDate).getTime() : NaN;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

function computeCarouselTrendSummary(sprints, currentSprint) {
  const closed = (sprints || []).filter((s) => String(s?.state || '').toLowerCase() === 'closed');
  if (closed.length < 2) {
    return { label: 'First sprint — no trend data', className: 'stable' };
  }
  const latest = Number(closed[0]?.completionPercent || 0);
  const previous = Number(closed[1]?.completionPercent || 0);
  const delta = latest - previous;
  const sign = delta > 0 ? '+' : '';
  const abs = Math.abs(delta);
  if (abs < 3) return { label: '→ Stable vs last sprint (' + sign + Math.round(delta) + '%)', className: 'stable' };
  if (delta > 0) return { label: '↑ ' + sign + Math.round(delta) + '% vs last sprint', className: 'up' };
  const activeIsEarly = String(currentSprint?.state || '').toLowerCase() === 'active' && Number(currentSprint?.completionPercent || 0) <= 5;
  const suffix = activeIsEarly ? ' · current sprint still early' : '';
  return { label: '↓ ' + Math.round(delta) + '% vs last sprint' + suffix, className: 'down' };
}

export function renderSprintCarousel(data) {
  const currentSprint = data.sprint || {};
  const sprints = [...(data.recentSprints || [])].sort((a, b) => {
    const aCurrent = a?.id === currentSprint?.id ? 1 : 0;
    const bCurrent = b?.id === currentSprint?.id ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    return 0;
  });

  if (sprints.length === 0) {
    return '<div class="sprint-carousel-container"><div class="carousel-limited-history"><small>No past sprints yet</small></div></div>';
  }

  const maxTabs = 8;
  const slice = sprints.slice(0, maxTabs);
  const hasEnoughHistory = slice.length >= 3;
  const trend = computeCarouselTrendSummary(slice, currentSprint);

  let html = '<div class="sprint-carousel-container">';

  if (hasEnoughHistory) {
    const points = slice.map((s) => {
      const pct = s.completionPercent ?? 0;
      return { pct: Math.min(100, Math.max(0, pct)), sprint: s };
    });
    const maxPct = Math.max(1, ...points.map((p) => p.pct));
    const w = 320;
    const h = 36;
    const pad = 4;
    const n = points.length;
    const step = n > 1 ? (w - pad * 2) / (n - 1) : 0;
    const poly = points.map((p, i) => {
      const x = pad + i * step;
      const y = h - pad - (p.pct / maxPct) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    html += '<div class="carousel-sparkline-wrap" role="img" aria-label="Sprint completion trend">';
    html += '<svg class="carousel-sparkline" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">';
    html += '<polyline fill="none" stroke="var(--primary)" stroke-width="2" points="' + poly + '"/>';
    points.forEach((p, i) => {
      const x = pad + i * step;
      const y = h - pad - (p.pct / maxPct) * (h - pad * 2);
      const isActive = p.sprint.id === currentSprint.id;
      const r = isActive ? 6 : 4;
      html += '<circle class="sparkline-dot' + (isActive ? ' sparkline-dot-current' : '') + '" cx="' + x + '" cy="' + y + '" r="' + r + '" data-sprint-id="' + p.sprint.id + '" data-index="' + i + '"/>';
    });
    html += '</svg>';
    html += '<span class="carousel-sparkline-label">Last ' + n + ' sprints</span>';
    html += '<span class="carousel-sparkline-axis"><span>0%</span><span>100%</span></span>';
    html += '<span class="carousel-trend-summary carousel-trend-summary-' + trend.className + '">' + escapeHtml(trend.label) + '</span>';
    html += '</div>';
  } else {
    html += '<p class="carousel-limited-history"><small>Limited history</small></p>';
    html += '<p class="carousel-trend-summary carousel-trend-summary-stable"><small>' + escapeHtml(trend.label) + '</small></p>';
  }

  html += '<div class="sprint-carousel" role="tablist" aria-label="Sprint navigation">';

  slice.forEach((sprint) => {
    const isActive = sprint.id === currentSprint.id;
    const isOpen = (sprint.state || '').toLowerCase() === 'active';
    const isClosed = (sprint.state || '').toLowerCase() === 'closed';
    const completionPercent = sprint.completionPercent ?? 0;
    const noData = isClosed && completionPercent === 0;

    let completionColor = 'gray';
    if (completionPercent >= 100) completionColor = 'green';
    else if (completionPercent >= 50) completionColor = 'yellow';
    if (isClosed && completionPercent < 100) completionColor = 'muted';

    const sprintName = (sprint.name || ('Sprint ' + sprint.id)).slice(0, 24) + ((sprint.name || '').length > 24 ? '...' : '');
    const startDate = sprint.startDate ? formatDate(sprint.startDate) : '-';
    const endDate = sprint.endDate ? formatDate(sprint.endDate) : '-';
    const durationDays = computeDurationDays(sprint.startDate, sprint.endDate);
    const durationLabel = durationDays == null ? '-' : (durationDays + 'd');
    const stateLabel = isOpen ? 'Active' : (isClosed ? 'Closed' : 'Planned');
    const tooltip = sprintName + '\nStart: ' + startDate + '\nEnd: ' + endDate + '\n' + (noData ? 'No data' : completionPercent + '%');

    const noDataClass = noData ? ' carousel-tab--no-data' : '';
    const noDataTooltip = noData ? sprintName + '\n' + startDate + ' -> ' + endDate + '\nNo data - SP tracking may not have been enabled for this sprint.' : tooltip;
    html += '<button class="carousel-tab ' + (isActive ? 'active carousel-tab-current' : '') + ' ' + completionColor + noDataClass + '" ';
    html += 'type="button" role="tab" aria-selected="' + (isActive ? 'true' : 'false') + '" data-sprint-id="' + sprint.id + '" title="' + escapeHtml(noDataTooltip) + '">';
    html += '<span class="carousel-tab-name">' + escapeHtml(sprintName) + '</span>';
    html += '<span class="carousel-tab-meta">' + stateLabel + ' · ' + durationLabel + '</span>';
    if (!noData) {
      html += '<span class="carousel-tab-dates">' + startDate + ' -> ' + endDate + '</span>';
      html += '<div class="carousel-health-indicator" style="width: ' + completionPercent + '%;" role="img" aria-label="' + completionPercent + '% complete"></div>';
    }
    if (isOpen) html += '<span class="carousel-status current">Current</span>';
    else if (isClosed && !noData) html += '<span class="carousel-status closed">Closed</span>';
    html += '<span class="carousel-completion">' + (noData ? '-' : completionPercent + '%') + '</span>';
    html += '</button>';
  });

  html += '</div>';
  if (slice.length <= 1) {
    html += '<div class="carousel-limited-history"><small>No past sprints yet</small></div>';
  }
  html += '<div class="carousel-scroll-hint sprint-carousel-scroll-hint" aria-hidden="true"><- swipe for older sprints -></div>';
  html += '<div class="carousel-legend">';
  html += '<span class="legend-item"><span class="legend-dot green"></span>100%</span>';
  html += '<span class="legend-item"><span class="legend-dot yellow"></span>50-99%</span>';
  html += '<span class="legend-item"><span class="legend-dot gray"></span>0-49%</span>';
  html += '<span class="legend-item"><span class="legend-dot muted"></span>- No data</span>';
  html += '</div>';
  html += '</div>';

  return html;
}

/**
 * Wire sprint carousel handlers
 */
export function wireSprintCarouselHandlers(onSprintSelect) {
  const carousel = document.querySelector('.sprint-carousel');
  if (!carousel) return;

  const tabs = carousel.querySelectorAll('.carousel-tab');

  const container = document.querySelector('.sprint-carousel-container');
  if (container) {
    container.addEventListener('click', (e) => {
      const dot = e.target.closest('.sparkline-dot');
      if (dot && dot.dataset.sprintId) {
        const tab = carousel.querySelector('.carousel-tab[data-sprint-id="' + dot.dataset.sprintId + '"]');
        if (tab) tab.click();
      }
    });
  }

  const scrollHint = document.querySelector('.sprint-carousel-scroll-hint');
  if (scrollHint) {
    carousel.addEventListener('scroll', () => {
      scrollHint.classList.add('scrolled');
    }, { passive: true, once: true });
  }

  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
      const sprintId = tab.dataset.sprintId;
      if (sprintId && onSprintSelect) {
        onSprintSelect(sprintId);
      }

      tabs.forEach((t) => {
        t.classList.remove('active', 'carousel-tab-current');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active', 'carousel-tab-current');
      tab.setAttribute('aria-selected', 'true');

      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });

    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextTab = tabs[idx + 1];
        if (nextTab) {
          nextTab.focus();
          nextTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevTab = tabs[idx - 1];
        if (prevTab) {
          prevTab.focus();
          prevTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tab.click();
      }
    });
  });
}
