# Agent Persistent Memory
Target: http://127.0.0.1:3001/governance
Core Directives: Flatten UI hierarchy, zero-click data visibility, eliminate redundant borders. You MUST output your final exact test command into .\.agent_test_target.
Available Tests: test:all, test:all:stop, test:pw, test:focused, test:smoke, test:journey:current-sprint, test:journey:leadership, test:journey:brief-ssot, test:journey:layout-overlap, test:journey:governance, test:journey:outcome-intake, test:outcome-intake, test:journey:ux-core, test:journey:direct-value-masterplan, test:journey:customer-simplicity-trust, test:journey:customer-growth-round3, test:journey:hero-squad-first, test:journey:value-retention, test:journey:churn-retention-masterplan, test:journey:governance-click-friction, test:journey:governance-click-friction-round3, test:journey:governance-growth-round2, test:report-jira-ux, test:journey:shell-direct-value, test:journey:data-integrity, test:e2e:full, test:api:core, test:data:integrity, test:current-sprint:core, test:current-sprint:dedupe-fold, test:journey:viewport-declutter, test:ux:core, test:report:header-actions, test:report:summary-contract, test:leadership:hud-shell, test:report-current-shell, test:journey:nudge-summary-bridge, test:journey:adaptive-nudges, test:journey:no-click-coaching, test:journey:direct-value-send, test:journey:human-nudge-trust, test:human-nudge:verify-retry, test:current-sprint-ux-ssot, test:current-sprint-redesign, test:e2e

## Failure Ledger:
[Cleared after success]

## Active Refactor — Flatten Governance UI (2026-06-13)

**Source:** `.agent_logs/20260613_182749/L3_Investigation.md`
**Regression gate:** `npm run test:journey:governance-click-friction-round3` (written to `.agent_test_target`)
**Secondary gate:** `npm run test:journey:layout-overlap` (sticky-stack removal in Phase 2)

### Goal
Collapse three nested friction layers (scope bar double-deck, desktop grid split scroll, owner-cluster/evidence tab nesting) into a single vertical reading surface. Preserve Round 3 zero-click wins: inline scope, send-readiness pill SSOT, one-click send, inline approve, on-page issue preview, proof without supporting-evidence accordion.

### Phase 1 — Scope bar: flatten sticky double-deck
| File | Intended change |
|------|-----------------|
| `public/Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js` | Merge capsule + `#gov-scope-expanded` into one flat row; remove `scrollScopeIntoView` from public API; status chip uses in-place highlight (`data-scope-status-active`) instead of `executeFirstClusterNudge` / `focusFirstClusterNudge` scroll jumps. |
| `public/Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js` | Inline project/quarter/period chips in a single flex row; demote advanced `<details>` to compact overflow; remove redundant inner wrappers and horizontal scroll pockets where possible. |
| `public/Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js` | Demote `openScopeIntelligenceDrawer` to inline expansion or lightweight popover — no full overlay for routine scope changes. |
| `public/Delivera-Governance-Brief-Page-Controller.js` | Rewire `onOpenDrawer` so scope intelligence prefers inline path over drawer escalation. |
| `public/css/09-governance.css` | Reduce `.gov-scope-bar-sticky` height (`--gov-scope-bar-height` 56→~44px); trim mobile min-height block; drop redundant border-bottom; relax `.gov-scope-chips--scroll` wheel-capture where chips fit inline. |

**Invariant (Round 3 steps 03/09):** `#gov-scope-expanded` always visible; no `.gov-right-drawer-panel--scope-sheet` on mobile.

### Phase 2 — Desktop grid: single scroll owner
| File | Intended change |
|------|-----------------|
| `public/css/09-governance.css` | Remove `overflow-y: auto` + viewport `max-height` from `.gov-right-rail`; reduce `scroll-margin-top` on `.gov-owner-cluster` once sticky stack shortens; remove nested scroll on `.gov-inbox-inline-preview`. |
| `public/governance.html` | Flatten mount topology: scope bar outside main; right-rail children (proof → queue → PI strip) as sibling blocks without nested scroll hosts. |
| `public/Delivera-Shared-Top-Chrome-01Render-UI.js` | Align `--sticky-global-nav-top` / `--top-chrome-height` so scope bar offset does not reintroduce duplicate sticky layers. |
| `public/Delivera-App-Governance-Inbox-01Render-UI.js` | Remove `openQueueTab` → `scrollIntoView` on `#gov-right-rail-mount`; tab switch updates content in place; drawer only on mobile overflow. |
| `public/Delivera-App-Shared-RightDrawer-01UI.js` | Prefer inline rail over drawer on desktop; on mobile fallback use in-drawer scroll only — avoid `body.gov-right-drawer-open { overflow: hidden }` where rail suffices. |

### Phase 3 — Owner clusters + evidence tabs: cut scroll chains
| File | Intended change |
|------|-----------------|
| `public/Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js` | Flatten cluster DOM: header → issue list → send row as direct children; inline proof preview below chip (no nested `<details>`); reduce competing click targets per card. |
| `public/Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js` | Replace `scrollToFirstClusterNudge` with `focus({ preventScroll: true })` + temporary highlight; proof click sets `data-proof-active` on rail section instead of smooth `scrollIntoView` on `#gov-right-rail-proof-mount`. |
| `public/Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js` | Demote `mountEvidenceTabShell()` tab panels to always-visible sections or a single flat evidence block (readiness/baseline/scorecard zero-click); SSOT `renderEvidencePreview` for inline + rail without duplicate scroll-to-rail. |
| `public/Delivera-App-Governance-Brief-22Render-HoverProofCards-UI.js` | Stop hover proof from `scrollIntoView` on supporting-evidence section; highlight rail in place. |
| `public/governance.html` | Restructure `#gov-supporting-evidence` section + mount order for flat evidence visibility. |

**Invariant (Round 3 steps 05–08):** one-click grouped send, inline approve, issue preview stays on governance URL, proof cluster does not open supporting-evidence accordion.

### Phase 4 — CSS build & verify
1. Edit `public/css/09-governance.css` only (not `styles.css`).
2. Run `npm run build:css`.
3. Run `npm run test:journey:governance-click-friction-round3`.

### Success criteria (mapped to Round 3 test steps)
- Steps 03/09: scope expanded + chips visible inline (desktop + mobile).
- Step 04: zero `.gov-sticky-answer--governance` after scroll.
- Steps 05–08: one-click send, inline approve, issue preview on-page, proof cluster does not open supporting evidence.
- No new nested scroll containers in scope bar or right rail.

### Files in scope (13)
```
public/governance.html
public/css/09-governance.css
public/Delivera-Governance-Brief-Page-Controller.js
public/Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js
public/Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js
public/Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js
public/Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js
public/Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js
public/Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js
public/Delivera-App-Governance-Brief-22Render-HoverProofCards-UI.js
public/Delivera-App-Governance-Inbox-01Render-UI.js
public/Delivera-App-Shared-RightDrawer-01UI.js
public/Delivera-Shared-Top-Chrome-01Render-UI.js
```
