import { escapeHtml, renderIssueKeyLink } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatDate, formatDayLabel, formatNumber } from './Delivera-Shared-Format-DateNumber-Helpers.js';
import { renderEmptyStateHtml } from './Delivera-Shared-Empty-State-Helpers.js';
import { resolveResponsiveRowLimit } from './Delivera-Shared-Responsive-Helpers.js';
import { buildDistinctSprintFilterViews, buildMergedWorkRiskRows, getUnifiedRiskCounts } from './Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
import { hasOutcomeLabel, isOutcomeStoryLike, deriveDeliveryProgressTone, deriveSpilloverTone } from './Delivera-Shared-Outcome-Risk-Semantics.js';
import { renderWorkRisksMerged } from './Delivera-CurrentSprint-Render-Subtasks.js';
import { deriveSprintVerdict } from './Delivera-CurrentSprint-Alert-Banner.js';
import { getCurrentSprintPayload, isSprintCommentSendAllowed } from './Delivera-CurrentSprint-Action-Bridge.js';
import { resolvePrimaryBlockerKey } from './Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import {
  buildDeliveredImpactBullets,
  deriveBusinessOutcome,
  deriveBusinessValueTag,
  deriveLinkedKpi,
  deriveStoryDescription,
  deriveStoryGroup,
} from './Delivera-CurrentSprint-Value-Helpers.js';
export function renderStories(data) {
  const stories = data.stories || [];
  const sprintState = String(data?.sprint?.state || '').toLowerCase();
  const isHistoricalSprint = sprintState && sprintState !== 'active';
  // Build hoursInStatus lookup from stuckCandidates so table rows carry the duration attribute
  const stuckHoursMap = new Map(
    (data.stuckCandidates || []).map((c) => [String(c.issueKey || '').toUpperCase(), Number(c.hoursInStatus || 0)])
  );
  const verdictInfo = deriveSprintVerdict(data);
  const scopeChanges = data.scopeChanges || [];
  const mergedRiskRows = buildMergedWorkRiskRows(data);
  const unifiedRiskCounts = getUnifiedRiskCounts(data);
  const dailySeries = Array.isArray(data?.dailyCompletions?.stories) ? data.dailyCompletions.stories : [];
  const parentUnassigned = Number(unifiedRiskCounts.unownedOutcomes || 0);
  const blockerKeys = new Set(
    mergedRiskRows
      .filter((row) => row.isOwnedBlocker)
      .map((row) => String(row?.issueKey || row?.key || '').toUpperCase())
      .filter(Boolean)
  );
  const unownedOutcomeKeys = new Set(
    mergedRiskRows
      .filter((row) => row.isUnownedOutcome)
      .map((row) => String(row?.issueKey || row?.key || '').toUpperCase())
      .filter(Boolean)
  );
  const scopeKeys = new Set((scopeChanges || []).map((s) => String(s?.issueKey || s?.key || '').toUpperCase()).filter(Boolean));
  const noLogKeys = new Set();
  const missingEstimateKeys = new Set();
  const scopeAddedKeys = new Set();
  for (const row of mergedRiskRows) {
    const key = String(row?.issueKey || row?.key || '').toUpperCase();
    if (!key) continue;
    const tags = Array.isArray(row?.riskTags) ? row.riskTags : [];
    if (tags.includes('no-log')) noLogKeys.add(key);
    if (tags.includes('missing-estimate')) missingEstimateKeys.add(key);
    if (tags.includes('scope')) scopeAddedKeys.add(key);
  }
  const filterViews = buildDistinctSprintFilterViews(data, verdictInfo);
  const storyRiskTagMap = filterViews.storyTagMap || new Map();
  const groupedStories = { value: [], enabler: [], blocked: [] };
  stories.forEach((story) => {
    const storyKey = String(story?.issueKey || story?.key || '').toUpperCase();
    const group = deriveStoryGroup(story, storyRiskTagMap.get(storyKey) || []);
    groupedStories[group]?.push(story);
  });
  const deliveredBullets = buildDeliveredImpactBullets(stories, storyRiskTagMap);
  const valueDoneCount = groupedStories.value.filter((story) => String(story?.status || '').toLowerCase().includes('done')).length;
  const spilloverCount = Math.max(0, stories.length - Number(data?.summary?.doneStories || 0));
  const spilloverPct = stories.length > 0 ? Math.round((spilloverCount / stories.length) * 100) : 0;
  // Audit fix: the Blockers Panel was counting rows with ANY risk tag
  // (unassigned / missing-estimate / no-log) as "blockers", so a sprint with
  // 3 unestimated stories and zero actual blockers showed "3 visible" under
  // an "Active blockers" heading — a trust gap. Split real blockers from
  // ownership/estimate/log gaps so the count and label are honest.
  const isRealBlocker = (row) => Array.isArray(row?.riskTags) && row.riskTags.includes('blocker');
  const isOwnershipOrFlowGap = (row) => Array.isArray(row?.riskTags)
    && row.riskTags.some((tag) => ['unassigned', 'missing-estimate', 'no-log'].includes(tag));
  const realBlockerRows = mergedRiskRows.filter(isRealBlocker);
  const flowGapRows = mergedRiskRows.filter((row) => isOwnershipOrFlowGap(row) && !isRealBlocker(row));
  const blockerPanelRows = [...realBlockerRows, ...flowGapRows].slice(0, 6);
  const realBlockerCount = realBlockerRows.length;
  const flowGapCount = flowGapRows.length;

  let html = '<div class="transparency-card" id="stories-card">';
  html += '<div class="stories-dom-guardrail" data-story-count="' + stories.length + '" aria-hidden="true"></div>';
  if (stories.length > 0) {
    html += '<div class="stories-desktop-table-region">';
    html += '<div class="stories-primary-sticky">';
  }
  html += '<div class="section-inline-header">';
  html += '<div><h2>Sprint work <span class="section-inline-count">· ' + stories.length + ' issues</span></h2></div>';
  const storyStatChips = [];
  if (blockerKeys.size > 0) storyStatChips.push('<span>' + blockerKeys.size + ' blockers</span>');
  if (parentUnassigned > 0) storyStatChips.push('<span>' + parentUnassigned + ' unowned</span>');
  if (storyStatChips.length) {
    html += '<div class="section-inline-stats">' + storyStatChips.join('') + '</div>';
  }
  html += '</div>';
  // Only render chips when count > 0 — zero-count chips are visual noise that erode trust
  const hasAnyRisk = blockerKeys.size > 0 || noLogKeys.size > 0 || missingEstimateKeys.size > 0 || parentUnassigned > 0 || scopeAddedKeys.size > 0;
  // Risk filter chips live in header role-lens — avoid duplicate chip row here.
  if (hasAnyRisk) {
    const topNudgeKey = blockerKeys.size > 0 ? Array.from(blockerKeys)[0] : (noLogKeys.size > 0 ? Array.from(noLogKeys)[0] : '');
    const primaryBlocker = String(resolvePrimaryBlockerKey(data) || '').toUpperCase();
    const suppressStoriesNudge = Boolean(primaryBlocker);
    if (!suppressStoriesNudge) {
      const nudgeBtnLabel = topNudgeKey ? ('Nudge ' + topNudgeKey) : 'Send nudge to Jira';
      const sendAllowed = isSprintCommentSendAllowed(data?.meta, data?.sprint);
      html += '<div class="work-risks-direct-value-strip" role="group" aria-label="Direct action">';
      html += '<button type="button" class="btn btn-primary btn-compact stories-direct-nudge" data-action="send-top-nudge-to-jira" title="Send guided nudge to top visible risk directly to Jira" data-send-top-nudge'
        + (sendAllowed ? '' : ' disabled aria-disabled="true"')
        + '>' + nudgeBtnLabel + '</button>';
      html += '</div>';
    }
  }
  html += renderWorkRisksMerged(data);

  function mapRiskTagLabel(tag) {
    if (tag === 'blocker') return 'Blocked';
    if (tag === 'scope') return 'Scope change';
    if (tag === 'unassigned') return 'No owner';
    if (tag === 'no-log') return 'No log';
    if (tag === 'missing-estimate') return 'No estimate';
    return tag;
  }

  function renderStorySignalCard(label, value, copy, progress = null, tone = '') {
    const progressTone = progress != null ? deriveDeliveryProgressTone(progress) : '';
    const toneClass = (tone || progressTone) ? ' ' + (tone || progressTone).trim() : '';
    let cardHtml = '<article class="sprint-story-signal-card' + toneClass + '">';
    cardHtml += '<p class="sprint-story-signal-label">' + escapeHtml(label) + '</p>';
    cardHtml += '<strong>' + escapeHtml(value) + '</strong>';
    cardHtml += '<p>' + escapeHtml(copy) + '</p>';
    if (progress != null) {
      const width = Math.max(0, Math.min(100, Number(progress) || 0));
      cardHtml += '<div class="sprint-story-signal-bar' + progressTone + '"><span style="width:' + width + '%;"></span></div>';
    }
    cardHtml += '</article>';
    return cardHtml;
  }

  function formatBlockerAge(hoursInStatus) {
    const h = Number(hoursInStatus || 0);
    if (h <= 0) return 'Needs review now';
    if (h < 24) return Math.round(h) + 'h blocked';
    const days = Math.round(h / 24);
    return days + 'd blocked';
  }

  function blockerAgeTone(hoursInStatus) {
    const h = Number(hoursInStatus || 0);
    if (h >= 336) return 'blocker-age-critical';  // 14+ days
    if (h >= 168) return 'blocker-age-danger';     // 7+ days
    if (h >= 72)  return 'blocker-age-warning';    // 3+ days
    return 'blocker-age-caution';
  }

  function isFormerUserLabel(name) {
    return /^former\s+user$/i.test(String(name || '').trim());
  }

  function renderBlockersPanel() {
    if (!blockerPanelRows.length) {
      return '<article class="sprint-blockers-panel"><div class="sprint-group-header"><div><p class="sprint-group-kicker">Blockers Panel</p><h3>No active blockers</h3></div></div><p class="sprint-group-copy">No active blockers right now. Ownership and estimate gaps appear here the moment they become a delivery risk.</p></article>';
    }
    // Honest heading + count: real blockers vs ownership/estimate/log gaps.
    // Audit fix: previously showed "N visible" under "Active blockers" even
    // when N was entirely unestimated/unlogged stories — misleading.
    const panelTitle = realBlockerCount > 0 ? 'Active blockers' : 'Delivery risks';
    const countLabel = realBlockerCount > 0
      ? `${realBlockerCount} blocker${realBlockerCount === 1 ? '' : 's'}${flowGapCount > 0 ? ` · ${flowGapCount} risk${flowGapCount === 1 ? '' : 's'}` : ''}`
      : `${flowGapCount} risk${flowGapCount === 1 ? '' : 's'}`;
    let panelHtml = '<article class="sprint-blockers-panel">';
    panelHtml += '<div class="sprint-group-header"><div><p class="sprint-group-kicker">Blockers Panel</p><h3>' + panelTitle + '</h3></div><span class="sprint-group-count" data-blocker-count data-blocker-real="' + realBlockerCount + '" data-blocker-gap="' + flowGapCount + '">' + countLabel + '</span></div>';
    panelHtml += '<div class="sprint-blockers-list">';
    blockerPanelRows.forEach((row) => {
      const ownerRaw = row.owner || row.assignee || row.reporter || '';
      const isOrphan = !ownerRaw || isFormerUserLabel(ownerRaw);
      const ownerDisplay = isOrphan ? 'Owner needed' : ownerRaw;
      const ageLabel = formatBlockerAge(row.hoursInStatus);
      const ageTone = blockerAgeTone(row.hoursInStatus);
      const isFormerRep = isFormerUserLabel(row.reporter);
      const likelyOwner = ownerRaw && !isOrphan ? ownerRaw : (row.reporter || 'Unassigned');
      const canNudge = Boolean((likelyOwner && likelyOwner !== 'Unassigned') || getCurrentSprintPayload()?.meta?.teamRoster?.length);
      panelHtml += '<article class="sprint-blocker-row' + (isOrphan ? ' sprint-blocker-row--orphan' : '') + (canNudge ? ' sprint-blocker-row--tap-nudge' : '') + '"'
        + (canNudge ? ' tabindex="0" role="button" data-blocker-nudge="' + escapeHtml(row.issueKey || row.key || '') + '"' : '') + '>';
      if (isOrphan) {
        panelHtml += '<div class="sprint-blocker-orphan-alert" data-blocker-orphan-alert>No active owner — deactivated account. Assign before escalating.</div>';
      }
      panelHtml += '<div class="sprint-blocker-top">'
        + '<strong>' + renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + ' ' + escapeHtml(row.summary || '') + '</strong>'
        + '</div>';
      const hours = Number(row.hoursInStatus || 0);
      const rootCause = hours >= 24
        ? `Status unchanged ${Math.round(hours)}h — likely blocking sprint flow`
        : 'Needs ownership or unblock decision';
      panelHtml += '<p class="sprint-blocker-root-cause" data-blocker-root-cause="1">' + escapeHtml(rootCause) + '</p>';
      panelHtml += '<div class="sprint-blocker-meta">'
        + '<span class="sprint-blocker-owner' + (isOrphan ? ' sprint-blocker-owner--missing' : '') + '" data-blocker-owner>' + escapeHtml(COPY.likelyOwner) + ': ' + escapeHtml(likelyOwner) + '</span>'
        + '<span class="sprint-blocker-age ' + escapeHtml(ageTone) + '" data-blocker-age>' + escapeHtml(ageLabel) + '</span>'
        + (isFormerRep ? '<span class="sprint-blocker-former-reporter" data-former-reporter>Reporter deactivated</span>' : '')
        + '</div>';
      panelHtml += '</article>';
    });
    panelHtml += '</div></article>';
    return panelHtml;
  }

  function buildLiveConfidenceBrief() {
    const doneCount = Number(data?.summary?.doneStories || 0);
    const inProgressCount = stories.filter((s) => {
      const st = String(s?.status || '').toLowerCase();
      return st.includes('in progress') || st.includes('in-progress');
    }).length;
    const activeBlockers = blockerPanelRows.filter((r) => Array.isArray(r?.riskTags) && r.riskTags.includes('blocker')).length;
    const remainingDaysBrief = data?.daysMeta?.daysRemainingWorking ?? data?.daysMeta?.daysRemainingCalendar;
    const total = stories.length;
    const daysStr = remainingDaysBrief != null ? remainingDaysBrief + 'd remaining' : '';
    const confidence = (activeBlockers > 0 && doneCount === 0)
      ? 'Blocked'
      : (activeBlockers > 0 && remainingDaysBrief != null && remainingDaysBrief <= 3)
        ? 'Low'
        : (activeBlockers > 0 ? 'Low' : 'Healthy');
    const parts = [];
    if (inProgressCount > 0) parts.push(inProgressCount + ' of ' + total + ' items in active development');
    if (activeBlockers > 0) parts.push(activeBlockers + ' blocker' + (activeBlockers > 1 ? 's' : '') + ' unresolved');
    if (daysStr) parts.push(daysStr);
    parts.push('Delivery confidence: ' + confidence);
    return parts.join('. ') + '.';
  }

  function renderDeliveredSection() {
    if (deliveredBullets.length) {
      return '<article class="sprint-delivered-panel" data-delivered-panel><div class="sprint-group-header"><div><p class="sprint-group-kicker">What Was Delivered This Sprint</p><h3>Leadership-ready outcome summary</h3></div></div><ul class="sprint-delivered-list">' + deliveredBullets.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul></article>';
    }
    const brief = buildLiveConfidenceBrief();
    return '<article class="sprint-delivered-panel" data-delivered-panel data-confidence-brief>'
      + '<div class="sprint-group-header"><div><p class="sprint-group-kicker">What Was Delivered This Sprint</p><h3>Sprint confidence brief</h3></div></div>'
      + '<p class="sprint-confidence-brief" data-confidence-brief-text>' + escapeHtml(brief) + '</p>'
      + '<p class="sprint-confidence-brief-note">Delivered outcomes will appear here as work reaches Done.</p>'
      + '</article>';
  }

  function renderStoryValueCard(story) {
    const storyKey = String(story?.issueKey || story?.key || '').toUpperCase();
    const riskTags = Array.from(new Set(storyRiskTagMap.get(storyKey) || []));
    const riskSummary = riskTags.length ? riskTags.map(mapRiskTagLabel).join(' | ') : 'No active blocker';
    let cardHtml = '<article class="story-value-card' + (riskTags.includes('blocker') ? ' story-value-card--tap-nudge' : '') + '" data-parent-key="' + escapeHtml(storyKey) + '"';
    if (riskTags.length) cardHtml += ' data-risk-tags="' + escapeHtml(riskTags.join(' ')) + '"';
    if (riskTags.includes('blocker')) {
      cardHtml += ' tabindex="0" role="button" data-blocker-nudge="' + escapeHtml(storyKey) + '"';
    }
    cardHtml += '>';
    cardHtml += '<div class="story-value-card-top">';
    cardHtml += '<div><p class="story-value-card-key">' + renderIssueKeyLink(story.issueKey || story.key, story.issueUrl) + '</p><h4>' + escapeHtml(story.summary || '-') + '</h4></div>';
    cardHtml += '<span class="story-value-tag">' + escapeHtml(deriveBusinessValueTag(story)) + '</span>';
    cardHtml += '</div>';
    cardHtml += '<p class="story-value-description">' + escapeHtml(deriveStoryDescription(story)) + '</p>';
    cardHtml += '<dl class="story-value-details">';
    cardHtml += '<div><dt>Business outcome</dt><dd>' + escapeHtml(deriveBusinessOutcome(story)) + '</dd></div>';
    cardHtml += '<div><dt>Linked KPI</dt><dd>' + escapeHtml(deriveLinkedKpi(story)) + '</dd></div>';
    cardHtml += '<div><dt>Owner</dt><dd>' + escapeHtml(story.assignee || story.reporter || 'Owner needed') + '</dd></div>';
    cardHtml += '<div><dt>Status</dt><dd>' + escapeHtml(story.status || '-') + '</dd></div>';
    cardHtml += '<div><dt>Blockers</dt><dd>' + escapeHtml(riskSummary) + '</dd></div>';
    cardHtml += '</dl>';
    cardHtml += '</article>';
    return cardHtml;
  }

  function renderStoryGroupSection(groupKey, title, copy, actionRisk = '') {
    const items = groupedStories[groupKey] || [];
    let sectionHtml = '<section class="story-group-section story-group-section-' + escapeHtml(groupKey) + '">';
    sectionHtml += '<div class="sprint-group-header"><div><p class="sprint-group-kicker">' + escapeHtml(title) + '</p><h3>' + items.length + ' stories</h3></div>';
    if (actionRisk) {
      sectionHtml += '<button type="button" class="btn btn-secondary btn-compact stories-risk-chip" data-risk-tags="' + escapeHtml(actionRisk) + '">Focus</button>';
    }
    sectionHtml += '</div>';
    sectionHtml += '<p class="sprint-group-copy">' + escapeHtml(copy) + '</p>';
    if (!items.length) {
      sectionHtml += '<div class="decision-empty-card">No stories are currently grouped here.</div>';
    } else {
      sectionHtml += '<div class="story-group-card-list">';
      items.forEach((story) => {
        sectionHtml += renderStoryValueCard(story);
      });
      sectionHtml += '</div>';
    }
    sectionHtml += '</section>';
    return sectionHtml;
  }

  html += '<section class="sprint-story-signals-row" aria-label="Value-first sprint signals">';
  const headerBarPresent = typeof document !== 'undefined'
    && document.querySelector('.current-sprint-header-bar');
  if (!headerBarPresent) {
    html += renderStorySignalCard('Delivery Progress', formatNumber(data?.summary?.percentDone ?? 0, 0, '0') + '%', 'Focus on delivered value, not raw activity.', Number(data?.summary?.percentDone || 0));
  }
  html += renderStorySignalCard('Value Delivered', valueDoneCount + '/' + groupedStories.value.length + ' value stories', 'User-facing change completed this sprint.', groupedStories.value.length > 0 ? (valueDoneCount / groupedStories.value.length) * 100 : 0);
  html += renderStorySignalCard('Spillover Tracker', spilloverCount + ' stories', spilloverPct + '% of sprint scope is still open.', spilloverPct, deriveSpilloverTone(spilloverPct));
  html += '</section>';
  html += '<section class="sprint-visibility-grid">';
  html += renderDeliveredSection();
  html += renderBlockersPanel();
  html += '</section>';
  html += '<section class="story-groups-grid" aria-label="Grouped sprint stories">';
  html += renderStoryGroupSection('value', 'Value Delivery', 'User-facing work and KPI movement that the business can recognise immediately.');
  html += renderStoryGroupSection('enabler', 'Enablers', 'Technical work that protects speed, trust, and the ability to keep delivering value.');
  html += renderStoryGroupSection('blocked', 'Blocked / At Risk', 'Stories that need intervention because ownership, flow, estimate, or blocker signals are present.', 'blocker');
  html += '</section>';

  if (dailySeries.length > 0) {
    const dayKeysSet = new Set();
    dailySeries.forEach((row) => {
      if (!row || !row.date) return;
      try {
        const key = new Date(row.date).toISOString().slice(0, 10);
        if (key) dayKeysSet.add(key);
      } catch (_) {}
    });
    const dayKeys = Array.from(dayKeysSet).sort();
    if (!isHistoricalSprint && dayKeys.length > 1) {
      html += '<div class="daily-completion-timeline" aria-label="Filter issues by completion day">';
      html += '<button type="button" class="daily-timeline-chip daily-timeline-chip-active" data-day-key="">Flow</button>';
      dayKeys.forEach((key) => {
        const label = formatDayLabel(key);
        html += '<button type="button" class="daily-timeline-chip" data-day-key="' + escapeHtml(key) + '"><span class="daily-timeline-chip-label">' + escapeHtml(label) + '</span></button>';
      });
      html += '</div>';
    }
  }

  if (stories.length > 0) {
    html += '</div>';
  }

  function renderStoryRow(row) {
    const subtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
    const parentKey = String(row.issueKey || row.key || '').toUpperCase();
    const completedDayKey = row && row.resolved ? new Date(row.resolved).toISOString().slice(0, 10) : '';
    const rowKey = String(row.issueKey || row.key || '').toUpperCase();
    const rowTags = Array.from(new Set(storyRiskTagMap.get(rowKey) || []));
    const outcomeLabels = Array.isArray(row.labels) ? row.labels : [];
    const isOutcome = isOutcomeStoryLike({ labels: outcomeLabels, epicKey: row.epicKey }) || hasOutcomeLabel(outcomeLabels);
    const parentStatus = String(row.status || '').toLowerCase();
    const parentRowClasses = ['story-parent-row', 'work-risk-parent-row'];
    if (parentStatus.includes('done')) parentRowClasses.push('story-parent-row-done');
    let rowHtml = '<tr class="' + parentRowClasses.join(' ') + '" data-parent-key="' + escapeHtml(parentKey) + '"' + (subtasks.length ? ' data-has-children="true" aria-expanded="false"' : '') + '';
    if (completedDayKey) {
      rowHtml += ' data-completed-day="' + escapeHtml(completedDayKey) + '"';
    }
    if (rowTags.length) {
      rowHtml += ' data-risk-tags="' + escapeHtml(rowTags.join(' ')) + '"';
    }
    const rowHoursInStatus = stuckHoursMap.get(rowKey) || 0;
    if (rowTags.includes('blocker')) {
      rowHtml += ' data-story-nudge="' + escapeHtml(rowKey) + '"';
      parentRowClasses.push('story-row-nudgeable');
    }
    if (rowHoursInStatus > 0) {
      rowHtml += ' data-hours-in-status="' + rowHoursInStatus + '"';
    }
    rowHtml += '>';
    rowHtml += '<td>';
    if (subtasks.length) {
      rowHtml += '<button type="button" class="story-row-toggle" aria-label="Expand subtasks" aria-expanded="false" title="Show subtasks">&#9654;</button>';
    } else {
      rowHtml += '<span class="story-row-toggle story-row-toggle-placeholder" aria-hidden="true"></span>';
    }
    rowHtml += renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</td>';
    rowHtml += '<td title="' + escapeHtml(row.issueType || '-') + '">' + escapeHtml(row.issueType || '-') + '</td>';
    rowHtml += '<td class="cell-wrap story-summary-cell">' + escapeHtml(row.summary || '-');
    if (isOutcome) {
      rowHtml += '<span class="story-row-flag story-row-flag-icon" title="Outcome-linked work" aria-label="Outcome-linked work">O</span>';
    }
    rowHtml += '</td>';
    rowHtml += '<td class="story-status-cell">' + escapeHtml(row.status || '-') + '</td>';
    rowHtml += '<td class="story-reporter-cell">' + escapeHtml(row.reporter || '-') + '</td>';
    rowHtml += '<td class="story-assignee-cell">' + escapeHtml(row.assignee || '-') + '</td>';
    rowHtml += '<td>' + formatNumber(row.storyPoints ?? 0, 1, '-') + '</td>';
    rowHtml += '<td>' + formatNumber(row.subtaskEstimateHours ?? 0, 1, '-') + '</td>';
    rowHtml += '<td class="story-logged-cell">' + formatNumber(row.subtaskLoggedHours ?? 0, 1, '-') + '</td>';
    rowHtml += '<td>' + escapeHtml(formatDate(row.created)) + '</td>';
    rowHtml += '<td class="story-resolved-cell">' + escapeHtml(formatDate(row.resolved)) + '</td>';
    rowHtml += '<td class="story-risks-cell">';
    if (rowTags.length) {
      const labels = rowTags.map((tag) => tag === 'blocker'
        ? 'Blocker'
        : (tag === 'scope'
          ? 'Scope'
          : (tag === 'unassigned'
            ? 'Unowned'
            : (tag === 'no-log' ? 'No log' : (tag === 'missing-estimate' ? 'No estimate' : tag)))));
      const compactLabel = labels.length === 1 ? labels[0] : (labels.length + ' risks');
      rowHtml += '<span class="story-risk-pill story-risk-pill-compact" title="' + escapeHtml(labels.join(', ')) + '">' + escapeHtml(compactLabel) + '</span>';
    } else {
      rowHtml += '<span class="story-risk-pill-empty" aria-hidden="true"></span><span class="visually-hidden">No risk flags</span>';
    }
    rowHtml += '</td>';
    rowHtml += '</tr>';
    return rowHtml;
  }

  function renderSubtaskRows(row) {
    const subtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
    if (!subtasks.length) return '';
    let rowsHtml = '';
    const parentRowKey = String(row.issueKey || row.key || '').toUpperCase();
    for (const child of subtasks) {
      const owner = child.assignee || row.assignee || row.reporter || '-';
      const parentKey = child.parentIssueKey || row.issueKey || row.key || '-';
      const est = Number(child.estimateHours || 0);
      const log = Number(child.loggedHours || 0);
      const done = String(child.status || '').toLowerCase().includes('done');
      const rowFlags = [];
      if (est > 0 && !(log > 0)) rowFlags.push('flag-est-no-log');
      if (!(est > 0) && log > 0) rowFlags.push('flag-log-no-est');
      if (est > 0 && log > est) rowFlags.push('flag-overrun');
      if (done && !(log > 0)) rowFlags.push('flag-done-no-log');
      const flagBadges = [];
      if (est > 0 && !(log > 0)) flagBadges.push('Estimated, no log');
      if (!(est > 0) && log > 0) flagBadges.push('Logged, no estimate');
      if (est > 0 && log > est) flagBadges.push('Overrun');
      if (done && !(log > 0)) flagBadges.push('Done, no log');
      const completedDayKey = row && row.resolved ? new Date(row.resolved).toISOString().slice(0, 10) : '';
      const baseClasses = ['subtask-child-row'].concat(rowFlags).filter(Boolean).join(' ');
      const childTags = [];
      if (blockerKeys.has(String(parentKey).toUpperCase()) || blockerKeys.has(String(child.issueKey || '').toUpperCase())) childTags.push('blocker');
      if (scopeKeys.has(String(parentKey).toUpperCase())) childTags.push('scope');
      if (est > 0 && !(log > 0)) childTags.push('no-log');
      if (!(est > 0) && log > 0) childTags.push('missing-estimate');
      if (unownedOutcomeKeys.has(String(parentKey).toUpperCase())) childTags.push('unassigned');
      rowsHtml += '<tr class="' + baseClasses + '" data-parent-key="' + escapeHtml(parentRowKey) + '" hidden';
      if (completedDayKey) {
        rowsHtml += ' data-completed-day="' + escapeHtml(completedDayKey) + '"';
      }
      if (childTags.length) {
        rowsHtml += ' data-risk-tags="' + escapeHtml(Array.from(new Set(childTags)).join(' ')) + '"';
      }
      rowsHtml += '>';
      rowsHtml += '<td class="subtask-child-issue"><span class="subtask-parent-context" title="Parent issue">' + escapeHtml(parentKey) + '</span>' + renderIssueKeyLink(child.issueKey || '-', child.issueUrl) + '</td>';
      rowsHtml += '<td>' + escapeHtml(child.issueType || 'Sub-task') + '</td>';
      rowsHtml += '<td class="cell-wrap subtask-child-summary story-summary-cell">' + escapeHtml(child.summary || '-');
      if (flagBadges.length > 0) {
        rowsHtml += '<div class="subtask-row-flags">' + flagBadges.map((f) => '<span class="subtask-row-flag">' + escapeHtml(f) + '</span>').join('') + '</div>';
      }
      rowsHtml += '</td>';
      rowsHtml += '<td class="story-status-cell">' + escapeHtml(child.status || '-') + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td class="story-assignee-cell">' + escapeHtml(owner) + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td>' + formatNumber(child.estimateHours ?? 0, 1, '-') + '</td>';
      rowsHtml += '<td class="story-logged-cell">' + formatNumber(child.loggedHours ?? 0, 1, '-') + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td class="story-resolved-cell">-</td>';
      rowsHtml += '<td class="story-risks-cell">-</td>';
      rowsHtml += '</tr>';
    }
    return rowsHtml;
  }

  function renderStoryMobileCard(row) {
    const subtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
    const parentKey = String(row.issueKey || row.key || '').toUpperCase();
    const completedDayKey = row && row.resolved ? new Date(row.resolved).toISOString().slice(0, 10) : '';
    const rowKey = String(row.issueKey || row.key || '').toUpperCase();
    const rowTags = Array.from(new Set(storyRiskTagMap.get(rowKey) || []));
    const outcomeLabels = Array.isArray(row.labels) ? row.labels : [];
    const isOutcome = isOutcomeStoryLike({ labels: outcomeLabels, epicKey: row.epicKey }) || hasOutcomeLabel(outcomeLabels);
    const status = String(row.status || '-');
    const assignee = String(row.assignee || '-');
    const sp = formatNumber(row.storyPoints ?? 0, 1, '-');
    const est = formatNumber(row.subtaskEstimateHours ?? 0, 1, '-');
    const log = formatNumber(row.subtaskLoggedHours ?? 0, 1, '-');
    let htmlCard = '<article class="story-mobile-card" data-parent-key="' + escapeHtml(parentKey) + '"';
    if (completedDayKey) {
      htmlCard += ' data-completed-day="' + escapeHtml(completedDayKey) + '"';
    }
    if (rowTags.length) {
      htmlCard += ' data-risk-tags="' + escapeHtml(rowTags.join(' ')) + '"';
    }
    htmlCard += '>';
    htmlCard += '<button type="button" class="story-mobile-main" aria-expanded="false">';
    htmlCard += '<div class="story-mobile-head">';
    htmlCard += '<span class="story-mobile-key">' + renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</span>';
    htmlCard += '<span class="story-mobile-status">' + escapeHtml(status) + '</span>';
    htmlCard += '</div>';
    htmlCard += '<p class="story-mobile-summary">' + escapeHtml(row.summary || '-') + (isOutcome ? '<span class="story-row-flag story-row-flag-icon" title="Outcome-linked work" aria-label="Outcome-linked work">O</span>' : '') + '</p>';
    htmlCard += '<div class="story-mobile-meta"><span>' + escapeHtml(assignee) + '</span><span>SP ' + sp + '</span><span>Log/Est ' + log + 'h/' + est + 'h</span></div>';
    if (rowTags.length) {
      const labels = rowTags.map((tag) => tag === 'blocker'
        ? 'Blocker'
        : (tag === 'scope'
          ? 'Scope'
          : (tag === 'unassigned'
            ? 'Unowned'
            : (tag === 'no-log' ? 'No log' : (tag === 'missing-estimate' ? 'No est' : tag)))));
      htmlCard += '<div class="story-mobile-risk-chips">';
      htmlCard += '<span class="story-risk-pill story-risk-pill-compact" title="' + escapeHtml(labels.join(', ')) + '">' + escapeHtml(labels.length === 1 ? labels[0] : (labels.length + ' risks')) + '</span>';
      htmlCard += '</div>';
    }
    htmlCard += '</button>';
    htmlCard += '<div class="story-mobile-expand" hidden>';
    htmlCard += '<div class="story-mobile-detail-grid">';
    htmlCard += '<span><strong>Type:</strong> ' + escapeHtml(row.issueType || '-') + '</span>';
    htmlCard += '<span><strong>Reporter:</strong> ' + escapeHtml(row.reporter || '-') + '</span>';
    htmlCard += '<span><strong>Created:</strong> ' + escapeHtml(formatDate(row.created)) + '</span>';
    htmlCard += '<span><strong>Resolved:</strong> ' + escapeHtml(formatDate(row.resolved)) + '</span>';
    htmlCard += '</div>';
    if (subtasks.length) {
      htmlCard += '<ul class="story-mobile-subtasks">';
      for (const child of subtasks) {
        htmlCard += '<li>';
        htmlCard += '<span class="story-mobile-subtask-key">' + renderIssueKeyLink(child.issueKey || '-', child.issueUrl) + '</span>';
        htmlCard += '<span class="story-mobile-subtask-status">' + escapeHtml(child.status || '-') + '</span>';
        htmlCard += '<span class="story-mobile-subtask-hours">' + formatNumber(child.loggedHours ?? 0, 1, '-') + 'h / ' + formatNumber(child.estimateHours ?? 0, 1, '-') + 'h</span>';
        htmlCard += '</li>';
      }
      htmlCard += '</ul>';
    }
    htmlCard += '</div>';
    htmlCard += '</article>';
    return htmlCard;
  }

  if (!stories.length) {
    html += renderEmptyStateHtml('No work items', 'No work items in this sprint.', '');
  } else {
    html += '<details class="sprint-evidence-drawer" open>';
    html += '<summary class="sprint-evidence-summary">Open Jira evidence and work table</summary>';
    // Prevent rendering all rows to avoid large initial DOM
    const largeBoardMode = stories.length >= 18;
    const initialLimit = largeBoardMode
      ? resolveResponsiveRowLimit(8, 5)
      : resolveResponsiveRowLimit(10, 6);
    const toShow = stories.slice(0, initialLimit);
    const remaining = stories.slice(initialLimit);

    if (largeBoardMode) {
      html += '<p class="meta-row"><small>Large sprint. Highest-signal work first.</small></p>';
    }

    html += '<div class="data-table-scroll-wrap stories-table-scroll-wrap' + (largeBoardMode ? ' stories-table-scroll-wrap-compact' : '') + '" id="work-risks-table">';
    html += '<table class="data-table" id="stories-table"><thead><tr>'
      + '<th scope="col" title="Issue key and expand subtasks">Issue</th>'
      + '<th scope="col">Type</th>'
      + '<th scope="col" class="cell-wrap">Summary</th>'
      + '<th scope="col">Status</th>'
      + '<th scope="col">Reporter</th>'
      + '<th scope="col">Assignee</th>'
      + '<th scope="col" title="Parent story points">SP</th>'
      + '<th scope="col" title="Sum of subtask estimated hours">Est Hrs</th>'
      + '<th scope="col" title="Sum of subtask logged hours">Logged Hrs</th>'
      + '<th scope="col">Created</th>'
      + '<th scope="col">Resolved</th>'
      + '<th scope="col" title="Risk tags for this story">Risks</th>'
      + '</tr></thead><tbody>';
    for (const row of toShow) {
      html += renderStoryRow(row);
      html += renderSubtaskRows(row);
    }
    html += '</tbody></table>';
    html += '</div>';
    html += '</div>';
    html += '<div class="stories-mobile-card-list" id="stories-mobile-card-list">';
    for (const row of toShow) {
      html += renderStoryMobileCard(row);
    }
    html += '</div>';

    if (remaining.length > 0) {
      html += '<button class="btn btn-secondary btn-compact stories-show-more" data-count="' + remaining.length + '">' + (largeBoardMode ? 'Load ' : 'Show ') + remaining.length + ' more</button>';
      html += '<template id="stories-more-template">';
      for (const row of remaining) {
        html += renderStoryRow(row);
        html += renderSubtaskRows(row);
      }
      html += '</template>';
      html += '<template id="stories-mobile-more-template">';
      for (const row of remaining) {
        html += renderStoryMobileCard(row);
      }
      html += '</template>';
    }
    html += '</details>';
  }
  html += '</div>';
  return html;
}