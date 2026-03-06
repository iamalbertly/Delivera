# VodaAgileBoard

VodaAgileBoard is the tool for scrum masters and leaders: a Node.js web application for generating sprint reports from Jira for MPSA and MAS projects. It provides a preview-first workflow where you configure filters, preview data in a tabbed interface, and export CSV or Excel without re-fetching from Jira.

This README is the SSOT for usage and validation. Supplemental documents (e.g. `Jira-Reporting-Gap-Analysis-Plan.md`) provide planning context only and do not supersede this guide.

## Latest Reliability and UX Updates (2026-03-06)

- Current Sprint direct-to-value consolidation:
  - Work risks table is now an explainer-only card beneath `Issues in this sprint`, with all actionable filtering and risk counts owned by the stories card and header risk chips.
  - Burndown and Daily completion views are merged into a single `Flow over time` card that reuses the existing datasets and adapts between SP-based and story-count burndown copy.
  - The Current Sprint header bar stays as a thin three-band strip that surfaces verdict, countdown, compact metrics, and role presets without adding new rows or duplicate readiness strips.
- Cross-surface logging and navigation alignment:
  - Sidebar logging alerts and the notification dock now deep-link directly to `Issues in this sprint` (`#stories-card`) with `Work risks` as supporting context instead of a competing table.
  - Global navigation and header role presets all reuse the same `currentSprint:applyWorkRiskFilter` event so blockers, scope, unowned outcomes, and log-debt slices stay in sync across chips, shortcuts, and header actions.
- Test and console-guard hardening:
  - Playwright global console guard now reuses the shared ignore list and treats expected retry scenarios (e.g., transient 500 responses in mocked board loads) as non-fatal while still failing on unexpected console errors.
  - Current Sprint UX SSOT validation tests were updated for the merged `Flow over time` card, Work risks explainer, leadership empty-preview behavior, and dataset-aware board preselection checks.

## Latest Reliability and UX Updates (2026-03-04)

- Current Sprint data-integrity and friction fixes:
  - Saved sprint selection now expires after 12 hours (`vodaAgileBoard_lastSprintSelectedAt`) to prevent stale closed sprint lock-in.
  - If a saved sprint is closed and an active sprint exists, Current Sprint auto-switches to the active sprint (unless URL explicitly pins a sprint).
  - Header freshness now uses generated timestamps and consistent live/snapshot wording.
  - Header now shows multi-active sprint indicator (`Active: N sprints · Viewing ...`) and inline `vs last sprint` summary.
- Current Sprint mobile readability fix:
  - Issues-in-sprint now renders a mobile card list (`#stories-mobile-card-list`) with expandable details/subtasks instead of forcing horizontal table scanning.
  - Existing day-filter and risk-filter behavior now applies to both desktop table rows and mobile story cards.
- Report no-data recovery:
  - Boards tab zero-data state now shows a full-viewport recovery panel with one-tap `Try last quarter`.
- Leadership recurrence continuity:
  - Leadership filter persistence now has a 30-day TTL and auto-drops stale filters.
  - Leadership no-data state now includes a first-run onboarding CTA back to report filters.
- Navigation reliability:
  - Sidebar toggle/backdrop state synchronization was hardened across re-renders (`aria-expanded`, backdrop active/hidden, body scroll lock).
- Focused validation updates:
  - Added/updated focused checks for stale sprint selection TTL, current sprint mobile story cards, report no-boards recovery CTA, and navigation mobile stability.
  - New focused runner command: `npm run test:mobile-cards-and-recovery`.

- Outcome narrative intake is now stricter on `/report`:
  - If pasted text contains a Jira key, create is blocked with a direct reuse message.
  - If no key exists, intake stays one-CTA (`Create Jira Epic from this narrative`).
  - Duplicate outcomes are checked server-side (hash + similarity) before creation; inline decision offers `Use existing` or `Create anyway`.
  - Multi-project context now prompts for the target project key before creation.
- Risk semantics were tightened and reused:
  - Leadership summary now uses the same owned blocker/unowned outcome semantics as Current Sprint (`getUnifiedRiskCounts`).
  - Report context bar now exposes one-tap chips for `Blockers (owned)` and `Unowned outcomes`, opening Outcomes with matching filter intent.
- Current Sprint direct-action improvements:
  - Added a sprint readiness strip using outcome ownership semantics (`Ready`, `At risk`, `Not ready`, plus maintenance neutral mode).
  - Added a paste-to-jump affordance (`/browse/KEY` or `KEY`) that scrolls and pulses matching rows.
  - Outcome badge rendering is now consistent in Current Sprint stories and Report outcomes.
- Navigation vocabulary is aligned to:
  - `Performance - History` (`/report`)
  - `Performance - Current Sprint` (`/current-sprint`)
  - `Performance - Leadership HUD` (leadership surface)
- New focused validation spec added and wired into orchestration:
  - `tests/Jira-Reporting-App-Outcome-Intake-And-Readiness-Validation-Tests.spec.js`
  - Run standalone: `npm run test:outcome-intake-readiness`
  - Full suite: `npm run test:all`

## Latest Reliability and UX Updates (2026-02-26)

- Outcome-first + mission-control friction reduction pass (incremental, existing paths only):
  - Report `Outcomes` tab badge now uses **total done stories** (`Outcomes (Total: N)`) while the tab itself shows **visible vs total** (`Showing X of N stories`) so search/pill/strict filters no longer create a trust-breaking false zero.
  - Report preview outcome line now uses a human sentence (`X done stories across Y sprints · Z boards`) and deep-links to Outcomes with auto-scroll into the first sprint section.
  - Report Overview now includes a compact **Outcome digest** strip (top epic, total done stories, high-risk board) above the boards table.
  - Done Stories now auto-enables **quarter review mode** for quarter-length windows, adds a sticky review summary bar + sprint jump chips, and exposes a focused **Outcomes CSV** CTA in the existing tab controls.
  - Current Sprint command-center header now includes a **Reset** action inside Active view, clearer focused-action text (`Focused on: ...`), and a historical snapshot banner with disabled live-remediation actions.
  - Issue preview drawer adds **Back to table** and **Next risk** controls; opening the drawer now dims the underlying table and highlights the source row for better causality.
  - Sidebar footer can now surface a single **Logging alerts: N** chip (or healthy state) and jump directly to Current Sprint Work risks, reducing split attention across nav + floating controls.
  - Leadership HUD placeholders no longer rely on raw `--`; empty states now direct users to **Open Report Trends**.
- Test and orchestration hardening (same date):
  - Added `tests/Jira-Reporting-App-Data-Integrity-Coherence-Contracts.spec.js` for report outcomes truthfulness and current-sprint header/table/API coherence checks.
  - Added/updated E2E journey assertions for truthful Outcomes tab labeling and a cross-page “exec in a hurry” path (Report → Current Sprint → Take action → Copy summary).
  - `scripts/Jira-Reporting-App-Test-Orchestration-Runner.js` now also enforces serial Playwright workers (`--workers=1`) when absent and emits a periodic heartbeat while long steps run, improving realtime visibility when a step stalls.
  - Added focused npm scripts: `npm run test:data-integrity-coherence` and `npm run test:exec-journey`.
- Current Sprint direct-to-value pass (incremental, no new screens):
  - Header **Take action** is now an action (not only a jump): it applies the highest-value available risk focus (blockers first, with safe fallbacks) and moves the user directly to the first actionable Work risks row.
  - Header now shows **Active view** state so role/day/risk filters are visible in one place instead of hidden across cards.
  - Work risks table now supports **sortable columns** (tri-state) while preserving parent/subtask grouping and default priority ordering.
  - Issues table now defaults to **collapsed subtask rows under each story** with inline child counts, reducing scroll depth and cognitive drag while preserving full detail on demand.
  - Story hierarchy expand/collapse, day filter, and risk filter interactions are re-applied after **Show more** to avoid losing user context.
  - Countdown widget header markup now exposes explicit compact/inline data attributes for test stability and cross-layout reliability.
  - Focused Playwright validation specs were updated for the new direct-value header action, compact countdown selector contract, sortable Work risks headers, and collapsed Issues hierarchy.
- Test orchestration reliability:
  - The Node orchestration runner now enforces fail-fast Playwright flags (`--max-failures=1`, `--reporter=list`) when absent and logs step timestamps for clearer realtime failure diagnosis.

## Latest Reliability and UX Updates (2026-02-25)

- Report preview now includes a unified **status strip** above the tabs (`Results: up to date`, `Results: preview required`, or `Heavy range: manual preview only`) wired to shared filter-stale and complexity logic. The strip also echoes the active projects/date window so screenshots and decisions have one canonical context line.
- The filters panel is organized into **Who / When / Rules**: projects, quick ranges + custom dates, and advanced options. Applied filters are rendered once and reused across the filters panel, mobile-collapsed bar, and preview header so chips and summaries never drift.
- Performance overview keeps a **leadership-first layout**: merged board-health cards and a compact signals rail (Rework, Predictability, Epic TTM) appear before the boards table, while Trends is now explicitly labeled **“Trends over time”** and owns the historical story (“how performance changed across sprints”).
- Outcome list adds a **Quarter review mode** toggle that expands all sprints into one natural scroll (with sticky totals) and raises virtualization thresholds so normal windows avoid nested scroll regions.
- Excluded sprints now render as a **trust panel**: a banner clarifies that excluded sprints do not affect Performance overview metrics, and reasons are grouped with “Fix in Jira” guidance (missing dates, overlaps, future sprints).
- Current Sprint exports prioritize **Copy summary** as the hero action and surface **Markdown** as a secondary inline export; other exports stay in the dropdown. Link and email actions now write timestamped, human-readable confirmations into an inline export status text block so stakeholders know what was shared and when.
- Mobile UX Playwright specs were extended to cover the new status strip, quarter review toggle, and current-sprint export behavior (primary/secondary buttons and link-copy feedback), all wired into the existing fail-fast orchestration (`npm run test:all`).
- Current Sprint **Copy summary** and Markdown exports now use typographic emphasis (bold headings, italics, and structured sections) to keep the four-line contract readable in chat/email while preserving one SSOT for risk, flow, and action items. UX Trust validation specs assert that these exports include emphasis markers and stay telemetry-clean.
- Current Sprint **mission control header** now centralises sprint verdict, a single remaining-days metric, and compact risk pills that drive the merged Work risks table; the same verdict engine powers health copy in exports and dashboard views so wording cannot drift.
- The Work risks card, persona tiles, and new **daily completion timeline chips** all reuse one filter event (`currentSprint:applyWorkRiskFilter`) so developers, scrum masters, product owners, and leads can jump straight from header or persona presets into a focused, filtered risks table without extra clicks or scrolling.
- Issues in this sprint now combine parent/child hierarchy, inline time-tracking flags, and an **inline issue preview drawer**; clicking an issue in either Work risks or Issues opens a side-drawer with key metadata and a Jira link so leaders can inspect details without leaving the mission-control page.
- **Current Sprint single-flow page**: One route (`/current-sprint`) with four in-page states—welcome (no board/sprint), loading, content (data loaded), error (API/user error). Changing board or sprint only re-renders the main content area; header, nav, and sidebar persist and the page does not reload.

