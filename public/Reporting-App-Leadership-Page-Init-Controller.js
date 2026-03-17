import { renderNotificationDock } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { initLeadershipDefaults, initLeadershipFilters, tryAutoRunPreviewOnce, renderLeadershipLoading } from './Reporting-App-Leadership-Page-Data-Loader.js';
import { initGlobalOutcomeModal } from './Reporting-App-Shared-Outcome-Modal.js';
import { wireLeadershipContentInteractions } from './Reporting-App-Leadership-Shared-Actions.js';

function initLeadershipPage() {
  renderNotificationDock({ pageContext: 'leadership', collapsedByDefault: true });
  initGlobalOutcomeModal({
    getSelectedProjects: () => {
      const projectsSelect = document.getElementById('leadership-projects');
      return String(projectsSelect?.value || '').split(',').map((value) => value.trim()).filter(Boolean);
    },
  });
  initLeadershipDefaults();
  initLeadershipFilters();
  tryAutoRunPreviewOnce();
  renderLeadershipLoading();
  wireLeadershipContentInteractions(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeadershipPage);
} else {
  initLeadershipPage();
}
