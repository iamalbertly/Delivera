import { formatDateForDisplay, formatNumber, formatPercent } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { calculateVariance } from './Reporting-App-Report-Page-Sorting.js';

export const DELIVERY_GRADE_TOOLTIP = 'Historical delivery quality grade (on-time + predictability). Strong >=90, Solid >=80, Mixed >=65, Weak >=50. Requires at least 2 sprints.';

export function deriveDeliveryGrade(onTimePct, spEstimationPct, sprintCount) {
  if (!Number.isFinite(onTimePct) || !Number.isFinite(spEstimationPct) || (sprintCount || 0) < 2) {
    return 'Insufficient data';
  }
  const score = (onTimePct + spEstimationPct) / 2;
  if (score >= 90) return 'Strong';
  if (score >= 80) return 'Solid';
  if (score >= 65) return 'Mixed';
  if (score >= 50) return 'Weak';
  return 'Critical';
}

export function getWindowMonths(meta) {
  const start = meta?.windowStart ? new Date(meta.windowStart) : null;
  const end = meta?.windowEnd ? new Date(meta.windowEnd) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  const days = ms / (1000 * 60 * 60 * 24);
  return days / 30;
}

export function computeBoardRowFromSummary(board, summary, meta, spEnabled, hasPredictability) {
  const totalSprintDays = summary.totalSprintDays || 0;
  const avgSprintLength = summary.validSprintDaysCount > 0 ? totalSprintDays / summary.validSprintDaysCount : null;
  const doneStories = summary.doneStories || 0;
  const doneSP = summary.doneSP || 0;
  const doneBySprintEndPct = doneStories > 0 ? (summary.doneBySprintEnd / doneStories) * 100 : null;
  const storiesPerSprint = summary.sprintCount > 0 ? doneStories / summary.sprintCount : null;
  const spPerStory = spEnabled && doneStories > 0 ? doneSP / doneStories : null;
  const storiesPerSprintDay = totalSprintDays > 0 ? doneStories / totalSprintDays : null;
  const spPerSprintDay = spEnabled && totalSprintDays > 0 ? doneSP / totalSprintDays : null;
  const avgSpPerSprint = spEnabled && summary.sprintCount > 0 ? doneSP / summary.sprintCount : null;
  const spVariance = spEnabled && summary.sprintSpValues?.length ? calculateVariance(summary.sprintSpValues) : null;
  const spEstimationPct = hasPredictability && summary.committedSP > 0 ? (summary.deliveredSP / summary.committedSP) * 100 : null;
  const deliveryGrade = deriveDeliveryGrade(doneBySprintEndPct, spEstimationPct, summary.sprintCount || 0);
  const activeAssignees = summary.assignees?.size || 0;
  const storiesPerAssignee = activeAssignees > 0 ? doneStories / activeAssignees : null;
  const spPerAssignee = spEnabled && activeAssignees > 0 ? doneSP / activeAssignees : null;
  const windowMonths = getWindowMonths(meta);
  const assumedCapacity = windowMonths && activeAssignees > 0 ? activeAssignees * 18 * windowMonths : null;
  const coveredPersonDays = activeAssignees > 0 ? totalSprintDays * activeAssignees : null;
  const assumedWastePct = assumedCapacity && coveredPersonDays !== null && assumedCapacity > 0
    ? Math.max(0, ((assumedCapacity - coveredPersonDays) / assumedCapacity) * 100) : null;
  const sprintWindow = summary.earliestStart && summary.latestEnd
    ? `${formatDateForDisplay(summary.earliestStart)} to ${formatDateForDisplay(summary.latestEnd)}` : '';
  const latestEnd = summary.latestEnd ? formatDateForDisplay(summary.latestEnd) : '';
  // UX Fix #6: Replace '??-' placeholder with '—' (em-dash = intentional absence, not a system error).
  // Also: individual board N/A for Done SP gets a human-readable suffix so users know WHY it's absent.
  const idx = board.indexedDelivery;
  const indexedDeliveryStr = idx != null && idx.index != null
    ? formatNumber(idx.index, 2) + ' (vs own baseline)'
    : '—';
  return {
    'Board ID': board.id,
    'Board': board.name,
    'Type': board.type || '',
    'Projects': (board.projectKeys || []).join(', '),
    'Sprints': summary.sprintCount,
    'Sprint Days': totalSprintDays,
    'Avg Sprint Days': formatNumber(avgSprintLength),
    'Done Stories': doneStories,
    'Registered Work Hours': formatNumber(summary.registeredWorkHours ?? 0, 1, '-'),
    'Estimated Work Hours': formatNumber(summary.estimatedWorkHours ?? 0, 1, '-'),
    // UX Fix #6: Disambiguate N/A vs 0 — 'N/A' means SP tracking not configured (not zero output).
    // 'N/A (SP not tracked)' prevents leadership from reading N/A as data-error vs intentional gap.
    'Done SP': spEnabled ? doneSP : 'N/A (SP not tracked)',
    'Committed SP': formatNumber(hasPredictability ? summary.committedSP : null, 2),
    'Delivered SP': formatNumber(hasPredictability ? summary.deliveredSP : null, 2),
    'SP Estimation %': formatPercent(spEstimationPct),
    'Delivery Grade': deliveryGrade,
    'Stories / Sprint': formatNumber(storiesPerSprint),
    'SP / Story': formatNumber(spPerStory),
    'Stories / Day': formatNumber(storiesPerSprintDay),
    'SP / Day': formatNumber(spPerSprintDay),
    'SP / Sprint': formatNumber(avgSpPerSprint),
    'SP Variance': formatNumber(spVariance),
    'Indexed Delivery': indexedDeliveryStr,
    'On-Time %': formatPercent(doneBySprintEndPct),
    'Planned': summary.epicStories,
    'Ad-hoc': summary.nonEpicStories,
    'Active Assignees': activeAssignees,
    'Stories / Assignee': formatNumber(storiesPerAssignee),
    'SP / Assignee': formatNumber(spPerAssignee),
    'Assumed Capacity (PD)': formatNumber(assumedCapacity),
    'Assumed Waste %': formatPercent(assumedWastePct),
    'Sprint Window': sprintWindow,
    'Latest End': latestEnd,
  };
}