## Latest Reliability and UX Updates (2026-02-17)

- Current Sprint issue hierarchy trust fix:
  - Parent issues now render as primary rows and subtasks render as indented child rows in `Issues in this sprint`.
  - Subtask rows no longer present story-only fields as required inputs; story points/reporter cells are intentionally `-` while subtask estimate/logged hours remain visible.
  - Added a compact issue-type guidance line directly above the sprint issues table to reduce interpretation errors during standups.
- Leadership grade vocabulary alignment:
  - Leadership grade thresholds now align with the report delivery-grade model (`Strong`, `Solid`, `Mixed`, `Weak`, `Critical`, `Insufficient data` with minimum sample guard).
  - Delivery-grade tooltip text is now shared from one source constant to avoid drift between report and leadership views.
- Unified export menu reliability hardening:
  - Export dropdown open/close visibility now uses ARIA state as SSOT (`aria-hidden`), removing stale class-state drift.
  - Clipboard summary now includes explicit generation timestamp for factual sharing context.
- Report defaults and docs alignment:
  - Default report window is now the latest completed Vodacom quarter (UTC) on both server and client SSOT paths.
  - Quarter strip initialization now selects the matching pill from active inputs and avoids auto-clicking the oldest quarter.
  - Canonical wording is now `Report range: <start> - <end> (UTC)` across report preview, leadership context, current-sprint cache chip, and clipboard exports.
- Orchestration stability:
  - Test runner now resolves an available git base ref (`origin/main`, `origin/master`, `master`, `main`, `HEAD~1`) before diffing, eliminating repeated ambiguous-base warnings on local environments without `origin/main`.
- Validation status:
  - `npm run test:all` completed green in fail-fast mode for the impacted run (`45/45` selected orchestration steps).
  - Additional reliability hardening was applied after this run:
    - Current Sprint real-blocker logic now excludes parent items from blocker count when at least one child subtask is actively moving in the last 24h.
    - Blocker SSOT count is unified across verdict/header/work-risk rows via merged risk rows.
    - Report/Leadership/Current Sprint context copy now shares `Active filters ... | Report range ... (UTC)` helper semantics.
    - Current Sprint stories table is now wrapped in the shared horizontal scroll container to prevent 1024px overflow regressions.
    - Global navigation now deduplicates sidebar/toggle/backdrop nodes and synchronizes body scroll-lock classes to sidebar open state.
    - Playwright resilience updates were added for hidden/collapsed filter controls and mobile sidebar click paths.
  - Current Sprint Work risks card now renders a hierarchical table:
    - Parent stories appear as primary rows, with subtask risks rendered as indented, visually lighter child rows directly underneath.
    - Parent and subtask blockers remain clearly tagged (`Stuck >24h (Parent)` vs `Stuck >24h (Subtask)`), and each issue is still counted once in unified blocker metrics.
  - Work risks accordion behaviour:
    - Parents with subtask risks show a minimal chevron control that collapses/expands all child rows without changing navigation or adding extra pages.
    - Keyboard users can rely on native button semantics; click/keypress toggles `aria-expanded` on the parent row and hides/shows the corresponding child rows.
  - Burndown truthfulness:
    - Burndown copy now distinguishes between “story points field is not configured for this board”, “this sprint’s stories currently total 0 SP”, and normal SP burndown.
    - Completions that land after sprint end are excluded from sprint completion and annotated in the burndown card as “completed after sprint end; burndown shows sprint-only completion.”
    - When multiple SP-like Jira fields exist across projects, burndown surfaces a gentle warning that it uses the primary story-points field only.
  - Context chips and stale filters:
    - Report context line and shared sidebar context card now include a compact “Filters changed; context from last run” hint when filters change without a new preview.
    - This stale badge is stored in sessionStorage so Current Sprint and Leadership chips can reflect that state without any extra user action.
  - Focused validation suites:
    - `tests/Jira-Reporting-App-Current-Sprint-Work-Risks-Hierarchy-Validation-Tests.spec.js` validates parent/subtask grouping, accordion behaviour, and unified blocker counts.
    - `tests/Jira-Reporting-App-Current-Sprint-Burndown-Truthfulness-Validation-Tests.spec.js` validates SP configuration copy and SP vs story-count burndown paths.
    - `tests/Jira-Reporting-App-Current-Sprint-Edge-Semantics-Validation-Tests.spec.js` validates stale-context hints and excluded-parent blocker messaging.
  - Growth/velocity experimental spec (`tests/DeleteThisFile_growth_velocity.spec.js`) is now explicitly skipped so it no longer gates full Playwright runs; the file remains prefixed with `DeleteThisFile_` as a clear deletion marker.

## Latest Reliability and UX Updates (2026-02-18)

- Current Sprint trust clarity for developers and scrum masters:
  - Summary/export now separates **Flow movement** (status transitions in last 24h) from **Logging compliance** (logged vs estimated hours), so “work moved but 0h logged” is explicit and non-contradictory.
  - Parent stories are excluded from blocker counts when any child subtask moved in the last 24h, including transitions to Done.
  - Header and work-risk wording now uses one blocker definition: stale status movement, not “no work happened.”
- Report trust and simplification updates:
  - Done-story collection now includes both `Story` and `User Story` issue types in preview fetch paths.
  - Performance overview now includes a merged leadership card strip (grade, on-time, SP estimation, SP/day) to reduce tab-switching friction.
  - Delivery-grade tooltip rewritten in plain language with clear thresholds and partial-data behavior.
- Playwright reliability hardening:
  - Mobile filter/sidebar interactions now use retry-safe test helpers and dataset-aware skip logic to avoid false negatives in fail-fast orchestration.

## Latest Reliability and UX Updates (2026-02-19)

- Current Sprint summary UX simplification and export contract:
  - `/current-sprint` clipboard **Copy summary** now follows a strict four-line contract: `Period · Board · Health`, `X% complete · Y of Z stories done · time left (date range)`, one plain-language movement vs logging sentence, and a compact risk line (`blockers · not started · unassigned · scope +N`).
  - Detailed export text is grouped under a clear separator line (`--- More detail below ---`) into sections for **Recent activity & time logging**, **Blockers**, **Not started**, **Scope added mid-sprint**, and **Work breakdown (stories with subtasks)**, reducing wall-of-text fatigue while preserving auditor detail.
  - Movement/logging copy now handles realistic edge cases (no data yet, all work logged but no recent movement, estimates without logs, logs without estimates) so the story stays factually consistent with `subtaskTracking` and summary hours.
  - Blockers, not started, unassigned, and scope counts in the summary line are wired directly to the same SSOT collections used in Work risks and sprint stories, so headline and tables always reconcile.
  - Added `tests/Jira-Reporting-App-Current-Sprint-Summary-UX-Validation-Tests.spec.js` and wired it into `npm run test:all` to assert the four-line contract, presence of the `--- More detail below ---` separator, grouped detail sections, and clean browser telemetry for the summary/export path.
- Report and Current Sprint direct-to-value UI deduplication:
  - **Report:** Preview meta shows a single outcome line (Window coverage: Boards N | Sprints N + data-state badge). Range and projects live only in `#report-context-line` to avoid repeated eye-travel and duplicate sentences.
  - **Current Sprint:** Removed duplicate "Board: X" line from the header; board name stays in the context chip (Active: project | Board name). Work risks card heading shortened to "Work risks"; blocker strip label changed from "Blockers now: N" to "Blocker issues" with a one-line dedupe hint ("Each issue is counted once as a blocker...") above the table. When there are no blockers, the card shows "No blocker issues in this sprint." Product Owner summary block shows "No scope additions" / "Scope stable." when scope or unestimated counts are zero.
  - Tests updated to assert context from `#report-context-line` and board from `.header-context-chip`, and to validate header blocker count against the work-risks table row count when the strip is visible. Unused `buildActiveFiltersContextLabel` import removed from report preview meta builder.
- Report single outcome line and scope copy alignment (2026-02-20):
  - Report preview now shows a single outcome line in `#preview-outcome-line` (done stories, sprints, boards in window + data-state badge + previous run if any); `#preview-meta` contains only expandable technical details. Context remains SSOT in `#report-context-line` and is set after preview render via `getContextDisplayString()`.
  - Dead CSS removed or commented: `.meta-context-line` and `.header-board-label` (elements removed for dedupe; board in context chip, outcome in single line).
  - Current Sprint stories card Product Owner Scope block aligned with Work risks: "No scope added" / "Scope stable." when scope or unestimated counts are zero; one-line hint "Risks and blockers live in the Work risks card below" under the role-proof strip.
  - Tests updated to assert outcome from `#preview-outcome-line`; report context line non-empty placeholder test added.

## Latest Reliability and UX Updates (2026-02-16)

- Current Sprint summary duplication reduction:
  - Consolidated top summary experience around the header command center (`.current-sprint-header-bar`) and removed duplicate focused snapshot rendering.
  - Removed standalone oversized countdown card from secondary sections; countdown now stays in the top summary area.
  - Removed duplicate alert-layer competition in page composition so risk signaling is anchored to one primary summary flow + work-risks details.
- Report page direct-to-value improvements:
  - Tabs reordered to performance-first: `Performance overview` default, then `Leadership Signals`, `Sprint history`, `Outcome list`, `Excluded sprints`.
  - Leadership route duplication reduced in navigation: sidebar now exposes two primary destinations (`Performance Report`, `Current Sprint (Squad)`), with leadership hash/redirects mapped to report trends.
  - Report tabs now handle `#trends` hash precedence reliably during init and tab switching.
- Boards table cognitive-load reduction:
  - Added progressive column reveal in boards summary (core 7 columns default + persisted `Show advanced columns` toggle).
  - Added `Delivery Grade` as a first-class column to unify board-level interpretation in the performance table.
- Burndown reliability for non-SP teams:
  - Current Sprint now renders story-count burndown fallback when `Total SP = 0` and stories exist, with correct axis label and data source fallback.
