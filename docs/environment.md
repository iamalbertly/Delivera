# Environment Configuration

This document is the detailed environment reference for Delivera.

## `.env` location and loading

- Primary source: `<repo>/.env` (same folder as `package.json`)
- The server also merges current working directory `.env` when relevant
- After changing `.env`, restart the Node process

## Minimum variables (local development)

```bash
JIRA_HOST=https://your-domain.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_jira_api_token
```

## Auth modes

### No auth (default local fast loop)

- Do not set `SESSION_SECRET`, `APP_LOGIN_USER`, or `APP_LOGIN_PASSWORD`
- `/` redirects to report

### Legacy session auth

- Requires all three:
  - `SESSION_SECRET`
  - `APP_LOGIN_USER`
  - `APP_LOGIN_PASSWORD`

### SuperTokens auth

- Enable with:
  - `SUPERTOKENS_ENABLED=true`
  - `SUPERTOKENS_CONNECTION_URI` (default local core: `http://localhost:3567`)
- Migration mode:
  - `SUPERTOKENS_HYBRID_MODE=true` accepts both legacy + SuperTokens sessions

## Full variable reference

### Jira

- `JIRA_HOST`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

### Legacy auth

- `APP_LOGIN_USER`
- `APP_LOGIN_PASSWORD`
- `SESSION_SECRET`

### SuperTokens

- `SUPERTOKENS_ENABLED`
- `SUPERTOKENS_HYBRID_MODE`
- `SUPERTOKENS_CONNECTION_URI`
- `SUPERTOKENS_API_KEY`
- `SUPERTOKENS_APP_NAME`
- `SUPERTOKENS_API_DOMAIN`
- `SUPERTOKENS_WEBSITE_DOMAIN`
- `SUPERTOKENS_API_BASE_PATH`
- `SUPERTOKENS_WEBSITE_BASE_PATH`

### Server and cache

- `PORT` (default `3000`)
- `NODE_ENV`
- `LOG_LEVEL`
- `CACHE_BACKEND` (`memory` or `redis`)
- `REDIS_URL` (required when `CACHE_BACKEND=redis`)
- `CACHE_ENABLE_REMOTE_SCAN` (`1` default)
- `ALLOW_TEST_CACHE_CLEAR` (enables `/api/test/clear-cache` outside test mode)

## Validation command

To verify Jira credentials without using the browser:

```bash
npm run validate:jira-env
```
