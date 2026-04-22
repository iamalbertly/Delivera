## Delivera – Architecture & Context

### Modules & Dependencies

- **Environment SSOT (`lib/Delivera-Config-Env-Services-Core-SSOT.js`)** – Loads `<repo>/.env` from disk (path derived from this file’s location, not only `process.cwd()`), then `dotenv.config()` for cwd overlay. `JIRA_HOST`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` are **trimmed** (UTF-8 BOM stripped). Startup summary includes `jiraDotenvPath`, `jiraApiTokenLength`, and masked `jiraEmailPrefix`. Use `npm run validate:jira-env` to call Jira `/myself` with the same config.
- **Server (`server.js`)**
  - Depends on `express`, `dotenv`, `jira.js`, and internal libs:
    - `lib/jiraClients.js` – Jira client creation
    - `lib/discovery.js` – boards/fields discovery (uses `lib/Delivera-Data-JiraAPI-Pagination-Helper.js`). `discoverBoardsForProjects` returns `{ boards, projectErrors }` (per-project fault isolation; `extractJiraHttpStatus` / `classifyJiraHttpError` for stable `JIRA_*` codes). Field discovery unchanged; still returns `storyPointsFieldCandidates` when multiple SP-like fields exist.
    - `lib/server-utils.js` – `discoverBoardsWithCache` returns `{ boards, projectErrors }`; skips aggregate discovery cache when `projectErrors.length > 0` (per-project board cache still applies for successes). Re-exports `classifyJiraHttpError` / `extractJiraHttpStatus` from discovery.
    - `lib/sprints.js` – sprint fetching, overlap filtering, `getActiveSprintForBoard`, `getRecentClosedSprintForBoard` (uses pagination helper)
    - `lib/currentSprint.js` – current-sprint transparency: `buildCurrentSprintPayload` (observed window, daily completions, scope changes, burndown context); imports from `lib/Delivera-Data-CurrentSprint-Notes-IO.js`, `lib/Delivera-Data-IssueType-Classification.js`, `lib/Delivera-Data-CurrentSprint-Burndown-Resolve.js`. Enriches `subtaskTracking.subtasks[]` with `parentKey`, `parentSummary`, and `parentUrl` for Work risks hierarchy. Summary now includes:
      - `stuckExcludedParentsWithActiveSubtasks: number` – parents with active subtasks that are explicitly excluded from blockers.
      - `completedAfterSprintEndCount: number` – count of stories resolved after sprint end (used only for burndown annotations; SP completion remains sprint-only).
      - `storyPointsFieldCandidates: Array<{ id, name }>` – SP field candidates from discovery, passed through from `fields.storyPointsFieldCandidates`.
      - `storyPointsFieldWarning: boolean` – true when multiple SP-like fields exist; UI uses this to show a gentle “primary field only” warning in the burndown card.
    - `lib/issues.js` – issue fetching, `fetchSprintIssuesForTransparency`, `buildDrillDownRow` (re-export); imports from `lib/Delivera-Data-Issues-Pagination-Fields.js`, `lib/Delivera-Data-Issues-DrillDown-Row.js`, `lib/Delivera-Data-Issues-Subtask-Time-Totals.js`
    - `lib/metrics.js` – throughput, done comparison, rework, predictability (with planned carryover / unplanned spillover), epic TTM (uses `calculateWorkDays` from `lib/kpiCalculations.js`)
    - `lib/csv.js` – CSV column list and escaping (SSOT); CSV streaming for `/export`
    - `lib/cache.js` – TTL cache for preview responses (memory default; optional Redis when `CACHE_BACKEND=redis` + `REDIS_URL` — see `README.md`). Preview reuse is per-process with memory-only backends.
    - `lib/Delivera-Preview-Client-Budget-SSOT.js` – shared formula for `derivePreviewClientBudgetMs` (mirrored in `public/Delivera-Report-Page-Preview-Complexity-Config.js`; parity covered by `tests/Delivera-Preview-Budget-Parity-Validation-Tests.spec.js`).
    - `lib/Delivera-Server-Logging-Utility.js` – structured logging
    - **Outcome draft assistant (Jira-only, no LLM v1):** `lib/Delivera-Outcome-Similarity-01Core.js` (Jaccard/Dice SSOT for dedupe), `lib/Delivera-Outcome-Precheck-Messages.js` (non-blocking precheck copy), `lib/Delivera-Outcome-Board-Style-Profile.js` (bounded JQL style profile, cache namespace `outcomeProfile`), `lib/Delivera-Outcome-Draft-Builder.js` (server-authoritative draft rows, readiness warnings, three-level duplicate hints). `POST /api/outcome-draft` returns draft JSON (no Jira writes). `POST /api/outcome-from-narrative` accepts optional `commitChildIndices` (filter child/standalone rows) and `parentSummaryOverride`.
  - **Public API:** `GET /api/csv-columns` – returns `{ columns: CSV_COLUMNS }` (SSOT for client CSV column order). `GET /api/boards.json` – list boards for projects (current-sprint selector): **200** `{ projects, boards, jiraErrors? }` on partial Jira failure; **502** + `code: JIRA_UNAUTHORIZED` when every project fails auth/forbidden. `GET /api/sprints` and `GET /api/sprints.json` – sprints for the resolved board (`boardId` optional; `projects` query like boards); JSON `{ board, sprints[] }`. **Middleware order:** `apiRoutes` mount precedes `express.static('public')` so `/api/*` cannot be shadowed by static files. `GET /api/current-sprint.json` – current-sprint transparency payload per board (snapshot-first; query `boardId`, optional `projects`, `live=true`). Payload includes `stuckCandidates[]` (issues in progress >24h), `previousSprint: { name, id, doneSP, doneStories } | null`, and `summary` fields described above (including `completedAfterSprintEndCount`, `storyPointsFieldCandidates`, and `storyPointsFieldWarning`). `GET /api/date-range?quarter=Q1|Q2|Q3|Q4` – latest completed Vodacom quarter range `{ start, end }` (UTC). `GET /api/quarters-list?count=8` – last N Vodacom quarters up to current `{ quarters: [{ start, end, label, period, isCurrent }, ...] }`; implemented via `getQuartersUpToCurrent` in `lib/Delivera-Data-VodacomQuarters-01Bounds.js`. `GET /api/format-date-range?start=...&end=...` – date range label for filenames (Qn-YYYY or start_to_end). `GET /api/default-window` – default report date window `{ start, end }` (SSOT from config). **Test-only:** `POST /api/test/clear-cache` – clears in-memory caches (preview, boards, fields, in-flight, rate limit); available only when `NODE_ENV=test` or `ALLOW_TEST_CACHE_CLEAR=1`; returns `{ ok: true }`.
  - **Routes:** `GET /report`, `GET /current-sprint` (squad transparency), `GET /sprint-leadership` (leadership view).
  - **Default window SSOT:** `lib/Delivera-Config-DefaultWindow.js` exports `DEFAULT_WINDOW_START`, `DEFAULT_WINDOW_END`; server and `GET /api/default-window` use it.
  - **Vodacom quarters SSOT:** `lib/Delivera-Data-VodacomQuarters-01Bounds.js` – quarter bounds, `getLatestCompletedQuarter(q)`, and `getQuartersUpToCurrent(count)`; `lib/excel.js` uses `getQuarterLabelForRange` for filename labels.
- **Frontend (`public/report.html`, `public/current-sprint.html`, `public/leadership.html`, `public/styles.css`, and modular `Delivera-*` scripts)**
  - **CSS:** Source lives in `public/css/` (01-reset-vars.css through 08-modals-misc.css). Run `npm run build:css` to concatenate into `public/styles.css`. Do not edit `styles.css` directly; edit partials and rebuild. Mobile header fix (min-width:0, overflow-wrap) is in 02-layout-container.css. Leadership viewport containment (#hud-grid) is in 07-leadership.css. Optional backup `public/styles.css.orig` is not used by the build.
  - Report (General Performance) is loaded via `report.html` and `Delivera-Report-Page-Init-Controller.js` only; no legacy report.js. `body.preview-active` is maintained by `syncReportPreviewActiveFromDom()` in `Delivera-Report-Page-Render-Preview.js` (also after preview fetch lifecycle in `Delivera-Report-Page-Preview-Flow.js`) so it matches visible `#preview-content` + `reportState.previewData`, preventing the compact sidebar from sticking when the shell is hidden. On first paint, `#report-context-line` shows outcome-focused context (last run summary and freshness from `getContextDisplayString()`, or "No report run yet") so the main area is not blank for returning users. When context is "No report run yet", a "Load latest" button is shown and triggers Preview on click (and focuses the Preview button). When a valid last query and enabled Preview button exist, init schedules a single auto-preview after 1s; that timer is cancelled if the user changes any filter before it fires. When preview is shown, `Delivera-Report-Page-Render-Preview.js` clears `#report-context-line` and hides the "Load latest" wrap. When the Preview button is disabled (e.g. no projects), "Load latest" is hidden via `updateAppliedFiltersSummary`. On preview error with no existing preview, context line is set to "Preview failed. Use Load latest to retry." and "Load latest" is shown; when the user dismisses the error panel and no preview is visible, the same recovery line and button are shown. `Delivera-Report-Page-Loading-Steps.js` hides "Load latest" and sets `.preview-area` aria-busy when loading is visible, and clears aria-busy when loading is hidden. Filters panel, preview header, tabs, and content are driven by `Delivera-Report-Page-*` modules. Date window uses a scrollable strip of Vodacom quarter pills (5+ quarters up to current) from `/api/quarters-list`. A dedicated `REPORT_FILTERS_STALE_KEY` in `Delivera-Shared-Storage-Keys.js` is used to tag when filters have changed without a new preview; `Delivera-Shared-Context-From-Storage.js` reads this flag to append a stale hint to both `#report-context-line` text and the shared sidebar context card. **Report preview chrome SSOT:** while `body.preview-active` on the report page, the main `renderContextBar` chips live only in `#report-filter-strip-summary` (not duplicated in `#preview-meta`); the sidebar card switches to a compact trust card (`context-card--report-preview-compact`) that omits repeating Projects/Range and keeps freshness plus filter-drift warning. `renderContextPartList` in `Delivera-Shared-Context-From-Storage.js` renders arbitrary segment arrays for that compact path. `updateAppliedFiltersSummary` calls `renderSidebarContextCard()` so filter edits refresh the sidebar without waiting for another preview.
  - Leadership uses `leadership.html` and `Delivera-Leadership-Page-Init-Controller.js`; same quarter strip pattern.
  - `Delivera-Shared-Boards-Summary-Builder.js` – SSOT for board summary aggregation (Report and Leadership); both pages use `buildBoardSummaries` only.
  - `Delivera-Shared-AutoPreview-Config.js` – exports `AUTO_PREVIEW_DELAY_MS` (400 ms); Report Init and Leadership Data-Loader use it for auto-preview debounce (single source of truth).
  - `Delivera-Report-Utils-Jira-Helpers.js` – buildJiraIssueUrl, getEpicStoryItems, isJiraIssueKey (used by Epic TTM linkification and ad-hoc key detection).
  - `Delivera-Shared-Global-Nav.js` – injects or updates global nav (Delivera + Report | Current Sprint | Leadership) on all four surfaces (login, report, current-sprint, leadership); single source of truth for nav markup.
  - `Delivera-Shared-Outcome-Modal.js` – global outcome modal: client parse preview, **Generate draft** (`POST /api/outcome-draft`), readiness strip, two-stage review table (bulk **Accept all safe** / **Review warnings only** / **Cancel draft**), **Create selected** (`commitChildIndices` + optional `parentSummaryOverride`), **Ctrl+Enter** runs draft when enabled. `initGlobalOutcomeModal` accepts optional `getOutcomeDraftContext()` returning `{ boardId, quarterHint }` (Report and Current Sprint wire board context from storage / selector).
- **Tests (`tests/*.spec.js`)**
  - `Delivera-E2E-User-Journey-Tests.spec.js` – UI and UX/user-journey coverage
  - `Delivera-API-Integration-Tests.spec.js` – endpoint contracts and CSV semantics (includes `/api/csv-columns`, `/api/boards.json`, `/api/current-sprint.json`, `GET /current-sprint`, `GET /sprint-leadership`)
  - `Delivera-Server-Errors-And-Export-Validation-Tests.spec.js` – regression for EADDRINUSE handling, preview completion, Excel export, partial preview banner, and cache-clear endpoint; uses captureBrowserTelemetry and UI assertions
  - `Delivera-Current-Sprint-Leadership-View-Tests.spec.js` – E2E for current-sprint page (board selector, board selection) and sprint-leadership page (date inputs, Preview)
  - `Delivera-UX-Trust-And-Export-Validation-Tests.spec.js` – SSOT for report, current-sprint, leadership, and export (telemetry + UI); run by orchestration.
  - `Delivera-Current-Sprint-UX-SSOT-Validation-Tests.spec.js` – board pre-select, burndown summary, empty states, leadership empty preview, report boards; logcat + UI; run by orchestration
  - `Delivera-Refactor-SSOT-Validation-Tests.spec.js` – Boards column order, tooltips, capacity columns, CSV SSOT contract
  - `Delivera-UX-Customer-Simplicity-Trust-Validation-Tests.spec.js` – Login outcome/trust/error focus/ratelimit, Report sticky chips/empty state/Generated X min ago/filters tip, Current Sprint loading/no-boards copy, Leadership auto-preview; run by orchestration.
  - `Delivera-UX-Outcome-First-Nav-And-Trust-Validation-Tests.spec.js` – Default Done Stories tab, two-line preview meta, context bar last-run, alert classes, login/nav, Current Sprint hero and loading, Leadership sticky and zero-boards, global nav, Report CTA/loading, edge cases (tab state, project SSOT); run by orchestration.
  - `Delivera-CSS-Build-And-Mobile-Responsive-Validation-Tests.spec.js` – CSS build output exists, report/current-sprint headers responsive at 375px, nav and filters visible; telemetry + UI per step; run by orchestration.
  - `Delivera-Outcome-First-First-Paint-Validation-Tests.spec.js` – Report first-paint context line, empty state, Preview/context line presence, context line cleared after preview, login outcome/trust lines, sidebar context, last-run freshness, current-sprint and leadership load; uses captureBrowserTelemetry and assertTelemetryClean per step; run by orchestration after CSS Build.
  - `Delivera-Outcome-Draft-Assistant-Direct-Value-Logcat-Realtime-Validation-Tests.spec.js` – staged Playwright validation for outcome draft panel (precheck, readiness, bulk filters, detail expand, cancel) with mocked `/api/outcome-draft`; direct `fetch` 400 contract; registered in `scripts/Delivera-Tests-Journey-Buckets-Map-SSOT.js` under `journey.outcome-intake`.
  - `Delivera-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js` – Load latest visibility (empty state vs no projects), Load latest hidden when loading, aria-busy on preview area, context line cleared after preview, error then dismiss re-shows context and Load latest, error recovery context line when preview fails, aria-busy false after load; telemetry + UI per step; run by orchestration after Outcome-First First-Paint.
  - `Delivera-Report-Chrome-Direct-Value-Realtime-Validation-Tests.spec.js` – Stubbed `/preview.json` report run: single `#report-filter-strip-summary` context bar, no `#preview-meta` duplicate, compact Performance history row, signals rail flex layout, Leadership tab copy, compact sidebar (no Projects/Range rows), decision strip, mobile overflow guard; Playwright console guard fail-fast; `journey.ux-core` in `Delivera-Tests-Journey-Buckets-Map-SSOT.js`.
  - `tests/Delivera-Tests-Shared-PreviewExport-Helpers.js` – SSOT for `runDefaultPreview`, `waitForPreview`, `skipIfLoginVisible`, `skipIfRedirectedToLogin(page, test, options)`, `selectFirstBoard`, `assertPreviewOrSkip`, `captureBrowserTelemetry`, `assertTelemetryClean`; used by E2E, Excel, UX, CSS Build And Mobile Responsive, Current Sprint Health, Outcome-First First-Paint specs
  - `Delivera-Current-Sprint-Work-Risks-Hierarchy-Validation-Tests.spec.js` – validates hierarchical Work risks rendering (parent vs subtask rows tied by `data-parent-key`), accordion behaviour on `.work-risks-toggle`, and that the header “Blockers” metric matches the number of unique `Stuck >24h` issues in the table.
  - `Delivera-Current-Sprint-Burndown-Truthfulness-Validation-Tests.spec.js` – validates SP-configuration copy on the Current Sprint burndown card (field not configured vs 0 SP in this sprint vs SP burndown) and that SP burndown paths do not show story-count fallback text.
  - `Delivera-Current-Sprint-Edge-Semantics-Validation-Tests.spec.js` – validates stale context hints on the report page and the excluded-parent blockers messaging on the Work risks card.
  - `Delivera-Current-Sprint-Summary-UX-Validation-Tests.spec.js` – validates the exported Current Sprint summary text contract: four-line short summary (period/board/health, progress with date range, movement vs logging, compact risk line), presence of the `--- More detail below ---` separator, and grouped detail sections for recent activity, blockers, not started work, scope added, and work breakdown, all with clean telemetry.
- **Scripts**
  - `scripts/Delivera-Test-Orchestration-Runner.js` – sequential runner for Playwright API + E2E suites; imports steps from `scripts/Delivera-Test-Orchestration-Steps.js`; before test steps, calls `POST /api/test/clear-cache` (when NODE_ENV=test) so no test reads stale cache
  - `scripts/Delivera-Test-Orchestration-Steps.js` – SSOT list of fail-fast Playwright steps for `npm run test:all`; now includes focused Current Sprint validation steps for:
    - Direct-value blockers and snapshot semantics
    - Blockers trust and edge cases
    - Work risks hierarchy and accordion behaviour
    - Burndown truthfulness (SP vs story count)
    - Edge semantics including stale context hints and excluded-parent messaging
    - Summary UX contract and export text structure
- **File naming:** Product modules use the `Delivera-` prefix (`Delivera-<Tail>.js` in `lib/` and `public/`). Jira integration scopes may keep `Jira` or `JiraAPI` in the tail (e.g. `Delivera-Data-JiraAPI-Pagination-Helper.js`, `Delivera-Report-Utils-Jira-Helpers.js`). New files should use clear multi-segment tails; optional `01`/`02` ordering suffixes where execution order matters. Before adding a file, verify no duplicate scope exists.

### Public API Surface – `/preview.json`

- **Query parameters** (unchanged – see `README.md` for full list).
  - `previewMode` (optional): `"normal"` (default), `"recent-first"`, or `"recent-only"`. Used to bias server behaviour toward recent live data plus cached history.
  - `clientBudgetMs` (optional): client-side soft budget in milliseconds; server clamps this to `PREVIEW_SERVER_MAX_MS` and uses it as the preview time budget.
- **Response meta (selected fields)**:
  - `selectedProjects: string[]`
  - `windowStart: string`
  - `windowEnd: string`
  - `discoveredFields: { storyPointsFieldId?: string; epicLinkFieldId?: string }`
  - `fromCache: boolean`
  - `requestedAt: string`
  - `generatedAt: string`
  - `elapsedMs: number`
  - `partial: boolean`
  - `partialReason: string | null`
  - `requireResolvedBySprintEnd: boolean` **(surfaced so the UI can explain empty states)**
  - `previewMode: "normal" | "recent-first" | "recent-only"`
  - `recentSplitDays: number | null` **(days used to define the “recent” window when splitting long ranges)**
  - `recentCutoffDate: string | null` **(ISO date representing the start of the recent window; older sprints fall strictly before this when split is on)**
  - `timedOut: boolean` **(true when the preview stopped early because the time budget was reached)**
  - `usedCacheForOlder: boolean` **(true when older sprints were served purely from cache during a split window)**
  - `clientBudgetMs: number` **(the budget honoured for this request, after clamping)**
  - `clientBudgetMsEcho: number` **(same budget the server used for this response; UI Details and telemetry may reference it)**
  - `previewCacheSemantics: object` **(boolean flags used for safe best-cache reuse; written on live previews)**
  - `cachedFromBestAvailableSubset: boolean`, `cachedKeyUsed: string`, `cacheMatchType?: "narrower-window" | "wider-window-filtered"` **(subset cache trust flags)**
  - `cachedSourceWindowStart?: string`, `cachedSourceWindowEnd?: string` **(when serving from a widened/narrowed cache window)**
  - `kpisDeferred?: boolean`, `kpisDeferredReason?: string` **(when quarterly KPI enrichment is skipped to protect time budget)**
  - `serverMaxPreviewMs: number` **(hard server-side ceiling for preview processing)**
  - `epicHygiene: { ok: boolean, pctWithoutEpic: number, epicsSpanningOverN: number, message: string | null }` **(gates Epic TTM display)**
  - `phaseLog: Array<{ phase: string; at: string; ... }>`
  - `jiraProjectErrors?: Array<{ projectKey: string; code: string; message: string; detail?: string }>` **(set when board discovery succeeded for some projects but Jira failed for others)**
- **Preview response:** `boards[].indexedDelivery: { currentSPPerDay, rollingAvgSPPerDay, sprintCount, index }`; `sprintsIncluded[]` include `sprintCalendarDays`, `sprintWorkDays`, `spPerSprintDay`, `storiesPerSprintDay`. Predictability `perSprint` includes `plannedCarryoverStories`, `plannedCarryoverSP`, `unplannedSpilloverStories`, `unplannedSpilloverSP`, `plannedCarryoverPct`, `unplannedSpilloverPct`.

### Typed Error Path – `/preview.json`

- Introduced a small typed error wrapper:
  - `class PreviewError extends Error { code: string; httpStatus: number }`
  - Currently used for:
    - Missing/invalid Jira env at client creation → `code: "JIRA_UNAUTHORIZED"`, `httpStatus: 502`
    - All selected projects fail board discovery with auth/forbidden → `code: "JIRA_UNAUTHORIZED"`, `httpStatus: 502`
    - All projects fail discovery for non-auth reasons → `code: "BOARD_FETCH_ERROR"`, `httpStatus: 502`
  - Catch block for `/preview.json` now:
    - Detects `instanceof PreviewError`
    - Returns JSON with:
      - `error: "Failed to generate preview"`
      - `code: error.code | "PREVIEW_ERROR"`
      - `message: error.message | "An unexpected error occurred while generating the preview."`
      - `details: error.message` in `NODE_ENV=development`

### Frontend Behaviour & UX Notes

- **Error banner SSOT (per view)**  
  Each view uses a single DOM node for API/validation errors: report `#error`, current-sprint `#current-sprint-error`, leadership `#leadership-error`. Do not show duplicate or overlapping error messages; use one function per view (e.g. `showError`) that writes to that node.
- **Preview timeout error UI**
  - Report preview has a client-side timeout (60–90s). On timeout (AbortError), the catch block in `Delivera-Report-Page-Preview-Flow.js` sets the full user-facing message inline (no Details click), primary CTA "Use smaller date range", secondary "Retry same range", and optional "Technical details" expandable (Force full refresh inside). The error UI update is guarded so the box is never left empty. "Use smaller date range" updates both start and end date inputs to last 30 days and triggers preview. Telemetry `preview.timeout` is emitted when the timeout fires. Tests: `Delivera-Preview-Timeout-Error-UI-Validation-Tests.spec.js`, `Delivera-UX-Outcome-First-No-Click-Hidden-Validation-Tests.spec.js` validate error panel content and retry actions.
- **Project/Board SSOT**
  Selected projects are stored in `delivera_selectedProjects` (localStorage). Report persists on project checkbox change; Leadership reads/writes on load/save; Current Sprint reads on load and uses it for `/api/boards.json` and `/api/current-sprint.json` (fallback MPSA,MAS). Board selector on Current Sprint reflects the same projects as Report/Leadership.
- **Persistence SSOT**
  - **Projects:** `PROJECTS_SSOT_KEY` (Shared-Storage-Keys). Report, Leadership, and Current Sprint read/write this only (or via one wrapper). Single source of truth for selected projects.
  - **Date range:** `SHARED_DATE_RANGE_KEY`. Report and Leadership use it; Current Sprint does not.
  - **Report-only:** `REPORT_HAS_RUN_PREVIEW_KEY`, `REPORT_LAST_RUN_KEY`, `REPORT_FILTERS_COLLAPSED_KEY`, `REPORT_ADVANCED_OPTIONS_OPEN_KEY`, `REPORT_FILTERS_STALE_KEY`, `REPORT_FILTERS_STALE_REASON_KEY` in Shared-Storage-Keys; used only by Report modules (Preview-Flow, Render-Preview, Init-Controller, DateRange-Controller, Selections-Manager).
  - **Current Sprint:** `CURRENT_SPRINT_BOARD_KEY`, `CURRENT_SPRINT_SPRINT_KEY` in Shared-Storage-Keys; used only by CurrentSprint-Page-Storage (and 02Handlers). No parallel persistence; do not add report keys to Current Sprint or vice versa.
  - **Stale filters reason:** `REPORT_FILTERS_STALE_REASON_KEY` distinguishes local filter edits (`local-change`) from cross-tab storage events (`storage-event`) so the status strip can show “filters changed in another tab” when appropriate.
- **Sprint order contract**
  Sprints displayed for filtering (Report Sprints tab, Current Sprint tabs) are ordered **left-to-right from current/latest backwards by sprint end date**. First tab/row = latest end date; each subsequent = same or earlier. Report uses `sortSprintsLatestFirst(sprints)`; Current Sprint uses `resolveRecentSprints` (lib/currentSprint.js) which sorts by `endDate` descending. Automated tests assert this order.
- **Data alignment**  
  Current-sprint and leadership summary logic must use only server-provided fields. **Board summary SSOT:** `public/Delivera-Shared-Boards-Summary-Builder.js` exports `buildBoardSummaries`. Report uses it in `Delivera-Report-Page-Render-Boards.js` and `Delivera-Report-Page-Filters-Pills-Manager.js`; Leadership uses it in `Delivera-Leadership-Page-Data-Loader.js` and passes `boardSummaries` to the render. Do not aggregate boards/sprints locally; use the shared builder only. Canonical shape must match server `sprintsIncluded[]` (sprintWorkDays, sprintCalendarDays, etc.). Do not introduce client-only computed fields that can drift from server.
- **Client-side date-range validation**
  - `collectFilterParams()` now throws when `start >= end` after normalising to UTC ISO:
    - Message: `"Start date must be before end date. Please adjust your date range."`
  - Preview handler catches this as a **validation error**:
    - Shows error banner with guidance
    - Does **not** send a network request
    - Restores the previous export button disabled state
- **Shared auto-preview delay**
  - `Delivera-Shared-AutoPreview-Config.js` exports `AUTO_PREVIEW_DELAY_MS` (default 400 ms). Report page Init-Controller and Leadership Data-Loader use this constant for `scheduleAutoPreview` debounce so behaviour is consistent and tunable in one place.
- **Preview button and export buttons**
  - On `Preview` click:
    - `#preview-btn` is disabled immediately to prevent double-clicks
    - Both export buttons are disabled while the preview is in flight
  - After the request (success or failure):
    - `#preview-btn` is re-enabled
    - Export buttons enabled **only when there is at least one preview row**
  - Export to Excel and More are enabled only when there is at least one preview row.
- **Current Sprint: stuck prompt, stories table, subtask summary**
  When `stuckCandidates.length > 0`, the summary strip shows a link "X in progress >24h – Follow up" to `#stuck-card`. Stories in sprint table includes Reporter and Assignee columns; planned window line at top of Stories card. Sub-task summary in the summary card is a single line linking to `#subtask-tracking-card` (no duplicate Sub-task logged / Time tracking alerts blocks).
- **Partial preview visibility**
  - Server already emits `meta.partial` and `meta.partialReason`.
  - When `meta.partial === true`, the UI shows the banner in `#preview-status` and the export hint in `#export-hint` so users know the export may be partial.
  - UI now also:
    - Renders a banner in `#preview-status` when `partial === true`
    - Shows a matching export hint in `#export-hint` when partial previews have rows
- **Require Resolved by Sprint End empty state**
  - `renderDoneStoriesTab` now inspects:
    - `previewData.meta.requireResolvedBySprintEnd`
    - Total preview rows vs. visible rows
  - When the filter is on and there were preview rows, but none pass the filter:
    - Empty state messaging calls out `"Require resolved by sprint end"` explicitly with remediation hints.

### Issue key linkification

- **Shared helper:** `public/Delivera-Shared-Dom-Escape-Helpers.js` exports `renderIssueKeyLink(issueKey, issueUrl)`. When `issueUrl` is present, renders `<a href="..." target="_blank" rel="noopener noreferrer">` with escaped label; otherwise escaped text. Label = `(issueKey || '').trim() || '-'`.
- **Current Sprint:** Backend `/api/current-sprint.json` sends `issueKey` and `issueUrl` for `stories[]`, `scopeChanges[]`, `stuckCandidates[]`, and `subtaskTracking.rows[]`. Frontend uses `renderIssueKeyLink(row.issueKey || row.key, row.issueUrl)` in Stories, Scope changes, Items stuck, and Sub-task tracking tables. Optional `meta.jiraHost` in the response allows client-side URL fallback when `issueUrl` is missing.
- **Report:** Done Stories and Epic TTM use `buildJiraIssueUrl(jiraHost, key)` from Report utils; Epic Key and sample story in preview header are clickable Jira links.

### View Rendering – Empty-state SSOT

- **Shared helper:** `public/Delivera-Shared-Empty-State-Helpers.js` exports `renderEmptyStateHtml(title, message, hint?)` returning the same DOM pattern (`.empty-state` with title, message, optional hint). Report uses it via `renderEmptyState(targetElement, title, message, hint)` in `Delivera-Report-Page-Render-Helpers.js` (sets `targetElement.innerHTML`). Current Sprint (no sprint, no stories) and Leadership (no boards) use `renderEmptyStateHtml` when building HTML strings.
- Consolidated empty-state usage: Report (Boards, Sprints, Done Stories, Metrics, Unusable), Current Sprint (no sprint, no stories), Leadership (no boards).

### Test & Helper Consolidation

- **Playwright test strategy:** Specs in `tests/` (`.spec.js`) are discovered by Playwright (`testDir: './tests'`). Many specs use `captureBrowserTelemetry(page)` from `Delivera-Tests-Shared-PreviewExport-Helpers.js` to capture console errors, page errors, and failed requests; assertions on `telemetry.consoleErrors`, `telemetry.pageErrors`, `telemetry.failedRequests` fail the step when the UI or console/network is wrong. The orchestration runner (`scripts/Delivera-Test-Orchestration-Runner.js`) now runs a small number of **journey buckets** (see below) instead of dozens of one-spec steps, and it still terminates on first error (`--max-failures=1`) with all output visible in the same terminal.
- **Shared test helpers (`tests/Delivera-Tests-Shared-PreviewExport-Helpers.js`)**
  - `runDefaultPreview(page, overrides?)` – navigates to `/report`, sets default Q2 MPSA+MAS window, applies overrides, clicks Preview, then waits for result.
  - `waitForPreview(page)` – waits for preview content or error and loading overlay to disappear.
  - `captureBrowserTelemetry(page)` – returns `{ consoleErrors, pageErrors, failedRequests }` for logcat-style assertions.
  - `assertTelemetryClean(telemetry, options?)` – SSOT for asserting no critical console/network errors; `options.excludePreviewAbort: true` for error-path tests that abort preview.json. Used by UX Outcome-First, UX SoC Refactor, UX Trust, UX Improvements, Phase2, Full, and related specs.
  - Imported by E2E User Journey, Excel Export, UX Critical/Reliability, Column Tooltip, Refactor SSOT, E2E Loading Meta, RED-LINE, UX Trust, UX SoC Duplication Refactor, Current Sprint UX/SSOT, Linkification/Empty-state validation specs.
- **API integration tests (`Delivera-API-Integration-Tests.spec.js`)**
  - Centralised: `DEFAULT_Q2_QUERY`, `DEFAULT_PREVIEW_URL`, contract test for `GET /api/csv-columns` vs `lib/csv.js` CSV_COLUMNS.

#### Playwright journey buckets (SSOT)

We group specs into a small set of journey buckets so humans and automation have **one obvious command per intent** and so the orchestration steps can stay thin:

- **`journey.current-sprint` – Current Sprint mission control**
  - Specs: `Delivera-Current-Sprint-UX-SSOT-Validation-Tests.spec.js`, `Delivera-CurrentSprint-Redesign-Validation-Tests.spec.js`, `Delivera-CurrentSprint-Mission-Control-Direct-Value-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Health-And-SSOT-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Blockers-Snapshot-Direct-Value-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Blockers-Trust-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Blockers-EdgeCases-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Work-Risks-Hierarchy-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Burndown-Truthfulness-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Edge-Semantics-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Summary-UX-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Clipboard-Markdown-Validation-Tests.spec.js`, `Delivera-Current-Sprint-Export-Last-Action-Validation-Tests.spec.js`.
  - Primary page: `/current-sprint` (header, verdict, risks, stories hierarchy, exports).

- **`journey.leadership` – Leadership HUD & boards**
  - Specs: `Delivera-Current-Sprint-Leadership-View-Tests.spec.js`, `Delivera-Leadership-Trends-Usage-Validation-Tests.spec.js`, `Delivera-Boards-Summary-Filters-Export-Validation-Tests.spec.js`.
  - Primary pages: `/sprint-leadership` and report trends; covers trends rail, boards summary, and leadership exports.

- **`journey.outcome-intake` – Outcome intake & outcome-first readiness**
  - Specs: `Delivera-Outcome-Intake-And-Readiness-Validation-Tests.spec.js`, `Delivera-Outcome-Context-Trust-Validation-Tests.spec.js`, `Delivera-Outcome-First-Validation-Tests.spec.js`, `Delivera-Outcome-First-No-Click-Hidden-Validation-Tests.spec.js`, `Delivera-Outcome-First-Nav-And-Trust-Validation-Tests.spec.js`, `Delivera-Outcome-First-First-Paint-Validation-Tests.spec.js`.
  - Primary pages: `/report`, `/current-sprint`, `/sprint-leadership` where outcome readiness and first-paint context are surfaced.

- **`journey.ux-core` – Global UX, navigation, trust, responsiveness**
  - Specs: `Delivera-UX-Trust-And-Export-Validation-Tests.spec.js`, `Delivera-UX-Customer-Simplicity-Trust-Full-Validation-Tests.spec.js`, `Delivera-Customer-Speed-Simplicity-Trust-Realtime-Validation-Tests.spec.js`, `Delivera-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js`, `Delivera-Navigation-Consistency-Mobile-Trust-Realtime-Validation-Tests.spec.js`, `Delivera-Mobile-Responsive-UX-Validation-Tests.spec.js`, `Project-Delivera-UX-Responsiveness-Customer-Simplicity-Trust-Logcat-Realtime-Validation-Tests.spec.js`, `Delivera-UX-Login-Trust-Validation-Tests.spec.js`, `Delivera-UX-Report-Flow-And-Exports-Validation-Tests.spec.js`, `Delivera-UX-Enhancements.spec.js`, `Delivera-Direct-To-Value-UX-Validation-Tests.spec.js`, `Delivera-CSS-Build-And-Mobile-Responsive-Validation-Tests.spec.js`, `Delivera-Feedback-UX-Tests.spec.js`, `Delivera-UX-Reliability-Fixes-Tests.spec.js`, `Delivera-UX-Critical-Fixes-Tests.spec.js`, `Delivera-Linkification-EmptyState-UI-Validation-Tests.spec.js`, `Delivera-Cross-Page-Persistence-Validation-Tests.spec.js`, `Delivera-Preview-Timeout-Error-UI-Validation-Tests.spec.js`, `Delivera-Preview-Retry.spec.js`.
  - Primary pages: `/login`, `/report`, `/current-sprint`, `/sprint-leadership` and global nav + responsiveness.

- **`journey.data-integrity` – API contracts, data integrity, exports, SSOT**
  - Specs: `Delivera-API-Integration-Tests.spec.js`, `Delivera-Data-Integrity-Coherence-Contracts.spec.js`, `Delivera-Refactor-SSOT-Validation-Tests.spec.js`, `Delivera-Four-Projects-Q4-Data-Validation-Tests.spec.js`, `Delivera-Vodacom-Quarters-SSOT-Sprint-Order-Validation-Tests.spec.js`, `Delivera-General-Performance-Quarters-UI-Validation-Tests.spec.js`, `Delivera-Report-GrowthVelocity-Validation-Tests.spec.js`, `Delivera-DateWindow-Ordering.spec.js`, `Delivera-Throughput-Merge.spec.js`, `Delivera-CSV-Export-Fallback.spec.js`, `Delivera-Excel-Export-Tests.spec.js`, `Delivera-Column-Tooltip-Tests.spec.js`, `Delivera-Server-Feedback-Endpoint-Validation-Tests.spec.js`, `Delivera-Validation-Plan-Tests.spec.js`, `Delivera-Server-Errors-And-Export-Validation-Tests.spec.js`, `Delivera-EpicKeyLinks.spec.js`.
  - Primary surfaces: `/api` contracts plus report/leadership current-sprint SSOT for boards, quarters, growth velocity, exports.

- **`journey.e2e` – Full E2E journeys & deploy smoke**
  - Specs: `Delivera-Login-Security-Deploy-Validation-Tests.spec.js`, `Delivera-Deploy-Smoke-Validation-Tests.spec.js`, `Delivera-E2E-User-Journey-Tests.spec.js`, `Delivera-E2E-Loading-Meta-Robustness-Tests.spec.js`.
  - Primary focus: full user journeys across login → report → current-sprint → leadership with deploy-safe smoke guarantees.

Journey membership is implemented in `scripts/Delivera-Tests-Journey-Buckets-Map-SSOT.js` (SSOT) and used by:

- `scripts/Delivera-Tests-Journey-Runner-SSOT.js` – `node` CLI behind `npm run test:journey:*`.
- `scripts/Delivera-Test-Orchestration-Steps.js` – orchestration steps now run one journey at a time instead of one spec per step.

### SIZE-EXEMPT Notes

- `server.js`
  - Marker: `// SIZE-EXEMPT: Cohesive Express server entry and preview/export orchestration kept together for operational transparency, logging, and simpler deployment without introducing additional routing layers or indirection.`
  - Rationale: Keeping startup, routing, and preview/export orchestration in one place simplifies operational debugging and avoids scattering core HTTP entry behaviour across multiple files.
- `lib/metrics.js`
  - Marker: `// SIZE-EXEMPT: Cohesive metrics domain logic (throughput, done comparison, rework, predictability, epic TTM) is kept in a single module to avoid scattering cross-related calculations and increasing coordination bugs.`
  - Rationale: Metrics functions are tightly related and operate over the same row data; keeping them together avoids duplicated calculations and subtle drift between separate metric modules.
- `lib/currentSprint.js`
  - Marker: `// SIZE-EXEMPT: Payload-building compute helpers (observed window, days meta, daily completions, stories list, subtask tracking, remaining work by day, scope changes) are tightly coupled to buildCurrentSprintPayload; splitting further would scatter orchestration and increase coordination bugs.`
  - Rationale: Notes I/O, issue-type classification, and burndown/resolve helpers are already split into `Delivera-Data-CurrentSprint-Notes-IO.js`, `Delivera-Data-IssueType-Classification.js`, and `Delivera-Data-CurrentSprint-Burndown-Resolve.js`; remaining compute logic stays in currentSprint for cohesion.
- `public/Delivera-Report-Page-Preview-Flow.js`
  - Marker: `// SIZE-EXEMPT: Cohesive preview flow (DOM events, fetch, AbortController, applyPayload, timeout UI) kept in one module to avoid scattering and duplicate state handling; complexity config split to Preview-Complexity-Config.js.`
  - Rationale: Splitting fetch/apply into a second file would duplicate state and DOM references or create circular dependencies; complexity and timeout constants are already in `Delivera-Report-Page-Preview-Complexity-Config.js`.
- Test specs (E2E): `Delivera-UX-Critical-Fixes-Tests.spec.js`, `Delivera-CurrentSprint-Redesign-Validation-Tests.spec.js`, `Delivera-Excel-Export-Tests.spec.js` each have a SIZE-EXEMPT comment; splitting would duplicate runDefaultPreview/setup and reduce clarity.
- `routes/api.js`
  - Marker: `// SIZE-EXEMPT: Central API surface keeps route handlers co-located for auth, caching, and error-contract consistency across report/current-sprint/outcome flows.`
  - Rationale: Route-level concerns share auth, cache invalidation, and consistency of error envelopes; splitting aggressively here risks contract drift.
- `public/Delivera-Shared-Context-From-Storage.js`
  - Marker: `* SIZE-EXEMPT: Context assembly, rendering, and action semantics are kept together to avoid split-brain display logic between report/current-sprint/leadership surfaces.`
  - Rationale: Cross-page context rendering and interaction actions are tightly coupled; keeping one module avoids duplicate format/render/action logic.

### Current Sprint SSOT Dedup Wave (Focused)

- **Scope:** Current Sprint + shared support modules only (no broad cross-surface rename campaign).
- **Dependency/module map changes:**
  - Added backend helper SSOT: `lib/Delivera-Server-Url-And-Escape-Helpers.js`
    - Exports `buildJiraIssueUrl(host, issueKey)` and `escapeHtml(value)`.
    - Consumed by `routes/api.js` for outcome summary/link rendering.
    - Consumed by `lib/currentSprint.js` for Jira issue URL construction.
  - Frontend context card escaped text now uses shared SSOT:
    - `public/Delivera-Shared-Context-From-Storage.js` imports `escapeHtml` from `public/Delivera-Shared-Dom-Escape-Helpers.js` (removed local duplicate escaper).
- **Duplicate logic removals implemented:**
  - Removed duplicate HTML escaping implementation from `routes/api.js`.
  - Removed duplicate HTML escaping implementation from `public/Delivera-Shared-Context-From-Storage.js`.
  - Removed duplicate hour-diff helper in `lib/currentSprint.js` by reusing `computeHoursSinceIso(...)`.
  - Replaced local Jira URL string assembly in `lib/currentSprint.js` and `routes/api.js` with shared helper.
- **Cycle and reliability guardrails:**
  - No new route aliases introduced.
  - No duplicate storage keys introduced.
  - No parallel URL/escape implementations added in touched modules.
- **Public API surface impact:**
  - No request/response shape changes in `/api/current-sprint.json`, `/api/outcome-from-narrative`, or other API endpoints.
- **Cross-module file move / naming change events:**
  - Added one cross-module helper file: `lib/Delivera-Server-Url-And-Escape-Helpers.js`.
  - Naming follows existing project prefix convention and avoids folder-implied filler segments.

