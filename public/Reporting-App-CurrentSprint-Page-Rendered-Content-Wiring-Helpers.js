import { renderNotificationDock } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { updateNotificationStore } from './Reporting-App-CurrentSprint-Notifications-Helpers.js';
import { showContent } from './Reporting-App-CurrentSprint-Page-Status.js';
import { renderCurrentSprintPage } from './Reporting-App-CurrentSprint-Render-Page.js';
import { wireDynamicHandlers } from './Reporting-App-CurrentSprint-Page-Handlers.js';
import { wireHeaderBarHandlers } from './Reporting-App-CurrentSprint-Header-Bar.js';
import { wireHealthDashboardHandlers } from './Reporting-App-CurrentSprint-Health-Dashboard.js';
import { wireAlertBannerHandlers } from './Reporting-App-CurrentSprint-Alert-Banner.js';
import { wireRisksAndInsightsHandlers } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { wireCapacityAllocationHandlers } from './Reporting-App-CurrentSprint-Capacity-Allocation.js';
import { wireSprintCarouselHandlers } from './Reporting-App-CurrentSprint-Navigation-Carousel.js';
import { wireCountdownTimerHandlers } from './Reporting-App-CurrentSprint-Countdown-Timer.js';
import { wireSubtasksShowMoreHandlers } from './Reporting-App-CurrentSprint-Render-Subtasks.js';
import { wireProgressShowMoreHandlers } from './Reporting-App-CurrentSprint-Render-Progress.js';
import { wireExportHandlers } from './Reporting-App-CurrentSprint-Export-Dashboard.js';

function collapseMobileDetailsSections() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    document.querySelectorAll('details[data-mobile-collapse="true"]').forEach((el) => {
      el.open = false;
    });
  } catch (_) {}
}

export function appendCurrentSprintLoginLink(errorEl) {
  if (!errorEl || errorEl.querySelector('a.nav-link')) return;
  const link = document.createElement('a');
  link.href = '/?redirect=/current-sprint';
  link.className = 'nav-link';
  link.textContent = 'Sign in';
  link.style.marginLeft = '8px';
  errorEl.appendChild(document.createTextNode(' '));
  errorEl.appendChild(link);
}

export function showCurrentSprintRenderedContent(data, onSelectSprintById) {
  showContent(renderCurrentSprintPage(data));
  const summary = updateNotificationStore(data);
  renderNotificationDock({ summary, pageContext: 'current-sprint' });
  wireDynamicHandlers(data);
  wireHeaderBarHandlers();
  wireHealthDashboardHandlers();
  wireAlertBannerHandlers();
  wireRisksAndInsightsHandlers();
  wireCapacityAllocationHandlers();
  wireCountdownTimerHandlers();
  wireSubtasksShowMoreHandlers();
  wireProgressShowMoreHandlers();
  wireSprintCarouselHandlers((sprintId) => onSelectSprintById(sprintId));
  wireExportHandlers(data);
  collapseMobileDetailsSections();
}
