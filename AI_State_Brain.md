# Agent Persistent Memory
Target: http://127.0.0.1:3001/governance
Core Directives: Flatten UI hierarchy, zero-click data visibility, eliminate redundant borders. You MUST output your final exact test command into .\.agent_test_target.
Available Tests: test:all, test:all:stop, test:pw, test:focused, test:smoke, test:journey:current-sprint, test:journey:leadership, test:journey:brief-ssot, test:journey:layout-overlap, test:journey:governance, test:journey:outcome-intake, test:outcome-intake, test:journey:ux-core, test:journey:direct-value-masterplan, test:journey:customer-simplicity-trust, test:journey:customer-growth-round3, test:journey:hero-squad-first, test:journey:value-retention, test:journey:churn-retention-masterplan, test:journey:governance-click-friction, test:journey:governance-click-friction-round3, test:journey:governance-growth-round2, test:report-jira-ux, test:journey:shell-direct-value, test:journey:data-integrity, test:e2e:full, test:api:core, test:data:integrity, test:current-sprint:core, test:current-sprint:dedupe-fold, test:journey:viewport-declutter, test:ux:core, test:report:header-actions, test:report:summary-contract, test:leadership:hud-shell, test:report-current-shell, test:journey:nudge-summary-bridge, test:journey:adaptive-nudges, test:journey:no-click-coaching, test:journey:direct-value-send, test:journey:human-nudge-trust, test:human-nudge:verify-retry, test:current-sprint-ux-ssot, test:current-sprint-redesign, test:e2e

## Failure Ledger:
[Cleared after success]

## Active Refactor — Flatten Governance UI (2026-06-13)

**Source:** `.agent_logs/20260613_182749/L2_Investigation.md`
**Regression gate:** `npm run test:journey:governance-click-friction-round3` (written to `.agent_test_target`)

### Goal
Flatten three nested friction layers — scope bar double-deck, competing sticky scroll contexts, and owner-cluster/queue/evidence nesting — into a single vertical reading surface. Preserve Round 3 zero-click wins (inline scope, no duplicate sticky verdict, one-click send, proof rail without supporting-evidence accordion).

### Phase 1 — Scope bar: collapse sticky double-deck
| File | Intended change |
|------|-----------------|
| `public/Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js` | Merge capsule + `#gov-scope-expanded` into one flat horizontal row; remove `scrollScopeIntoView` from public API; status chip uses in-place highlight (`data-scope-status-active`) instead of `scrollToFirstClusterNudge()`; drop redundant inner wrappers. |
| `public/Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js` | Flatten desktop/mobile/period/advanced selectors into a single flex row; demote advanced accordion to compact overflow menu; remove nested `.gov-scope-bar-inner--expanded` depth. |
| `public/Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js` | Demote advanced-scope overlay to inline expansion or lightweight popover; eliminate full-screen drawer path for routine scope changes. |
| `public/css/09-governance.css` | Reduce `.gov-scope-bar-sticky` height (`--gov-scope-bar-height` 56→~44px); trim mobile min-height block (~L945–966); drop redundant border-bottom between scope and main. |

**Invariant (Round 3):** `#gov-scope-expanded` stays always visible; no `.gov-right-drawer-panel--scope-sheet` on mobile.

### Phase 2 — Sticky stack: one scroll owner
| File | Intended change |
|------|-----------------|
| `public/css/09-governance.css` | Remove `overflow-y: auto` + viewport `max-height` from `.gov-right-rail` (~L130–142); remove nested scroll on `.gov-inbox-inline-preview` (~L1336–1338); reduce `scroll-margin-top` on clusters now that sticky stack is shorter. |
| `public/governance.html` | Reorder mounts: scope bar outside main; flatten `#gov-right-rail-mount` to sibling blocks (proof → queue → PI strip) without nested scroll hosts. |
| `public/Delivera-Governance-Brief-Page-Controller.js` | Simplify `governance-shell--desktop-grid` toggle; ensure scope bar + main share one document scroll context. |
| `public/Delivera-Shared-Top-Chrome-01Render-UI.js` | Align `--sticky-global-nav-top` / `--top-chrome-height` so scope bar offset does not reintroduce duplicate sticky layers. |

### Phase 3 — Owner clusters + queue/evidence: cut scroll chains
| File | Intended change |
|------|-----------------|
| `public/Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js` | Flatten cluster DOM: header → issue list → send row as direct children; inline proof preview below chip (no nested `<details>`). |
| `public/Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js` | Replace `scrollToFirstClusterNudge` with `focus({ preventScroll: true })` + temporary highlight; proof click sets `data-proof-active` on rail section instead of smooth-scrolling rail container; stop nudge paths that force `wrap.open = true` on `#gov-supporting-evidence`. |
| `public/Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js` | SSOT proof preview in right rail; highlight via `scroll-margin-top` + `element.scrollIntoView({ block: 'nearest' })` only when off-screen. |
| `public/Delivera-App-Governance-Inbox-01Render-UI.js` | Inline queue preview stays in rail; `openQueueDrawer` only on mobile overflow; remove `openQueueTab` → `scrollIntoView` on `#gov-right-rail-mount`. |
| `public/Delivera-App-Shared-RightDrawer-01UI.js` | Prefer inline rail on desktop; drawer fallback uses in-drawer scroll only — avoid `body.gov-right-drawer-open { overflow: hidden }` where rail suffices. |
| `public/governance.html` | Demote `#gov-supporting-evidence` `<details>` accordion to always-visible sections or a single flat evidence block. |

### Phase 4 — CSS build & verify
1. Edit `public/css/09-governance.css` only (not `styles.css`).
2. Run `npm run build:css`.
3. Run `npm run test:journey:governance-click-friction-round3`.
4. Optional headed audit: `node scripts/map-governance-dom-headed.mjs`.

### Success criteria (mapped to Round 3 test steps)
- Steps 03/09: scope expanded + chips visible inline (desktop + mobile); no scope-sheet drawer.
- Step 04: zero `.gov-sticky-answer--governance` after scroll.
- Steps 05–08: one-click send, inline approve, issue preview on-page, proof cluster does not open supporting evidence.
- No new nested scroll containers in scope bar or right rail.

### Files in scope (12)
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
public/Delivera-App-Governance-Inbox-01Render-UI.js
public/Delivera-App-Shared-RightDrawer-01UI.js
public/Delivera-Shared-Top-Chrome-01Render-UI.js
```
