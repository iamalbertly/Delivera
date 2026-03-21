---
name: current-sprint-header-declutter
overview: Consolidate the Current Sprint page into a single, calm mission-control header that surfaces sprint health and next actions instantly, while tightening the CSS pipeline and tests so visual changes are predictable and reliable.
todos:
  - id: todo-header-single-visual
    content: Collapse duplicate headers into a single mission-control band on /current-sprint, making .current-sprint-header-bar the primary visual header.
    status: completed
  - id: todo-header-identity-and-metrics
    content: Finalize the identity row with project/board chip, sprint name/dates, and standardized Done/Issues/LogEst metric tiles plus inline last-sprint delta.
    status: completed
  - id: todo-header-risk-and-logging
    content: Normalize risk colors and copy, demote logging alerts to hygiene context, and clarify health vs hygiene in the header.
    status: completed
  - id: todo-header-role-strip
    content: Ensure role view modes live in a clear secondary strip and follow consistent interactive styling.
    status: completed
  - id: todo-context-strip
    content: Segment the context strip into Last, Projects, Range (UTC), and Freshness pieces using shared helpers and aligned visuals.
    status: completed
  - id: todo-mini-header-mobile
    content: Implement and validate a compact mini-header scroll state and safe stacking behavior on mobile and tablets.
    status: completed
  - id: todo-copy-map-and-tokens
    content: Centralize sprint-related copy and header spacing/typography tokens so all surfaces share one grammar.
    status: completed
  - id: todo-hud-alignment
    content: Align leadership HUD header visuals and summaries with Current Sprint’s refined mission-control design.
    status: completed
  - id: todo-edge-states
    content: Handle historical, zero-data, sparse history, and rapid board-switching edge cases with explicit header copy and behavior.
    status: completed
  - id: todo-css-pipeline-guard
    content: Enforce that CSS edits happen in partials under public/css with generated styles.css and tooling guards against direct edits.
    status: completed
  - id: todo-header-tests
    content: Extend Playwright specs to assert header structure, sticky behavior, interactive map, and edge cases across viewports.
    status: pending
  - id: todo-orchestration
    content: Ensure header-focused tests are wired into focused runs and npm run test:all remains a fail-fast, visible gate.
    status: completed
  - id: todo-manual-verification-and-commit
    content: After tests pass, manually validate key journeys with Playwright MCP/browser-view, then create a single scoped commit and push.
    status: pending
isProject: false
---

# Current Sprint Header Declutter & Reliability Plan

> **Tracker sync (2026-03-21):** Frontmatter todos marked `completed` for slices already shipped (context strip, copy map + tokens, leadership HUD alignment, CSS pipeline guard, orchestration, **`todo-edge-states`** — header `data-edge-state` + explicit empty / just-started / low-confidence copy). Remaining: `todo-header-tests`, `todo-manual-verification-and-commit`.

## Objectives

- **Customer**: Present a single, calm mission-control header on `/current-sprint` that answers "What sprint am I looking at? How healthy is it? What should I do next?" without badge overload or stacked bars.
- **Realism & Simplicity**: Reshape only existing components and HTML structure (no new screens), collapsing duplicate headers and reusing shared helpers. No new visual concepts; just cleaner composition.
- **Speed & Trust**: Reduce clicks and eye-scanning by clarifying hierarchy, demoting non-critical signals, and tightening the CSS + test pipeline so style updates show reliably and regressions are caught early.

## 13+ core implementation to-dos (with rationale)

1. **Consolidate to a single visual header on Current Sprint**
  - **What**: Decide that `.current-sprint-header-bar` is the one true mission-control header. Slim the `<header>` in `current-sprint.html` down to just the page title (or remove it entirely as a visual block), letting the header bar own project/board identity, sprint name, and actions.  
  - **Why**: **Customer** sees one coherent band instead of "two headers on top of each other"; **Simplicity** eliminates duplicated context; **Speed & Trust** improve because there is only one place to look for status.
