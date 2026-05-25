/**
 * Thin coordinator — all Create Work UI is handled by Delivera-Work-Draft-Canvas.js.
 * This module preserves the original public API so existing callers keep working.
 */
import { initWorkDraftDrawer, openWorkDraftDrawer, closeWorkDraftDrawer } from './Delivera-Work-Draft-Canvas.js';

export { openWorkDraftDrawer as openGlobalOutcomeModal };

export function initGlobalOutcomeModal(config = {}) {
  initWorkDraftDrawer(config);
}

export { closeWorkDraftDrawer };
