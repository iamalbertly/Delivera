import { renderContextSummaryStrip } from './Reporting-App-Shared-Context-Summary-Strip.js';

export function renderCurrentSprintContextStrip(data) {
  const boardName = data?.board?.name || 'Board';
  const projectLabel = Array.isArray(data?.board?.projectKeys) && data.board.projectKeys.length
    ? data.board.projectKeys.join(', ')
    : (data?.meta?.projects || 'Project');
  const sprintName = data?.sprint?.name || 'No active sprint';
  const sprintDates = data?.sprint?.startDate && data?.sprint?.endDate
    ? `${String(data.sprint.startDate).slice(0, 10)} - ${String(data.sprint.endDate).slice(0, 10)}`
    : 'Date window unavailable';
  const freshness = data?.meta?.fromSnapshot ? 'Snapshot' : 'Live sprint';

  return renderContextSummaryStrip({
    title: 'Sprint context',
    chips: [
      { label: 'Project', value: projectLabel },
      { label: 'Board', value: boardName },
      { label: 'Sprint', value: sprintName },
      { label: 'Dates', value: sprintDates },
      { label: 'Freshness', value: freshness, tone: data?.meta?.fromSnapshot ? 'warning' : 'success' },
    ],
    secondary: 'One context bar replaces repeated scope and freshness explanations.',
  });
}
