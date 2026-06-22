# Organization settings (admin)

Delivera shows organization configuration **read-only** in Settings → Organization. Admins edit sources on disk or via API — not in the browser UI.

## Project catalog

**File:** `data/Delivera-Org-Project-Catalog.json` (copy from [`docs/Delivera-Org-Project-Catalog.example.json`](Delivera-Org-Project-Catalog.example.json))

```json
{
  "schemaVersion": 1,
  "projects": [
    {
      "key": "SD",
      "label": "DMS Squad",
      "shortLabel": "DMS",
      "subtitle": "Kilimanjaro Legends",
      "defaultSelected": false,
      "portfolioGroup": "optional"
    }
  ]
}
```

- `key` — Jira project key (immutable in UI)
- `label` — organization display name
- `shortLabel` — chip / compact UI (defaults to `label`)
- `defaultSelected` — org default for new browsers
- If the JSON file is missing or invalid, the server falls back to `public/Delivera-Shared-Projects-Catalog-01SSOT.js`

**API:** `GET /api/projects-catalog.json` — catalog + Jira access flags + `displayMode`

## Display mode

**Env:** `DELIVERA_PROJECT_DISPLAY_MODE`

| Value | UI behavior |
|-------|-------------|
| `label` (default) | Show display name; Jira key in tooltip |
| `key` | Show Jira key |
| `both` | `DMS Squad (SD)` |

## Governance profile overrides

**File:** `data/Delivera-Governance-Profile-Overrides.jsonl`

**API:**

- `GET /api/governance/profile?projects=MPSA,SD` — effective thresholds
- `POST /api/governance/profile` — append override (admin/script only)

## Squad roles (Jira fields)

**Env:**

- `GOV_SM_FIELD_ID` — Jira custom field id for Scrum Master
- `GOV_PO_FIELD_ID` — Jira custom field id for Product Owner

## Settings APIs (read-only UI)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/settings/org-summary.json` | Catalog + governance + access (one fetch) |
| `GET /api/settings/runtime.json` | Sanitized Jira/auth/cache health |
| `GET /api/settings/ai-usage.json` | AI usage telemetry |

## RBAC (deferred)

`DELIVERA_ORG_ADMIN_USERS` is reserved for future admin-only edit UI. Until then, all authenticated users see the same read-only org panels.
