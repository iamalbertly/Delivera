# CTO weekly slice — Vodacom Impact Engine (locked)

**Locked:** 2026-03-21 — **next slice:** pick next item from `docs/current-sprint-header-declutter_6c80b0d6.plan.md` backlog (CSS gate satisfied)  
**Shipped this lock:** `todo-css-pipeline-guard` — `npm run test:current-sprint:dedupe-fold` now runs **`npm run check:css` first** (`scripts/check-css.js`): fails if `public/styles.css` was edited directly or is stale vs `public/css/*.css` partials. Proof: `npm run check:css` + `npm run test:current-sprint:dedupe-fold`.  
**ALB-ID:** ALB-42 (EngineerLead).  
**Source plan:** `docs/current-sprint-header-declutter_6c80b0d6.plan.md`

## Decision

The Vodacom gate now enforces **generated `styles.css` SSOT** before Playwright. After any CSS partial edit, run `npm run build:css`; the dedupe-fold command fails fast if the bundle was not regenerated.

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