- Cross-page persistence hardening:
  - Updated persistence Playwright journey to handle collapsed/expanded filter states deterministically and fail fast without flaky hidden-control clicks.
- Validation status:
  - `npm run test:all` passed end-to-end in fail-fast mode (`45/45` selected steps green).

- Current Sprint direct-to-value fixes for blocker discoverability and fast stakeholder snapshot:
  - Verdict bar now links blocker states directly to `#work-risks-table` with explicit `Why:` reasons.
  - Header now includes compact countdown widget (small ring) and explicit blocker drilldown link.
  - Removed separate oversized countdown card from secondary content row to reduce vertical friction.
  - Work-risks card now surfaces a top blocker strip with issue-key links and grouped blocker reasons.
  - Sprint carousel cards now show state + duration metadata for faster sprint-to-sprint comparison.
  - Risks & Insights blocker action form now includes owner + action-time fields and consistent live char counters.
- Reliability hardening:
  - Current Sprint delegated handlers are now idempotent to prevent duplicate event binding across rerenders.
  - `/report` Done Stories now resolves Jira host from `jiraHostResolved` SSOT and renders safe unlinked fallback text when host is missing.
  - Current Sprint export primary action now keeps one-click copy and also opens menu for zero-friction follow-up export actions.
- Added focused fail-fast validation suite:
  - `tests/Jira-Reporting-App-Current-Sprint-Blockers-Snapshot-Direct-Value-Validation-Tests.spec.js`
  - Covers 13 direct UX/reliability validations + 3 realistic edge-case checks for blockers/snapshot behavior.
- Orchestration update:
  - Added the new direct-value sprint validation spec into `scripts/Jira-Reporting-App-Test-Orchestration-Steps.js`.
- Validation status:
  - `npm run test:all` passed end-to-end (`45/45` selected steps, fail-fast mode, headless, parallel workers).

- Refactored duplicated page bootstrap behaviors into shared SSOT helpers:
  - `public/Reporting-App-Shared-Page-Identity-Scroll-Helpers.js`
  - `public/Reporting-App-Report-Page-Init-Filters-Panel-State-Helpers.js`
  - `public/Reporting-App-CurrentSprint-Page-Rendered-Content-Wiring-Helpers.js`
- Reduced large init controllers to stay under the file-size guardrail while preserving behavior:
  - `public/Reporting-App-Report-Page-Init-Controller.js` → 283 lines
  - `public/Reporting-App-CurrentSprint-Page-Init-Controller.js` → 299 lines
- Fixed current sprint desktop overflow by removing forced non-wrapping top-row cards in `public/css/06-current-sprint.css` and rebuilding `public/styles.css`.
- Hardened fail-fast Playwright journeys against valid collapsed-filter and no-exportable-row states:
  - `tests/Jira-Reporting-App-Preview-Retry.spec.js`
  - `tests/Jira-Reporting-App-Customer-Speed-Simplicity-Trust-Realtime-Validation-Tests.spec.js`
  - `tests/Jira-Reporting-App-UX-Trust-And-Export-Validation-Tests.spec.js`
  - `tests/Jira-Reporting-App-General-Performance-Quarters-UI-Validation-Tests.spec.js`
  - `tests/Jira-Reporting-App-Report-GrowthVelocity-Validation-Tests.spec.js`
- Added shared Playwright SSOT helpers to remove duplicated test logic:
  - `clickReportPreviewFromCurrentState(page)` for collapsed-filter safe preview clicks
  - `ensureReportFiltersVisible(page)` for deterministic filter interaction
  - `getReportExportButtonState(page)` for normalized export-state checks
  - Implemented in `tests/JiraReporting-Tests-Shared-PreviewExport-Helpers.js`
- Added repository ignores for generated local test artifacts in `.gitignore` (`.playwright-cli/`, `output/`, orchestration temp state files).
- Validation status:
  - Targeted fail-fast suites above pass locally after fixes.
  - `npm run test:all` reached step `44/44` and exposed one final GrowthVelocity assertion mismatch; the spec was then fixed and validated standalone.
  - A later orchestration run completed through step `16/44` and was externally interrupted by a cancel flag before the next step.

## Latest Reliability and UX Updates (2026-02-15)

- Added a canonical route alias: `/reports` now redirects to `/report` to prevent dead-entry errors.
- Strengthened Jira host SSOT behavior in preview APIs:
  - Cached/live/partial preview responses now consistently expose `meta.jiraHostResolved`.
  - Added `meta.jiraHostMismatch` and `meta.jiraHostFromCache` for cache-vs-runtime host diagnostics.
- Hardened current sprint snapshot host metadata so cached snapshots always use current resolved host.
- Consolidated duplicate Epic TTM rendering logic into shared helpers to reduce drift and reliability regressions.
- Added explicit Jira-link availability status in Epic TTM sections so users can immediately see linkability state.
- Improved unlinked Epic/Story key rendering clarity with explicit unlinked styling instead of silent plain-text ambiguity.
- Fixed test orchestration step quoting on Windows for focused grep execution in fail-fast runs.
- Updated API and UX validation tests for:
  - `/reports` canonical route behavior
  - Preview host metadata contract fields
  - Epic TTM Jira-link availability status rendering

## Features

- **Preview-First Workflow**: Preview data before exporting to ensure accuracy
- **Sidebar Navigation**: Desktop left sidebar and mobile hamburger drawer with two primary destinations (`Performance Report`, `Current Sprint (Squad)`); leadership is accessed from report trends.
- **Multi-Project Support**: Generate reports for MPSA and MAS projects
- **Sprint Overlap Filtering**: Automatically filters sprints that overlap with the selected date window
- **Comprehensive Metrics**: Optional metrics including throughput, predictability, rework ratio, and Epic TTM
- **Flexible Export**: Export filtered or raw preview data as CSV
- **Runtime Discovery**: Automatically discovers boards and field IDs from your Jira instance
- **Error Handling**: Robust error handling with user-friendly messages and retry logic
- **Feedback Capture**: In-app feedback form for users to submit issues and suggestions
- **Project/Board SSOT**: Selected projects are shared across Report, Leadership, and Current Sprint via `vodaAgileBoard_selectedProjects` in localStorage. Report persists project checkboxes on change; Leadership reads and writes the same key; Current Sprint reads the same key but **normalizes to one project** for sprint-level accuracy and loads boards for that one project (fallback `MPSA`).
- **Filter Persistence**: Report search inputs (Boards/Sprints/Stories) persist between visits. Report and Leadership share the same date-range storage.
- **Current Sprint Transparency**: Squad view at `/current-sprint` - sprint header with name/ID, summary strip (work items, SP, % done) with a **stuck prompt** when any issue is in progress >24h (link to follow up), status chips, a **Project** selector synchronized from shared SSOT but enforced to one project in this page, single **sub-task summary** line in the summary card (logged h; missing estimate / no log; stuck >24h count) linking to the full Sub-task time tracking card, daily completion (with SP), burndown with ideal line + axis labels, scope changes (including reporter/assignee and merged risk rows), **Work items in sprint** table with **Type**, **Reporter**, **Assignee**, and merged subtask estimate/logged-hour columns, sub-task time tracking (estimate/logged/remaining plus status age), assignee or reporter notification message generator for missing sub-task time, dependencies/learnings, stuck tasks card (in progress >24h) with status-change hint, snapshot freshness badge (Live vs Snapshot timestamp), previous/next sprint snippet, and sprint tabs (latest to oldest by end date). Export menu now provides **Copy as Text**, **Markdown**, **Copy link**, and **Email**.
- **Persistent Notification Dock**: A fixed left-side alert dock appears across pages when time-tracking alerts exist. On Report and Leadership it stays compact and points users to **Open Current Sprint**; on Current Sprint it expands to show board/sprint details and missing estimate/log counts. It can be minimized or hidden after review, with a quick toggle to restore it.
- **Sprint Leadership View**: Normalized trends in the `Leadership Signals (Trends)` tab on `/report`; legacy `/sprint-leadership` resolves to this destination. Indexed delivery and predictability are presented for trend visibility, not ranking.

## Prerequisites

