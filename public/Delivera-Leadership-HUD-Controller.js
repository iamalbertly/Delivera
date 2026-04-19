/**
 * Delivera-Leadership-HUD-Controller.js
 * Leadership mission-control controller.
 */

import { getContextPieces, renderContextSegments } from './Delivera-Shared-Context-From-Storage.js';
import { renderKPICard, KPI_TREND_VISIBILITY_HINT } from './Delivera-Shared-KPI-Card-Renderer.js';
import { buildTrustBadge, formatCostPerSPDisplay, buildUtilizationDisplay } from './Delivera-Shared-Cost-Capacity-Calc.js';
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';

const REFRESH_INTERVAL_MS = 60 * 1000;
const STALE_THRESHOLD_MS = 15 * 60 * 1000;
let lastFetchTime = 0;

function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return 'No data';
  return Number(num).toFixed(decimals);
}

function getTrendHtml(trend) {
  if (!trend && trend !== 0) return '<span class="trend-neutral">No trend data</span>';
  const direction = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
  const arrow = trend > 0 ? '^' : trend < 0 ? 'v' : '->';
  return `<span class="trend-${direction}">${arrow} ${Math.abs(trend)}% vs last 3</span>`;
}

function updateHeaderStatus(text, stateClass) {
  const statusEl = document.getElementById('connection-status');
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `hud-status-pill ${stateClass || ''}`.trim();
}

function renderContextHeader(data) {
  const contextEl = document.getElementById('project-context');
  const summaryEl = document.getElementById('leadership-summary');
  if (!contextEl || !summaryEl) return;

  const projectContext = (data?.projectContext || '')
    .split(',')
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');

  const generatedAt = data?.generatedAt ? new Date(data.generatedAt) : null;
  let freshness = '';
  let freshnessIsStale = false;
  if (generatedAt && !Number.isNaN(generatedAt.getTime())) {
    const diffMinutes = Math.max(0, Math.round((Date.now() - generatedAt.getTime()) / 60000));
    freshnessIsStale = diffMinutes >= 30;
    freshness = diffMinutes < 1 ? 'Updated just now' : `Updated ${diffMinutes} min ago`;
  }

  const segments = getContextPieces({
    projects: projectContext,
    rangeStart: data?.windowStart || data?.meta?.windowStart || '',
    rangeEnd: data?.windowEnd || data?.meta?.windowEnd || '',
    freshness,
    freshnessIsStale,
  });
  contextEl.innerHTML = renderContextSegments(segments, {
    className: 'header-context-strip',
    segmentClass: 'header-context-segment',
  }) || '<div class="header-context-strip"><span class="header-context-segment"><span class="header-context-segment-label">Projects</span><span class="header-context-segment-value">All projects</span></span></div>';

  try {
    const url = new URL(window.location.href);
    const queryProject = url.searchParams.get('project') || '';
    const queryBoard = url.searchParams.get('board') || '';
    const storageRaw = window.localStorage.getItem('leadership_focus_context');
    const storageFocus = storageRaw ? JSON.parse(storageRaw) : null;
    const focusProject = queryProject || storageFocus?.project || '';
    const focusBoard = queryBoard || storageFocus?.board || '';
    if (focusProject || focusBoard) {
      contextEl.innerHTML += '<div class="header-context-strip"><span class="header-context-segment"><span class="header-context-segment-label">Focus</span><span class="header-context-segment-value">' + [focusProject, focusBoard].filter(Boolean).join(' - ') + '</span></span></div>';
    }
  } catch (_) {}

  const risk = data?.risk || {};
  const limitedHistory = Number(data?.limitedHistoryBoards || 0);
  const parts = [];
  if (risk.score != null) parts.push(`Risk index ${formatNumber(risk.score, 0)}%`);
  if (risk.blockersOwned != null) parts.push(`${formatNumber(risk.blockersOwned, 0)} owned blockers`);
  if (risk.dataQualityRisk != null) parts.push(`Hygiene ${formatNumber(risk.dataQualityRisk, 0)}%`);
  if (limitedHistory > 0) parts.push(`${limitedHistory} low-confidence boards`);
  if (data?.kpis?.dataQuality?.trustBand) parts.push(`Trust ${data.kpis.dataQuality.trustBand}`);
  summaryEl.textContent = parts.length
    ? parts.join(' - ') + ' - ' + KPI_TREND_VISIBILITY_HINT
    : 'Delivery trend and risk signals will appear here once data loads.';
}

