# Agent Persistent Memory
Target: http://127.0.0.1:3001/governance
Core Directives: Flatten UI hierarchy, zero-click data visibility, eliminate redundant borders.
Available Tests: test:all, test:all:stop, test:pw, test:focused, test:smoke, test:journey:current-sprint, test:journey:leadership, test:journey:brief-ssot, test:journey:layout-overlap, test:journey:governance, test:journey:outcome-intake, test:outcome-intake, test:journey:ux-core, test:journey:direct-value-masterplan, test:journey:customer-simplicity-trust, test:journey:customer-growth-round3, test:journey:hero-squad-first, test:journey:value-retention, test:journey:churn-retention-masterplan, test:journey:governance-click-friction, test:journey:governance-click-friction-round3, test:journey:governance-growth-round2, test:report-jira-ux, test:journey:shell-direct-value, test:journey:data-integrity, test:e2e:full, test:api:core, test:data:integrity, test:current-sprint:core, test:current-sprint:dedupe-fold, test:journey:viewport-declutter, test:ux:core, test:report:header-actions, test:report:summary-contract, test:leadership:hud-shell, test:report-current-shell, test:journey:nudge-summary-bridge, test:journey:adaptive-nudges, test:journey:no-click-coaching, test:journey:direct-value-send, test:journey:human-nudge-trust, test:human-nudge:verify-retry, test:current-sprint-ux-ssot, test:current-sprint-redesign, test:e2e

## Failure Ledger (DO NOT REPEAT THESE):
[Empty - No failures yet]

---

## Active Refactor — Flatten Governance UI (2026-06-13)

**Run ID:** 20260613_194434  
**Regression gate:** `.agent_test_target` → `npm run test:journey:governance-click-friction-round3`  
**Secondary gate (layout only):** `npm run test:journey:layout-overlap`

### Problem Summary

Three nested friction layers on `/governance` compete during scroll and click:

| Layer | Symptom | Root cause |
|-------|---------|------------|
| **1. Scope bar double-deck** | ~44–72px sticky chrome; status chip yanks page scroll; advanced scope opens full overlay | Capsule + `#gov-scope-expanded` in same sticky host; `.gov-scope-chips--scroll` horizontal pocket; `openScopeIntelligenceDrawer` |
| **2. Desktop grid split scroll** | Document scroll vs right-rail column; proof clicks scroll whole page to rail | `governance-shell--desktop-grid`; `scrollIntoView` on `#gov-right-rail-proof-mount`; queue inline → drawer with body lock |
| **3. Owner cluster + evidence tab nesting** | Multiple click targets per card; readiness/baseline/scorecard behind tab panels | Deep `.gov-owner-cluster` DOM; `mountEvidenceTabShell()`; hover proof scrolls supporting evidence |

Round 3 already removed `#gov-sticky-answer-mount` and keeps scope inline. This refactor completes flattening without regressing those wins.

---

### Intended Codebase Changes (13 files)

| # | File | Phase | Change |
|---|------|-------|--------|
| 1 | `public/Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js` | 1 | Merge capsule + expanded into one flat row; status chip uses in-place highlight, not `scrollToFirstClusterNudge()` |
| 2 | `public/Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js` | 1 | Flatten nested desktop/mobile/period/advanced selectors into single horizontal strip |
| 3 | `public/Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js` | 1 | Demote drawer to inline expansion or lightweight popover for routine scope changes |
| 4 | `public/Delivera-Governance-Brief-Page-Controller.js` | 1 | Remove `scrollScopeIntoView` from scope API; wire inline advanced scope path |
| 5 | `public/css/09-governance.css` | 1–2 | Lower `--gov-scope-bar-height`; drop redundant scope/main border; remove right-rail sticky + nested scroll |
| 6 | `public/governance.html` | 2–3 | Flatten `#gov-right-rail-mount` to sibling blocks (proof → queue → PI strip) |
| 7 | `public/Delivera-Shared-Top-Chrome-01Render-UI.js` | 2 | Align `--sticky-global-nav-top` / `--top-chrome-height` so scope offset doesn't duplicate sticky layers |
| 8 | `public/Delivera-App-Governance-Inbox-01Render-UI.js` | 2 | Remove inline preview → full drawer escalation; keep approve/send on-page |
| 9 | `public/Delivera-App-Shared-RightDrawer-01UI.js` | 2 | Reserve drawer for exceptional flows only; avoid body scroll lock on routine actions |
| 10 | `public/Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js` | 3 | Flatten cluster DOM: header → issue list → send row; inline proof preview below chip |
| 11 | `public/Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js` | 3 | Replace `scrollToFirstClusterNudge()` with `focus({ preventScroll: true })` + CSS highlight; proof click sets `data-proof-active` on rail |
| 12 | `public/Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js` | 3 | Demote `mountEvidenceTabShell()` tab panels to always-visible flat sections |
| 13 | `public/Delivera-App-Governance-Brief-22Render-HoverProofCards-UI.js` | 3 | Stop `scrollIntoView` on `#gov-supporting-evidence`; drawer fallback uses in-drawer scroll only |

---

### Phase Plan

**Phase 1 — Scope bar: collapse sticky double-deck**  
Merge capsule + `#gov-scope-expanded` into one flat horizontal row (project chips | quarter pills | period chips | advanced overflow). Remove scroll-jump handlers. Demote scope intelligence drawer to inline/popover. CSS: trim height, remove redundant borders.

**Phase 2 — Sticky stack: one scroll owner**  
Remove `position: sticky` + `overflow-y: auto` + viewport `max-height` from `.gov-right-rail`. Remove nested scroll on `.gov-inbox-inline-preview`. Flatten right-rail mounts to sibling blocks. Reduce `scroll-margin-top` on owner clusters once sticky stack is shorter.

**Phase 3 — Owner clusters + evidence: cut scroll chains**  
Flatten cluster DOM depth. Proof click highlights rail section instead of smooth-scrolling container. Replace evidence tab shell with flat always-visible sections. Stop hover proof cards from opening supporting-evidence accordion.

**Phase 4 — Build & verify**  
```powershell
npm run build:css
npm run test:journey:governance-click-friction-round3
```

---

### Round 3 Success Criteria (must not regress)

| Step | Assertion |
|------|-----------|
| 03 | `#gov-scope-expanded` always visible on desktop |
| 04 | No duplicate sticky verdict after scroll |
| 05 | One-click grouped send (`[data-grouped-send]`) |
| 06 | Inline approve visible on queue summary |
| 07 | Issue preview stays on governance URL |
| 08 | Proof cluster click does not open `#gov-supporting-evidence[open]` |
| 09 | Mobile scope inline; no `.gov-right-drawer-panel--scope-sheet` |

---

### Test Selection Rationale

Among **Available Tests**, `test:journey:governance-click-friction-round3` is the single most specific journey for these 13 governance files. It runs only `Delivera-Governance-Click-Friction-MasterPlan-Round3-Realtime-Validation-Tests.spec.js`, which directly asserts steps 03–09 above. Broader options (`test:journey:governance`, `test:journey:governance-click-friction`) add unrelated specs and dilute signal.