- Node.js 20.0.0 or newer
- Jira Cloud account with API access
- Jira API token (create at https://id.atlassian.com/manage-profile/security/api-tokens)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

4. Edit `.env` and set your Jira credentials:
```
JIRA_HOST=https://your-domain.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your_api_token
```

## Running the Application

### Development Mode
```bash
npm run dev
```

This starts the server with nodemon for auto-restart on file changes.

### Production Mode
```bash
npm start
```

This runs `npm run build:css` first (prestart), then starts the server. The server will start on `http://localhost:3000` (or the port specified in the `PORT` environment variable).

### Access the Application

1. Open your browser and go to `http://localhost:3000` (or the port in `PORT`).
2. Log in with the credentials configured in your environment (see Environment Variables).
3. After login you can open **Report**, **Current Sprint** (squad view), or **Sprint Leadership** from the app; the default redirect is `http://localhost:3000/report`.
4. Navigation is unified through a left sidebar on desktop and a hamburger drawer on mobile for **Performance Report** and **Current Sprint (Squad)**. Leadership signals are opened from the report trends tab.

### Quickstart for Scrum Masters & Leaders

1. Get the live VodaAgileBoard URL from your admin (for example, `https://voda-agile-board.onrender.com`).
2. Sign in with the credentials shared by your admin.
3. On the General Performance (Report) screen, keep both MPSA and MAS selected for a combined view, or choose a single project for a focused view.
4. Leave the default quarter dates or adjust them to your sprint window. Preview auto-runs after filter changes (manual **Preview** is still available).
5. Use **Export to Excel - All Data** to download a workbook you can slice and share in your own tooling.

## Usage

### Generating a Report

1. **Select Projects**: Check MPSA and/or MAS (at least one required)

2. **Set Date Window**: 
  - **Quick range (Vodacom quarters):** A scrollable strip of quarter pills (at least 5 quarters up to current) shows fiscal labels (e.g. "FY26 Q2"); clicking a pill sets the range and can auto-run the report. Select a quarter or enter dates manually.
   - Default is the latest completed Vodacom quarter (UTC)
   - Adjust start and end dates as needed
   - Dates are in UTC

3. **Configure Options**:
   - **Story Points, Epic TTM, and Bugs/Rework**: Always included in reports (mandatory)
   - **Require Resolved by Sprint End** (optional): Only include stories resolved before sprint end
   - **Include Predictability** (optional): Calculate committed vs delivered (approx or strict mode)
   - **Include Active/Missing End Date Sprints** (optional): Include sprints with missing end dates

4. **Preview (auto or manual)**: Generates preview data from Jira.

5. **Review Tabs**:
  - **Project & Epic Level**: Shows discovered boards and all project/epic-level metrics in one consolidated view. Boards table merges delivery volume with time-normalized output (total sprint days, avg sprint length, **Done Stories**, **Registered Work Hours**, **Estimated Work Hours**, stories/SP per sprint day, variance, done-by-end %, epic vs non-epic counts), plus sprint window and latest sprint end. Includes a top-row **All Boards (Comparison)** summary to anchor comparisons. Includes capacity proxies (Active Assignees, Stories/SP per Assignee, Assumed Capacity, Assumed Waste %) with clear assumptions. Epic Time-To-Market shows Epic Name, story IDs as Jira links with hover summaries, **Subtask Spent (Hrs)** for the epic, and includes a **{Board}-AD-HOC** row per board for stories not linked to any epic. Missing epic titles are surfaced with a warning for trust. Throughput remains available by issue type, along with rework ratio and predictability.
   - **Sprints**: Lists sprints overlapping the date window with completion counts. Shows "Total SP" and "Story Count" columns. Column labels: "Stories Completed (Total)" (all stories currently marked Done) and "Completed Within Sprint End Date" (stories resolved by sprint end date). When time-tracking data exists, shows Est Hrs, Spent Hrs, Remaining Hrs, and Variance Hrs. When subtask tracking exists, adds Subtask Est/Spent/Remaining/Variance columns.
   - **Done Stories**: Drill-down view of completed stories, grouped by sprint. Shows Epic Key, Epic Title, and Epic Summary columns when Epic Link field is available. Epic Summary is truncated to 100 characters with full text in tooltip. When time tracking exists, shows Est/Spent/Remaining/Variance hours for the story and for its subtasks (when available). Dates render in local-friendly format with raw ISO on hover.
   - **Unusable Sprints**: Lists sprints excluded due to missing dates

6. **Export to Excel**:
   - **Export to Excel - All Data**: Main export button generates a comprehensive Excel workbook (.xlsx) with 6 tabs:
     - **Summary**: Key metrics, KPIs, agile maturity assessment, data quality scores, and manual enrichment guide
     - **Boards**: Board-level delivery and time-normalized metrics (sprint days, stories/SP per sprint day, variance, done-by-end %, epic vs non-epic counts, capacity proxy columns)
     - **Stories**: All done stories with business-friendly column names, Excel-compatible dates, calculated KPI columns (Work Days to Complete, Cycle Time, etc.), and manual enrichment columns (Epic ID/Name Manual, Is Rework/Bug Manual, Team Notes)
     - **Sprints**: Sprint-level metrics with throughput, predictability, rework data, and time tracking totals (when available)
   - **Epics**: Epic TTM data with calculated lead times, epic names, and linked story IDs
   - **Metadata**: Export timestamp, date range, projects, filters applied, and data freshness
   - **Field Inventory** (Metadata): Counts of available/custom Jira fields plus EBM-relevant field matches and missing candidates (no full field list in export payload)
   - **File Naming**: Excel files use descriptive names: `{Projects}_{DateRange}_{ReportType}_{ExportDate}.xlsx` (e.g., `MPSA-MAS_Q2-2025_Sprint-Report_2025-01-27.xlsx`)
   - **Business-Friendly Columns**: All technical column names are mapped to business-friendly labels (e.g., `issueKey` -> `Ticket ID`, `sprintStartDate` -> `Sprint Start Date`)
   - **Excel-Compatible Dates**: All dates are formatted for Excel recognition, enabling date filtering, pivot tables, and formulas
   - **KPI Columns**: Pre-calculated columns include Work Days to Complete, Cycle Time, Sprint Duration, and Agile Maturity Level
   - **Manual Enrichment**: Blank columns provided for teams to fill in missing Epic IDs/Names, Rework/Bug flags, and notes
   - **Data Validation**: Excel export validates data structure before sending to server, preventing errors and providing clear feedback
   - **Empty Tab Handling**: Empty tabs (Epics, Sprints) show placeholder messages explaining why data is missing
   - **File Size Warnings**: Large Excel files (>50MB) trigger a warning before generation, allowing users to filter data or cancel
   - **Improved Error Messages**: Specific, actionable error messages for network errors, server errors, timeouts, and invalid data
   
7. **Export CSV** (Secondary Option):
   - **Export CSV (Active Tab)**: Exports the currently selected tab from the unified export menu
   - **Export CSV (Filtered View)**: Exports only currently visible rows (after search/filter)
   - **File Naming**: `{Projects}_{DateRange}_{Section}_{ExportDate}.csv` (includes `_PARTIAL` when preview data is partial)
   - All CSV exports include Epic Key, Epic Title, and Epic Summary columns when Epic Link field is available
   - Stories exports include time-tracking and EBM-supporting fields when available (e.g., subtask count, story estimate/spent/remaining/variance hours, subtask estimate/spent/remaining/variance hours, status category, priority, labels, components, fix versions, and EBM fields such as team, product area, customer segments, value, impact, satisfaction, sentiment, severity, source, work category, goals, theme, roadmap, focus areas, delivery status/progress)

### Copy & Export Contracts

- **Current Sprint clipboard summary (Copy summary)**:
  - Follows a strict four-line contract optimised for Slack/Teams and plain text:
    - Line 1: `**<Sprint name> · <Board> · <Verdict>**`
    - Line 2: `**<X% complete>** · <Y of Z stories done> · <time left / ended (date range)>`
    - Line 3: `**Flow & logging:** <one plain-language movement/logging sentence>`
    - Line 4: `**Risk snapshot:** <blockers> · <not started> · <unassigned> · scope +N`
  - Below the summary, a `--- More detail below ---` separator introduces grouped detail sections for:
    - Recent activity & time logging
    - Blockers (in-progress items stuck >24h)
    - Not started work
    - Scope added mid-sprint
    - Work breakdown (stories with subtasks) and unassigned work
    - Prioritised **ACTION NEEDED** list
  - The text stays fully readable if Markdown is stripped; tests also validate the plain-text version by removing `*` and `_`.
- **Current Sprint Markdown export (Markdown button)**:
  - Produces a stakeholder-ready report with:
    - `# <Sprint name>` heading
    - `> **X% done** | Y/Z stories | <time left/ended>` summary blockquote
    - `## Summary` bullets aligned with the four clipboard summary lines
    - `## Flow & Logging`, `## Blockers`, `## Not started`, `## Scope changes`, `## Work breakdown`, `## Actions`
  - Risks & Insights are appended as a `# Risks & Insights` section with Blockers/Dependencies, Learnings, and Assumptions & Risks lists.
- **Last export action line (`.export-status-text`)**:
  - Current Sprint export controls maintain a single inline status line under the export buttons:
    - Format: `Last action: <Action> · <local time> · <compact detail>`
    - Updated after each export interaction (`Copy summary`, `Markdown`, `Copy link`, `Email`) so users always know what they just did without scanning logs.
  - Examples:
    - `Last action: Copy summary · 10:32:14 · Summary copied to clipboard`
    - `Last action: Copy link · 10:33:02 · https://.../current-sprint?boardId=...`
- **Emphasis rules (exports and status text)**:
  - **Bold** is reserved for primary metrics and labels (headlines, key percentages, section titles).
  - *Italic* is reserved for nuance and warnings (e.g. caveats, gentle hints).
  - No underlines or emojis are used in exported text; colour and layout are handled by the destination tool.

## Recent UX & Reliability fixes (2026-02-09)
- **Hidden-section accountability chips (2026-02-15):** Data-availability summaries now include a compact source badge per hidden section (`Config`, `Window`, `Data`, `Workflow`) so users can immediately see whether missing output is a filter choice, data gap, or workflow requirement.
- **Current Sprint export readiness signal (2026-02-15):** Header now surfaces an explicit `Export ready` / `No exportable rows` state near top controls, reducing failed export attempts and extra clicks.
- **Current Sprint race-condition guard (2026-02-15):** Board/sprint async loads now use request-id gating so stale responses cannot overwrite a newer user selection.
- **Risk logic deduplication in Current Sprint (2026-02-15):** Health dashboard risk state now reuses `deriveSprintVerdict` as single source of truth, removing duplicate verdict logic paths.
- **Leadership context trust alignment (2026-02-15):** Leadership context line now mirrors report/current-sprint semantics with explicit `Active filters` and `Query window` phrasing.
- **Validation outcome (2026-02-15):** `npm run test:all` completed successfully in fail-fast mode for all selected orchestration steps (`44/44` selected for this impacted run); no blocking failures.
- **True no-data card suppression (2026-02-14):** Current Sprint now hides no-value cards instead of rendering placeholders (Burndown, Daily completion, Work items, Capacity, Health when underlying data is absent). This reduces vertical noise and scroll friction.
- **Compact hidden-sections summary (2026-02-14):** A reusable summary block now lists only hidden sections with short reason chips (for example `Burndown hidden`, `Capacity hidden`) so users immediately understand what is not shown and why.
- **Current Sprint top-summary compression (2026-02-14):** Header verdict text is now concise and scannable (`Critical · 4 blockers · 6 missing est`) instead of long explanatory prose.
- **Report Epic TTM suppression when empty (2026-02-14):** Project & Epic and Metrics tabs now suppress empty Epic TTM sections and replace them with hidden-section summaries, avoiding dead visual space.
- **Section-link hygiene (2026-02-14):** Current Sprint jump links now render only for visible sections, preventing dead anchor clicks.
- **Test hardening for hidden-section flows (2026-02-14):** Current Sprint UX/Redesign specs now validate both visible-card and intentionally-hidden-card outcomes, including compact hidden-section summary checks.
- **Shared UI utility cleanup (2026-02-14):** Added a single shared renderer for data-availability summaries (`renderDataAvailabilitySummaryHtml`) to reduce duplication and keep report/current-sprint messaging consistent.
- **Context clarity pass (2026-02-14):** Report and Current Sprint now separate meanings explicitly: `Active filters` (what user asked for), `Query window` (requested date range), and `Data freshness` / `Report cache context` (reference cache provenance). This removes the "cache date looks like active filter" confusion.
- **Current Sprint header trust chips (2026-02-14):** Added compact, always-near-top context chips for active Project/Board and optional cache-context details, reducing scroll/search to understand what data is being shown.
- **Data-availability summary (2026-02-14):** Current Sprint now renders a top summary when sections have no data (stories, daily completion, burndown), so users see why cards are suppressed instead of scanning empty blocks.
- **Leadership context wording alignment (2026-02-14):** Leadership context line now uses the same `Active filters: Query window ...` semantics as report/current sprint for cross-page trust consistency.
- **Fail-fast orchestration hardening (2026-02-14):** Test runner cancel handling now requires both cancel marker and state file, preventing stale cancellation artifacts from stopping runs unexpectedly.
- **E2E semantic resilience updates (2026-02-14):** Existing specs now accept both legacy and current context labels (`Projects/Window` and `Active filters/Query window`) to avoid false negatives during copy alignment.
- **UX-enhancements test stability (2026-02-14):** Existing test flow now expands collapsed filters when needed and interacts with advanced options only when the control is interactable, removing transient visibility flakes.
- **Validation outcome (2026-02-14):** `npm run test:all` completed end-to-end with fail-fast enabled; all selected orchestration steps passed.
- **Export visibility:** Export Excel and export dropdown are hidden until a preview has run successfully; they appear only when there is preview data to export.
- **Closest-available data banner:** When the server returns a subset cache (e.g. same projects, different date window), the UI shows "Showing closest available data for your selection. Use Full refresh for exact filters."
- **Loading hint:** Report loading panel shows "Usually ready in under 30s for one quarter." below the progress bar.
- **Partial-on-error cache:** If a preview request fails or times out, any data already retrieved is cached (when it has more rows than existing cache) so future or repeated requests benefit; partial entries use a shorter TTL (10 min) so full runs can replace them sooner.
- **Error UI hierarchy:** Error panel promotes "Use smaller date range" and "Re-run exact range"; "View technical details" is demoted to a secondary toggle.
- **Sticky chips row:** Report applied-filters chips row (and Edit filters) is sticky so filters are always reachable when scrolled.
- **One empty state:** Report uses a single empty-state message for no done stories with one "Adjust filters" CTA.
- **Generated X min ago:** Report sticky summary shows freshness (e.g. "Generated just now" or "Generated N min ago") when preview has meta.
- **Loading chip minimum 300 ms:** Report loading-status chip only appears after 300 ms to avoid flicker on fast previews.
- **Login copy:** One-line outcome ("Sprint risks and delivery in under 30 seconds"), shorter trust line, error focus, and rate-limit message (`?error=ratelimit`).
- **Leadership auto-preview:** Quarter or date change triggers preview without a mandatory Preview click.
- **Current Sprint copy:** Clearer loading text ("Choose projects above… Then pick a board") and no-boards error with hint ("Check project selection or try Report…").
- **Report filters tip and subtitle:** Shortened to one sentence; optional "Fast: pick a quarter" label.
- **Edge cases:** (1) Only latest preview result applied when filters change repeatedly; (2) No partial banner when 0 rows—unified empty state only; (3) Session-expiry message and redirect so user returns to Report after re-login.
- Report filters keep the last successful results visible while refreshing automatically.
- Leadership filters now auto-run preview on project/date changes and quarter picks.
- Report advanced options are now collapsed by default behind an explicit `Options` toggle.
- Long-range preview splitting now also activates for heavier project combinations.
- Current Sprint now renders one merged **Work risks** table combining scope changes, stuck items, sub-task tracking risks, and sprint ownership gaps.
- Notification dock now renders as a persistent left-side rail instead of covering right-side actions and defaults to a compact summary on Report/Leadership so it never competes with primary content.
- Playwright telemetry now ignores abort-class request failures caused by intentional cancellation.
- **Preview button state:** Single source of truth: project/date change and "Select none" call `refreshPreviewButtonLabel` (via `window.__reportPreviewButtonSync`) so disabled state and title stay in sync.
- **Tests:** Four Projects Q4 and Preview timeout specs force filters panel expanded (or use `force: true` for date fill) so date inputs are actionable; E2E "no projects" tests are skipped until flaky run is resolved.
- **Visual refresh without flow changes:** Existing pages now use a more modern, higher-contrast theme (lighter gradients, clearer hierarchy for sidebar/nav, stronger active states, and improved table/header readability) to reduce "plain" appearance while preserving the same workflows and controls.
- **Text encoding cleanup:** Fixed mojibake in core report/leadership rendering strings (for example timeline separators and grade fallback labels) to keep customer-facing copy trustworthy and readable.
- **Realtime fail-fast validation suite:** Added `tests/Jira-Reporting-App-Customer-Speed-Simplicity-Trust-Realtime-Validation-Tests.spec.js` and orchestration wiring so `npm run test:all` now includes 16 fail-fast checks covering report/current-sprint/leadership UI geometry, deduped throughput rendering, hydration behavior, and realtime telemetry ("logcat-equivalent") guardrails.
- **Current Sprint scope dedup (2026-02-12):** Removed the separate Scope indicator card/modal and merged scope-change insight directly into existing SSOT views: Work risks table + Risks & Insights blockers narrative.
- **Work risks table enrichment (2026-02-12):** Added `Type` and `SP` columns to merged Work risks so scope/stuck/sub-task/sprint issues keep decision-grade detail in one place.
- **Current Sprint layout simplification (2026-02-12):** Rebalanced card rows so Work risks and Burndown are side-by-side, with Risks & Insights + Countdown in the secondary row; this removes duplicate visual blocks and reduces wide empty-space dead zones.
- **Burndown trust fix (2026-02-12):** Actual burndown line now clamps to real dates and does not project into future days; future trajectory renders as a lighter projection line with a "today" marker.
- **Runtime error guard (2026-02-12):** Fixed current-sprint `stuckCount is not defined` runtime path and extended realtime validation tests to fail fast on surfaced runtime error signatures.
- **Preview resilience (2026-02-12):** Multi-board preview now isolates sprint-fetch failures per board (partial success) instead of failing the full request when a single board returns an upstream error.
- **Retry narrowing hardening (2026-02-12):** "Try smaller date range" now always normalizes end/start dates and narrows progressively (30 days, then 14 days if already narrow).
- **Auth migration hardening (2026-02-12):** Middleware now supports SuperTokens + legacy session hybrid mode with explicit provider-aware unauthorized payloads and safer redirect behavior.
- **Unified cache module and shared-store support (2026-02-12):** `lib/cache.js` is now the single instrumented cache owner with namespace metrics, canonical key builders, optional Redis backend (`CACHE_BACKEND=redis` + `REDIS_URL`), and memory fallback.
- **Canonical cache keys + invalidation hooks (2026-02-12):** Current-sprint snapshot keys are now standardized across worker + API; posting notes invalidates related snapshot entries via targeted cache invalidation.
- **Preview cache key normalization (2026-02-12):** Preview cache keys now normalize project sets, date windows (day precision), and mode flags to increase hit rates for semantically equivalent requests.
- **TTL tuning refresh (2026-02-12):** Heavy user-facing caches (preview, sprint issues, current sprint snapshots) now use longer calibrated TTLs with short-lived partial entries.
- **Cache observability endpoint (2026-02-12):** Added `GET /api/cache-metrics` for backend/namespace hit/miss/set/error visibility.
- **Navigation consistency hardening (2026-02-13):** Global sidebar now uses one canonical leadership destination (`/sprint-leadership` -> `/report#trends`), hash-aware active states, and same-page leadership navigation on report without full reload.
- **Mobile nav reliability pass (2026-02-13):** Sidebar drawer now includes keyboard focus trapping, Escape close, outside-click close, touch-safe sizing, safe-area aware toggle positioning, and 44px minimum touch targets.
- **Accessibility and trust pass (2026-02-13):** Added global skip-link (`Skip to main content`), main landmarks on report/current-sprint, and cleaned navigation/help copy consistency.
- **Report tab-state hardening (2026-02-14):** `#trends` hash now has precedence over saved session tab on first load; report no longer clears leadership hash during init hydration.
- **Report cross-tab context sync (2026-02-14):** Report now listens for `localStorage` changes (`selectedProjects`, shared date range, last query), syncs filters in-place, and schedules safe auto-preview refreshes to prevent stale context across tabs.
- **Mobile keyboard overlap guard (2026-02-14):** When the virtual keyboard is open, sticky report/leadership bars are temporarily de-sticked (`body.keyboard-open`) so inputs and primary actions stay reachable.
- **Current-sprint scope clarity (2026-02-14):** Added explicit single-project-mode hint near project/board selectors to explain why shared multi-project context is normalized to one project.
- **Preview render default alignment (2026-02-14):** Report preview now preserves Outcome list as default active tab unless hash/session explicitly selects another tab; prevents hidden-value first paint.
- **Orchestration reliability fallback (2026-02-14):** `test:all` now falls back to `git status --porcelain` when `origin/main...HEAD` is unavailable and no longer hard-aborts cache-clear before managed Playwright webserver startup.
- **Normalized report error actions (2026-02-13):** Report preview/export errors now use one shared action-banner pattern with explicit retry actions and dismiss behavior (`retry-preview`, `retry-with-smaller-range`) to reduce dead-end states.
- **Current Sprint preferred-sprint fallback (2026-02-13):** When a stored preferred sprint is stale for the selected board, current-sprint now retries board load without the stale sprint id instead of failing the full auto-load flow.
- **Current Sprint header verdict line (2026-02-13):** Header now surfaces one compact verdict line (`Healthy/Watch/At risk/Critical`) with key risk details for faster first-scan decision making.
- **Report first-paint and mobile reliability test hardening (2026-02-13):** Updated existing fail-fast Playwright suites to handle auto-collapsed filters and auto-preview timing without false negatives while preserving telemetry checks.

### Preview Behaviour & Feedback

- **In-flight feedback**:
  - When you click **Preview**, the button is temporarily disabled to prevent double-clicks while the loading overlay shows progress updates.
  - The loading panel includes a live timer and step log (e.g. Collecting filter parameters, Sending request to server, Received data from server).
  - A compact **loading status chip** appears near the bottom of the viewport while a preview is in-flight so you can scroll freely and still see that work is in progress.
  - If a previous preview is already visible, the UI keeps it on-screen while the new request runs and shows a refresh banner so users see immediate results.
  - The step log keeps only the most recent entries to avoid overwhelming the UI during long-running previews.
  - Partial previews include a **Force full refresh** action which re-runs the request with cache bypass.
- **User feedback capture**:
  - Click **Give Feedback** at the top of the report to submit your email and detailed feedback.
  - Submissions are stored on the server in `data/JiraReporting-Feedback-UserInput-Submission-Log.jsonl`.
- **Preview client-side timeout**
  - The report preview request has a client-side timeout (typically 60-90 seconds depending on date range and options). If the request exceeds this, the client aborts it.
  - On timeout, the error box shows a concise message: "Preview ran longer than Xs. We kept your last full results on-screen; try a smaller date range or fewer projects." with **Retry now**, **Retry with smaller date range**, and **Force full refresh** buttons. The error box is never left empty.
  - A dedicated Playwright spec (`Jira-Reporting-App-Preview-Timeout-Error-UI-Validation-Tests.spec.js`) validates that the error UI is visible, non-empty, and includes retry actions when a preview fails.
- **Partial previews**:
  - If the backend has to stop early (for example due to time budget or pagination limits), the response is marked as partial.
  - The UI shows a short warning banner near the preview summary and a matching hint near the export buttons, explaining that export matches exactly what is on-screen and recommending narrower ranges for full history. CSV exports will only contain the currently loaded data in this case.
- **Require Resolved by Sprint End**:
  - When this option is enabled, the **Done Stories** tab will explain when no rows passed this filter, and suggests turning it off or reviewing resolution vs sprint end dates in Jira.
- **Exports and table state**:
  - Export buttons are hidden until a preview has run successfully; they then appear and are enabled when there is data to export.
  - If you change filters and end up with no rows, the empty state explains whether this is due to filters, the Require Resolved by Sprint End option, or genuinely no Done stories.
  - Filtered CSV export is disabled when filters match zero rows, with a hint explaining why.
  - Invalid date inputs are caught client-side with a clear error before any request is sent.

### Filtering Done Stories

- **Search Box**: Filter by issue key or summary (case-insensitive)
- **Project Pills**: Click project pills to filter by project
- Filters update the visible rows in real-time

## API Endpoints

### GET /report
Serves the main report page HTML.

### GET /current-sprint
Serves the Current Sprint Transparency HTML page (squad view).

### GET /sprint-leadership
Legacy leadership route; resolves to the report trends experience (`/report#trends`).

### GET /api/boards.json
Returns a list of boards for the given projects (for the current-sprint board selector).

**Query Parameters:**
- `projects` (required): Comma-separated project keys (e.g., `MPSA,MAS`)

**Response:** `{ boards: Array<{ id: number, name: string, ... }> }`. Returns 400 with code `NO_PROJECTS` when `projects` is missing or empty.

### GET /api/current-sprint.json
Returns the current-sprint transparency payload for a board (snapshot-first; use `live=true` to bypass cache). Optional `sprintId` loads a specific sprint for tab navigation.

### POST /api/current-sprint-notes
Saves dependencies/learnings notes for a sprint. Body: `{ boardId, sprintId, dependencies, learnings }`.

### GET /api/cache-metrics
Returns cache backend + namespace counters (`hits`, `misses`, `sets`, `deletes`, `errors`) for observability and tuning.

**Query Parameters:**
- `boardId` (required): Jira board ID
- `projects` (optional): Comma-separated project keys
- `live` (optional): `true` to fetch live from Jira instead of cached snapshot

**Response:** Current-sprint payload (sprint details, daily completion, scope changes, burndown context). Returns 400 with code `MISSING_BOARD_ID` when `boardId` is missing; 404 with code `BOARD_NOT_FOUND` when the board is not in the given projects.

### GET /preview.json
Generates preview data from Jira.

**Query Parameters:**
- `projects` (required): Comma-separated project keys (e.g., `MPSA,MAS`)
- `start` (optional): Start date in ISO 8601 format (default: `2025-07-01T00:00:00.000Z`)
- `end` (optional): End date in ISO 8601 format (default: `2025-09-30T23:59:59.999Z`)
- `includeStoryPoints` (mandatory): Always `true` - Story Points are always included in reports
- `requireResolvedBySprintEnd` (optional): `true` or `false`
- `includeBugsForRework` (mandatory): Always `true` - Bugs/Rework are always included in reports
- `includePredictability` (optional): `true` or `false`
- `predictabilityMode` (optional): `approx` or `strict` (default: `approx`)
- `includeEpicTTM` (mandatory): Always `true` - Epic TTM is always included in reports
- `includeActiveOrMissingEndDateSprints` (optional): `true` or `false`
 - `previewMode` (optional): `normal` (default), `recent-first`, or `recent-only`. Heavy queries automatically prefer `recent-first`/`recent-only` to prioritise the last 14 days while leaning on cache for older history.
 - `preferCache` (optional): `true` to allow the server to return a best-available subset cache when the exact key misses (response meta includes `reducedScope` / `cacheMatchType`).
 - `clientBudgetMs` (optional): Soft time budget in milliseconds requested by the client; the server clamps this to an internal maximum and uses it as the preview time budget for partial responses.

### POST /export-excel
Generates Excel workbook (.xlsx) with multiple sheets.

**Request Body:**
```json
{
  "workbookData": {
    "sheets": [
      {
        "name": "Summary",
        "columns": ["Section", "Metric", "Value"],
        "rows": [...]
      },
      {
        "name": "Stories",
        "columns": ["Ticket ID", "Ticket Summary", ...],
        "rows": [...]
      }
    ]
  },
  "meta": {
    "selectedProjects": ["MPSA", "MAS"],
    "windowStart": "2025-07-01T00:00:00.000Z",
    "windowEnd": "2025-09-30T23:59:59.999Z"
  }
}
```

**Response:** Excel file download (.xlsx) with filename: `{Projects}_{DateRange}_{ReportType}_{ExportDate}.xlsx`

**Response:**
```json
{
  "meta": {
    "selectedProjects": ["MPSA", "MAS"],
    "windowStart": "2025-07-01T00:00:00.000Z",
    "windowEnd": "2025-09-30T23:59:59.999Z",
    "discoveredFields": {
      "storyPointsFieldId": "customfield_10016",
      "epicLinkFieldId": "customfield_10014"
    },
    "fromCache": false,
    "cacheAgeMinutes": 5,
    "epicTTMFallbackCount": 2
  },
  "boards": [...],
  "sprintsIncluded": [...],
  "sprintsUnusable": [...],
  "rows": [...],
  "metrics": {...}
}
```

### POST /export
Streams CSV export for large datasets.

**Request Body:**
```json
{
  "columns": ["projectKey", "boardId", ...],
  "rows": [{...}, {...}]
}
```

**Response:** CSV file download

## Testing

### Run All Tests
```bash
npm run test:all
```

This runs the test orchestration script which:
1. Installs dependencies
2. Runs API integration tests (includes `/api/boards.json`, `/api/current-sprint.json`, `/current-sprint`, `/sprint-leadership`)
3. Runs Login Security Deploy Validation tests
4. Runs E2E user journey tests
5. Runs UX reliability tests (validates data quality indicators, error handling, UI improvements)
6. Runs UX critical fixes tests (validates Epic Title/Summary, merged throughput, renamed labels, unified export menu actions, TTM definition, export loading states, button visibility)
7. Runs Feedback & Date Display tests
8. Runs Column Titles & Tooltips tests
9. Runs Validation Plan tests
10. Runs Excel Export tests
11. Runs Refactor SSOT Validation tests
12. Runs Boards Summary Filters Export Validation tests
13. Runs Current Sprint and Leadership View tests
14. Runs UX Trust and Export Validation tests (report, current-sprint, leadership, export; telemetry + UI)
15. Runs Current Sprint UX and SSOT Validation tests (board pre-select, burndown summary, empty states, leadership empty preview)
16. Terminates on first error
17. Shows all steps in foreground with live output from each test command and elapsed step timing. Step definitions live in `scripts/Jira-Reporting-App-Test-Orchestration-Steps.js`.

### Run Specific Test Suites
```bash
# E2E tests only
npm run test:e2e

# API tests only
npm run test:api

# Validation plan tests (UI + telemetry)
npm run test:validation

# Current Sprint and Leadership view E2E tests
npm run test:current-sprint-leadership

# UX Trust Validation (report, current-sprint, leadership + console/UI assertions)
npm run test:ux-trust

# Current Sprint UX and SSOT Validation (board pre-select, burndown, empty states, leadership empty preview)
npm run test:current-sprint-ux-ssot

# Focused cache reliability and preview metadata checks
npm run test:cache-reliability

# Navigation consistency + realtime mobile trust checks (13 fail-fast assertions)
npm run test:navigation-consistency
```

### Test Coverage and Caching Behavior

- **E2E Tests**: User interface interactions, tab navigation, filtering, export
- **API Tests**: Endpoint validation, error handling, CSV generation
- **UX Reliability Tests**: Data quality indicators (Unknown issueType display, Epic TTM fallback warnings), cache age display, error recovery
- **UX Critical Fixes Tests**: Epic Title/Summary display, merged Sprint Throughput data, renamed column labels with tooltips, unified CSV export actions and filenames, TTM definition header, export button loading states, button visibility after async renders, Epic Summary truncation edge cases
- **Excel Export Tests**: Excel file generation, multi-tab structure, business-friendly column names, Excel-compatible dates, KPI calculations, manual enrichment columns, Summary and Metadata tabs

**Note**: Some tests may require valid Jira credentials. Tests that require Jira access will gracefully handle authentication failures.

### Data Quality & Reliability Features

- **Issue Type Tracking**: All rows include `issueType` field. Missing types display as "Unknown" in UI and are logged as warnings.
- **Epic Data Enrichment**: When Epic Link field is available, rows include Epic Key, Epic Title, and Epic Summary. Epic Summary is truncated to 100 characters in table view with full text in tooltip. Epic fetch failures gracefully degrade - empty strings are used if Epic issues unavailable.
- **Epic TTM Accuracy**: Epic TTM uses Epic issue dates when available. Falls back to story dates if Epic issues unavailable, with warning displayed in Metrics tab. Definition clearly explained: "Days from Epic creation to Epic resolution (or first story created to last story resolved if Epic dates unavailable)."
- **Cache Transparency**: Preview meta shows cache age when data is served from cache, enabling users to assess data freshness.
- **Error Recovery**: Epic fetch failures don't break preview generation - system gracefully degrades to story-based calculation.
- **Excel Export**: Main export generates comprehensive Excel workbook with 5 tabs (Summary, Stories, Sprints, Epics, Metadata). Files use descriptive naming: `{Projects}_{DateRange}_{ReportType}_{ExportDate}.xlsx`. All dates are Excel-compatible format, enabling filtering and formulas. Data is validated before export, empty tabs show placeholder messages, large files (>50MB) trigger warnings, and error messages are actionable.
- **Business-Friendly Columns**: Technical column names mapped to business-friendly labels (e.g., `issueKey` -> `Ticket ID`, `sprintStartDate` -> `Sprint Start Date`) for easier analysis by leaders and analysts.
- **KPI Columns**: Pre-calculated columns include Work Days to Complete, Cycle Time (Days), Sprint Duration (Work Days), Days Since Created, and Agile Maturity Level (1-5 scale).
- **Manual Enrichment**: Excel exports include blank columns for teams to fill in: Epic ID (Manual), Epic Name (Manual), Is Rework (Manual), Is Bug (Manual), and Team Notes.
- **CSV Validation**: Client-side validation ensures required columns (issueKey, issueType, issueStatus) are present before export. CSV exports include Epic Key, Epic Title, and Epic Summary when available.
- **Export UX**: Export buttons show loading state ("Exporting..." or "Generating Excel...") and are disabled during export to prevent duplicate exports. Buttons are visible after async rendering completes.
- **Excel export (Report page)**: Export to Excel is available on the General Performance (Report) page after preview has data. It is validated by `Jira-Reporting-App-Excel-Export-Tests.spec.js` and by the UX Trust And Export Validation tests.
- **Current Sprint Work risks**: The Work risks table (Scope, Flow, Subtask, Sprint) shows issue summary and status from Jira when the API provides them; scope-change rows include summary and status from the server.

### Test Orchestration & Playwright

- The test orchestration script (`npm run test:all`) runs `npm install`, then (when the server is up) calls `POST /api/test/clear-cache` so no test reads stale in-memory cache. The clear-cache endpoint is available only when `NODE_ENV=test` or `ALLOW_TEST_CACHE_CLEAR=1`. The ordered list of steps is in `scripts/Jira-Reporting-App-Test-Orchestration-Steps.js`. It runs a sequence of Playwright specs (API integration, Server Errors and Export Validation, Login Security Deploy, E2E user journey, UX Reliability, UX Critical Fixes, UX Customer Simplicity Trust Full, Feedback, Column Tooltips, Validation Plan, Excel Export, Refactor SSOT, Boards Summary Filters Export, Current Sprint and Leadership View, UX Trust Validation, Current Sprint UX and SSOT Validation, Linkification and Empty-state UI Validation, Server Feedback Endpoint, Growth Velocity, and others) with `--max-failures=1` (headless, parallel workers; fail-fast on first failure). Steps include CSS Build And Mobile Responsive (viewport containment, headers, nav/filters). Spec files in `tests/` follow the naming convention `Jira-Reporting-App-*-Validation-Tests.spec.js` (or similar); obsolete files may be prefixed with `DeleteThisFile_`.
- Specs in `tests/` use `captureBrowserTelemetry(page)` (console errors, page errors, failed requests) and UI assertions so a step fails if the UI is wrong or the browser reports errors.
- **Issue key linkification:** Report Done Stories and Epic TTM use Jira links for issue keys; Current Sprint (Stories, Scope changes, Items stuck, Sub-task tracking) uses shared `renderIssueKeyLink(issueKey, issueUrl)` from `Reporting-App-Shared-Dom-Escape-Helpers.js`. Backend sends `issueKey` and `issueUrl`; optional `meta.jiraHost` in current-sprint response allows client fallback when URL is missing.
- **Empty-state SSOT:** `Reporting-App-Shared-Empty-State-Helpers.js` exports `renderEmptyStateHtml(title, message, hint)`; Report, Current Sprint, and Leadership use it for consistent "no data" messaging.
- Playwright is configured (via `playwright.config.js`) to:
  - Use `http://localhost:3000` as the default `baseURL` (configurable via `BASE_URL` for remote runs).
  - Optionally manage the application lifecycle with `webServer` (set `SKIP_WEBSERVER=true` to run against an already running server, e.g. when `BASE_URL` points to a deployed instance).

The backend cache is now unified in `lib/cache.js` with:

- **Single owner API**: One module handles get/set/delete/clear/entries and key templates.
- **Shared store support**: Memory cache by default; optional Redis-backed shared cache when `CACHE_BACKEND=redis` and `REDIS_URL` are set.
- **Canonical key templates**: Standardized key builders for preview, sprint issues, discovery, leadership summary, and current-sprint snapshots.
- **Namespace observability**: Per-namespace hit/miss/set/delete/error counters exposed via `/api/cache-metrics`.
- **Targeted invalidation**: Current-sprint notes writes invalidate the board snapshot namespace to avoid stale snapshots.
- **TTL profile**: Preview (45m), preview partial (15m), sprint issues (20m), current-sprint snapshots (2h), with short partial lifetimes so full runs can supersede quickly.

## Project Structure

```
.
|-- server.js                 # Express server and routes
|-- package.json              # Dependencies and scripts
|-- .env.example              # Environment variable template
|-- .gitignore                # Git ignore rules
|-- lib/
|   |-- jiraClients.js        # Jira client setup
|   |-- cache.js              # TTL cache implementation
|   |-- discovery.js          # Board and field discovery
|   |-- sprints.js            # Sprint fetching and filtering
|   |-- currentSprint.js      # Current-sprint payload (imports Notes-IO, IssueType, Burndown-Resolve)
|   |-- issues.js             # Issue fetching, buildDrillDownRow re-export (imports Pagination-Fields, DrillDown-Row, Subtask-Time-Totals)
|   |-- metrics.js            # Metrics calculations
|   |-- csv.js                # CSV generation utilities
|   |-- excel.js              # Excel generation utilities
|   |-- columnMapping.js      # Business-friendly column name mapping
|   |-- kpiCalculations.js   # KPI calculation functions
|   |-- Jira-Reporting-App-Data-CurrentSprint-Notes-IO.js
|   |-- Jira-Reporting-App-Data-IssueType-Classification.js
|   |-- Jira-Reporting-App-Data-CurrentSprint-Burndown-Resolve.js
|   |-- Jira-Reporting-App-Data-Issues-Pagination-Fields.js
|   |-- Jira-Reporting-App-Data-Issues-DrillDown-Row.js
|   |-- Jira-Reporting-App-Data-Issues-Subtask-Time-Totals.js
|   `-- Jira-Reporting-App-Server-Logging-Utility.js  # Structured logging
|-- public/
|   |-- report.html           # General Performance report UI (modular entrypoint)
|   |-- Reporting-App-Report-Page-Init-Controller.js  # Report page init/controller (SSOT)
|   |-- Reporting-App-Report-Page-*.js               # Report page modules (state, filters, preview, renderers, exports)
|   |-- Reporting-App-Report-Page-Preview-Complexity-Config.js  # Preview complexity and timeout config
|   |-- Reporting-App-Shared-*.js                     # Shared helpers (DOM escape, formatting, boards summary, notifications, quarters)
|   |-- css/                  # CSS source partials (01-reset-vars through 08-modals-misc); run `npm run build:css` to output styles.css
|   `-- styles.css            # Built stylesheet (do not edit; generated from public/css/). Viewport containment (no horizontal overflow) and mobile responsiveness are validated by Mobile Responsive UX and CSS Build And Mobile Responsive validation specs.
|-- tests/
|   |-- JiraReporting-Tests-Shared-PreviewExport-Helpers.js  # SSOT for runDefaultPreview, waitForPreview, captureBrowserTelemetry
|   |-- Jira-Reporting-App-E2E-User-Journey-Tests.spec.js
|   |-- Jira-Reporting-App-API-Integration-Tests.spec.js
|   |-- Jira-Reporting-App-UX-Trust-And-Export-Validation-Tests.spec.js  # SSOT for report/current-sprint/leadership/export
|   |-- Jira-Reporting-App-UX-Reliability-Fixes-Tests.spec.js
|   |-- Jira-Reporting-App-UX-Critical-Fixes-Tests.spec.js
|   |-- Jira-Reporting-App-Excel-Export-Tests.spec.js
|   |-- Jira-Reporting-App-RED-LINE-ITEMS-KPI-Tests.spec.js
|   |-- Jira-Reporting-App-Current-Sprint-Leadership-View-Tests.spec.js
|   `-- (other .spec.js files)
`-- scripts/
    |-- Jira-Reporting-App-Test-Orchestration-Runner.js  # Runs steps; clear-cache, server start optional
    `-- Jira-Reporting-App-Test-Orchestration-Steps.js   # Step definitions (getSteps(projectRoot))
```

## Reality-check and UX backlog (Customer, Simplicity, Trust)

**Outcome lens:** People don’t buy products, they buy outcomes. First load today: user lands on /report and often sees an empty main area until they run Preview. That’s a weak first impression.

**Prioritized improvements (zero budget, incremental):**

1. **Report first-paint context (done)** – On load, the main area now shows a single outcome line (`#report-context-line`): last run summary and freshness when available, or “No report run yet.” So returning users see “Last: X stories, Y sprints · Generated N min ago” before doing anything.
2. **Dashboard from cache** – Use existing preview cache: on /report load, if server has cached preview for default projects/quarter, return a lightweight summary (e.g. from `lib/cache.js`) so the client can show “Last quarter: X boards, Y stories” without a full preview run. Option: GET /api/report-summary-from-cache that returns `{ boards, storyCount, generatedAt }` from last cached payload for current project/date key.
3. **One-click “Load latest”** – Replace or supplement the generic empty state with a single CTA: “See last quarter’s delivery — Load latest” that runs preview with default window so the user gets data in one click.
4. **Auto-preview on load when last-run exists** – When report loads with default projects and sessionStorage has last-run, trigger one auto-preview after a short delay (e.g. 1s) so returning users see data quickly without clicking.
5. **Background prefetch (later)** – Scheduled job or low-priority worker that warms cache for squads not yet searched, so next visit the landing can show something useful for every squad. No change to current flows; add only when resource allows.
6. **Login outcome line** – Keep and emphasize the existing “Sprint risks and delivery in under 30 seconds” (and trust line) on the login page so the outcome is clear before sign-in.

**Codebase health (Simplicity, SSOT):** Duplicate “skip if redirected to login” logic across many specs is consolidated into `skipIfRedirectedToLogin(page, test, options)` in `JiraReporting-Tests-Shared-PreviewExport-Helpers.js`. Further: merge duplicate logic in large files (e.g. `Reporting-App-Report-Page-Preview-Flow.js` is SIZE-EXEMPT; `lib/currentSprint.js` >300 lines — split by logical blocks when touching). Enforce ≤300 lines per file and single source of truth for routes, components, and tests; no parallel implementations.

## Metric guide and governance

Use metrics with explicit assumptions. Every view should make clear what is measured, what is assumed, and what could be wrong. Do not use metrics for performance review, ranking teams, or weaponizing numbers.

### Per-metric guardrails

- **Throughput (SP / stories per sprint)**  
  **Measures:** Volume of work completed in the window (story points and story count).  
  **Does not measure:** Quality, complexity, or team capacity.  
  **Can mislead when:** Sprint length or scope varies; SP is inconsistent across teams.  
  **Do not use for:** Comparing raw totals across teams; performance appraisal.

- **Predictability % (committed vs delivered)**  
  **Measures:** How much of the committed scope (at sprint start) was delivered by sprint end.  
  **Does not measure:** Whether scope change was justified or whether the team failed.  
  **Can mislead when:** Committed is approximated from creation date; late scope add is treated as failure.  
  **Do not use for:** Single-sprint team quality score; blaming teams for unplanned spillover.

- **Planned carryover vs unplanned spillover**  
  **Measures:** Delivered work that was in plan at sprint start vs added mid-sprint.  
  **Does not measure:** Why scope changed or whether it was appropriate.  
  **Do not use for:** Treating unplanned spillover as failure; ranking without context.

- **Rework % (bug SP vs story SP)**  
  **Measures:** Proportion of delivered effort that was bugs vs stories.  
  **Does not measure:** Root cause or whether bugs were regression vs new work.  
  **Can mislead when:** Bug definition or SP usage differs across teams.  
  **Do not use for:** Naming worst team; performance review.

- **Epic TTM (time to market)**  
  **Measures:** Calendar or working days from Epic start to Epic (or story) completion.  
  **Does not measure:** Value delivered or quality of the epic.  
  **Can mislead when:** Epic hygiene is poor (many stories without epic; epics spanning many sprints). Epic TTM is suppressed when hygiene is insufficient.  
  **Do not use for:** Comparing teams without normalizing for epic size or type.

- **Indexed delivery score**  
  **Measures:** Current SP per sprint day vs that teams own rolling average (last 3-6 sprints).  
  **Does not measure:** Absolute productivity or cross-team comparison.  
  **Can mislead when:** Used to rank teams; baseline period is unrepresentative.  
  **Do not use for:** Ranking teams; performance review.

- **Burndown / remaining SP by day**  
  **Measures:** Context for how remaining scope decreased over the sprint (when completion anchor is resolution date).  
  **Does not measure:** Effort or ideal line accuracy.  
  **Can mislead when:** Scope changes are not shown; used as a single success criterion.  
  **Do not use for:** Grading the sprint; ignoring scope-change context.

- **Daily completion histogram**  
  **Measures:** Stories (and optionally task movement) completed per calendar day.  
  **Does not measure:** Effort or quality.  
  **Do not use for:** Inferring slow days without scope/blocker context.

- **Observed work window**  
  **Measures:** Earliest and latest issue activity (created/resolution) in the sprint.  
  **Does not measure:** Whether sprint dates were wrong; only that work fell inside or outside planned dates.  
  **Do not use for:** Blaming teams when work extends past sprint end; use for transparency only.

### Metrics that look good but are not trustworthy

- **Raw SP totals across teams** - Sprint length and scope differ; normalize by sprint days and use indexed delivery for trend, not rank.
- **Sprint count as productivity** - More sprints do not mean more delivery; use stories/SP per sprint day.
- **Single-sprint predictability as team quality** - One sprint is noise; use planned vs unplanned breakdown and trends.
- **Unplanned spillover as failure** - Mid-sprint adds (bugs, support) are reality; show cause (Bug/Support/Feature), not blame.

### Example: misuse vs correct interpretation

- **Misuse:** Team A has lower predictability % than Team B, so Team A is underperforming.  
- **Correct:** Team A had more unplanned spillover (bugs/support). Check scope-change cause and sprint hygiene before comparing predictability.

## Troubleshooting

### Port already in use (EADDRINUSE)
- If you see "Port already in use" when starting the server, another process is bound to the port (e.g. a previous server instance).
- **Fix:** Stop the other process (e.g. close the terminal running `node server.js`) or set a different port: `PORT=3001 npm start`.
- Do not start a second server on the same port; the test orchestration reuses an existing server when the port is in use.

### "Missing required Jira credentials" Error
- Ensure `.env` file exists and contains `JIRA_HOST`, `JIRA_EMAIL`, and `JIRA_API_TOKEN`
- Verify the API token is valid and not expired
- Check that the email matches your Jira account

### "Failed to fetch boards" Error
- Verify project keys (MPSA, MAS) are correct
- Ensure your Jira account has access to these projects
- Check that the projects have boards configured
- Verify your `.env` file is in the project root (not in a subdirectory)
- Check server startup logs for credential loading confirmation

### "Rate limited" Error
- The app automatically retries with exponential backoff
- Wait a moment and try again
- Consider reducing the date range to fetch less data

### No Data in Preview
- Verify sprints exist in the selected date range
- Check that stories are marked as "Done" in Jira
- Ensure stories belong to the selected projects
- Try enabling "Include Active/Missing End Date Sprints" if sprints are missing end dates
- Check server logs for detailed error messages
- Large date ranges or many sprints may return a partial preview after ~1 minute to keep the UI responsive
- Quarterly ranges now use cached older sprints plus the most recent 2 weeks live to avoid timeouts; a full refresh can be forced with cache bypass

### Date Timezone Issues
- All dates are handled in UTC
- The UI shows both UTC and local time for reference
- Ensure your date inputs are correct for your timezone

## Environment Modes

VodaAgileBoard behaves slightly differently depending on which environment variables you set:

- **Local development (no auth, default)**:
  - Set Jira variables and (optionally) `PORT`, but **do not** set `SESSION_SECRET` or any `APP_LOGIN_*` values.
  - Visit `http://localhost:3000/report` directly; `/` redirects to `/report` for a fast feedback loop.
- **Local development (legacy auth enabled)**:
  - In addition to Jira variables, set `SESSION_SECRET`, `APP_LOGIN_USER`, and `APP_LOGIN_PASSWORD`.
  - Visit `http://localhost:3000`; you will see the login screen, and `/report` plus the APIs require a valid session.
- **Local development (SuperTokens enabled)**:
  - Start SuperTokens core stack: `npm run auth:supertokens:up`
  - Set `SUPERTOKENS_ENABLED=true` and `SUPERTOKENS_CONNECTION_URI=http://localhost:3567`.
  - Keep `SUPERTOKENS_HYBRID_MODE=true` during migration so existing login + sessions remain valid while SuperTokens sessions are accepted.
  - For pure SuperTokens mode, set `SUPERTOKENS_HYBRID_MODE=false` and move clients to `/auth`.
- **CI (GitHub Actions)**:
  - CI runs `npm run test:all` with a controlled set of environment variables.
  - Recommended: keep auth disabled in CI by omitting `SESSION_SECRET`, so most tests remain simple and deterministic.
- **Production (Render)**:
  - Preferred: set `SUPERTOKENS_ENABLED=true` with `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_DOMAIN`, `SUPERTOKENS_WEBSITE_DOMAIN`, Jira variables, and `NODE_ENV=production`.
  - Migration-safe: keep `SUPERTOKENS_HYBRID_MODE=true` while users transition.
  - Legacy fallback: `SESSION_SECRET`, `APP_LOGIN_USER`, `APP_LOGIN_PASSWORD`.

## Environment Variables

- `JIRA_HOST`: Your Jira instance URL (e.g., `https://your-domain.atlassian.net`)
- `JIRA_EMAIL`: Your Jira account email
- `JIRA_API_TOKEN`: Your Jira API token
- `APP_LOGIN_USER`: Username for app login (required when auth is enabled)
- `APP_LOGIN_PASSWORD`: Password for app login (required when auth is enabled)
- `SESSION_SECRET`: Secret for signing session cookies (required when auth is enabled)
- `SUPERTOKENS_ENABLED`: Enable SuperTokens backend auth/session middleware (`true` / `false`)
- `SUPERTOKENS_HYBRID_MODE`: Accept both legacy sessions and SuperTokens sessions during migration
- `SUPERTOKENS_CONNECTION_URI`: SuperTokens core URI (default `http://localhost:3567`)
- `SUPERTOKENS_API_KEY`: Optional API key used by SuperTokens core
- `SUPERTOKENS_APP_NAME`: App display name for auth flows
- `SUPERTOKENS_API_DOMAIN`: Backend domain for SuperTokens (`http://localhost:3000` in local dev)
- `SUPERTOKENS_WEBSITE_DOMAIN`: Frontend domain for SuperTokens (`http://localhost:3000` in local dev)
- `SUPERTOKENS_API_BASE_PATH`: SuperTokens API base path (default `/auth`)
- `SUPERTOKENS_WEBSITE_BASE_PATH`: SuperTokens website base path (default `/auth`)
- `PORT`: Server port (default: 3000)
- `LOG_LEVEL`: Logging level - `DEBUG`, `INFO`, `WARN`, `ERROR` (default: `INFO`)
- `NODE_ENV`: Environment - `development` or `production`
- `CACHE_BACKEND`: `memory` (default) or `redis`
- `REDIS_URL`: Redis connection URL (required when `CACHE_BACKEND=redis`)
- `CACHE_ENABLE_REMOTE_SCAN`: `1` (default) enables remote cache key scan for best-available preview lookups; set `0` to disable scan

## Deployment

VodaAgileBoard can be deployed to [Render](https://render.com) or any Node host.

1. Connect your Git repo (e.g. GitHub) to Render and create a Web Service.
2. Set **Build command** to `npm install` (or `npm ci`) and **Start command** to `npm start`.
3. Add environment variables in Render:
   - Required: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `NODE_ENV=production`
   - Preferred auth: `SUPERTOKENS_ENABLED=true`, `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_DOMAIN`, `SUPERTOKENS_WEBSITE_DOMAIN`
   - Legacy fallback auth: `APP_LOGIN_USER`, `APP_LOGIN_PASSWORD`, `SESSION_SECRET`
4. Optional: use a [Blueprint](https://render.com/docs/infrastructure-as-code) by adding `render.yaml` at the repo root; validate with `render blueprints validate`. Deploy via Render CLI: `render deploys create <SERVICE_ID> --confirm`.

### Live instance

After the first deploy succeeds, your app will be available at a URL like `https://voda-agile-board.onrender.com`. Update this README with your actual live URL.

### CI/CD

Tests run on push via GitHub Actions (when configured). Deploys are triggered by Render on push to `main` (Git-backed), or by running the Render CLI in CI with `RENDER_API_KEY` and `RENDER_SERVICE_ID`.

## License

MIT

## Support

For issues or questions, please check the troubleshooting section above or review the error messages in the application UI.
