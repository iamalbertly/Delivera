# Troubleshooting

Use this page for common run and validation issues.

## Cold boot checklist (after reboot)

1. Run **one** server: `npm run dev` (port guard + CSS watch + self-heal).
2. Confirm `Delivera running on http://localhost:3001` (or the port in `.delivera-dev-port`).
3. Open `/governance` — Answer/Today should paint within a few seconds (cache-first while workers warm).
4. Terminal should **not** spam `ERROR Error fetching sprints for board … 400` for kanban boards; those are skipped as non-sprint-capable.
5. Optional: `npm run validate:jira-env` if Jira looks empty.

### Port in use

- Symptom: startup fails with `EADDRINUSE` or nodemon shows `app crashed - waiting for file changes`
- Common cause: multiple `npm run dev` terminals on the same machine (ports 3001–3010)
- Fix:
  - use **one** dev server: `npm run dev` (checks the port before start)
  - or `npm run dev:safe:force` to kill the preferred-port listener
  - stop duplicate `node`/`nodemon` processes, or set another `PORT` in `.env` and restart
  - on Windows, if needed: `taskkill /PID <pid> /F` (PID printed by the port guard)
- Note: CSS/HTML edits no longer restart the API; only `server.js`, `lib/`, `routes/`, and `api/` changes trigger nodemon
- Stale `.delivera-dev-port` after reboot is fine — the port guard re-probes and rewrites it

### Post-reboot worker noise (historical)

- Older builds called `getAllSprints` on every discovered board (including kanban board 27) and logged ERROR on HTTP 400.
- Current behavior: scrum-only sprint ops + deferred governance worker (45s) + negative cache for non-sprint boards.
- If you still see board-27 ERROR spam, confirm you are on a build that includes `lib/Delivera-Data-Board-Sprint-Capability-01SSOT.js`.

## Jira connection issues

### Unauthorized or access denied

- Check:
  - `JIRA_HOST` format (site URL only)
  - `JIRA_EMAIL`
  - `JIRA_API_TOKEN`
  - token permissions for selected Jira projects
- Validate from terminal:

```bash
npm run validate:jira-env
```

## Auth loops or unexpected redirects

- Verify selected auth mode:
  - no-auth local mode (no legacy auth vars set)
  - legacy auth mode (all legacy vars present)
  - SuperTokens mode (enabled + connection URI configured)
- In hybrid mode, confirm `SUPERTOKENS_HYBRID_MODE=true` during migration
- If SuperTokens Docker is enabled, start it separately: `npm run auth:supertokens:up`

## CSS check failures

- If `npm run check:css` fails:
  - do not edit `public/styles.css` directly
  - move style changes into `public/css/*.css`
  - run:

```bash
npm run build:css
npm run check:css
```
