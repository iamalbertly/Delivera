/**
 * App shell layout constants — scope appears only in scope bar + sidebar context.
 */
export const SCOPE_SURFACE_IDS = ['gov-scope-bar-mount', 'sidebar-context-card'];

export const PAGE_HEADINGS = {
  governance: "Today's delivery answer",
  report: 'Proof for current Brief',
  sprints: 'Sprint today',
};

/** Above-fold Brief zones (order matters). */
export const BRIEF_ABOVE_FOLD = [
  'gov-verdict-mount',
  'gov-donow-mount',
  'gov-issues-drawer-mount',
];

export const BRIEF_BELOW_FOLD = [
  'gov-meeting-script-mount',
  'gov-measurement-mount',
  'gov-supporting-evidence',
];