2. **Merge project/board selectors conceptually into the mission-control header**
  - **What**: Keep the existing selectors in `current-sprint.html` but visually align them with the mission-control context chip: project + board appear as a single chip near the sprint name, with the underlying selects styled as secondary controls beneath or beside it.  
  - **Why**: **Customer** feels like they are configuring one sprint view, not two separate systems (page header vs bar). This supports faster mental mapping of "which work am I seeing?".
3. **Demote logging alerts to a lightweight hygiene hint**
  - **What**: Keep the logging-alerts count but render it as a low-contrast pill and text such as "23 logging nudges ready" in the secondary strip, visually distinct from risk verdict colors.  
  - **Why**: **Customer** shouldn’t confuse hygiene work with sprint health; **Realism** separates risk from maintenance; **Trust** rises when alarms map to real danger only.
4. **Rebalance role view modes into a clear secondary strip**
  - **What**: Ensure that "View as: All / Dev / SM / PO / Leads" is grouped and styled as a neutral filter strip below the verdict, with smaller taps and subdued color compared to risk chips and CTAs.  
  - **Why**: **Customer** gets the health answer first and only tweaks view when needed; **Simplicity** removes competition for attention; **Speed** stays high thanks to single-click role switching.
5. **Sharpen the three-row hierarchy inside `current-sprint-header-bar`**
  - **What**: Confirm and enforce that: Row 1 = identity + compact metric tiles; Row 2 = verdict line + Last 3 sprints delta + countdown; Row 3 = status (Live/Snapshot), logging strip, role modes, and CTAs. Avoid adding new rows.  
  - **Why**: **Customer** can parse the bar in a single top-to-bottom scan; **Simplicity** is encoded directly in layout; **Speed & Trust** follow from predictable structure.
6. **Standardize mini-metric tiles and last-sprint delta composition**
  - **What**: Keep exactly three tiles (Done %, Issues, Log/Est) with identical structure and microcopy, and integrate the "vs last sprint" delta sentence directly adjacent to Done % (not in a separate detached note).  
  - **Why**: **Customer** gets a fast, pattern-based view of metrics and trajectory; **Realism** ties current performance to recent history; **Speed** avoids hunting for comparisons.
7. **Clarify dominant risk color and mute non-critical elements**
  - **What**: Use a single strong color system for `Critical / At risk / Healthy` on the verdict line and risk chips; keep Live/Snapshot badges, role pills, and logging chips in softer neutrals.  
  - **Why**: **Customer** can instantly tell whether they should worry; **Simplicity** removes color noise; **Trust** improves because color semantics are consistent.
8. **Segment the context strip under the header instead of wall-of-text**
  - **What**: Under the header (or in the summary bar), render context as segmented pieces: Last (stories/sprints), Projects, Range (UTC), and Freshness. Reuse `getContextDisplayString` but visually separate the parts using icons and spacing.  
  - **Why**: **Customer** decodes critical context in under a second; **Realism** keeps copy honest; **Speed** reduces cognitive load.
9. **Introduce a compact mini-header scroll state**
  - **What**: When the user scrolls past the main header, collapse to a mini-header that keeps only sprint name, verdict color, and days left as a sticky strip. Hide metric tiles, role strip, and logging summary in this state.  
  - **Why**: **Customer** always sees where they are and how urgent things are while reviewing issues; **Simplicity** stops the full header from dominating vertical space; **Speed** improves by reducing scroll gymnastics.
10. **Make mobile and tablet behavior explicit**
  - **What**: Define clear breakpoints where the header stacks in the order: (1) identity, (2) verdict + days left, (3) Take action, (4) metrics, (5) role/logging. On very narrow widths, disable or simplify stickiness to avoid overlapping the content below.  
  - **Why**: **Customer** on mobile sees a coherent, uncluttered view; **Realism** matches actual usage on phones and tablets; **Trust** strengthens when nothing feels janky on small screens.
11. **Enforce interactive vs read-only visual rules**
  - **What**: Maintain a strict rule: interactive elements (chips, buttons, filters) have clear hover + pointer cursor and pill/button styling; read-only text remains flat, non-hovered, and non-pointer. Apply this consistently in header bar, context strip, and leadership HUD cards.  
  - **Why**: **Customer** knows instantly what they can act on; **Simplicity** comes from a predictable click-map; **Speed** is gained by cutting "is that clickable?" hesitation.
