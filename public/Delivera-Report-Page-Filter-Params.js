import {
  DEFAULT_WINDOW_END,
  DEFAULT_WINDOW_END_LOCAL,
  DEFAULT_WINDOW_START,
  DEFAULT_WINDOW_START_LOCAL,
} from './Reporting-App-Report-Config-Constants.js';
import { toUtcIsoFromLocalInput } from './Reporting-App-Report-Utils-Data-Helpers.js';
import { getSelectedProjects } from './Reporting-App-Report-Page-Selections-Manager.js';

export function collectFilterParams() {
  const projects = getSelectedProjects();

  if (projects.length === 0) {
    throw new Error('Please select at least one project.');
  }

  const startDate = document.getElementById('start-date')?.value || '';
  const endDate = document.getElementById('end-date')?.value || '';

  let startISO;
  let endISO;
  if (startDate) {
    startISO = toUtcIsoFromLocalInput(startDate);
    if (!startISO) {
      throw new Error('Invalid start date. Please provide a valid start date and time.');
    }
  } else {
    const startInput = document.getElementById('start-date');
    if (startInput && !startInput.value) {
      startInput.value = DEFAULT_WINDOW_START_LOCAL;
    }
    startISO = DEFAULT_WINDOW_START;
  }

  if (endDate) {
    endISO = toUtcIsoFromLocalInput(endDate, true);
    if (!endISO) {
      throw new Error('Invalid end date. Please provide a valid end date and time.');
    }
  } else {
    const endInput = document.getElementById('end-date');
    if (endInput && !endInput.value) {
      endInput.value = DEFAULT_WINDOW_END_LOCAL;
    }
    endISO = DEFAULT_WINDOW_END;
  }

  const startTime = new Date(startISO).getTime();
  const endTime = new Date(endISO).getTime();
  if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && startTime >= endTime) {
    throw new Error('Start date must be before end date. Please adjust your date range.');
  }

  return {
    projects: projects.join(','),
    start: startISO,
    end: endISO,
    includeStoryPoints: true,
    requireResolvedBySprintEnd: document.getElementById('require-resolved-by-sprint-end')?.checked ?? false,
    includeBugsForRework: true,
    includePredictability: document.getElementById('include-predictability')?.checked ?? false,
    predictabilityMode: (() => {
      const selected = document.querySelector('input[name="predictability-mode"]:checked');
      if (selected && 'value' in selected) {
        return selected.value;
      }
      return 'approx';
    })(),
    includeEpicTTM: true,
    includeActiveOrMissingEndDateSprints: document.getElementById('include-active-or-missing-end-date-sprints')?.checked ?? false,
  };
}
