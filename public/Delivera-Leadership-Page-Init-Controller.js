import { refreshNotificationDockFromStore } from './Delivera-Shared-Notifications-Dock-Manager.js';
import { initLeadershipDefaults, initLeadershipFilters, tryAutoRunPreviewOnce, renderLeadershipLoading } from './Delivera-Leadership-Page-Data-Loader.js';
import { initWorkDraftDrawer as initGlobalOutcomeModal } from './Delivera-Work-Draft-Canvas.js';
import { wireLeadershipContentInteractions } from './Delivera-Leadership-Shared-Actions.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

function initLeadershipPage() {
  refreshNotificationDockFromStore();
  initGlobalOutcomeModal({
    getSelectedProjects: readSharedProjectsCsv,
    getOutcomeDraftContext: () => ({ boardId: null, quarterHint: '' }),
  });
  initLeadershipDefaults();
  initLeadershipFilters();
  renderLeadershipLoading();
  tryAutoRunPreviewOnce();
  wireLeadershipContentInteractions(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeadershipPage);
} else {
  initLeadershipPage();
}
