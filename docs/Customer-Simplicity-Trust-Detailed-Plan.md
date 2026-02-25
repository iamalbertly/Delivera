# Customer, Simplicity & Trust – Detailed Plan (2 pages)

This plan defines **13 validation to-dos** for hardening the report first-paint, error recovery, and Load-latest behaviour, plus **3 bonus edge cases**, **build and deploy**, and **rationale** for chosen options. Values: **Customer**, **Speed**, **Simplicity**, **Trust**. All validation uses Playwright (browser) with logcat-style telemetry and real-time UI assertions; tests **fail fast by default** on any UI or logcat issue.

---

## Page 1 – 13 To-dos, rationale, edge cases

### 13 Validation To-Dos (validation and fixes)

1. **First-paint context line** – Ensure `#report-context-line` is visible on load and shows "No report run yet", "Last: …", or "Projects: …" so the main area is never blank. *Rationale:* A blank main area undermines trust; one line sets context immediately (Trust, Simplicity).

2. **Load latest visibility** – When context is "No report run yet", "Load latest" is visible; when Preview is disabled (no projects or invalid range), "Load latest" is hidden. *Rationale:* We never show a CTA that does nothing (Customer, Simplicity).

3. **Load latest hides when loading** – When preview fetch starts, `#report-load-latest-wrap` is hidden so the user cannot double-trigger. *Rationale:* Prevents duplicate requests and confusion (Simplicity, Speed).

4. **Error recovery message** – On preview failure with no existing preview, context line shows "Preview failed. Use Load latest to retry." or equivalent so user has a retry path. *Rationale:* Clear path to retry without reload (Trust, Customer).

5. **Error dismiss re-show** – When the user dismisses the error panel (error-close) and no preview is visible, context line and "Load latest" are shown again. *Rationale:* Retry path remains available after dismiss (Simplicity, Trust).

6. **aria-busy on preview area** – While loading is visible, `.preview-area` has `aria-busy="true"`; when loading hides, `aria-busy="false"`. *Rationale:* Assistive tech and screen readers get correct busy state (Trust).

7. **Context line cleared after successful preview** – When preview renders, `#report-context-line` is cleared and "Load latest" is hidden so outcome lives in the preview area. *Rationale:* Single source of truth for outcome (Simplicity).

8. **Init auto-preview cancelled on filter change** – The 1s delayed auto-preview on load is cancelled when the user changes any filter. *Rationale:* User intent is not overwritten; avoids redundant request (Trust, Speed).

9. **Focus after Load latest click** – After "Load latest" triggers Preview, the Preview button receives focus for keyboard and a11y users. *Rationale:* Keeps focus in the correct control (Trust).

10. **Telemetry clean at every step** – Each Playwright step captures browser telemetry (console errors, page errors, failed requests) before actions and asserts clean after; any step fails on UI mismatch or logcat issue. *Rationale:* Fail-fast on real-time UI and logs (Trust).

11. **Automated spec in orchestration** – A dedicated Playwright spec validates these behaviours and is registered in `Jira-Reporting-App-Test-Orchestration-Steps.js`; the runner uses `--max-failures=1` so the first failure stops the run. *Rationale:* One place to run and maintain validation (Simplicity, Trust).

12. **Report load without critical errors** – On initial load of `/report`, no critical console errors, page errors, or failed requests (except ignored patterns). *Rationale:* First impression must not show errors; telemetry clean on load (Trust, Speed).

13. **Preview button state in sync with filters** – Preview button is disabled when no projects or invalid date range; when at least one project and valid range are selected, it is enabled. *Rationale:* Prevents dead clicks and reflects filter state (Customer, Simplicity).

### Best-option choices and rationale

- **Single “recovery” spec vs. scattering** – One spec file (`Jira-Reporting-App-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js`) groups error recovery, Load latest visibility, and aria-busy checks. *Rationale:* Easier to run and reason about; orchestration already runs one step per spec; adding one step is the minimal change.
- **Assert telemetry after each meaningful step** – We use `captureBrowserTelemetry(page)` before navigation/actions and `assertTelemetryClean(telemetry)` after UI assertions in each test. *Rationale:* A failure is either a UI assertion or a telemetry violation; no need for a separate “logcat” step.
- **Hide Load latest in Loading-Steps** – Hiding `#report-load-latest-wrap` in `setLoadingVisible(true)` keeps loading UX in one module. *Rationale:* Loading visibility is already the single place that shows/hides the loading state; co-locating “hide Load latest” there avoids cross-module coupling.