export function computeBoardsSummaryRow(boards, boardSummaries, meta, spEnabled, hasPredictability) {
  if (!boards || boards.length === 0) return null;
  const windowMonths = getWindowMonths(meta);
  let sumSprints = 0, sumSprintDays = 0, sumDoneStories = 0, sumDoneSP = 0, sumRegisteredWorkHours = 0, sumEstimatedWorkHours = 0, sumCommittedSP = 0, sumDeliveredSP = 0;
  let sumPlanned = 0, sumAdhoc = 0, sumAssignees = 0, sumCapacity = 0;
  const avgSprintDaysArr = [], storiesPerSprintArr = [], spPerStoryArr = [], storiesPerDayArr = [], spPerDayArr = [];
  const spPerSprintArr = [], onTimeArr = [], spEstimationArr = [], spVarianceArr = [], wasteArr = [];
  const storiesPerAssigneeArr = [], spPerAssigneeArr = [];
  let earliestStart = null, latestEnd = null;

  for (const board of boards) {
    const summary = boardSummaries.get(board.id) || { sprintCount: 0, doneStories: 0, doneSP: 0, registeredWorkHours: 0, estimatedWorkHours: 0, committedSP: 0, deliveredSP: 0, earliestStart: null, latestEnd: null, totalSprintDays: 0, validSprintDaysCount: 0, doneBySprintEnd: 0, sprintSpValues: [], epicStories: 0, nonEpicStories: 0, epicSP: 0, nonEpicSP: 0, assignees: new Set(), nonEpicAssignees: new Set() };
    sumSprints += summary.sprintCount || 0;
    sumSprintDays += summary.totalSprintDays || 0;
    sumDoneStories += summary.doneStories || 0;
    if (spEnabled) sumDoneSP += summary.doneSP || 0;
    sumRegisteredWorkHours += summary.registeredWorkHours ?? 0;
    sumEstimatedWorkHours += summary.estimatedWorkHours ?? 0;
    if (hasPredictability) {
      sumCommittedSP += summary.committedSP || 0;
      sumDeliveredSP += summary.deliveredSP || 0;
    }
    sumPlanned += summary.epicStories || 0;
    sumAdhoc += summary.nonEpicStories || 0;
    const activeAssignees = summary.assignees?.size || 0;
    sumAssignees += activeAssignees;

    const totalSprintDays = summary.totalSprintDays || 0;
    const avgSprintLength = summary.validSprintDaysCount > 0 ? totalSprintDays / summary.validSprintDaysCount : null;
    if (avgSprintLength !== null) avgSprintDaysArr.push(avgSprintLength);
    if (summary.sprintCount > 0) storiesPerSprintArr.push(summary.doneStories / summary.sprintCount);
    if (spEnabled && summary.doneStories > 0) spPerStoryArr.push(summary.doneSP / summary.doneStories);
    if (totalSprintDays > 0) {
      storiesPerDayArr.push(summary.doneStories / totalSprintDays);
      if (spEnabled) spPerDayArr.push(summary.doneSP / totalSprintDays);
    }
    if (spEnabled && summary.sprintCount > 0) spPerSprintArr.push(summary.doneSP / summary.sprintCount);
    if (summary.doneStories > 0) onTimeArr.push((summary.doneBySprintEnd / summary.doneStories) * 100);
    if (hasPredictability && summary.committedSP > 0) spEstimationArr.push((summary.deliveredSP / summary.committedSP) * 100);
    if (spEnabled && summary.sprintSpValues?.length) spVarianceArr.push(calculateVariance(summary.sprintSpValues));
    const assumedCapacity = windowMonths && activeAssignees > 0 ? activeAssignees * 18 * windowMonths : null;
    const coveredPersonDays = activeAssignees > 0 ? totalSprintDays * activeAssignees : null;
    const assumedWastePct = assumedCapacity && coveredPersonDays !== null && assumedCapacity > 0 ? Math.max(0, ((assumedCapacity - coveredPersonDays) / assumedCapacity) * 100) : null;
    if (assumedWastePct !== null) wasteArr.push(assumedWastePct);
    sumCapacity += assumedCapacity || 0;
    if (activeAssignees > 0) {
      storiesPerAssigneeArr.push(summary.doneStories / activeAssignees);
      if (spEnabled) spPerAssigneeArr.push(summary.doneSP / activeAssignees);
    }
    if (summary.earliestStart) {
      const d = summary.earliestStart instanceof Date ? summary.earliestStart : new Date(summary.earliestStart);
      if (!earliestStart || d < earliestStart) earliestStart = d;
    }
    if (summary.latestEnd) {
      const d = summary.latestEnd instanceof Date ? summary.latestEnd : new Date(summary.latestEnd);
      if (!latestEnd || d > latestEnd) latestEnd = d;
    }
  }

  const avg = (arr) => (arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length);
  // UX Fix #6: All '??-' placeholders replaced with '—' (em-dash) for intentional-absence signalling.
  // 'Projects: Multiple' replaces '??-' on the All Boards comparison row — it's accurate AND readable.
  const sprintWindow = earliestStart && latestEnd ? `${formatDateForDisplay(earliestStart)} to ${formatDateForDisplay(latestEnd)}` : '—';
  const latestEndStr = latestEnd ? formatDateForDisplay(latestEnd) : '—';
  const avgOnTime = avg(onTimeArr);
  const avgSpEstimation = avg(spEstimationArr);
  const deliveryGrade = deriveDeliveryGrade(avgOnTime, avgSpEstimation, sumSprints);

  return {
    'Board ID': '—',
    'Board': 'Total',
    'Type': '—',
    'Projects': 'Multiple',
    'Sprints': sumSprints,
    'Sprint Days': sumSprintDays,
    'Avg Sprint Days': formatNumber(avg(avgSprintDaysArr)),
    'Done Stories': sumDoneStories,
    'Registered Work Hours': formatNumber(sumRegisteredWorkHours, 1, '-'),
    'Estimated Work Hours': formatNumber(sumEstimatedWorkHours, 1, '-'),
    'Done SP': spEnabled ? sumDoneSP : 'N/A',
    'Committed SP': formatNumber(hasPredictability ? sumCommittedSP : null, 2),
    'Delivered SP': formatNumber(hasPredictability ? sumDeliveredSP : null, 2),
    'SP Estimation %': formatPercent(avg(spEstimationArr)),
    'Delivery Grade': deliveryGrade,
    'Stories / Sprint': formatNumber(avg(storiesPerSprintArr)),
    'SP / Story': formatNumber(avg(spPerStoryArr)),
    'Stories / Day': formatNumber(avg(storiesPerDayArr)),
    'SP / Day': formatNumber(avg(spPerDayArr)),
    'SP / Sprint': formatNumber(avg(spPerSprintArr)),
    'SP Variance': formatNumber(avg(spVarianceArr)),
    'Indexed Delivery': '—',
    'On-Time %': formatPercent(avg(onTimeArr)),
    'Planned': sumPlanned,
    'Ad-hoc': sumAdhoc,
    'Active Assignees': sumAssignees,
    'Stories / Assignee': formatNumber(avg(storiesPerAssigneeArr)),
    'SP / Assignee': formatNumber(avg(spPerAssigneeArr)),
    'Assumed Capacity (PD)': formatNumber(sumCapacity),
    'Assumed Waste %': formatPercent(avg(wasteArr)),
    'Sprint Window': sprintWindow,
    'Latest End': latestEndStr,
  };
}
