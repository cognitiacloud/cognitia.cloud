# Hermes HubSpot Skill

The real HubSpot CRM path for the Cognitia pilot, plus the integration
health/status contracts the operator UI consumes.

What it does:

- **Contact lookup** by email or id (`/crm/v3/objects/contacts/search`, `GET .../{id}`).
- **Contact create** (`POST /crm/v3/objects/contacts`).
- **Activity writeback** — writes a Note to a contact's timeline and associates
  it to the contact (`POST /crm/v3/objects/notes`, association type `202`).
- **Find-or-create + log** in one operator action (`sync_contact_activity`).
- **Integration health + sync status** objects for the UI.

It is **fail-closed**: with no credentials it refuses to act and never claims a
success. It is also fully **auditable**: every operation appends a redacted
record to an in-memory ledger (and optionally to an append-only JSONL audit
log). Tokens never appear in logs, audit records, or returned objects.

This skill uses **stdlib only** at runtime — the HubSpot CRM v3 API is reached
directly over HTTPS via `urllib`, matching the vision skill's provider pattern.

## Operating modes

The mode governs **writes** and is reported on every result as `mode`:

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| `live` | `HUBSPOT_ACCESS_TOKEN` set, dry-run off | Real API calls. |
| `dry_run` | `HUBSPOT_DRY_RUN` truthy | Plans payloads, **no mutations, no network writes**. The seam. |
| `blocked_no_credentials` | no token, not dry-run | Fail closed. No network at all. |

The health connection probe is the one read that always runs when a token is
present (even in dry-run), because operators need the truth about whether the
credential works. `mode` (which governs writes) is reported separately from
`connection` (the probe result).

## Configure

| Env var | Default | Purpose |
|---------|---------|---------|
| `HUBSPOT_ACCESS_TOKEN` | — | **Required for live.** Private app token (Bearer). |
| `HUBSPOT_BASE_URL` | `https://api.hubapi.com` | API base. |
| `HUBSPOT_DRY_RUN` | off | Truthy → plan only, never mutate. |
| `HUBSPOT_TIMEOUT` | `30` | Per-request timeout (seconds). |
| `HUBSPOT_MAX_RETRIES` | `3` | Attempts on 429/5xx/network. |
| `HUBSPOT_RETRY_BASE_SECONDS` | `1.0` | Exponential backoff base. |
| `HUBSPOT_RETRY_CAP_SECONDS` | `30.0` | Backoff ceiling; also caps `Retry-After`. |
| `HUBSPOT_AUDIT_LOG` | off | Append-only JSONL audit path (redacted). |
| `HUBSPOT_HEALTH_PROBE_DISABLE` | off | Truthy → skip the live connection probe. |

No secret is ever read from code or written to an artifact — only from the
environment. See `docs/handoffs/lane-c.md` for the full operator runbook,
required scopes, and the verified-vs-blocked status.

## CLI

```bash
python3 hubspot_skill.py health     # integration health contract
python3 hubspot_skill.py status     # ledger counters + recent ops + health
python3 hubspot_skill.py config     # redacted config (token -> fingerprint)
python3 hubspot_skill.py find  --email lead@example.com
python3 hubspot_skill.py find  --id 262363443138
python3 hubspot_skill.py log   --id 262363443138 --note "Logged a pilot call"
python3 hubspot_skill.py sync  --email lead@example.com --note "Demo booked" \
        --firstname Pat --lastname Lee
```

With no token, every command returns a `blocked` / `not ready` object rather
than an error trace or a fabricated success. To rehearse the write path safely:

```bash
HUBSPOT_DRY_RUN=1 HUBSPOT_ACCESS_TOKEN=pat-... \
    python3 hubspot_skill.py sync --email lead@example.com --note "rehearsal"
```

## Health contract (UI)

```jsonc
{
  "integration": "hubspot",
  "mode": "live | dry_run | blocked_no_credentials",
  "credentials_present": true,
  "dry_run": false,
  "connection": "ok | auth_failed | forbidden_scopes | unreachable | not_checked",
  "ready_for_pilot": true,           // only true when live + connection ok + no blockers
  "blocking_reasons": [],            // human-readable, UI-renderable
  "account": { "portal_id": 343344751, "hub_domain": "app.hubspot.com" },
  "latency_ms": 120,
  "last_checked": "2026-06-15T03:56:31Z"
}
```

`ready_for_pilot` is the single boolean the UI can gate on. It is never `true`
unless a live connection was actually verified and writes are not blocked.

## Status contract (UI)

`hubspot_status` returns the health object plus a sync ledger: `counters`
(by outcome), `total_operations`, `recent_operations`, `last_success`,
`last_error`. Each operation record carries `action`, `mode`, `outcome`,
`object_type`, `object_id`, `idempotency_key`, `attempts`, `http_status`,
`duration_ms`, and a redacted `error`.

## MCP server

```bash
python3 hubspot_skill.py --mcp     # requires: pip install mcp
```

Exposes `health`, `status`, `config`, `find_contact`, `log_activity`,
`sync_contact_activity`. See `.mcp.json`.

## Tests

```bash
python3 -m unittest test_hubspot_skill -v
```

Runs with **no credentials and no network**. The full request / retry / audit
path is exercised through an injected fake transport — the same seam that makes
live-vs-simulated explicit in the code.

## Safety constraints

- Fail closed: no credentials → no action, no fabricated success.
- No success without a real 2xx response from HubSpot.
- Tokens are redacted from logs and audit records, and never returned (config
  exposes only a non-reversible `pat-xxx…(len=N)` fingerprint).
- Retries are bounded (429/5xx/network only); 4xx is not retried.
- Every operation is recorded for audit; auditing never crashes an operation.
