# Hermes HubSpot Skill

The HubSpot CRM **live path** for the Cognitia pilot. It does contact
lookup, contact association, and activity write-back (notes + tasks), and it
exposes an integration **health/status contract** for a UI to consume.

Design contract (enforced in code and tests):

- **Fails closed.** With no credentials the skill runs in `seam` mode: every
  read/write returns a structured `state: "blocked"` result. It **never**
  fabricates a successful HubSpot object.
- **Real-vs-seam boundary is explicit.** All HTTP goes through a single
  `_http_call()` seam. Every result and the health object carry a `mode`
  field (`live` | `seam`). Simulated responses (opt-in via
  `HUBSPOT_ALLOW_SIMULATION`, **off by default**) are stamped
  `"simulated": true, "source": "seam"`.
- **Secrets stay out of logs.** A redacting log filter scrubs tokens and
  emails; auth identity is only ever shown masked.
- **Auditable.** Each operation emits a redacted JSONL audit record (to
  `HUBSPOT_AUDIT_LOG` when set) plus a redacted `INFO` log line.

No HubSpot SDK dependency — the REST API is called directly over stdlib
`urllib`, consistent with the rest of Hermes.

## Install

```bash
# Core skill needs only the Python 3.10+ stdlib.
# MCP stdio server (optional):
pip install mcp
```

## Configure (credentials)

Two auth modes are supported behind one interface. Auto-detected unless you
set `HUBSPOT_AUTH_MODE`.

### Private App token (recommended for the pilot)

```bash
export HUBSPOT_ACCESS_TOKEN="pat-na1-xxxxxxxx-...."
```

### OAuth refresh flow

```bash
export HUBSPOT_AUTH_MODE=oauth
export HUBSPOT_CLIENT_ID="...."
export HUBSPOT_CLIENT_SECRET="...."
export HUBSPOT_REFRESH_TOKEN="...."   # access tokens are minted + cached automatically
```

### Other env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `HUBSPOT_AUTH_MODE` | _(auto)_ | Force `private_app` or `oauth` |
| `HUBSPOT_BASE_URL` | `https://api.hubapi.com` | API base (same for all portal regions) |
| `HUBSPOT_MAX_RETRIES` | `3` | Retries on 429/5xx/network (exponential backoff, honors `Retry-After`) |
| `HUBSPOT_TIMEOUT` | `30` | Per-request timeout (seconds) |
| `HUBSPOT_AUDIT_LOG` | _(unset)_ | Path to append a redacted JSONL audit trail |
| `HUBSPOT_ALLOW_SIMULATION` | `off` | If on, seam mode returns clearly-labelled `simulated:true` responses (UI dev only) |

No secrets are stored in code; the skill reads credentials only from the
environment and redacts them in logs.

## Tools

### `hubspot_health_check` — the UI status contract
Returns an `IntegrationHealth` object:

```json
{
  "integration": "hubspot",
  "status": "ok | degraded | down | unconfigured",
  "mode": "live | seam",
  "base_url": "https://api.hubapi.com",
  "auth": { "mode": "private_app", "token": "pat-…1 (len=…)" },
  "checks": [ { "name": "contacts_read", "ok": true, "detail": "...", "latency_ms": 84 } ],
  "portal": { "portal_id": 343344751, "account_type": "STANDARD", "ui_domain": "app-na3.hubspot.com" },
  "last_error": null,
  "checked_at": "2026-06-15T04:00:00Z"
}
```

### `hubspot_contact_lookup`
Inputs: `email` **or** `contact_id`. Returns a `SyncResult` whose
`details.found`/`details.contact_id`/`details.properties` carry the match.
`state` is `success` (found), `skipped` (not found), `failed` (API error),
or `blocked` (seam mode).

### `hubspot_contact_associate`
Inputs: `contact_id`, `to_object_type` (e.g. `companies`, `deals`),
`to_object_id`, optional `association_type_id`. Uses the HubSpot v4
associations API.

### `hubspot_activity_writeback`
Inputs: `contact_id`, `writeback_type` (`note` | `task`), `subject`, `body`,
optional `task_status`. Creates the engagement and associates it to the
contact. Returns a `SyncResult` with the new object id in `target_id`.

Every tool returns a `SyncResult` (`hubspot_health_check` returns
`IntegrationHealth`), both stable shapes intended for direct UI consumption.

## CLI usage

```bash
python3 hubspot_skill.py auth                       # masked auth diagnostics
python3 hubspot_skill.py health                     # integration health JSON
python3 hubspot_skill.py lookup --email a@b.com
python3 hubspot_skill.py lookup --contact-id 1001
python3 hubspot_skill.py associate --contact-id 1001 --to-type companies --to-id 2002
python3 hubspot_skill.py writeback --contact-id 1001 --type note --body "logged from Cognitia"
python3 hubspot_skill.py writeback --contact-id 1001 --type task --subject "follow up"
```

With no credentials these honestly report `seam` / `blocked` rather than
failing or faking success.

## MCP server usage

```bash
python3 hubspot_skill.py --mcp
```

Exposes the four tools above. Register via `.mcp.json` in this folder.

## Failure states & retries

- Errors are categorized: `auth` (401/403, not retried), `rate_limit`
  (429, retried, honors `Retry-After`), `validation` (400/409/422, not
  retried), `server` (5xx, retried), `network` (timeouts/connection, retried),
  `config` (no credentials → blocked).
- Retries use exponential backoff (`2, 4, 8…s`), capped by
  `HUBSPOT_MAX_RETRIES`.
- `SyncResult.attempts` records how many tries were made; operators can see
  this in the audit log.

## Tests

```bash
python3 test_hubspot_skill.py    # 30 tests, runs fully offline, zero credentials
```

The only network seam (`_http_call`) is mocked, so auth/retry/operation logic
is exercised without touching HubSpot.

See `docs/handoffs/lane-c.md` for the operator runbook, credential setup, and
the explicit "verified vs blocked by live credentials" status.
