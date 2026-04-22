import {
  writeNotificationSummary,
  readNotificationSummary,
  buildNotificationSummaryFromSprintData,
} from './Delivera-Shared-Notifications-Dock-Manager.js';

export const buildNotificationSummary = buildNotificationSummaryFromSprintData;

export function updateNotificationStore(data) {
  const summary = buildNotificationSummary(data);
  if (summary) {
    const existing = readNotificationSummary();
    if (existing && Array.isArray(existing.runtimeAlerts) && existing.runtimeAlerts.length) {
      summary.runtimeAlerts = existing.runtimeAlerts;
    }
    writeNotificationSummary(summary);
    try {
      window.dispatchEvent(new CustomEvent('app:notification-summary-updated', { detail: summary }));
    } catch (_) {}
  }
  return summary;
}
