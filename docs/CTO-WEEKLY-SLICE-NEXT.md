# CTO weekly slice — Vodacom Impact Engine (locked)

**Locked:** 2026-03-21 — **next slice:** `todo-header-role-strip`  
**Shipped this lock:** Verdict/risk normalization on the mission band (`todo-header-risk-and-logging`): main `.sprint-verdict-line` carries `data-signal="health"`, `role="status"`, `aria-label="Sprint health verdict"`, and a left accent rail per verdict color; drawer hygiene remains `data-signal="hygiene"` (neutral chrome). Proof: `VALUE_PROOF_LEDGER.md` + `npm run test:current-sprint:dedupe-fold`.  
**ALB-ID:** Strike #1 (ALB-7 lane) when no Paperclip issue is queued — EngineerLead executes from this doc.  
**Source plan:** `docs/current-sprint-header-declutter_6c80b0d6.plan.md` → `todo-header-role-strip`

## Decision

The next manager-visible Jira improvement is **role view strip consistency** (`todo-header-role-strip`): ensure “View as” role modes live in a clear secondary strip with consistent interactive styling versus risk CTAs — per plan §4. Touch surface: `Reporting-App-CurrentSprint-Header-Bar.js`, `public/css/06-current-sprint.css`; verify `npm run test:current-sprint:dedupe-fold`.

## Previously shipped (reference)

- **Identity + metrics:** `renderHeaderIdentityMetricsRow`, delta on Done %, Playwright metric row test.  
- **Risk / logging:** Verdict line explicitly marked as sprint **health** signal; CSS accent rail distinguishes health from dashed neutral **hygiene** strip in the Context drawer.

## Out of scope for the role-strip slice

- Leadership HUD alignment, CSS pipeline guard — queue after role strip passes `test:current-sprint:dedupe-fold`.

## Acceptance

- `npm run test:current-sprint:dedupe-fold` passes.  
- Manual spot-check: role pills read as neutral filters; risk chips and “Take action” keep stronger affordance.

## Baseline / verify commands (PowerShell)

```powershell
Set-Location C:\Shared\Projects\Jira
npm run build:css
npm run test:current-sprint:dedupe-fold
```

## Proof handoff

On ship: append to `C:\Shared\Projects\VALUE_PROOF_LEDGER.md` (Vodacom Impact Engine) with files touched and verify command.

**Scope contract:** Matches `C:\Shared\Projects\REUSE_RADAR.md` Jira must-win line.
