/**
 * ALB-82 / ALB-76: Sprint context chips are owned by Header-Bar `buildHeaderContextStrip`
 * (scope, report window, freshness). This module stays a no-op so legacy imports cannot add a second strip.
 *
 * Kept as a no-op for any legacy import paths; do not render a parallel context summary on this page.
 */
export function renderCurrentSprintContextStrip() {
  return '';
}