12. **Align leadership HUD header and summary strip with Current Sprint**
  - **What**: Use the same verbal and visual grammar in `leadership.html` and its controller for the top HUD bar: a single, slim header, segmented context line, and clear separation between risk index and hygiene signals (e.g., data quality).  
  - **Why**: **Customer** doesn’t have to re-learn patterns across pages; **Realism & Simplicity** drive consistent leadership journeys; **Trust** grows when cross-surface stories match.
13. **Clarify copy for historical, zero-data, and sparse history sprints**
  - **What**: Harmonize wording in header, history banner, and HUD so: historical sprints clearly say "Historical snapshot – actions limited"; just-started sprints say "Sprint has just started · No risks yet"; and sparse history trends add a "Low confidence" tag.  
  - **Why**: **Customer** never mis-reads the signal; **Realism** is explicit about data quality; **Speed & Trust** come from unambiguous language.
14. **Guard the compiled CSS ownership contract**
  - **What**: Treat `public/styles.css` as a generated file only; align tooling and docs (pre-commit/CI checks, README) so visual work always happens in partials under `public/css/` and juniors cannot accidentally edit `styles.css` directly.  
  - **Why**: **Customer & Trust** indirectly benefit because design iteration becomes reliable; **Simplicity** in the pipeline means less time wrestling with "why didn’t this change show up?".

## 6+ bonus prerequisite improvements

1. **Centralized sprint copy map**
  - Extract all sprint-related labels (Critical, Ends in X days, No blockers, Logging hygiene, Building history, Ready/At risk/Not ready) into a single configuration or helper so header, summary bar, reports, and HUD all reuse the same wording.
2. **Header spacing and typography tokens**
  - Define a small set of design tokens for header title font size, metric label font size, chip label size, and row gaps. Apply these tokens in `06-current-sprint.css` and `07-leadership.css` to eliminate ad-hoc inline styles that cause drift.
3. **Context-strip iconography alignment**
  - Choose a minimal icon set for Projects, Date range, Freshness, and Last-run statistics and reuse them everywhere the context strip appears so the visual language reinforces the text.
4. **Consistent verdict narrative structure across surfaces**
  - Ensure that Current Sprint header, leadership HUD summaries, and exports all follow one core structure: `Verdict · Time left · Blockers · Missing est · No log`, with optional trailing clarifiers. No competing narrative templates.
5. **Refined hover/focus for accessibility**
  - Make sure key header controls (Take action, role pills, logging links, export split-button) all have visible focus outlines and gentle hover transitions that match the design tokens, aiding keyboard and screen-reader users.
6. **HUD top bar re-skin to match Current Sprint**
  - Lighten the leadership HUD header’s background, adjust padding, and bring typography in line with Current Sprint so the leadership view feels like a sibling surface, not a different product.

## 5+ edge-case solutions

1. **Historical sprint snapshots vs live sprints**
  - Ensure the header can never display conflicting statuses like "Live" alongside a snapshot banner. The banner should clearly state "Historical snapshot – actions limited" and certain actions (like Refresh, Take action) should appear visually disabled with explanatory tooltips.
2. **Zero-data / just-started sprints**
  - When Done % is 0 and there are no blockers/missing-est/no-log signals, render a neutral state: "Sprint has just started · No risks yet" and hide or mute risk chips that would otherwise show zeros, avoiding a fake sense of danger.
3. **Sparse history for Last 3 sprints trend**
  - When fewer than three closed sprints exist, keep the trend but add a small inline label "Low confidence" and more conservative language like "Limited history – Treat trend as early signal" rather than strong up/down narratives.
4. **Frequent board switching by leads**
  - Handle rapid project/board changes without header flicker or stale identity by resetting header content cleanly, showing a short "Loading: {board}" context line, and avoiding partially-rendered verdict strips from previous boards.
5. **Narrow devices, rotating screens, and sticky overlap**
  - Test mobile portrait, landscape, and tablet orientations to make sure the mini-header never overlays interactive cards or hides content; adjust sticky offsets to account for any global navigation bar heights.
