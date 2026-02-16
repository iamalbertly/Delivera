/**
 * Alert/Warning Banner Component
 * Dynamic alerts for: stuck items (>24h), scope growth, burndown trend, sub-task risks
 * Color-coded: Yellow (1-2 risks), Orange (3-5 risks), Red (6+ risks or critical)
 * Dismissible with localStorage caching (4-hour TTL)
 * Rationale: Customer - Blockers discovered in <2s. Simplicity - One consistent place for alerts. Trust - Proactive warning pattern.
 */

import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {}
}

/**
 * Build alerts array from sprint data (shared for verdict bar and banner).
 */
export function buildAlerts(data) {
  const alerts = [];
  const stuckCount = (data.stuckCandidates || []).length;
  const scopeChanges = data.scopeChanges || [];
  const summary = data.summary || {};
  const tracking = data.subtaskTracking || {};
  const totalSP = summary.totalSP ?? 0;

  const assignees = new Set();
  (data.stories || []).forEach((s) => { if (s.assignee) assignees.add(s.assignee); });
  (data.stuckCandidates || []).forEach((s) => { if (s.assignee) assignees.add(s.assignee); });
  const teamSize = Math.max(1, assignees.size || 1);
  const stuckThresholdCount = Math.max(1, Math.ceil(teamSize / 5));

  if (stuckCount >= stuckThresholdCount) {
    const severity = stuckCount > Math.max(5, stuckThresholdCount + 3) ? 'critical' : (stuckCount > Math.max(2, stuckThresholdCount) ? 'high' : 'medium');
    const stuckItems = data.stuckCandidates || [];
    const previewKeys = stuckItems.slice(0, 2)
      .map((s) => s.key || s.issueKey || '')
      .filter(Boolean);
    const keyPreview = previewKeys.length
      ? previewKeys.join(', ') + (stuckCount > 2 ? ' +' + (stuckCount - 2) + ' more' : '')
      : '';
    const oldestHours = stuckItems.reduce((max, s) => Math.max(max, s.hoursInStatus || 0), 0);
    const oldestSuffix = oldestHours > 0 ? ' · Oldest: ' + Math.round(oldestHours) + 'h' : '';
    const titleText = stuckCount + ' blocker' + (stuckCount > 1 ? 's' : '')
      + (keyPreview ? ' · ' + keyPreview : '') + oldestSuffix;
    alerts.push({
      id: 'stuck-items',
      type: 'stuck',
      severity,
      icon: '!',
      title: titleText,
      message: 'Items stuck >24h in the same status. Unblock immediately to protect delivery.',
      action: 'Open blocker list',
      actionHref: '#work-risks-table',
      actionData: 'view-blockers',
      color: severity === 'critical' ? 'red' : (severity === 'high' ? 'orange' : 'yellow')
    });
  }

  if (scopeChanges.length > 0 && totalSP > 0) {
    const scopeSP = scopeChanges.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
    const scopePercent = (scopeSP / totalSP) * 100;
    const scopeThresholdHigh = teamSize <= 3 ? 8 : 15;
    const scopeThresholdMedium = teamSize <= 3 ? 4 : 5;
    if (scopePercent > scopeThresholdHigh) {
      alerts.push({
        id: 'scope-growth',
        type: 'scope',
        severity: 'high',
        icon: '!',
        title: 'Scope growth: +' + scopePercent.toFixed(0) + '%',
        message: scopeChanges.length + ' new issues added (' + scopeSP + ' SP). Sprint commitment at risk.',
        action: 'Review Risks',
        actionHref: '#stuck-card',
        actionData: 'review-risks',
        color: 'orange'
      });
    } else if (scopePercent > scopeThresholdMedium) {
      alerts.push({
        id: 'scope-growth',
        type: 'scope',
        severity: 'medium',
        icon: '!',
        title: 'Scope growth: +' + scopePercent.toFixed(0) + '%',
        message: scopeChanges.length + ' new items. Monitor impact on delivery.',
        action: 'Review Risks',
        actionHref: '#stuck-card',
        actionData: 'review-risks',
        color: 'yellow'
      });
    }
  }

  const trackingRows = tracking.rows || [];
  const missingEstimates = trackingRows.filter((r) => !r.estimateHours || r.estimateHours === 0).length;
  if (missingEstimates > 5) {
    alerts.push({
      id: 'missing-estimates',
      type: 'estimation',
      severity: 'high',
      icon: '!',
      title: missingEstimates + ' sub-tasks missing estimates',
      message: 'Cannot accurately forecast completion. Add estimates immediately.',
      action: 'View Sub-tasks',
      actionHref: '#subtask-tracking-card',
      color: 'red'
    });
  } else if (missingEstimates > 2) {
    alerts.push({
      id: 'missing-estimates',
      type: 'estimation',
      severity: 'medium',
      icon: '!',
      title: missingEstimates + ' sub-tasks missing estimates',
      message: 'Reduce forecast uncertainty by adding estimates.',
      action: 'View Sub-tasks',
      actionHref: '#subtask-tracking-card',
      color: 'yellow'
    });
  }

  const totalLogged = trackingRows.reduce((sum, r) => sum + (r.loggedHours || 0), 0);
  const totalEstimated = trackingRows.reduce((sum, r) => sum + (r.estimateHours || 0), 0);
  if (totalEstimated > 0 && totalLogged === 0) {
    alerts.push({
      id: 'low-logging',
      type: 'logging',
      severity: 'medium',
      icon: '!',
      title: 'No time logged on sub-tasks',
      message: 'Team members need to log hours for accurate burndown visibility.',
      action: 'View Tracking',
      actionHref: '#subtask-tracking-card',
      color: 'orange'
    });
  }

  return alerts;
}

