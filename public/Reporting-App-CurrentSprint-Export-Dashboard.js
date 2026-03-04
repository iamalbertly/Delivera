/**
 * Export Dashboard Component
 * Copy as Text, Markdown, PNG snapshot, Share URL, Email options
 */
import { formatDate } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { exportRisksInsightsAsMarkdown } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { setActionErrorOnEl } from './Reporting-App-Shared-Status-Helpers.js';
import { buildReportRangeLabel } from './Reporting-App-Shared-Context-From-Storage.js';
import { getUnifiedRiskCounts } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';

const SUMMARY_SECTION_KEYS = [
  'summary',
  'flowLogging',
  'blockers',
  'notStarted',
  'scope',
  'workBreakdown',
  'actions',
];

function createEmptySummaryModel() {
  const sections = {};
  SUMMARY_SECTION_KEYS.forEach((key) => {
    sections[key] = [];
  });
  return {
    sections,
    meta: {
      mode: 'markdownEnhanced',
    },
  };
}

function escapeHtmlText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a structured sprint summary model that can be rendered to
 * clipboard text or Markdown without duplicating logic.
 *
 * Sections: summary, flowLogging, blockers, notStarted, scope, workBreakdown, actions.
 * Each section contains ordered lines:
 * { text, isBold, isItalic, isHeading, isSeparator }.
 *
 * The builder keeps text readable when Markdown is stripped so
 * non-Markdown clients still get an intelligible narrative.
 */
