# CSS Partials — Source of Truth

`public/styles.css` is **generated**. Do not edit it directly — your changes will be overwritten the next time `npm run build:css` runs (which also happens on every `npm start` via the `prestart` hook).

## How to change styles

1. Find the right partial below
2. Edit it
3. Run `npm run build:css`

## Partials (build order)

| File | What belongs here |
|---|---|
| `01-reset-vars.css` | CSS variables (colours, spacing, radius), browser reset |
| `02-layout-container.css` | Page layout, `.container`, `header`, sticky header, `.header-page-context` |
| `03-nav-sidebar.css` | Sidebar, hamburger, nav links |
| `04-filters-report.css` | Report page: filters panel, preview UI, tabs, data-state badges, loading context bar |
| `05-tables-export.css` | Shared data tables, `.data-table-scroll-wrap`, export panel |
| `06-current-sprint.css` | Everything on `/current-sprint`: header bar, cards, carousel, alert banner, countdown |
| `07-leadership.css` | Everything on `/leadership`: HUD grid, metrics, trend charts |
| `08-modals-misc.css` | Modals, dialogs, notification dock, miscellaneous shared components |
| `09-governance.css` | Brief / governance scope bar, evidence tabs, portfolio heat map, drawers |
| `10-report-proof.css` | Report proof surface extensions (when present) |
| `11-executive-pulse.css` | Executive verdict zone, portfolio heat tiles, pulse bars |
| `12-top-chrome.css` | Global top chrome, Improve Delivera modal |
| `13-sub-chrome.css` | Sub-chrome and secondary header strips |
| `14-speed-simplicity-trust.css` | Direct-value import, organization health, and accessible disclosure overrides |

## CI guard

`npm run check:css` (run by CI) will **fail the build** if `styles.css` doesn't match what the partials would produce. This catches any direct edits before they reach the repo.

To fix a `check:css` failure locally:

```bash
# Move your changes into the right partial, then:
npm run build:css
npm run check:css   # should pass
```
