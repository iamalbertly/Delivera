# CTO weekly slice — Vodacom Impact Engine (locked)

**Locked:** 2026-03-21 — **next slice:** `todo-header-risk-and-logging`  
**Shipped this lock:** Row 1 identity + metric tiles + inline last-sprint delta (`todo-header-identity-and-metrics`) — proof ALB-18 / `VALUE_PROOF_LEDGER.md`  
**ALB-ID:** Proof entry on ship ties to active Paperclip task (ALB-7 lane until ChiefOfStaff rotates strike list)  
**Source plan:** `docs/current-sprint-header-declutter_6c80b0d6.plan.md` → `todo-header-risk-and-logging`

## Decision

The next manager-visible Jira improvement is **verdict/risk color normalization and logging demotion** (`todo-header-risk-and-logging`): normalize risk colors and copy, demote logging alerts to hygiene context, and clarify health vs hygiene in the header — per plan §3 and §7. Touch surface stays the Current Sprint header stack (`Reporting-App-CurrentSprint-Header-Bar.js`, related helpers, `public/css/06-current-sprint.css`); no new routes or deps unless ChiefOfStaff reopens scope.

## Previously shipped (reference)

Identity row + three metric tiles (Done %, Work items, Logged/est) + delta inline on Done % — implemented in `Reporting-App-CurrentSprint-Header-Bar.js` (`renderHeaderIdentityMetricsRow`, `computeDoneDeltaVsPriorClosed`). Regression: Playwright **Mission control row 1 shows three standardized metric tiles** in `Jira-Reporting-App-CurrentSprint-Mission-Control-Direct-Value-Validation-Tests.spec.js`.

## Out of scope for the risk/logging slice

- Mini-header scroll polish, segmented context strip-only work, leadership HUD alignment, CSS pipeline guard — queue after risk/logging passes `test:current-sprint:dedupe-fold`.

## Acceptance

- `npm run test:current-sprint:dedupe-fold` passes (no regressions in viewport + mission-control specs).
- Manual spot-check: verdict line uses one strong risk color system; logging/hygiene reads as demoted vs sprint health.

## Baseline / verify commands (PowerShell)

```powershell
Set-Location C:\Shared\Projects\Jira
npm run test:current-sprint:dedupe-fold
```

Optional full gate after edits:

```powershell
Set-Location C:\Shared\Projects\Jira
npm run test:all
```

## Proof handoff

On ship: append one entry to `C:\Shared\Projects\VALUE_PROOF_LEDGER.md` (Vodacom Impact Engine) with files touched, the command above (or `test:all` if used), and the ALB issue id in use when merged.

**Scope contract (SSOT pair):** App/CSS edit surface matches `C:\Shared\Projects\REUSE_RADAR.md` — Jira Internal App **must-win slice** bullet; verify with `npm run test:current-sprint:dedupe-fold`.
