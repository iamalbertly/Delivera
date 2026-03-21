# CTO weekly slice — Vodacom Impact Engine (locked)

**Locked:** 2026-03-21 — **next slice:** `todo-header-tests` (then `todo-manual-verification-and-commit`)  
**Shipped this lock:** `todo-edge-states` — mission header **`data-edge-state`** (`empty` | `just-started` | `low-confidence` | `none`); explicit copy for zero-work sprints, **`SPRINT_COPY.justStarted`** when health model `justStarted`, **` · Low confidence`** when prior-sprint delta is missing or fewer than three closed sprints appear in `recentSprints`; historical hygiene string uses en-dash; verdict explain `title` uses low-confidence hint when applicable. Gate: **`npm run test:current-sprint:dedupe-fold`** exit 0 (32 passed, 12 skipped).  
**ALB-ID:** ALB-42 (EngineerLead).  
**Source plan:** `docs/current-sprint-header-declutter_6c80b0d6.plan.md`

## Decision

Full orchestration and the focused dedupe-fold gate both enforce **CSS SSOT** before browser tests; see `TESTING.md` for the command matrix.

## Previously shipped (reference)

- **Copy/tokens slice:** centralized sprint strings + header font tokens; header bar uses `SPRINT_COPY` for drawer, chips, metric labels, time remaining.

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
