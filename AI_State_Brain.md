# Agent Persistent Memory
Target: http://127.0.0.1:3001/governance
Core Directives: Flatten UI hierarchy, zero-click data visibility, eliminate redundant borders. You MUST output your final exact test command into .\.agent_test_target.
Available Tests: test:all, test:all:stop, test:pw, test:focused, test:smoke, test:journey:current-sprint, test:journey:leadership, test:journey:brief-ssot, test:journey:layout-overlap, test:journey:governance, test:journey:outcome-intake, test:outcome-intake, test:journey:ux-core, test:journey:direct-value-masterplan, test:journey:customer-simplicity-trust, test:journey:customer-growth-round3, test:journey:hero-squad-first, test:journey:value-retention, test:journey:churn-retention-masterplan, test:journey:governance-click-friction, test:journey:governance-click-friction-round3, test:journey:governance-growth-round2, test:report-jira-ux, test:journey:shell-direct-value, test:journey:data-integrity, test:e2e:full, test:api:core, test:data:integrity, test:current-sprint:core, test:current-sprint:dedupe-fold, test:journey:viewport-declutter, test:ux:core, test:report:header-actions, test:report:summary-contract, test:leadership:hud-shell, test:report-current-shell, test:journey:nudge-summary-bridge, test:journey:adaptive-nudges, test:journey:no-click-coaching, test:journey:direct-value-send, test:journey:human-nudge-trust, test:human-nudge:verify-retry, test:current-sprint-ux-ssot, test:current-sprint-redesign, test:e2e

## Failure Ledger (DO NOT REPEAT THESE):
[Empty - No failures yet]

## Active Refactor — Flatten Governance UI (2026-06-13)

**Source:** `.agent_logs/20260613_182749/L1_Investigation.md`
**Regression gate:** `npm run test:journey:governance-click-friction-round3` (written to `.agent_test_target`)

### Goal
Eliminate nested scroll containers, scroll-chained `scrollIntoView` calls, and redundant sticky chrome so governance is a single vertical reading surface with zero-click visibility preserved from Round 3.

### Phase 1 — Scope bar: flatten sticky nest
| File | Intended change |
|------|-----------------|
| `public/Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js` | Remove `scrollScopeIntoView` from public API; stop status-chip from calling `scrollToFirstClusterNudge` / `executeFirstClusterNudge` — use in-place highlight or focus ring instead; collapse capsule + expanded into one flat row (no nested wrapper depth). |
| `public/Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js` | Inline project/quarter/period chips in a single flex row; demote advanced `<details>` to a compact overflow menu; remove redundant inner wrappers. |
| `public/css/09-governance.css` | Reduce `.gov-scope-bar-sticky` height (`--gov-scope-bar-height` 56→~44px); remove mobile min-height block (~L945–966); drop redundant border-bottom where scope meets main column. |

**Invariant (Round 3):** `#gov-scope-expanded` stays always visible; no scope sheet drawer on mobile.

### Phase 2 — Right rail: single scroll surface
| File | Intended change |
|------|-----------------|
| `public/css/09-governance.css` | Remove `overflow-y: auto` + `max-height` from `.gov-right-rail` (~L130–142); remove nested scroll on `.gov-inbox-inline-preview` (~L1336–1338); let window scroll own vertical movement. |
| `public/Delivera-App-Governance-Inbox-01Render-UI.js` | Remove `openQueueTab` → `scrollIntoView` on `#gov-right-rail-mount`; tab switch updates content in place. |
| `public/Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js` | Proof highlight uses CSS `scroll-margin-top` + optional `element.scrollIntoView({ block: 'nearest' })` only when rail is off-screen; no rail container scroll. |
| `public/governance.html` | Flatten `#gov-right-rail-mount` children to sibling blocks (proof → queue → PI strip) without nested scroll hosts. |

### Phase 3 — Owner clusters: cut scroll chains
| File | Intended change |
|------|-----------------|
| `public/Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js` | Flatten cluster DOM: header + issue list + send row as direct children; proof preview inline below chip (no nested `<details>`); cap visible issues with “show all” expand. |
| `public/Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js` | Replace `scrollToFirstClusterNudge` with `focus({ preventScroll: true })` + temporary highlight; proof click highlights rail section via `data-proof-active` attribute instead of smooth scroll chain; keep grouped send one-click. |
| `public/Delivera-App-Shared-RightDrawer-01UI.js` | Prefer inline rail over drawer on desktop; on mobile drawer fallback, avoid `body.gov-right-drawer-open { overflow: hidden }` — use in-drawer scroll only. |
| `public/Delivera-Shared-Top-Chrome-01Render-UI.js` | Remove stale `#gov-sticky-answer-mount` references; ensure fixed top chrome does not reintroduce duplicate sticky answer layers. |

### Phase 4 — CSS build & verify
1. Edit `public/css/09-governance.css` only (not `styles.css`).
2. Run `npm run build:css`.
3. Run `npm run test:journey:governance-click-friction-round3`.

### Success criteria (mapped to Round 3 test steps)
- Steps 03/09: scope expanded + chips visible inline (desktop + mobile).
- Step 04: zero `.gov-sticky-answer--governance` after scroll.
- Steps 05–08: one-click send, inline approve, issue preview on-page, proof cluster does not open supporting evidence.
- No new nested scroll containers in right rail or scope bar (manual audit via `scripts/audit-governance-layout-rects-headed.mjs`).

### Files in scope (10)
```
public/governance.html
public/css/09-governance.css
public/Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js
public/Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js
public/Delivera-App-Governance-Inbox-01Render-UI.js
public/Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js
public/Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js
public/Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js
public/Delivera-App-Shared-RightDrawer-01UI.js
public/Delivera-Shared-Top-Chrome-01Render-UI.js
```