export async function buildSprintSummaryModel(data, options = {}) {
  const mode = options.mode || 'markdownEnhanced';
  const model = createEmptySummaryModel();
  model.meta.mode = mode;

  const sprint = data.sprint || {};
  const board = data.board || {};
  const summary = data.summary || {};
  const days = data.daysMeta || {};
  const stuck = data.stuckCandidates || [];
  const trackingSummary = data?.subtaskTracking?.summary || {};
  const trackingRows = Array.isArray(data?.subtaskTracking?.subtasks) ? data.subtaskTracking.subtasks : [];
  const scopeChanges = data.scopeChanges || [];
  const stories = data.stories || [];
  const meta = data.meta || {};
  const excludedParents = Number(summary?.stuckExcludedParentsWithActiveSubtasks || 0);

  const doneStories = summary.doneStories || 0;
  const totalStories = summary.totalStories || 0;
  const pctDone = summary.percentDone || 0;
  const remainingDays = days.daysRemainingWorking != null
    ? days.daysRemainingWorking
    : days.daysRemainingCalendar;

  const boardName = board.name || '';
  const sprintName = sprint.name || 'Sprint';

  const { deriveSprintVerdict } = await import('./Reporting-App-CurrentSprint-Alert-Banner.js');
  const verdictInfo = deriveSprintVerdict(data);
  const verdict = verdictInfo.verdict;

  const healthLabel = verdict ? `${verdict} sprint health` : 'Sprint health';
  const topLineParts = [];
  if (sprintName) topLineParts.push(sprintName);
  if (boardName) topLineParts.push(boardName);
  topLineParts.push(healthLabel);

  let timeLeftLabel = '';
  if (remainingDays == null || remainingDays <= 0) {
    timeLeftLabel = 'Sprint ended';
  } else if (remainingDays < 1) {
    timeLeftLabel = '<1 day left';
  } else {
    timeLeftLabel = `${remainingDays} day${remainingDays === 1 ? '' : 's'} left`;
  }

  const startLabel = formatDate(sprint.startDate) || '?';
  const endLabel = formatDate(sprint.endDate) || '?';
  let dateRangeLabel = '';
  if (startLabel && endLabel && startLabel !== '?' && endLabel !== '?') {
    dateRangeLabel = `${startLabel}–${endLabel}`;
  } else if (startLabel && startLabel !== '?') {
    dateRangeLabel = `Starts ${startLabel}`;
  } else if (endLabel && endLabel !== '?') {
    dateRangeLabel = `Ends ${endLabel}`;
  }

  const estHrs = trackingSummary.totalEstimateHours || 0;
  const logHrs = trackingSummary.totalLoggedHours || 0;
  const remainHrs = trackingSummary.totalRemainingHours || 0;
  const recentSubtaskMovement = trackingRows.filter((r) => Number(r?.hoursInStatus) >= 0 && Number(r?.hoursInStatus) < 24).length;
  const parentKeysWithRecentMovement = new Set(
    trackingRows
      .filter((r) => Number(r?.hoursInStatus) >= 0 && Number(r?.hoursInStatus) < 24)
      .map((r) => r.parentKey)
      .filter(Boolean),
  ).size;

  let movementLoggingLine = '';
  if (trackingRows.length === 0 && estHrs === 0 && logHrs === 0) {
    movementLoggingLine = 'No recent activity or time logging captured for this sprint yet.';
  } else if (recentSubtaskMovement > 0 && estHrs > 0 && logHrs === 0) {
    movementLoggingLine = `Flow is moving (${recentSubtaskMovement} subtasks changed) but 0h of ${estHrs}h estimated is logged.`;
  } else if (recentSubtaskMovement > 0 && estHrs === 0 && logHrs === 0) {
    movementLoggingLine = `Recent activity on ${recentSubtaskMovement} subtasks; no estimates or time logs captured yet.`;
  } else if (recentSubtaskMovement === 0 && estHrs > 0 && logHrs === estHrs && estHrs > 0) {
    movementLoggingLine = 'Time is fully logged on estimated work, but no issues have moved in the last 24 hours.';
  } else if (recentSubtaskMovement === 0 && estHrs > 0) {
    movementLoggingLine = `No issues moved in the last 24 hours; ${logHrs}h of ${estHrs}h estimated is logged.`;
  } else if (estHrs > 0 || logHrs > 0 || recentSubtaskMovement > 0) {
    const logPct = estHrs > 0 ? Math.round((logHrs / estHrs) * 100) : 0;
    movementLoggingLine = `Recent activity on ${recentSubtaskMovement}/${trackingRows.length || 0} subtasks; ${logHrs}h logged of ${estHrs}h estimated (${logPct}%).`;
  } else {
    movementLoggingLine = 'Sprint signals are not yet available (no movement or logging data).';
  }

  const inProgressStuck = stuck.filter((s) => {
    const st = (s && s.status || '').toLowerCase();
    return st !== 'to do' && st !== 'open' && st !== 'backlog';
  });
  const notStartedStuck = stuck.filter((s) => {
    const st = (s && s.status || '').toLowerCase();
    return st === 'to do' || st === 'open' || st === 'backlog';
  });

  const unifiedRiskCounts = getUnifiedRiskCounts(data);
  const blockersCount = Number(unifiedRiskCounts.blockersOwned || inProgressStuck.length || 0);
  const notStartedCount = notStartedStuck.length;
  const unassignedStories = Array.from({ length: Number(unifiedRiskCounts.unownedOutcomes || 0) });

  const riskParts = [];
  riskParts.push(`${blockersCount} blocker${blockersCount === 1 ? '' : 's'}`);
  if (notStartedCount > 0) riskParts.push(`${notStartedCount} not started`);
  if (unassignedStories.length > 0) {
    riskParts.push(`${unassignedStories.length} key stor${unassignedStories.length === 1 ? 'y' : 'ies'} unowned`);
  }
  if (scopeChanges.length > 0) riskParts.push(`Scope +${scopeChanges.length} mid-sprint`);
  const riskSnapshotText = riskParts.join(' · ') || 'No major risks detected.';

  const summarySection = model.sections.summary;
  if (totalStories === 0 && !dateRangeLabel) {
    summarySection.push({
      text: topLineParts.join(' · '),
      isHeading: true,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
    summarySection.push({
      text: 'No active sprint data yet for this board.',
      isHeading: false,
      isBold: false,
      isItalic: false,
      isSeparator: false,
    });
  } else {
    summarySection.push({
      text: topLineParts.join(' · '),
      isHeading: true,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
    summarySection.push({
      text: `${pctDone}% complete · ${doneStories} of ${totalStories} stories done · ${timeLeftLabel}${dateRangeLabel ? ` (${dateRangeLabel})` : ''}`,
      isHeading: false,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
  }

  summarySection.push({
    text: `Flow & logging: ${movementLoggingLine}`,
    isHeading: false,
    isBold: false,
    isItalic: false,
    isSeparator: false,
  });

  summarySection.push({
    text: `Risk snapshot: ${riskSnapshotText}`,
    isHeading: false,
    isBold: false,
    isItalic: false,
    isSeparator: false,
  });

  summarySection.push({
    text: '--- More detail below ---',
    isHeading: false,
    isBold: false,
    isItalic: false,
    isSeparator: true,
  });

  const flowSection = model.sections.flowLogging;
  if (trackingRows.length > 0 || estHrs > 0 || logHrs > 0) {
    flowSection.push({
      text: 'RECENT ACTIVITY & TIME LOGGING',
      isHeading: true,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
    if (trackingRows.length > 0) {
      let lineText = `Recent subtask activity: ${recentSubtaskMovement}/${trackingRows.length} subtasks moved in the last 24h`;
      if (parentKeysWithRecentMovement > 0) {
        lineText += ` (${parentKeysWithRecentMovement} parent stor${parentKeysWithRecentMovement === 1 ? 'y' : 'ies'} moving)`;
      }
      flowSection.push({
        text: `- ${lineText}.`,
        isHeading: false,
        isBold: false,
        isItalic: false,
        isSeparator: false,
      });
    }
    if (estHrs > 0 || logHrs > 0) {
      const logPct = estHrs > 0 ? Math.round((logHrs / estHrs) * 100) : 0;
      const noLogFlag = logHrs === 0 && estHrs > 0 ? ' No time has been logged against estimated work.' : '';
      const noEstimatesFlag = estHrs === 0 && logHrs > 0 ? ' Time is logged but estimates are missing.' : '';
      flowSection.push({
        text: `- Time logging: ${logHrs}h logged / ${estHrs}h estimated (${logPct}%).${noLogFlag}${noEstimatesFlag}`,
        isHeading: false,
        isBold: false,
        isItalic: false,
        isSeparator: false,
      });
      if (remainHrs > 0) {
        flowSection.push({
          text: `- Remaining estimate: ${remainHrs}h.`,
          isHeading: false,
          isBold: false,
          isItalic: false,
          isSeparator: false,
        });
      }
    }
    if (trackingRows.length > 0 && estHrs === 0 && logHrs === 0) {
      flowSection.push({
        text: '- Interpretation: movement is happening, but no estimates or worklogs are captured yet.',
        isHeading: false,
        isBold: false,
        isItalic: false,
        isSeparator: false,
      });
    }
  }

  const blockersSection = model.sections.blockers;
  if (inProgressStuck.length > 0) {
    blockersSection.push({
      text: `Blockers (${inProgressStuck.length})`,
      isHeading: true,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
    blockersSection.push({
      text: 'In-progress items stuck >24h with stale status movement:',
      isHeading: false,
      isBold: false,
      isItalic: false,
      isSeparator: false,
    });
    const byAssignee = new Map();
    inProgressStuck.forEach((item) => {
      const assignee = (item && item.assignee) || 'Unassigned';
      if (!byAssignee.has(assignee)) byAssignee.set(assignee, []);
      byAssignee.get(assignee).push(item);
    });
    for (const [assignee, items] of byAssignee) {
      blockersSection.push({
        text: `${assignee}:`,
        isHeading: false,
        isBold: false,
        isItalic: false,
        isSeparator: false,
      });
      items.forEach((item) => {
        const key = (item && (item.issueKey || item.key)) || '?';
        const hrs = (item && item.hoursInStatus) != null ? `${Math.round(item.hoursInStatus)}h` : '';
        blockersSection.push({
          text: `- ${key} - ${(item && item.summary) || '?'}${hrs ? ` [${hrs}]` : ''}`,
          isHeading: false,
          isBold: false,
          isItalic: false,
          isSeparator: false,
        });
      });
    }
  }

  const notStartedSection = model.sections.notStarted;
  if (notStartedStuck.length > 0) {
    notStartedSection.push({
      text: `Not started (${notStartedStuck.length})`,
      isHeading: true,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
    const maxNotStartedExamples = 5;
    const head = notStartedStuck.slice(0, maxNotStartedExamples);
    head.forEach((item) => {
      const key = (item && (item.issueKey || item.key)) || '?';
      const owner = (item && item.assignee) || 'Unassigned';
      notStartedSection.push({
        text: `- ${key} - ${(item && item.summary) || '?'} [${owner}]`,
        isHeading: false,
        isBold: false,
        isItalic: false,
        isSeparator: false,
      });
    });
    if (notStartedStuck.length > maxNotStartedExamples) {
      const remaining = notStartedStuck.length - maxNotStartedExamples;
      notStartedSection.push({
        text: `- +${remaining} more not started…`,
        isHeading: false,
        isBold: false,
        isItalic: false,
        isSeparator: false,
      });
    }
  }

  const scopeSection = model.sections.scope;
  if (scopeChanges.length > 0) {
    const scopeSP = scopeChanges.reduce((sum, r) => sum + (Number(r.storyPoints) || 0), 0);
    const scopeByType = new Map();
    scopeChanges.forEach((r) => {
      const t = r.classification || 'other';
      scopeByType.set(t, (scopeByType.get(t) || 0) + 1);
    });
    const scopeTypeStr = [...scopeByType.entries()].map(([t, c]) => `${c} ${t}`).join(', ');
    scopeSection.push({
      text: 'Scope added mid-sprint',
      isHeading: true,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
    scopeSection.push({
      text: `+${scopeChanges.length} items added mid-sprint (${scopeTypeStr})${scopeSP > 0 ? ` +${scopeSP} SP` : ''}`,
      isHeading: false,
      isBold: false,
      isItalic: false,
      isSeparator: false,
    });
  }

  const workSection = model.sections.workBreakdown;
  const storiesWithSubtasks = stories.filter((s) => Array.isArray(s.subtasks) && s.subtasks.length > 0);
  if (storiesWithSubtasks.length > 0) {
    workSection.push({
      text: `Work breakdown (${storiesWithSubtasks.length} stories with subtasks)`,
      isHeading: true,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
    storiesWithSubtasks.forEach((s) => {
      const subs = s.subtasks || [];
      const subDone = subs.filter((st) => (st.status || '').toLowerCase().includes('done')).length;
      const subEst = subs.reduce((sum, st) => sum + (st.estimateHours || 0), 0);
      const subLog = subs.reduce((sum, st) => sum + (st.loggedHours || 0), 0);
      let line = `${s.issueKey} (${s.assignee || 'Unassigned'}): ${subDone}/${subs.length} subtasks done`;
      if (subEst > 0 || subLog > 0) line += ` | ${subLog}h/${subEst}h`;
      workSection.push({
        text: line,
        isHeading: false,
        isBold: false,
        isItalic: false,
        isSeparator: false,
      });
    });
  }

  const actionsSection = model.sections.actions;
  const actions = [];
  if (logHrs === 0 && estHrs > 0) actions.push(`Log actual work - ${estHrs}h estimated but 0h captured in timetracking (use a standard Jira nudge template instead of ad-hoc reminders).`);
  if (recentSubtaskMovement > 0 && logHrs === 0) actions.push(`Flow is moving (${recentSubtaskMovement} subtasks changed <24h) but logs are missing; send one shared Jira update nudge.`);
  if (inProgressStuck.length > 0) actions.push(`Unblock ${inProgressStuck.length} stuck item${inProgressStuck.length > 1 ? 's' : ''}.`);
  if (notStartedStuck.length > 0) actions.push(`Start ${notStartedStuck.length} item${notStartedStuck.length > 1 ? 's' : ''} still in To Do.`);
  if (excludedParents > 0) {
    actions.push(`${excludedParents} parent stor${excludedParents === 1 ? 'y' : 'ies'} flowing via subtasks (not counted as stuck).`);
  }
  if (unassignedStories.length > 0) {
    actions.push(`Resolve ownership signal for ${unassignedStories.length} unowned outcome${unassignedStories.length > 1 ? 's' : ''} (assignee, active subtask owner, or reporter).`);
  }
  if (pctDone < 30 && remainingDays != null && remainingDays < 5) {
    actions.push('Velocity behind - consider scope cut.');
  }
  if (actions.length > 0) {
    actionsSection.push({
      text: 'ACTION NEEDED:',
      isHeading: true,
      isBold: true,
      isItalic: false,
      isSeparator: false,
    });
    actions.forEach((a, idx) => {
      actionsSection.push({
        text: `${idx + 1}. ${a}`,
        isHeading: false,
        isBold: false,
        isItalic: false,
        isSeparator: false,
      });
    });
  }

  model.meta = {
    ...model.meta,
    sprintName,
    boardName,
    verdict,
    dateRangeLabel,
    doneStories,
    totalStories,
    pctDone,
    remainingDays,
    meta,
  };

  return model;
}

function renderSummaryModelToClipboard(model, options = {}) {
  const mode = options.mode || model.meta.mode || 'markdownEnhanced';
  const linesOut = [];

  const summary = model.sections.summary || [];
  summary.forEach((line, index) => {
    if (line.isSeparator) {
      // Avoid duplicate "More detail below" lines in clipboard output.
      return;
    }
    let rendered = line.text;
    if (mode === 'markdownEnhanced') {
      if (index === 0) {
        rendered = `**${line.text}**`;
      } else if (index === 1) {
        const parts = line.text.split(' · ');
        const first = parts.shift() || '';
        const rest = parts.join(' · ');
        rendered = `**${first}**${rest ? ` · ${rest}` : ''}`;
      } else if (index === 2 || index === 3) {
        const colonIdx = line.text.indexOf(':');
        if (colonIdx !== -1) {
          const label = line.text.slice(0, colonIdx);
          const body = line.text.slice(colonIdx + 1).trimStart();
          rendered = `**${label}:** ${body}`;
        }
      }
    }
    linesOut.push(rendered);
  });

  linesOut.push('');

  const order = ['flowLogging', 'blockers', 'notStarted', 'scope', 'workBreakdown', 'actions'];
  let emittedDetailsIntro = false;
  order.forEach((sectionKey, idx) => {
    const section = model.sections[sectionKey] || [];
    if (!section.length) return;
    if (!emittedDetailsIntro) {
      linesOut.push(mode === 'markdownEnhanced' ? '--- More detail below ---' : 'More detail below');
      linesOut.push('');
      emittedDetailsIntro = true;
    } else {
      linesOut.push(mode === 'markdownEnhanced' ? '---' : '');
      linesOut.push('');
    }
    section.forEach((line) => {
      if (line.isSeparator) {
        linesOut.push(line.text);
        return;
      }
      let rendered = line.text;
      if (mode === 'markdownEnhanced' && line.isHeading) {
        rendered = `**${line.text}**`;
      }
      linesOut.push(rendered);
    });
    linesOut.push('');
  });

  return linesOut.join('\n').trimEnd();
}

function renderSummaryModelToClipboardHtml(model) {
  const sectionTitleMap = {
    flowLogging: 'Recent Activity & Time Logging',
    blockers: 'Blockers',
    notStarted: 'Not started',
    scope: 'Scope added mid-sprint',
    workBreakdown: 'Work breakdown',
    actions: 'Action needed',
  };
  let html = '<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.4;color:#142334;max-width:760px">';
  const summary = model.sections.summary || [];
  const summaryLines = summary.filter((line) => !line.isSeparator);
  if (summaryLines[0]) html += '<div style="font-size:16px;font-weight:700;margin:0 0 6px">' + escapeHtmlText(summaryLines[0].text) + '</div>';
  if (summaryLines[1]) html += '<div style="margin:0 0 6px"><strong>' + escapeHtmlText(summaryLines[1].text) + '</strong></div>';
  summaryLines.slice(2).forEach((line) => {
    const colonIdx = line.text.indexOf(':');
    if (colonIdx > 0) {
      html += '<div style="margin:0 0 4px"><strong>' + escapeHtmlText(line.text.slice(0, colonIdx + 1)) + '</strong> ' + escapeHtmlText(line.text.slice(colonIdx + 1).trimStart()) + '</div>';
    } else {
      html += '<div style="margin:0 0 4px">' + escapeHtmlText(line.text) + '</div>';
    }
  });

  const order = ['flowLogging', 'blockers', 'notStarted', 'scope', 'workBreakdown', 'actions'];
  let hasAnySection = false;
  order.forEach((sectionKey) => {
    const section = model.sections[sectionKey] || [];
    if (!section.length) return;
    hasAnySection = true;
    html += '<hr style="border:none;border-top:1px solid #cfdae8;margin:10px 0">';
    html += '<div style="font-weight:700;margin:0 0 6px;text-decoration:underline">' + escapeHtmlText(sectionTitleMap[sectionKey] || sectionKey) + '</div>';
    html += '<div>';
    section.forEach((line) => {
      if (line.isSeparator) return;
      if (line.isHeading) {
        html += '<div style="font-weight:700;margin:0 0 4px">' + escapeHtmlText(line.text) + '</div>';
      } else if (/^\d+\.\s/.test(line.text)) {
        html += '<div style="margin:0 0 4px">' + escapeHtmlText(line.text) + '</div>';
      } else {
        html += '<div style="margin:0 0 4px">' + escapeHtmlText(line.text) + '</div>';
      }
    });
    html += '</div>';
  });
  if (!hasAnySection) {
    html += '<div style="margin-top:8px;color:#5a6b7f">No additional details.</div>';
  }
  html += '</div>';
  return html;
}

function renderSummaryModelToMarkdown(model, data) {
  const {
    sprintName,
    pctDone,
    doneStories,
    totalStories,
    remainingDays,
    meta,
    dateRangeLabel,
  } = model.meta;
  const metaObj = meta || {};
  const lines = [];

  const headingName = sprintName || 'Sprint';
  lines.push(`# ${headingName}`);
  lines.push('');

  const remainingLabel = remainingDays != null && remainingDays > 0 ? `${remainingDays} days left` : 'ended';
  lines.push(`> *${pctDone}% done* | ${doneStories}/${totalStories} stories | ${remainingLabel}  `);
  if (dateRangeLabel) {
    lines.push(`> ${dateRangeLabel} | Generated ${new Date().toLocaleString()}`);
  } else {
    lines.push(`> Generated ${new Date().toLocaleString()}`);
  }

  if (metaObj.generatedAt || metaObj.snapshotAt || metaObj.windowStart || metaObj.windowEnd) {
    const freshness = metaObj.generatedAt || metaObj.snapshotAt ? formatDate(metaObj.generatedAt || metaObj.snapshotAt) : '-';
    lines.push(`> Data freshness: ${freshness} | ${buildReportRangeLabel(metaObj.windowStart, metaObj.windowEnd)}`);
  }

  lines.push('');

  lines.push('## Summary');
  const summaryLines = model.sections.summary || [];
  summaryLines.slice(0, 4).forEach((line, index) => {
    if (index === 0) {
      lines.push(`- **${line.text}**`);
    } else if (index === 1) {
      const parts = line.text.split(' · ');
      const first = parts.shift() || '';
      const rest = parts.join(' · ');
      lines.push(`- **${first}**${rest ? ` · ${rest}` : ''}`);
    } else {
      lines.push(`- ${line.text}`);
    }
  });

  lines.push('');

  const sectionToMarkdown = (title, key) => {
    const section = model.sections[key] || [];
    if (!section.length) return;
    lines.push(`## ${title}`);
    lines.push('');
    section.forEach((line) => {
      if (line.isHeading) {
        lines.push(`- **${line.text}**`);
      } else {
        lines.push(`- ${line.text}`);
      }
    });
    lines.push('');
  };

  sectionToMarkdown('Flow & Logging', 'flowLogging');
  sectionToMarkdown('Blockers', 'blockers');
  sectionToMarkdown('Not started', 'notStarted');
  sectionToMarkdown('Scope changes', 'scope');
  sectionToMarkdown('Work breakdown', 'workBreakdown');
  sectionToMarkdown('Actions', 'actions');

  return `${lines.join('\n').trim()}\n\n${exportRisksInsightsAsMarkdown(data || {})}`;
}

function setLastExportStatus(actionLabel, detail) {
  const statusEl = document.querySelector('.export-dashboard-container .export-status-text');
  if (!statusEl) return;
  const ts = new Date().toLocaleTimeString();
  let compactDetail = detail ? String(detail).trim() : '';
  try {
    const snapshotBadge = document.querySelector('.current-sprint-header-bar .status-badge.status-snapshot');
    const updatedText = (document.querySelector('.current-sprint-header-bar .last-updated')?.textContent || '').trim();
    if (snapshotBadge) {
      compactDetail = compactDetail
        ? `${compactDetail} | Snapshot${updatedText ? ` (${updatedText})` : ''}`
        : `Snapshot${updatedText ? ` (${updatedText})` : ''}`;
    }
  } catch (_) {}
  const labelHtml = `<span class="export-status-label">Last action:</span> <em>${actionLabel}</em>`;
  const metaHtml = `${ts}${compactDetail ? ` · ${compactDetail}` : ''}`;
  statusEl.innerHTML = `${labelHtml} · <span class="export-status-meta">${metaHtml}</span>`;
  statusEl.setAttribute('data-last-action', actionLabel);
  statusEl.setAttribute('data-last-timestamp', ts);
  statusEl.setAttribute('data-last-detail', compactDetail);
}

try {
  if (typeof window !== 'undefined') {
    window.__setCurrentSprintLastExportStatus = setLastExportStatus;
  }
} catch (_) {}
export function renderExportButton(inline = false) {
  const containerClass = 'export-dashboard-container' + (inline ? ' header-export-inline' : '');
  let html = '<div class="' + containerClass + '">';
  html += '<span class="export-split-group">';
  html += '<button class="btn btn-secondary btn-compact export-dashboard-btn export-default-action" type="button" aria-label="Copy sprint summary" aria-live="polite">Copy summary</button>';
  if (!inline) {
    html += '<button class="btn btn-secondary btn-compact export-dashboard-secondary" type="button" aria-label="Export sprint summary as Markdown">Markdown</button>';
  }
  html += '<button class="btn btn-secondary btn-compact export-menu-toggle" type="button" aria-label="More export options" aria-haspopup="true" aria-expanded="false">&#9662;</button>';
  html += '</span>';
  html += '<div class="export-menu hidden" id="export-menu" role="menu" aria-hidden="true">';
  html += '<button class="export-option" data-action="copy-text" role="menuitem">Copy as Text</button>';
  html += '<button class="export-option" data-action="export-markdown" role="menuitem">Markdown</button>';
  html += '<button class="export-option" data-action="export-png" role="menuitem">PNG snapshot</button>';
  html += '<button class="export-option" data-action="copy-link" role="menuitem">Copy link</button>';
  html += '<button class="export-option" data-action="email" role="menuitem">Email</button>';
  html += '</div>';
  html += '<div class="export-status-text" aria-live="polite"></div>';
  html += '</div>';
  return html;
}
function setButtonStatus(btn, text, originalText, disabled = false, resetAfterMs = 2000) {
  if (!btn) return;
  btn.textContent = text;
  btn.disabled = disabled;
  if (!originalText) return;
  window.setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
  }, resetAfterMs);
}
async function writeTextToClipboardWithFallback(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', 'true');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('Clipboard copy unavailable');
}

async function writeRichClipboardWithFallback(html, text) {
  const plain = String(text || '').trim();
  const rich = String(html || '').trim();
  try {
    if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem !== 'undefined' && rich) {
      const item = new ClipboardItem({
        'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([rich], { type: 'text/html' }),
      });
      await navigator.clipboard.write([item]);
      return;
    }
  } catch (_) {}
  await writeTextToClipboardWithFallback(plain);
}
export function wireExportHandlers(data) {
  const container = document.querySelector('.export-dashboard-container');
  if (!container) return;
  if (container.dataset.wiredExportHandlers === '1') return;
  container.dataset.wiredExportHandlers = '1';
  const btn = container.querySelector('.export-dashboard-btn');
  const secondaryBtn = container.querySelector('.export-dashboard-secondary');
  const menuToggle = container.querySelector('.export-menu-toggle');
  const menu = container.querySelector('#export-menu');
  if (!menu) return;
  const effectiveBtn = btn || menuToggle;
  if (!effectiveBtn) return;
  // Primary button: direct copy-text action (1-click export)
  if (btn) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyDashboardAsText(data, btn);
    });
  }
  if (secondaryBtn) {
    secondaryBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      exportDashboardAsMarkdown(data, secondaryBtn);
    });
  }
  // Menu toggle: expand/collapse the full options menu
  if (menuToggle) {
    menuToggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      menu.classList.toggle('hidden');
      const expanded = !menu.classList.contains('hidden');
      menuToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      menu.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    });
  }
  if (!window.__currentSprintExportOutsideClickBound) {
    window.__currentSprintExportOutsideClickBound = true;
    document.addEventListener('click', (event) => {
      const activeContainer = document.querySelector('.export-dashboard-container');
      const activeMenu = activeContainer?.querySelector('#export-menu');
      const activeToggle = activeContainer?.querySelector('.export-menu-toggle');
      if (!activeContainer || !activeMenu) return;
      if (!activeContainer.contains(event.target) && !activeMenu.classList.contains('hidden')) {
        activeMenu.classList.add('hidden');
        if (activeToggle) activeToggle.setAttribute('aria-expanded', 'false');
        activeMenu.setAttribute('aria-hidden', 'true');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const activeContainer = document.querySelector('.export-dashboard-container');
      const activeMenu = activeContainer?.querySelector('#export-menu');
      const activeToggle = activeContainer?.querySelector('.export-menu-toggle');
      if (!activeMenu || activeMenu.classList.contains('hidden')) return;
      activeMenu.classList.add('hidden');
      activeMenu.setAttribute('aria-hidden', 'true');
      if (activeToggle) activeToggle.setAttribute('aria-expanded', 'false');
    });
  }
  const options = container.querySelectorAll('.export-option');
  options.forEach((option) => {
    option.addEventListener('click', () => {
      const action = option.dataset.action;
      menu.classList.add('hidden');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      if (action === 'copy-text') {
        copyDashboardAsText(data, btn || menuToggle);
      } else if (action === 'export-markdown') {
        exportDashboardAsMarkdown(data, btn || menuToggle);
      } else if (action === 'export-png') {
        exportDashboardAsPng(data, btn || menuToggle);
      } else if (action === 'copy-link') {
        copyDashboardLink(data, btn || menuToggle);
      } else if (action === 'email') {
        emailDashboard(data, btn || menuToggle);
      }
    });
  });
  if (!window.__currentSprintExportCopyTextActionBound) {
    window.__currentSprintExportCopyTextActionBound = true;
    document.addEventListener('click', (event) => {
      const actionTarget = event.target?.closest?.('[data-action="copy-export-text"]');
      if (!actionTarget) return;
      const activeContainer = document.querySelector('.export-dashboard-container');
      const activeBtn = activeContainer?.querySelector('.export-dashboard-btn')
        || activeContainer?.querySelector('.export-menu-toggle');
      copyDashboardAsText(data, activeBtn);
    });
  }
}
async function exportDashboardAsPng(data, btn) {
  const originalText = btn.textContent;
  setButtonStatus(btn, 'Rendering...', null, true, 4000);
  try {
    // Prefer header bar (compact, answers key questions) then grid layout, then fallback
    const headerBar = document.querySelector('.current-sprint-header-bar');
    const gridLayout = document.querySelector('.current-sprint-grid-layout');
    const target = headerBar || gridLayout || document.getElementById('current-sprint-content') || document.body;
    if (!target) throw new Error('Snapshot target not found');
    // Temporarily expand any collapsed sections within the target for a complete snapshot
    const collapsedDetails = target.querySelectorAll('details:not([open])');
    collapsedDetails.forEach((d) => d.setAttribute('open', ''));
    const hiddenRegions = Array.from(target.querySelectorAll('[aria-hidden="true"]'))
      .map((el) => ({ el, prev: el.getAttribute('aria-hidden') }));
    hiddenRegions.forEach(({ el }) => el.setAttribute('aria-hidden', 'false'));
    const module = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
    const html2canvas = module?.default;
    if (typeof html2canvas !== 'function') throw new Error('Snapshot renderer unavailable');
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });
    const sprint = data?.sprint || {};
    const fileName = 'sprint-summary-' + String(sprint.name || 'snapshot').replace(/[^a-zA-Z0-9-_]+/g, '-') + '.png';
    // Restore collapsed state after render
    collapsedDetails.forEach((d) => d.removeAttribute('open'));
    hiddenRegions.forEach(({ el, prev }) => {
      if (prev == null) {
        el.removeAttribute('aria-hidden');
      } else {
        el.setAttribute('aria-hidden', prev);
      }
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = fileName;
    a.click();
    setButtonStatus(btn, 'Downloaded!', originalText);
  } catch (error) {
    console.error('PNG snapshot export error:', error);
    const errorEl = document.getElementById('current-sprint-error');
    if (errorEl) {
      setActionErrorOnEl(errorEl, {
        title: 'PNG snapshot unavailable.',
        message: 'Could not render screenshot. Try copy text or markdown export.',
        primaryLabel: 'Copy as text',
        primaryAction: 'copy-export-text',
      });
    }
    setButtonStatus(btn, 'PNG failed', originalText);
  }
}
async function copyDashboardAsText(data, btn) {
  const originalText = btn?.textContent || '';
  setButtonStatus(btn, 'Copying...', null, true);
  try {
    const model = await buildSprintSummaryModel(data, { mode: 'markdownEnhanced' });
    const text = renderSummaryModelToClipboard(model, { mode: 'plain' });
    const html = renderSummaryModelToClipboardHtml(model);
    await writeRichClipboardWithFallback(html, text);
    setButtonStatus(btn, 'Copied!', originalText);
    setLastExportStatus('Share state', 'Rich text copied (HTML + plain text fallback)');
  } catch (error) {
    console.error('Copy text error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
  }
}
async function exportDashboardAsMarkdown(data, btn) {
  const originalText = btn?.textContent || '';
  setButtonStatus(btn, 'Generating...', null, true);
  try {
    const model = await buildSprintSummaryModel(data, { mode: 'markdownEnhanced' });
    const markdown = renderSummaryModelToMarkdown(model, data);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sprint-${model.meta.sprintName || 'export'}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    setButtonStatus(btn, 'Exported!', originalText);
    setLastExportStatus('Markdown', `File sprint-${model.meta.sprintName || 'export'}.md`);
  } catch (error) {
    console.error('Markdown export error:', error);
    setButtonStatus(btn, 'Export failed', originalText);
  }
}
async function copyDashboardLink(data, btn) {
  const originalText = btn?.textContent || '';
  try {
    const sprint = data.sprint || {};
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;
    const boardSelect = document.querySelector('#board-select');
    const boardId = boardSelect?.value;
    let url = baseUrl + currentPath;
    if (boardId) {
      url += '?boardId=' + encodeURIComponent(boardId) + '&sprintId=' + encodeURIComponent(String(sprint.id || ''));
    }
    await writeTextToClipboardWithFallback(url);
    setButtonStatus(btn, 'Link copied!', originalText);
    setLastExportStatus('Copy link', url);
  } catch (error) {
    console.error('Copy link error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
    setLastExportStatus('Copy link failed', 'Try Copy summary instead.');
  }
}
async function emailDashboard(data, btn) {
  const originalText = btn?.textContent || '';
  setButtonStatus(btn, 'Sending...', null, true);
  try {
    const sprint = data.sprint || {};
    const response = await fetch('/api/current-sprint/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sprintId: sprint.id,
        sprintName: sprint.name,
      }),
    });
    if (response.ok) {
      setButtonStatus(btn, 'Sent!', originalText);
      setLastExportStatus('Email', 'Sent to configured distribution');
    } else {
      setButtonStatus(btn, 'Send failed', originalText);
      setLastExportStatus('Email failed', 'Use Copy summary or Markdown export instead.');
    }
  } catch (error) {
    console.error('Email error:', error);
    setButtonStatus(btn, 'Email unavailable', originalText);
    setLastExportStatus('Email unavailable', 'Share via Copy summary or Markdown.');
  }
}
