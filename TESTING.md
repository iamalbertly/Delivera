## Delivera - Testing Guide

This project uses Playwright for end-to-end and integration tests. The root orchestration entrypoint is `npm run test:all`.

### CSS pipeline before Playwright (SSOT)

- `npm run test:all` always runs `npm run build:css` and `npm run check:css` before browser tests.
- If `public/styles.css` is missing or out of sync with `public/css/*.css`, the run stops before Playwright starts.
- `npm run test:current-sprint:dedupe-fold` also runs `npm run check:css` first for a faster Current Sprint gate.
- CSS ownership/source-of-truth details live in `public/css/README.md` (do not duplicate them in this file).

### Fail-fast gate order (after CSS)

`npm run test:all` and `npm run test:all:priority` run Playwright gates in this order (fail-fast on first failure):

**Tier 0:** `build:css` → `check:css`

**Tier 1 (recent governance):** server lifecycle unit → governance intervention unit → portfolio decision unit → cache age-tier TTL unit → **PI intelligence spec** → intervention loop journey → portfolio command surface journey

**Tier 2 (last-failed + core contracts):** cross-page persistence → **API integration contracts** → value retention → direct-value masterplan → focused (`@focused`) → layout overlap → current-sprint dedupe-fold

**Tier 3:** brief SSOT → governance decision cockpit journey

**Tier 4 (layout/fold):** AutoHacker v6 fold → governance flatten L3

**Tier 5+:** settings, PI baseline, data integrity, outcome intake, ux-core, current-sprint, leadership, full E2E

`npm run test:all:priority` includes tiers 0–3 only (stops before tier 4 layout/fold bundles).

Every Playwright step uses `--max-failures=1`, `--workers=1`, `--reporter=list`. The runner clears server cache via `POST /api/test/clear-cache` before browser steps when `NODE_ENV=test`.

### Default behavior

- `npm run test:all` is the full regression entrypoint.
- The runner is foreground, serial, and fail-fast.
- Each Playwright command is normalized to:
  - `--max-failures=1`
  - `--workers=1`
  - `--reporter=list`
- The runner prints:
  - the active step name,
  - the exact command,
  - the primary spec/journey contract,
  - a periodic heartbeat while long steps run.

### Optional impacted-only mode

- Use `IMPACTED_ONLY=1 npm run test:all` for changed-only debugging.
- In impacted-only mode, the runner:
  - checks changed files against `TEST_BASE_REF` (default `origin/main` fallback chain),
  - uses the saved last-failed spec list,
  - selects only impacted or last-failed steps,
  - still stays fail-fast.

### Last-failed behavior

- In impacted-only mode, failing specs are persisted to `scripts/Delivera-Test-Last-Failed.json`.
- The next impacted-only run prioritizes those specs and applies Playwright `--last-failed --pass-with-no-tests`.
- Disable that optimization with `DISABLE_LAST_FAILED=1 npm run test:all`.

### Environment variables

- `IMPACTED_ONLY=1` - run changed-only / last-failed selection instead of full regression.
- `DISABLE_LAST_FAILED=1` - disable implicit last-failed optimization in impacted-only mode.
- `TEST_BASE_REF=<ref>` - override the Git base ref used for impacted selection.
- `SKIP_NPM_INSTALL=true` - skip the initial `npm install` step in orchestration.

### New fail-fast UX trust validations

- Added specs:
  - `tests/Delivera-Report-Refresh-Trust-And-Action-Hierarchy-Validation-Tests.spec.js`
  - `tests/Delivera-CurrentSprint-Standup-Action-Rhythm-Validation-Tests.spec.js`
  - `tests/Delivera-Leadership-Mobile-FirstViewport-Decision-Validation-Tests.spec.js`
  - `tests/Delivera-CrossSurface-Context-Freshness-SSOT-Validation-Tests.spec.js`
  - `tests/Delivera-Duplicate-UI-Decision-Strip-Regression-Validation-Tests.spec.js`
- All new specs use the shared console/pageerror guard and runtime UI assertions (not brittle static copy checks).
- Registering a spec in `scripts/Delivera-Tests-Journey-Buckets-Map-SSOT.js` is required for orchestration inclusion.
- Expected network-abort simulation tests should use `allow-console-pattern` annotations when intentionally triggering `ERR_FAILED`.
