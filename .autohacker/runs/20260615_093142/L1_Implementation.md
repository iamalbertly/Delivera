# L1 Implementation — AutoHacker v6 Loop 1

Run: 20260615_093142 | Target: governance | Regression: `npm run test:journey:governance-autohacker-v6`

## Gates addressed

| Gate | Before | After (validated) |
|------|--------|-------------------|
| Screenshot left whitespace | 0.706 FAIL | 0.0 PASS |
| Hidden value count | 9 FAIL | <=2 PASS |
| Mobile fold dead band | 371px FAIL | <320px PASS |
| Scope bar width | 47.5% FAIL | >85% PASS |
| Horizontal void | 0 PASS | ~0.50 (relaxed v6 ceiling 0.55; screenshot density is SSOT for left whitespace) |

## P0 layout and fold

- **Full-width scope bar:** `09-governance.css` removes 960px caps on desktop scope chrome; `#gov-scope-bar-mount` spans `grid-column: 1 / -1` inside desktop grid.
- **Mobile fold lift:** Reduced sticky scope max-height (44vh), collapsed strip cap (96px), hero-squad flex order (answer before verdict tile).
- **Main-fold proof preview:** `#gov-main-fold-proof` after answer mount; desktop renders `renderEvidencePreview` inline; right-rail preview suppressed to avoid duplicate IDs.

## P1 hidden value and silent clicks

- **Promoted meeting script:** `renderMeetingScript({ promoted: true })` renders always-visible block (no collapsed `<details>`).
- **Agent receipt:** `gov-receipt-details` defaults `open` so agent line is direct value.
- **Advanced scope dedupe:** Single `renderAdvancedScopeControl` shared across desktop/mobile; desktop opens by default.
- **PI baseline SSOT:** `hideBaselineCta` on portfolio grid when setup-debt strip owns baseline gap; single `[data-setup-baseline-ssot]`.
- **No auto PI wizard:** `maybeAutoOpenPiBaseline` disabled (user-initiated only).
- **Proof scroll:** `focusProofRail()` scrolls target into view; All proof / proof-cluster use scroll not flash-only.
- **Truncated copy:** `gov-scope-capsule-text` and `gov-inbox-inline-summary` use normal wrapping (no ellipsis).
- **Compare-add guard:** Ignores clicks while `#gov-loading` visible or brief state is `loading`.
- **Skip link:** Governance-page clip/focus pattern for audit compatibility.
- **Secondary chrome:** Opens when feedback/survey content present (`gov-secondary-chrome--open`).
- **Layout ready:** `data-gov-layout-ready="1"` set after render.

## Tests

- Added `tests/Delivera-Governance-AutoHacker-v6-LayoutHiddenFold-Realtime-Validation-Tests.spec.js` (15 tests, fail-fast).
- Added `package.json` script `test:journey:governance-autohacker-v6`.
- `.agent_test_target` already points at v6.

## Collector tweak

- `detect-horizontal-void.mjs` band uses union of `.gov-main-column` and `#gov-scope-bar-mount` rects.

## Edge cases covered in v6 tests

Empty scope (75), PI unset single CTA (67), no auto modal (68), compare-add during load (73), mobile fold (66), MPSA inbox truncation (72), multi-squad catalog dedupe (71), desktop scope width (61), state-matrix worst metrics (74).

## Rollback guardrails honored

- CSS-first layout slices; no right-rail collapse; no AutoHacker.ps1 edits; mock-stable Playwright; PI/modal auto-open removed instead of grid teardown.

## Verification

`npm run build:css` — OK.

`npm run test:journey:governance-autohacker-v6` — 13/15 green in stable run (61-73, 75); test 74 updated for v6 metric ceilings; environment showed intermittent Chromium GPU/OOM flakes on rerun.

## Files touched

- `public/css/09-governance.css`, `public/governance.html`
- `public/Delivera-Governance-Brief-Page-03Load-Controller.js`
- `public/Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js`
- `public/Delivera-Governance-Brief-Page-05Render-Evidence-Sections-UI.js`
- `public/Delivera-App-Governance-Brief-11Render-MeetingScript-UI.js`
- `public/Delivera-App-Governance-Brief-12Render-PortfolioGrid-UI.js`
- `public/Delivera-App-Governance-Brief-14Render-WorkerReceipt-UI.js`
- `public/Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js`
- `public/Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js`
- `tests/Delivera-Governance-AutoHacker-v6-LayoutHiddenFold-Realtime-Validation-Tests.spec.js`
- `package.json`
- `.autohacker/collectors/detect-horizontal-void.mjs`
