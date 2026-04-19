import { renderNotificationDock } from './Delivera-Shared-Notifications-Dock-Manager.js';
import { initLeadershipDefaults, initLeadershipFilters, tryAutoRunPreviewOnce, renderLeadershipLoading } from './Delivera-Leadership-Page-Data-Loader.js';
import { initGlobalOutcomeModal } from './Delivera-Shared-Outcome-Modal.js';
import { wireLeadershipContentInteractions } from './Delivera-Leadership-Shared-Actions.js';

function initLeadershipPage() {
  renderNotificationDock({ pageContext: 'leadership', collapsedByDefault: true });
  initGlobalOutcomeModal({
    getSelectedProjects: () => {
      const projectsSelect = document.getElementById('leadership-projects');
      return String(projectsSelect?.value || '').split(',').map((value) => value.trim()).filter(Boolean);
    },
    getOutcomeDraftContext: () => ({ boardId: null, quarterHint: '' }),
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
