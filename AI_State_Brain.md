# Agent Persistent Memory
Target: http://127.0.0.1:3001/governance
Core Directives: Flatten UI hierarchy, zero-click data visibility, eliminate redundant borders.
Available Tests: test:all, test:all:stop, test:pw, test:focused, test:smoke, test:journey:current-sprint, test:journey:leadership, test:journey:brief-ssot, test:journey:layout-overlap, test:journey:governance, test:journey:outcome-intake, test:outcome-intake, test:journey:ux-core, test:journey:direct-value-masterplan, test:journey:customer-simplicity-trust, test:journey:customer-growth-round3, test:journey:hero-squad-first, test:journey:value-retention, test:journey:churn-retention-masterplan, test:journey:governance-click-friction, test:journey:governance-click-friction-round3, test:journey:governance-growth-round2, test:report-jira-ux, test:journey:shell-direct-value, test:journey:data-integrity, test:e2e:full, test:api:core, test:data:integrity, test:current-sprint:core, test:current-sprint:dedupe-fold, test:journey:viewport-declutter, test:ux:core, test:report:header-actions, test:report:summary-contract, test:leadership:hud-shell, test:report-current-shell, test:journey:nudge-summary-bridge, test:journey:adaptive-nudges, test:journey:no-click-coaching, test:journey:direct-value-send, test:journey:human-nudge-trust, test:human-nudge:verify-retry, test:current-sprint-ux-ssot, test:current-sprint-redesign, test:e2e

## Intended Codebase Changes (2026-06-13 — UI flatten pass)

**Source:** `.agent_logs/20260613_150352/L1_Investigation.md`  
**Validation gate:** `npm run test:journey:governance-click-friction-round3` (written to `.agent_test_target`)  
**Secondary gates:** `npm run test:journey:layout-overlap`, `node scripts/audit-governance-clicks-fast.mjs`

### Goal
Flatten governance brief hierarchy: zero-click visibility for scope, verdict, proof, and owner actions; eliminate redundant sticky chrome and drawer fallbacks.

### Phase 1 — Scope bar (triple-nest → inline)
| File | Change |
|------|--------|
| `public/Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js` | Remove collapse toggle; keep project/quarter/period chips visible inline; drop mobile `scope-sheet` drawer path; remove `expandScopePanel()` + `scrollIntoView` |
| `public/Delivera-App-Governance-Brief-ScopeBar-02ProjectQuarter-Selector-UI.js` | Promote selectors from `#gov-scope-expanded[hidden]` into always-visible capsule row; flatten advanced accordion |
| `public/css/09-governance.css` | Reduce sticky scope bar height; remove mobile sheet + stale-overlay `pointer-events:none` on refresh |

### Phase 2 — Sticky chrome (dual stack → single)
| File | Change |
|------|--------|
| `public/Delivera-App-Governance-GlobalAgentBar-01UI.js` | Remove or demote `#gov-sticky-answer-mount` duplicate copy-answer; fold verdict micro-copy into scope bar or main answer |
| `public/governance.html` | Reorder mounts: scope bar → main (no sticky answer between) |
| `public/Delivera-Governance-Brief-Page-Controller.js` | Remove `bindStickyScroll(120)` wiring |
| `public/css/09-governance.css` | Delete `#gov-sticky-answer-mount.gov-sticky-answer--governance` sticky/pointer-events rules |

### Phase 3 — Owner clusters (nested → flat)
| File | Change |
|------|--------|
| `public/Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js` | Inline hidden `<ul.gov-cluster-issues>`; surface proof preview inline; reduce action row to one-click send/nudge |
| `public/Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js` | Proof click → right-rail highlight only (no `openEvidenceDrawer` fallback); remove `+N more` toggle |
| `public/Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js` | SSOT `renderEvidencePreview` for inline + rail |
| `public/Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js` | Restrict drawer to explicit evidence/inbox flows only |
| `public/Delivera-App-Shared-RightDrawer-01UI.js` | Stop scroll-lock for proof-preview path |

### Build note
Edit `public/css/09-governance.css` only (not `styles.css`); run `npm run build:css` after CSS changes.

## Failure Ledger (DO NOT REPEAT THESE):
[Empty - No failures yet]
