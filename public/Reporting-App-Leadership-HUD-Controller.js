/**
 * Reporting-App-Leadership-HUD-Controller.js
 * "Morning Coffee" Dashboard Controller
 * 
 * Philosophy: 
 * - Zero Config: Loads immediately.
 * - Auto-Healing: Refreshes on focus if stale.
 * - Resilient: Handles API failures gracefully.
 */

const REFRESH_INTERVAL_MS = 60 * 1000; // 1 minute
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
let lastFetchTime = 0;

function getReportCacheContextLabel() {
  try {
    const rawProjects = localStorage.getItem('vodaAgileBoard_selectedProjects') || '';
    const projects = rawProjects.split(',').map((p) => String(p || '').trim()).filter(Boolean);
    const reportMetaRaw = sessionStorage.getItem('vodaAgileBoard_reportLastMeta');
    const reportMeta = reportMetaRaw ? JSON.parse(reportMetaRaw) : null;
    const range = reportMeta?.windowStart && reportMeta?.windowEnd
      ? `${String(reportMeta.windowStart).slice(0, 10)} to ${String(reportMeta.windowEnd).slice(0, 10)}`
      : '';
    return [projects.length ? projects.join('+') : '', range].filter(Boolean).join(' | ');
  } catch (_) {
    return '';
  }
}

function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return 'No data';
  return num.toFixed(decimals);
}

function getTrendHtml(trend) {
  if (!trend) return '<span class="trend-neutral">No trend data</span>';
  const direction = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
  // Context aware: Up is good for Velocity, bad for Risk
  const arrow = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  return `<span class="trend-${direction}">${arrow} ${Math.abs(trend)}% vs last 3</span>`;
}

function renderCard(label, value, unit, trendHtml, colorClass = '') {
  return `
    <div class="hud-card">
      <div>
        <div class="metric-label">${label}</div>
        <div class="metric-value ${colorClass}">${value}<span class="metric-unit">${unit}</span></div>
        <div class="metric-trend">${trendHtml}</div>
      </div>
    </div>
  `;
}

function renderError(msg) {
  const grid = document.getElementById('hud-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="hud-card" style="grid-column: 1/-1; border-left: 4px solid var(--hud-danger);">
        <div class="metric-label" style="color: var(--hud-danger)">System Alert</div>
        <div class="metric-value" style="font-size: 1.5rem">${msg}</div>
        <div class="metric-trend">Retrying automatically...</div>
      </div>
    `;
  }
}

async function fetchHudData() {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) statusEl.textContent = 'Syncing...';

  try {
    const res = await fetch('/api/leadership-summary.json');
    if (res.status === 401) {
      window.location.href = '/login?redirect=/leadership';
      return;
    }
    if (!res.ok) throw new Error(`API Error ${res.status}`);

    const data = await res.json();
    renderHud(data);
    lastFetchTime = Date.now();

    if (statusEl) {
      statusEl.textContent = 'Live';
      statusEl.className = 'live';
    }
    updateTimeAgo();
  } catch (err) {
    console.error('HUD Fetch Error:', err);
    if (statusEl) statusEl.textContent = 'Offline';
    if (!lastFetchTime && document.getElementById('hud-grid')) {
      document.getElementById('hud-grid').innerHTML = '<div class="error-card">Unable to connect. Retrying...</div>';
    }
  }
}

function renderHud(data) {
  const grid = document.getElementById('hud-grid');
  if (!grid) return;

  const { velocity, risk, quality, predictability, projectContext } = data;

  // Update Context
  const contextEl = document.getElementById('project-context');
  if (contextEl) {
    const generatedAt = data?.generatedAt ? new Date(data.generatedAt) : null;
    const ageDays = generatedAt ? Math.floor((Date.now() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
    let contextText = projectContext || 'All Projects';
    if (ageDays != null && ageDays > 30) contextText += ` · Data older than 30 days`;
    const reportCacheContext = getReportCacheContextLabel();
    if (data?.windowLabel) contextText += ` | ${data.windowLabel}`;
    else if (reportCacheContext) contextText += ` | ${reportCacheContext}`;
    contextEl.textContent = contextText;
  }

  const noMetricData = [velocity?.avg, risk?.score, quality?.reworkPct, predictability?.avg]
    .every((value) => value == null || Number.isNaN(Number(value)));
  if (noMetricData) {
    grid.innerHTML = `
      <div class="hud-card" style="grid-column:1/-1;border-left:4px solid var(--hud-warning);">
        <div class="metric-label">No report data yet</div>
        <div class="metric-value" style="font-size:1.25rem">Run Performance Report for this window</div>
        <div class="metric-trend"><a href="/report#trends" style="color:var(--hud-accent);text-decoration:underline;">Open Report Trends</a></div>
      </div>
    `;
    return;
  }

  const riskNarrative = [
    `<span class="trend-neutral">Delivery risk (blockers): ${formatNumber(risk?.deliveryRisk, 0)}%</span>`,
    `<span class="trend-neutral">Data quality risk (ownership/logging): ${formatNumber(risk?.dataQualityRisk, 0)}%</span>`,
    `<span class="trend-neutral">${formatNumber(risk?.blockersOwned, 0)} blockers (owned) · ${formatNumber(risk?.unownedOutcomes, 0)} unowned outcomes</span>`,
    '<span class="trend-neutral"><a href=\"/report\" style=\"color:var(--hud-accent)\">Open Performance - History</a> · <a href=\"/current-sprint\" style=\"color:var(--hud-accent)\">Open Performance - Current Sprint</a></span>',
  ].join('<br>');

  grid.innerHTML = [
    renderCard('Velocity (Last 3)', formatNumber(velocity.avg, 0), 'SP', getTrendHtml(velocity.trend)),
    renderCard('Risk Index', formatNumber(risk.score, 0), '%', riskNarrative, risk.score > 20 ? 'trend-down' : ''),
    renderCard('Rework Ratio', formatNumber(quality.reworkPct, 1), '%', getTrendHtml(quality.trend)),
    renderCard('Predictability', formatNumber(predictability.avg, 0), '%', getTrendHtml(predictability.trend))
  ].join('');
}

function updateTimeAgo() {
  const el = document.getElementById('last-updated');
  if (!el || !lastFetchTime) return;
  const seconds = Math.floor((Date.now() - lastFetchTime) / 1000);
  if (seconds < 60) el.textContent = 'Just now';
  else el.textContent = `${Math.floor(seconds / 60)}m ago`;
}

function init() {
  fetchHudData();

  // Auto-refresh
  setInterval(() => {
    fetchHudData();
  }, REFRESH_INTERVAL_MS);

  // Stale Tab / Auto-Healing Edge Case
  window.addEventListener('focus', () => {
    const now = Date.now();
    if (now - lastFetchTime > STALE_THRESHOLD_MS) {
      console.log('Tab focused after stale period. Refreshing...');
      fetchHudData();
    }
  });

  // Time ago ticker
  setInterval(updateTimeAgo, 5000); // 5s accuracy
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
