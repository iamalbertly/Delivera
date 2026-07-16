# Deployment

This page contains deployment-specific guidance. Keep `README.md` lean and link here for details.

## Runtime

- Node.js `>=20`
- Start command: `npm start`
- Build/install: `npm install` (or `npm ci`)

## Local UAT ownership

- Development workspace: `C:\Users\Hermes\Documents\Delivera\Delivera-src`
- Managed UAT checkout: `C:\Shared\Projects\Delivera`
- UAT URL: `http://localhost:3001`
- UAT branch: `autohacker-20260615_093142`
- UAT credentials remain in the ignored `C:\Shared\Projects\Delivera\.env` file.

Never assume a pushed development checkout automatically changes the running UAT process. Synchronize and verify it with:

```powershell
npm run uat:sync
```

The command refuses tracked UAT changes, fast-forwards only, installs dependencies, validates committed CSS, reloads the managed server even for documentation-only releases, and succeeds only when `/version` reports the expected commit.

## Render

The repository includes `render.yaml` with:

- Service type: `web`
- Runtime: `node`
- Build command: `npm install`
- Start command: `npm start`

Recommended production env:

- Required:
  - `NODE_ENV=production`
  - `JIRA_HOST`
  - `JIRA_EMAIL`
  - `JIRA_API_TOKEN`
- Auth (choose mode):
  - SuperTokens preferred: `SUPERTOKENS_ENABLED=true` and related SuperTokens variables
  - Legacy fallback: `APP_LOGIN_USER`, `APP_LOGIN_PASSWORD`, `SESSION_SECRET`
- Optional shared cache:
  - `CACHE_BACKEND=redis`
  - `REDIS_URL`

## Vercel (serverless Express mode)

The repository includes:

- `index.js` — Vercel zero-config Express entrypoint (must import `express` in this file). Exports the app with background workers disabled.
- `api/index.js` — re-exports root `index.js` for legacy `/api` paths only.
- `vercel.json` — install + CSS build; `functions.*.includeFiles` bundles `public/**` and `data/**` into the serverless function (required for `sendFile` HTML routes like `/governance`). Static assets are also served from the CDN.
- `.github/workflows/vercel-preview.yml` — preview deployment workflow that runs only when Vercel repository secrets are configured.

Use Vercel when you want a quick beta URL. Keep these limits in mind:

- Background snapshot workers are disabled in serverless mode; use Render or another always-on host for scheduled workers.
- Set production environment variables in Vercel Project Settings, never in git.
- Required Vercel project env: `NODE_ENV=production`, `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
- Auth env for a shareable beta: either SuperTokens variables or legacy `APP_LOGIN_USER`, `APP_LOGIN_PASSWORD`, `SESSION_SECRET`.
- GitHub preview deploy secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

Manual local deploy after `vercel login`:

```bash
npm run vercel:deploy
```

## Pre-deploy checks

Run before deploy:

```bash
npm run build:css
npm run check:css
npm run test:all
```

## Post-deploy smoke checks

- Open `/report`
- Open `/current-sprint`
- Open `/leadership`
- Verify preview can run and no auth loops occur for your chosen auth mode
- Verify `/version` reports the same commit in UAT and production.
- Verify `/api/governance-brief.json?projects=SD` is `live`; a `cannot-verify` response must fail the release gate.
