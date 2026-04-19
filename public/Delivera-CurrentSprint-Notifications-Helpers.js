import { writeNotificationSummary } from './Reporting-App-Shared-Notifications-Dock-Manager.js';

export function buildNotificationSummary(data) {
  if (!data?.sprint) return null;
  const tracking = data.subtaskTracking?.summary || {};
  const missingEstimate = tracking.missingEstimate ?? 0;
  const missingLogged = tracking.missingLogged ?? 0;
  const total = missingEstimate + missingLogged;
  return {
    total,
    missingEstimate,
    missingLogged,
    boardId: data.board?.id || '',
    boardName: data.board?.name || '',
    sprintId: data.sprint?.id || '',
    sprintName: data.sprint?.name || '',
    updatedAt: new Date().toISOString(),
  };
}

export function updateNotificationStore(data) {
  const summary = buildNotificationSummary(data);
  if (summary) {
    writeNotificationSummary(summary);
    try {
      window.dispatchEvent(new CustomEvent('app:notification-summary-updated', { detail: summary }));
    } catch (_) {}
  }
  return summary;
}
