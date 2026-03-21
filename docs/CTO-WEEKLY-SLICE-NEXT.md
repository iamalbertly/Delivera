# CTO weekly slice — Vodacom Impact Engine (locked)

**Locked:** 2026-03-21 — **next slice:** `todo-edge-states` or `todo-header-tests` (next backlog in plan)  
**Shipped this lock:** `todo-orchestration` — documented in **`TESTING.md`**: `npm run test:all` runs **`build:css` + `check:css`** before Playwright journeys (`Jira-Reporting-App-Test-Orchestration-Steps.js`); `test:current-sprint:dedupe-fold` runs **`check:css`** first. Plan frontmatter updated.  
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