function leadershipSummaryQueryFromStorage() {
  try {
    const keys = (window.localStorage.getItem(PROJECTS_SSOT_KEY) || '')
      .split(',')
      .map((k) => String(k || '').trim())
      .filter(Boolean);
    if (!keys.length) return '';
    const params = new URLSearchParams();
    params.set('projects', keys.join(','));
    return params.toString();
  } catch (_) {
    return '';
  }
}

async function fetchHudData() {
  updateHeaderStatus('Syncing...', '');

  try {
    const qs = leadershipSummaryQueryFromStorage();
    const res = await fetch(qs ? `/api/leadership-summary.json?${qs}` : '/api/leadership-summary.json');
    if (res.status === 401) {
      window.location.href = '/login?redirect=/leadership';
      return;
    }
    if (!res.ok) throw new Error(`API Error ${res.status}`);

    const baseData = await res.json();

    let kpis = null;
    try {
      const projectContextRaw = Array.isArray(baseData.projects)
        ? baseData.projects.join(',')
        : String(baseData.projectContext || '').split(',').map((p) => p.trim()).filter(Boolean).join(',');
      const windowStart = baseData.windowStart || baseData.meta?.windowStart || '';
      const windowEnd = baseData.windowEnd || baseData.meta?.windowEnd || '';
      const params = new URLSearchParams();
      if (projectContextRaw) params.set('projects', projectContextRaw);
      if (windowStart) params.set('start', windowStart);
      if (windowEnd) params.set('end', windowEnd);

      if (params.toString()) {
        const kpiRes = await fetch(`/api/quarterly-kpi-summary.json?${params.toString()}`);
        if (kpiRes.ok) {
          kpis = await kpiRes.json();
        } else {
          console.warn('Quarterly KPI summary request failed', kpiRes.status); // eslint-disable-line no-console
        }
      }
    } catch (innerErr) {
      console.warn('Quarterly KPI summary fetch error', innerErr); // eslint-disable-line no-console
    }

    const merged = kpis ? { ...baseData, kpis } : baseData;

    renderHud(merged);
    renderContextHeader(merged);
    lastFetchTime = Date.now();
    updateHeaderStatus('Live', 'hud-status-pill is-live');
    updateTimeAgo();
  } catch (err) {
    console.error('HUD Fetch Error:', err);
    updateHeaderStatus('Offline', 'hud-status-pill is-offline');
    if (!lastFetchTime && document.getElementById('hud-grid')) {
      document.getElementById('hud-grid').innerHTML = '<div class="hud-card"><div class="metric-label">System alert</div><div class="metric-value" style="font-size:1.35rem">Unable to connect. Retrying...</div></div>';
    }
  }
}

