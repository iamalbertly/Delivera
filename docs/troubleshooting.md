# Troubleshooting

Use this page for common run and validation issues.

## Server does not start

### Port in use

- Symptom: startup fails with `EADDRINUSE`
- Fix:
  - stop the process using the same port, or
  - set another `PORT` and restart

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

## CSS check failures

- If `npm run check:css` fails:
  - do not edit `public/styles.css` directly
  - move style changes into `public/css/*.css`
  - run:

```bash
npm run build:css
npm run check:css
```

See `public/css/README.md` for CSS ownership rules.

## Tests fail early in orchestration

- `npm run test:all` is fail-fast and stops on first failing step.
- Use focused journeys while debugging:
  - `npm run test:journey:ux-core`
  - `npm run test:journey:current-sprint`
  - `npm run test:journey:data-integrity`

Refer to `TESTING.md` for run modes and flags.

## Stale or inconsistent preview/sprint data

- Use live/refresh query options when debugging data freshness.
- Ensure test cache clear endpoint is available only when intended.
- For multi-instance deployments, prefer `CACHE_BACKEND=redis`.

## Jira comment send returns 404 or does nothing

- Symptom: browser console shows `404` on `POST /api/issues/KEY/comment`, or Take action / Send to Jira fails silently.
- If the response body is HTML `Cannot POST /api/issues/.../comment`, the Node process is running **old code**. Restart: `npm run dev` or `npm start` on the port you use (`BASE_URL`). The UI toast should say the comment API is missing on this port after the client fix ships.
- If the API returns JSON with `JIRA_COMMENT_FAILED` and HTTP 403/404, check Jira token permissions (**Add comments** on the project) and that the issue key exists.
- Snapshot or historical sprint views disable send; switch to **Live** active sprint data before commenting.

### Console noise that is not Delivera

- `A listener indicated an asynchronous response by returning true, but the message channel closed` — almost always a **browser extension** (password manager, ad blocker, Cursor/IDE helper). Disable extensions on `127.0.0.1` or use a clean profile if it obscures real errors.
- `[Violation] 'storage' handler took …ms` on `Delivera-Shared-Global-Nav.js` — localStorage sync for notification badges; debounced in app code. Safe to ignore unless the page feels sluggish.