### 3 Bonus edge case solutions (realistic to scope)

1. **Stale last-run** – When data is >15 min old, the context/sidebar still shows "Generated N min ago" or "Data may be stale". Tests accept "Last:", "Generated", or "min ago" in context line when last-run exists. *Not remote:* Returning users often see slightly stale data; we must show recency (Trust).

2. **No projects selected** – When all project checkboxes are unchecked, Preview is disabled and "Load latest" is hidden. Test: uncheck all projects, assert Load latest wrap hidden and Preview disabled. *Not remote:* Common mistake; we must not offer a dead CTA (Customer, Simplicity).

3. **Error shown then dismissed** – When preview fails (e.g. invalid range), error panel is shown; when user clicks Dismiss, context line and "Load latest" reappear. Test: trigger error (start > end), assert error visible; click error-close, assert context line or Load latest visible. *Not remote:* Core recovery flow (Trust, Simplicity).

---

## Page 2 – Build, deploy, testing, orchestration

### Build and deploy (for you to validate)

- **Build:** Run `npm run build:css` so `public/styles.css` includes report context line and Load latest styles. `npm start` runs `prestart` (build:css) automatically.
- **Deploy:** Start the app with `npm start` (or your usual deploy). Base URL for Playwright is `process.env.BASE_URL || 'http://localhost:3000'`; the Playwright config starts the web server if `SKIP_WEBSERVER !== 'true'`.
- **Validation:** Run the new recovery spec:  
  `npx playwright test tests/Jira-Reporting-App-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js --reporter=list --max-failures=1`  
  Then run the full orchestration if desired: `npm run test:all`.

### How tests detect failures (UI + logcat) and fail fast

- **UI:** Every test uses Playwright assertions (`expect(...).toBeVisible()`, `.toContainText()`, etc.) after each meaningful action. If the UI does not match, the assertion fails and the test fails immediately.
- **Logcat (browser telemetry):** `captureBrowserTelemetry(page)` collects console errors, page errors, and failed requests. `assertTelemetryClean(telemetry)` throws if there are unexpected console errors, page errors, or non-ignored failed requests. So a test fails if either the UI is wrong or telemetry is dirty.
- **Order:** In each test we (1) capture telemetry, (2) perform actions (goto, click, etc.), (3) assert UI state, (4) assert telemetry clean. Both UI and logs are validated per step.
- **Fail fast by default:** The recovery spec sets `test.describe.configure({ retries: 0 })` so no retries; the orchestration runs with `--max-failures=1` so the first failing test stops the entire run. Any issue from the test itself (assertion) or from realtime logs (assertTelemetryClean) causes immediate failure.

### Automatic testing engine and filename

- The existing engine is the **orchestration runner** that executes steps from `scripts/Jira-Reporting-App-Test-Orchestration-Steps.js`. It does not auto-discover specs; each step runs a **fixed spec path**.
- To have the new validation run automatically, a **new step** is added that runs  
  `tests/Jira-Reporting-App-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js`.  
  The filename follows the existing pattern (`Jira-Reporting-App-*-Validation-Tests.spec.js`) so it is clearly a validation spec; the runner picks it up because it is listed in `getSteps(projectRoot)`.

### Files created/updated

- **New:** `docs/Customer-Simplicity-Trust-Detailed-Plan.md` (this 2-page plan).
- **New:** `tests/Jira-Reporting-App-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js` – Playwright spec with telemetry + UI at every step for context line, Load latest, error recovery, aria-busy, no-projects.
- **Updated:** `scripts/Jira-Reporting-App-Test-Orchestration-Steps.js` – One new step: "Run Customer Simplicity Trust Recovery Validation Tests" (after Outcome-First First-Paint).

### Summary

The 13 to-dos are implemented in the app and verified by the recovery spec (and Outcome-First spec where relevant); the 3 bonus edge cases are covered by the same specs. Build and deploy are standard (`npm run build:css`, `npm start`). All tests use Playwright (browser), fail fast on any UI or telemetry violation (no retries, max-failures=1), and are run by the existing automatic testing engine via the orchestration steps. After all tests pass, a git commit and push seals the changes.
