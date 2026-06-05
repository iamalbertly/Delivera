/**
 * SSOT: notify all chrome surfaces when project/quarter scope changes (same-tab safe).
 */
import { renderSidebarContextCard } from './Delivera-Shared-Context-From-Storage.js';
import { refreshTopChromeBrand } from './Delivera-Shared-Top-Chrome-01Render-UI.js';

export function notifyScopeChanged() {
  renderSidebarContextCard();
  refreshTopChromeBrand();
  try {
    window.dispatchEvent(new CustomEvent('delivera:scope-changed'));
  } catch (_) { /* ignore */ }
}