function renderHud(data) {
  const grid = document.getElementById('hud-grid');
  if (!grid) return;

  const { velocity = {}, risk = {}, quality = {}, predictability = {}, kpis = {} } = data || {};
  const noMetricData = [velocity?.avg, risk?.score, quality?.reworkPct, predictability?.avg]
    .every((value) => value == null || Number.isNaN(Number(value)));

  if (noMetricData) {
    grid.innerHTML = `
      <div class="hud-card" style="grid-column:1/-1;">
        <div class="metric-label">No data yet</div>
        <div class="metric-value" style="font-size:1.25rem">Open Report, choose a range, run Preview, then reopen Leadership.</div>
        <div class="metric-trend"><a href="/leadership" style="color:#0f4c81;text-decoration:underline;">Open Leadership HUD</a></div>
      </div>
    `;
    return;
  }

  const riskNarrative = [
    `<span class="trend-neutral">Delivery risk: ${formatNumber(risk?.deliveryRisk, 0)}%</span>`,
    `<span class="trend-neutral">Hygiene risk: ${formatNumber(risk?.dataQualityRisk, 0)}%</span>`,
    `<span class="trend-neutral">${formatNumber(risk?.blockersOwned, 0)} blockers - ${formatNumber(risk?.unownedOutcomes, 0)} unowned outcomes</span>`,
    '<span class="trend-neutral"><a href="/report" style="color:#0f4c81">Open Performance - History</a> - <a href="/current-sprint" style="color:#0f4c81">Open Performance - Current Sprint</a></span>',
  ].join('');

  const projectKpis = kpis?.projectKPIs || {};
  const projectKeys = Object.keys(projectKpis);
  const fallbackProjectKey = Array.isArray(data?.projects) && data.projects.length === 1 ? data.projects[0] : (projectKeys[0] || null);
  const projectKpi = fallbackProjectKey ? projectKpis[fallbackProjectKey] : null;
  const cards = [];

  cards.push(renderKPICard({
    label: 'Velocity (Last 3)',
    value: velocity?.avg != null ? formatNumber(velocity.avg, 0) : null,
    unit: 'SP',
    trendHtml: getTrendHtml(velocity.trend),
    detailHref: '/leadership',
  }));

  cards.push(renderKPICard({
    label: 'Risk Index',
    value: risk?.score != null ? formatNumber(risk.score, 0) : null,
    unit: '%',
    trendHtml: riskNarrative,
    status: risk?.score > 20 ? 'below-target' : 'on-target',
    detailHref: '/current-sprint',
  }));

  cards.push(renderKPICard({
    label: 'Rework Ratio',
    value: quality?.reworkPct != null ? formatNumber(quality.reworkPct, 1) : null,
    unit: '%',
    trendHtml: getTrendHtml(quality.trend),
    detailHref: '/leadership',
  }));

  cards.push(renderKPICard({
    label: 'Predictability',
    value: predictability?.avg != null ? formatNumber(predictability.avg, 0) : null,
    unit: '%',
    trendHtml: getTrendHtml(predictability.trend),
    detailHref: '/report',
  }));

  if (projectKpi) {
    const trustBadge = buildTrustBadge(projectKpi.dataQuality || null);
    const utilization = buildUtilizationDisplay(projectKpi);

    if (projectKpi.costPerSP != null) {
      cards.push(renderKPICard({
        label: `Cost per SP${projectKeys.length > 1 ? ` (${fallbackProjectKey})` : ''}`,
        value: formatCostPerSPDisplay(projectKpi),
        unit: '',
        status: projectKpi.costPerSPStatus || 'no-data',
        detailHref: '/leadership',
        trustBadge,
      }));
    }

    if (projectKpi.avgOverheadPct != null) {
      cards.push(renderKPICard({
        label: `AVG Overhead${projectKeys.length > 1 ? ` (${fallbackProjectKey})` : ''}`,
        value: Number(projectKpi.avgOverheadPct).toFixed(1),
        unit: '%',
        status: projectKpi.avgOverheadStatus || 'no-data',
        detailHref: '/leadership',
        trustBadge,
      }));
    }

    cards.push(renderKPICard({
      label: `Utilization${projectKeys.length > 1 ? ` (${fallbackProjectKey})` : ''}`,
      value: utilization.text,
      unit: '',
      status: projectKpi.utilizationPct != null ? 'on-target' : 'no-data',
      detailHref: '/leadership',
      trustBadge,
    }));
  }

  if (kpis?.dataQuality) {
    cards.push(renderKPICard({
      label: 'Portfolio trust',
      value: kpis.dataQuality.trustBand || 'Weak',
      unit: '',
      trendHtml: `<span class="trend-neutral">SP ${(kpis.dataQuality.spCoverage * 100).toFixed(0)}% · Dates ${(kpis.dataQuality.dateCoverage * 100).toFixed(0)}% · Timesheets ${(kpis.dataQuality.timesheetCoverage * 100).toFixed(0)}%</span>`,
      detailHref: '/leadership',
      trustBadge: buildTrustBadge(kpis.dataQuality),
    }));
  }

  const primaryOutlier = (Array.isArray(kpis?.outlierEpics) && kpis.outlierEpics[0])
    || (Array.isArray(kpis?.outlierSprints) && kpis.outlierSprints[0])
    || null;
  if (primaryOutlier) {
    cards.push(renderKPICard({
      label: 'Top outlier',
      value: primaryOutlier.label,
      unit: '',
      detailHref: '/leadership',
      status: 'below-target',
      trendHtml: `<span class="trend-neutral">${primaryOutlier.metric}: ${formatNumber(primaryOutlier.value, 0)}</span><span class="trend-neutral">${primaryOutlier.rcaHint || ''}</span>`,
    }));
  }

  grid.innerHTML = cards.join('');
}

function updateTimeAgo() {
  const el = document.getElementById('last-updated');
  if (!el || !lastFetchTime) return;
  const seconds = Math.floor((Date.now() - lastFetchTime) / 1000);
  if (seconds < 60) el.textContent = 'Updated just now';
  else el.textContent = `Updated ${Math.floor(seconds / 60)}m ago`;
}

function init() {
  fetchHudData();
  setInterval(fetchHudData, REFRESH_INTERVAL_MS);
  window.addEventListener('focus', () => {
    const now = Date.now();
    if (now - lastFetchTime > STALE_THRESHOLD_MS) {
      fetchHudData();
    }
  });
  setInterval(updateTimeAgo, 5000);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
