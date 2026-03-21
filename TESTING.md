## Jira Reporting App - Testing Guide

This project uses Playwright for end-to-end and integration tests. The `test:all` script orchestrates all suites.

### CSS pipeline before Playwright (SSOT)

- **`npm run test:all`** — after optional `npm install`, the orchestration always runs **`npm run build:css`** then **`npm run check:css`** (`scripts/Jira-Reporting-App-Test-Orchestration-Steps.js`). If `public/styles.css` is missing or out of sync with `public/css/*.css` partials, the run stops before any browser tests.
- **`npm run test:current-sprint:dedupe-fold`** — runs **`npm run check:css`** first, then the Current Sprint / viewport Playwright pack (`package.json`). Use this for a fast header-focused gate without the full orchestration.

### Default behaviour: fast, impacted + last-failed

- Running `npm run test:all` now:
  - Detects **changed files** via `git diff --name-only ${TEST_BASE_REF:-origin/main}...HEAD`.
  - Maps those changes to the closest matching Playwright specs.
  - Reads the last failing spec (if any) from `scripts/Jira-Reporting-App-Test-Last-Failed.json`.
  - Runs **only**:
    - Specs that failed in the previous orchestration run, and
    - Specs mapped to your current changes,
    - Or a small **smoke pack** (API + E2E + UX SSOT) when there are no changes.

- Fail-fast is preserved:
  - Each spec uses `--max-failures=1`.
  - The orchestration runner stops on the first failing step.

### Implicit last-failed behaviour

- By default, the orchestration behaves as if `TEST_LAST_FAILED=1`:
  - The first run that fails records the failing spec path to `scripts/Jira-Reporting-App-Test-Last-Failed.json`.
  - The next `npm run test:all` run:
    - Prioritises that spec in the step order.
    - Adds Playwright’s `--last-failed --pass-with-no-tests` flags to relevant commands.
- To disable this optimisation (for debugging), set:
  - `DISABLE_LAST_FAILED=1 npm run test:all`

### Forcing a full regression run

- To run the full suite in its canonical order:
  - `FULL=1 npm run test:all`
- This ignores changed-file selection and last-failed metadata, but still keeps fail-fast enabled.

### Skipped steps and transparency

- When impacted-only mode is active, the runner prints:
  - How many steps were selected vs total.
  - How many were skipped as unrelated to current changes.
  - A hint to use `FULL=1 npm run test:all` before merging or releasing.

### Environment variables

- `FULL=1` – run all orchestrated steps (full regression).
- `DISABLE_LAST_FAILED=1` – turn off implicit last-failed optimisation.
- `TEST_BASE_REF` – override the Git base ref used for change detection (defaults to `origin/main`).
- `SKIP_NPM_INSTALL=true` – skip the initial `npm install` step in the orchestration.

