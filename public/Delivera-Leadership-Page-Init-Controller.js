/**
 * Legacy Leadership trends-on-report path.
 * leadership.html uses Delivera-Leadership-HUD-Controller.js + Instant Shell.
 * This controller remains only if an alternate report-embedded leadership layout is revived.
 * Do not import from leadership.html.
 */
import { refreshNotificationDockFromStore } from './Delivera-Shared-Notifications-Dock-Manager.js';
import { initLeadershipDefaults, initLeadershipFilters, tryAutoRunPreviewOnce, renderLeadershipLoading } from './Delivera-Leadership-Page-Data-Loader.js';
import { initWorkDraftDrawer as initGlobalOutcomeModal } from './Delivera-Work-Draft-Canvas.js';
import { wireLeadershipContentInteractions } from './Delivera-Leadership-Shared-Actions.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

function initLeadershipPage() {
  if (!document.getElementById('leadership-loading') && !document.getElementById('leadership-content')) {
    return;
  }
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
