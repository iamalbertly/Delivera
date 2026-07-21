# SKIPPED
# Phase 0 — Browser exploration enrichment (after explore-page.mjs)

Read these artifacts first:
- Brain: C:\Shared\Projects\Delivera\.autohacker\runs\20260614_051156\brain.md
- Evidence bundle: C:\Shared\Projects\Delivera\.autohacker\runs\20260614_051156\evidence-bundle.json
- Deterministic exploration report: C:\Shared\Projects\Delivera\.autohacker\runs\20260614_051156\exploration-report.json

Use Playwright MCP on **full desktop (1280x900)** then **mobile (390x844)** to validate and extend the exploration report for http://127.0.0.1:3001/governance.

Rules:
- If MCP tools are unavailable, read C:\Shared\Projects\Delivera\.autohacker\runs\20260614_051156\exploration-report.json and write narrative only — do NOT report MCP status or stop.
- Click through controls the JSON flagged as failed or suspicious; run negative tests (escape, double-click, scroll+drawer).
- Read browser console during the journey.
- Challenge visual speed and dead vertical space — cite metric numbers from evidence bundle (foldDeadBandPx, scrollToPrimaryValuePx, stickyChromeRatio).
- Every finding must reference evidence (metric, screenshot path, or exploration entry).

Output:
1. Append findings to C:\Shared\Projects\Delivera\.autohacker\runs\20260614_051156\exploration-report.md (create if missing).
2. Update C:\Shared\Projects\Delivera\.autohacker\runs\20260614_051156\exploration-report.json with any new brokenInteractions, consoleIssues, clickReductionIdeas (target 20+ total ideas across JSON + narrative).
3. Do NOT modify application code or AutoHacker.ps1.



