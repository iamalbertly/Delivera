# Deployment

This page contains deployment-specific guidance. Keep `README.md` lean and link here for details.

## Runtime

- Node.js `>=20`
- Start command: `npm start`
- Build/install: `npm install` (or `npm ci`)

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

## Vercel (Node server mode)

If deploying as a Node server:

- Framework preset: `Node.js` or `Other`
- Root directory: repository root
- Build command: `npm install`
- Start command: `npm start`
- Set the same required environment variables as production

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
