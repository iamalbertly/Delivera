# CTO weekly slice — Vodacom Impact Engine (locked)

**Locked:** 2026-03-21 — **next slice:** `todo-hud-alignment`  
**Shipped this lock:** `todo-copy-map-and-tokens` — expanded `SPRINT_COPY` in `Reporting-App-CurrentSprint-Copy.js` + `formatSprintRemainingLabel` / `formatFreshnessAgeLabel`; mission header + context fallback strings route through copy map; `:root` header typography tokens in `06-current-sprint.css` + `07-leadership.css` (`--header-sprint-name-size`, `--header-verdict-line-size`, `--header-verdict-pill-size`, `--header-export-readiness-size`); viewport fold budget +1px for var rounding (`Jira-Reporting-App-Viewport-Compression-Validation-Tests.spec.js`). Proof: `npm run build:css` + `npm run test:current-sprint:dedupe-fold` (**33 passed, 11 skipped**).  
**ALB-ID:** Strike #1 (ALB-7 lane) when no Paperclip issue is queued.  
**Source plan:** `docs/current-sprint-header-declutter_6c80b0d6.plan.md` → `todo-hud-alignment`

## Decision

The next improvement is **leadership HUD alignment with Current Sprint grammar** (`todo-hud-alignment`): same verbal/visual patterns in `leadership.html` + controller — per plan §12. Touch: `Reporting-App-Leadership-Page-Render.js`, `07-leadership.css`; verify `npm run test:current-sprint:dedupe-fold` (includes leadership viewport spec).

## Previously shipped (reference)

- **Copy/tokens slice:** centralized sprint strings + header font tokens; header bar uses `SPRINT_COPY` for drawer, chips, metric labels, time remaining.

## Out of scope for HUD alignment slice

- CSS pipeline guard for `styles.css` — remains queued after HUD passes the gate.

## Acceptance

- `npm run test:current-sprint:dedupe-fold` passes.  
- Leadership top band reads as sibling to Current Sprint (typography + labels where applicable).

## Baseline / verify commands (PowerShell)

```powershell
Set-Location C:\Shared\Projects\Jira
npm run build:css
npm run test:current-sprint:dedupe-fold
```

## Proof handoff

Append to `C:\Shared\Projects\VALUE_PROOF_LEDGER.md` (Vodacom Impact Engine).

**Scope contract:** `C:\Shared\Projects\REUSE_RADAR.md` Jira must-win line.