export function deriveSprintVerdict(data) {
  const stuckCount = (data.stuckCandidates || []).length;
  const summary = data.summary || {};
  const totalStories = Number(summary.totalStories || (data.stories || []).length || 0);
  const doneStories = Number(summary.doneStories || 0);
  const donePct = totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0;
  const missingEstimate = Number(summary.subtaskMissingEstimate || 0);
  const missingLogged = Number(summary.subtaskMissingLogged || 0);
  const riskScore = (stuckCount * 3) + (missingEstimate * 2) + missingLogged + (donePct < 45 && totalStories > 0 ? 3 : 0);

  let verdict = 'Healthy';
  let color = 'green';
  if (riskScore >= 14) {
    verdict = 'Critical';
    color = 'red';
  } else if (riskScore >= 8) {
    verdict = 'At risk';
    color = 'orange';
  } else if (riskScore >= 3) {
    verdict = 'Watch';
    color = 'yellow';
  }

  let detail = donePct + '% done';
  if (stuckCount > 0) detail += ' · ' + stuckCount + ' blockers';
  if (missingEstimate > 0) detail += ' · ' + missingEstimate + ' missing estimates';
  if (missingLogged > 0) detail += ' · ' + missingLogged + ' no log';
  return {
    verdict,
    color,
    detail,
    stuckCount,
    missingEstimate,
    missingLogged,
  };
}

/**
 * Single-line verdict bar: one sentence, one color, one action.
 */
export function renderVerdictBar(data) {
  const alerts = buildAlerts(data);
  const first = alerts[0] || null;
  const moreCount = alerts.length > 0 ? alerts.length - 1 : 0;
  const { verdict, color, detail, stuckCount, missingEstimate, missingLogged } = deriveSprintVerdict(data);

  const quickReasons = [];
  if (stuckCount > 0) quickReasons.push('blocked >24h');
  if (missingEstimate > 0) quickReasons.push('missing estimates');
  if (missingLogged > 0) quickReasons.push('missing logs');
  const explainLine = quickReasons.length
    ? 'Why: ' + quickReasons.join(', ') + '.'
    : 'Why: no blocker or sub-task hygiene risks detected.';

  let html = '<div class="verdict-bar verdict-bar-' + color + '" role="status" aria-live="polite">';
  html += '<span class="verdict-text">' + escapeHtml(verdict) + '</span>';
  if (stuckCount > 0) {
    html += '<a href="#work-risks-table" class="verdict-detail verdict-detail-link" title="Open blocker drilldown table">' + escapeHtml(detail) + '</a>';
  } else {
    html += '<span class="verdict-detail">' + escapeHtml(detail) + '</span>';
  }
  if (moreCount > 0) {
    html += '<button type="button" class="verdict-more" data-action="expand-verdict" aria-expanded="false">+' + moreCount + ' more</button>';
  }
  html += ' <a href="' + (first?.actionHref || '#work-risks-table') + '" class="verdict-action btn btn-primary btn-compact">' + escapeHtml(first?.action || 'Review') + '</a>';
  if (verdict !== 'Healthy') {
    html += '<span class="verdict-explain">' + escapeHtml(explainLine) + '</span>';
  }
  html += '</div>';
  return html;
}

