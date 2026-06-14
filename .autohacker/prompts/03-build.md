# Phase 3 - Build and validate

Read {{BRAIN_FILE}}, {{INVEST_LOG}}, {{PLAN_LOG}}, {{EVIDENCE_BUNDLE}}.

**Build phase (Loop {{LOOP_INDEX}})** - implement the full plan:
1. UX fixes for void gaps, hidden-value clicks, scope dead space, inline direct-value.
2. **4+ edge cases per major item** aligned to {{CORE_VALUES}}.
3. Create/update Playwright specs in tests/ - fail-fast (--max-failures=1), realtime UI queries after each step, console capture, journey value not legacy noise.
4. Run `npm run build:css` then the npm command in {{TEST_TARGET_FILE}} before done.
5. Write implementation notes to **{{BUILD_LOG}}**.

Do NOT modify .autohacker/AutoHacker.ps1.

{{PATCH_TEXT}}
