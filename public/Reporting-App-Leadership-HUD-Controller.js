/**
 * Reporting-App-Leadership-HUD-Controller.js
 * Leadership mission-control controller.
 */

import { getContextPieces, renderContextSegments } from './Reporting-App-Shared-Context-From-Storage.js';
import { getLeadershipTrendVisibilityHint } from './Reporting-App-Leadership-Page-Render.js';

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

function renderCard(label, value, unit, trendHtml, colorClass = '', href = '') {
  const wrap = href
    ? `<a href="${href}" class="hud-card-link" style="text-decoration:none;color:inherit;display:block;">`
    : '';
  const wrapEnd = href ? '</a>' : '';
  return `
    ${wrap}<div class="hud-card">
      <div>
        <div class="metric-label">${label}</div>
        <div class="metric-value ${colorClass}">${value}<span class="metric-unit">${unit}</span></div>
        <div class="metric-trend">${trendHtml}</div>
      </div>
    </div>${wrapEnd}
  `;
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
  summaryEl.textContent = parts.length
    ? parts.join(' - ') + ' - ' + getLeadershipTrendVisibilityHint()
    : 'Delivery trend and risk signals will appear here once data loads.';
}

async function fetchHudData() {
  updateHeaderStatus('Syncing...', 'hud-status-pill');

  try {
    const res = await fetch('/api/leadership-summary.json');
    if (res.status === 401) {
      window.location.href = '/login?redirect=/leadership';
      return;
    }
    if (!res.ok) throw new Error(`API Error ${res.status}`);

    const data = await res.json();
    renderHud(data);
    renderContextHeader(data);
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

  const { velocity = {}, risk = {}, quality = {}, predictability = {} } = data || {};
  const noMetricData = [velocity?.avg, risk?.score, quality?.reworkPct, predictability?.avg]
    .every((value) => value == null || Number.isNaN(Number(value)));

  if (noMetricData) {
    grid.innerHTML = `
      <div class="hud-card" style="grid-column:1/-1;">
        <div class="metric-label">No data yet</div>
        <div class="metric-value" style="font-size:1.25rem">Open Report, choose a range, run Preview, then reopen Leadership.</div>
        <div class="metric-trend"><a href="/report#trends" style="color:#0f4c81;text-decoration:underline;">Open Report Trends</a></div>
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

  grid.innerHTML = [
    renderCard('Velocity (Last 3)', formatNumber(velocity.avg, 0), 'SP', getTrendHtml(velocity.trend), '', '/report#trends'),
    renderCard('Risk Index', formatNumber(risk.score, 0), '%', riskNarrative, risk.score > 20 ? 'trend-down' : '', '/current-sprint'),
    renderCard('Rework Ratio', formatNumber(quality.reworkPct, 1), '%', getTrendHtml(quality.trend), '', '/report#trends'),
    renderCard('Predictability', formatNumber(predictability.avg, 0), '%', getTrendHtml(predictability.trend), '', '/report'),
  ].join('');
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