/**
 * Renders the full alert banner. Scope growth is shown only in the verdict bar (single source); exclude it here to avoid duplication.
 */
export function renderAlertBanner(data) {
  const allAlerts = buildAlerts(data).filter((a) => a.id !== 'scope-growth');
  if (allAlerts.length === 0) return '';
  const alerts = allAlerts.slice(1);
  if (alerts.length === 0) return '';

  const maxSeverity = alerts.reduce((max, a) => {
    const severities = { critical: 3, high: 2, medium: 1 };
    return Math.max(max, severities[a.severity] || 0);
  }, 0);
  const severityMap = { 3: 'critical', 2: 'high', 1: 'medium' };
  const bannerSeverity = severityMap[maxSeverity] || 'medium';
  const bannerColor = bannerSeverity === 'critical' ? 'red' : (bannerSeverity === 'high' ? 'orange' : 'yellow');

  const dismissKey = `alert_banner_dismissed_${data.sprint?.id || 'unknown'}`;
  const dismissedTime = safeLocalStorageGet(dismissKey);
  const now = Date.now();
  const fourHoursMs = 4 * 60 * 60 * 1000;
  const isDismissed = dismissedTime && (now - parseInt(dismissedTime, 10)) < fourHoursMs;

  if (isDismissed) return '';

  let html = '<div class="alert-banner ' + bannerColor + '" role="alert" aria-live="polite">';
  html += '<div class="alert-banner-content">';

  alerts.forEach((alert, idx) => {
    if (idx > 0) html += '<div class="alert-separator"></div>';
    html += '<div class="alert-item">';
    html += '<span class="alert-icon">' + alert.icon + '</span>';
    html += '<div class="alert-text">';
    html += '<strong>' + escapeHtml(alert.title) + '</strong>';
    html += '<p>' + escapeHtml(alert.message) + '</p>';
    html += '</div>';
    const actionDataAttr = alert.actionData ? (' data-action="' + alert.actionData + '"') : '';
    html += '<a href="' + alert.actionHref + '" class="alert-action"' + actionDataAttr + '>' + alert.action + '</a>';
    html += '</div>';
  });

  html += '</div>';
  html += '<button class="alert-dismiss" type="button" aria-label="Dismiss alert" title="Dismiss for 4 hours">×</button>';
  html += '</div>';

  return html;
}

/**
 * Wire alert banner handlers
 */
export function wireAlertBannerHandlers() {
  const banner = document.querySelector('.alert-banner');
  if (!banner) return;

  const dismissBtn = banner.querySelector('.alert-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      const headerBar = document.querySelector('.current-sprint-header-bar');
      const sprintId = headerBar?.getAttribute('data-sprint-id') || 'unknown';
      const dismissKey = `alert_banner_dismissed_${sprintId}`;
      const genericKey = 'alert_banner_dismissed_unknown';
      const ts = String(Date.now());
      safeLocalStorageSet(dismissKey, ts);
      safeLocalStorageSet(genericKey, ts);
      banner.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        banner.style.display = 'none';
      }, 300);
    });
  }

  const actionLinks = banner.querySelectorAll('.alert-action');
  actionLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      const actionData = link.getAttribute('data-action') || '';
      if (actionData === 'view-blockers' || actionData === 'review-risks') {
        const target = document.querySelector('#work-risks-table') || document.querySelector('#stuck-card');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
          target.classList.add('highlight-flash');
          setTimeout(() => target.classList.remove('highlight-flash'), 2000);
        }
        return;
      }

      const target = href ? document.querySelector(href) : null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Check if alert should be shown (not dismissed)
 */
export function shouldShowAlertBanner(sprintId) {
  const dismissKey = `alert_banner_dismissed_${sprintId}`;
  const genericKey = 'alert_banner_dismissed_unknown';
  const dismissedTime = safeLocalStorageGet(dismissKey) || safeLocalStorageGet(genericKey);
  if (!dismissedTime) return true;

  const now = Date.now();
  const fourHoursMs = 4 * 60 * 60 * 1000;
  return (now - parseInt(dismissedTime, 10)) >= fourHoursMs;
}