6. **CSS pipeline/cache consistency**
  - Treat any mismatch between partials and compiled `styles.css` as an error in dev/CI (e.g., using a small build-version data attribute in the header) so that stale CSS or skipped builds cannot reach shared environments unnoticed.

## Testing & validation (Playwright MCP and existing specs)

- **Extend existing Playwright specs in `tests/`**  
  - Update or extend:
    - `tests/Jira-Reporting-App-Current-Sprint-UX-SSOT-Validation-Tests.spec.js`
    - `tests/Jira-Reporting-App-CurrentSprint-Mission-Control-Direct-Value-Validation-Tests.spec.js`
    - `tests/Jira-Reporting-App-UX-Enhancements.spec.js`
  - Validate via UI queries:
    - The three-row header and mini-header scroll behavior (check class presence, sticky offsets, and visibility).
    - The presence and text of verdict line, Last 3 sprints comparison, and key chips (blockers, missing est, no log) under different data scenarios.
    - That only interactive elements have pointer cursor/hover styles, while status text remains non-interactive.
    - That edge states (historical, zero-risk, sparse-history sprints) render appropriate copy and disabled/enabled actions.
- **Use existing console/logcat guard helpers**  
  - Keep leveraging your global console guard to fail tests when new layout or resource-loading issues appear (e.g., missing CSS files, sticky observers misbehaving), while ignoring expected retry logs.
- **Viewport coverage**  
  - Ensure the header tests run across at least:
    - Desktop width (e.g. 1440px),
    - Tablet (~1024px),
    - Mobile (~375px),
  - Verifying sticky and stacking behavior as well as text truncation/ellipsis.

## Orchestration, deployment & verification

- **Orchestration**  
  - Keep `npm run test:all` as the canonical full test run in fail-fast mode so any header regression stops the pipeline quickly and shows its logs in the foreground.  
  - If a focused header/UX subset command already exists (e.g., `npm run test:current-sprint-ux`), wire new header tests into it for faster local iteration.
- **Build & deploy validation**  
  - After code and CSS changes, run the full suite, fix any failing specs, and then use Playwright MCP or browser-view to:
    - Navigate `/current-sprint` → Risks & Insights → Leadership HUD on both desktop and mobile.
    - Confirm that the header never overlaps or hides content.
    - Ensure the sprint story (identity, health, next action) is legible in under a second.
    - Confirm that edge-case behaviors (historical, zero-data, sparse history, rapid board switching) perform as designed.
- **Finalization**  
  - Once Playwright runs clean and manual journeys look right, create a single, scoped git commit (including partial CSS, compiled `styles.css`, updated tests, and any README notes about CSS ownership) and push it following your existing naming conventions.

## Initial implementation to-dos summary

- **todo-header-single-visual**: Collapse duplicate headers into one coherent mission-control band on `/current-sprint`.
- **todo-header-identity-and-metrics**: Finalize identity + metric tiles + inline last-sprint delta.
- **todo-header-risk-and-logging**: Normalize risk colors, demote logging alerts, and clarify hygiene vs health.
- **todo-header-role-strip**: Ensure role modes live in a secondary strip and follow interactive visual rules.
- **todo-context-strip**: Segment context bar using shared helpers and aligned iconography.
- **todo-mini-header-mobile**: Implement and validate mini-header scroll state and mobile stacking.
- **todo-copy-map-and-tokens**: Centralize sprint copy and spacing/typography tokens for headers.
- **todo-hud-alignment**: Align leadership HUD header and summaries with Current Sprint.
- **todo-edge-states**: Implement copy and behavior for historical, zero-data, sparse history, and rapid-switching edge cases.
- **todo-css-pipeline-guard**: Enforce partials → compiled CSS contract and guard against direct `styles.css` edits.
- **todo-header-tests**: Extend Playwright specs for header structure, behaviors, and edge cases across viewports.
- **todo-orchestration**: Keep `npm run test:all` fail-fast and ensure header tests are wired into focused and full runs.
- **todo-manual-verification-and-commit**: Perform final MCP/browser-view validation, then commit and push the polished header work.

