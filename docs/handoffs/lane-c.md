# Lane C — HubSpot Live Path & Integration Health

**Owner:** Lane C
**Scope:** Take the HubSpot integration path as far toward real pilot readiness
as honestly possible, in-repo. Contact lookup/association, activity writeback,
integration health/status contracts, sync failure states + retries, and the
exact credential/operator requirements.
**Status date:** 2026-06-15

---

## 1. Audit of the starting state

There was **no HubSpot integration anywhere in the repository** at the start of
this lane (`git grep -i hubspot` across all branches returned nothing; the repo
contained only `hermes/skills/vision-skill/`). So "the existing HubSpot path"
was a clean slate. Rather than invent a half-real client, this lane builds a
complete HubSpot CRM path to the **same engineering standard as the existing
`vision-skill`** (stdlib-only HTTP, fail-closed defaults, redacted logs, an
injectable seam, a CLI + an MCP server, and offline tests).

Two distinct HubSpot surfaces exist in this environment, and **keeping them
separate is the whole point of this lane's honesty requirement:**

| Surface | Auth | Where it lives | Used for |
|---------|------|----------------|----------|
| **In-repo skill** (`hermes-hubspot`) | `HUBSPOT_ACCESS_TOKEN` private app token | This repo — the deliverable | The automated pilot path Cognitia ships |
| **Session MCP** (HubSpot connector) | Per-session OAuth (`cognitiacloud@gmail.com`) | The agent session only — *not* in the repo | Verifying the live path against the real portal |

The in-repo skill does **not** depend on the session MCP. The MCP was used only
to prove, against the real portal, that the exact REST shapes the skill issues
actually work (see §6).

---

## 2. What was built

`hermes/skills/hubspot-skill/`

| File | Purpose |
|------|---------|
| `hubspot_skill.py` | Client, retries, dry-run planner, audit ledger, health/status contracts, CLI, MCP server. |
| `test_hubspot_skill.py` | 34 offline tests (no creds, no network) via an injected fake transport. |
| `README.md` | Operator/dev usage. |
| `skill.yaml` / `.mcp.json` | Hermes + MCP registration metadata. |
| `requirements.txt` | Stdlib only at runtime (optional `mcp` for the server). |

Capabilities:

- **Contact lookup** — by email (`POST /crm/v3/objects/contacts/search`,
  `email EQ`) or by id (`GET /crm/v3/objects/contacts/{id}`).
- **Contact create** — `POST /crm/v3/objects/contacts`.
- **Activity writeback** — `POST /crm/v3/objects/notes` with a
  `HUBSPOT_DEFINED` association (type **202**, Note→Contact) so the note lands
  on the contact's timeline.
- **`sync_contact_activity`** — the full pilot path: find-or-create the contact
  by email, then log the note. Links the per-step audit records.
- **Health + status contracts** for the UI (§4).

> **Association note.** "Association" here is implemented as the Note→Contact
> association that writeback depends on (type 202), which is verified live.
> Generic object-to-object association (e.g. contact→company via
> `PUT /crm/v4/objects/...`) was intentionally **not** added as a separate tool
> — it is out of scope for the pilot path and would have been an unverified
> seam. Called out here so the boundary is explicit rather than implied.

---

## 3. Real-vs-seam boundary (explicit)

The single seam where bytes leave the process is the **transport** callable.
`HubSpotClient` takes an injectable `transport`; the default is a thin `urllib`
wrapper, and tests inject a fake that replays scripted responses. This is what
makes "live vs simulated" unambiguous in code, not just in prose.

Operating **mode** governs writes and is stamped on every result:

- `live` — token present, dry-run off → real API calls.
- `dry_run` (`HUBSPOT_DRY_RUN=1`) — builds and returns the exact payload it
  *would* send, performs **no network writes**, and **invents no ids** (the
  composite sync returns `contact_id: null`, `note_id: null`).
- `blocked_no_credentials` — no token → fail closed, **no network at all**.

The health **connection probe** is deliberately decoupled from write-mode: it
runs whenever a token is present (even under dry-run) because operators need the
truth about whether the credential authenticates. `mode` and `connection` are
reported as separate fields.

---

## 4. UI consumption — the contracts

`hubspot_health()` → gate the UI on the single boolean `ready_for_pilot`:

```jsonc
{
  "integration": "hubspot",
  "mode": "live | dry_run | blocked_no_credentials",
  "credentials_present": true,
  "dry_run": false,
  "connection": "ok | auth_failed | forbidden_scopes | unreachable | not_checked",
  "ready_for_pilot": false,            // true ONLY when live + connection ok + no blockers
  "blocking_reasons": ["HUBSPOT_ACCESS_TOKEN is not set"],
  "account": { "portal_id": 343344751, "hub_domain": "app.hubspot.com" },
  "latency_ms": 120,
  "last_checked": "2026-06-15T03:56:31Z"
}
```

`hubspot_status()` → operator-visible sync state: the embedded health object
plus `counters` (by outcome), `total_operations`, `recent_operations`,
`last_success`, `last_error`. Each operation record:

```jsonc
{
  "action": "log_activity",
  "mode": "live",
  "outcome": "created",            // ok|created|found|not_found|dry_run|blocked|error
  "object_type": "note",
  "object_id": "260302748636",
  "idempotency_key": "…",
  "attempts": 1,
  "http_status": 201,
  "duration_ms": 240,
  "error": null                    // redacted if present
}
```

---

## 5. Failure states, retries, auditability, secret hygiene

- **Retries:** bounded exponential backoff (`HUBSPOT_MAX_RETRIES`, default 3) on
  `429` and `5xx` and network errors, honoring `Retry-After` (capped). `4xx`
  (bad request / not found) is **not** retried. `attempts` is recorded.
- **Fail closed:** no token → every op returns `outcome: "blocked"` with no
  network call; `ready_for_pilot` is `false`. No partial/fabricated success.
- **No success without 2xx:** an `ok/created/found` outcome is only set on a
  real 2xx response.
- **Auditability:** every op appends an `OperationRecord` to an in-memory ledger
  (cap 200) and, if `HUBSPOT_AUDIT_LOG` is set, to an append-only JSONL file.
  Audit writes can never crash an operation.
- **Secrets out of logs:** a redacting log filter + `_redact()` scrub `pat-…`
  tokens, `Bearer …`, `Authorization`/`access_token` values, and `hapikey`
  from logs, audit records, and even error bodies echoed back by HubSpot. The
  token is never in a returned object — `config` exposes only a non-reversible
  `pat-na1…(len=N)` fingerprint. (Covered by tests
  `test_error_body_is_redacted`, `test_audit_log_written_and_redacted`,
  `test_config_describe_has_no_raw_token`.)

---

## 6. Verified vs blocked by live credentials

### ✅ Verified

**A. In-repo skill, offline (no creds, no network) — automated tests.**
`python3 -m unittest test_hubspot_skill` → **34 tests, all passing.** Covers:
fail-closed (no network when blocked), dry-run seam (no network, no invented
ids), live find/create/log via fake transport, retry on 429→success, retry on
500→give-up, network-error retry, 4xx-not-retried, all five health connection
states, ledger/counter accounting, and token redaction (incl. leaked error
bodies and the audit file).

**B. Live REST path, real portal — verified via the session OAuth (MCP).**
The exact request shapes the in-repo skill issues were exercised against the
real Cognitia portal **`343344751`** (`cognitiacloud@gmail.com`, a fresh demo
portal). Object availability confirmed: `CONTACT` read+write, `NOTE` read+write.

| Step | Skill REST shape | Live result |
|------|------------------|-------------|
| Contact lookup (read) | `contacts/search` `email EQ` | Returned the 2 default sample contacts ✓ |
| Contact create | `POST contacts` | Created contact **`262363443138`** ✓ |
| Activity writeback | `POST notes` + assoc **type 202** | Created note **`260302748636`**, association `successful: 1` ✓ |
| Round-trip lookup | `contacts/search` `email EQ` | Found the new contact by email ✓ |

This proves the contact-lookup, contact-create, note-writeback, and
note→contact-association mechanics are correct against live HubSpot.

> **Verification artifact (safe to delete):** contact
> `lane-c-verify@cognitia.cloud` (`262363443138`) and its note
> (`260302748636`), both tagged "Lane C pilot-readiness verification". Operator
> may archive/delete them in HubSpot at any time.

### ⛔ Blocked by live credentials

**The in-repo skill's own `live` mode is blocked: there is no
`HUBSPOT_ACCESS_TOKEN` in this environment.** Confirmed (`env | grep -ic
hubspot` → 0). Consequences:

- The skill currently resolves to `blocked_no_credentials`; `hubspot_health()`
  returns `ready_for_pilot: false`, `blocking_reasons:
  ["HUBSPOT_ACCESS_TOKEN is not set"]`. This is correct fail-closed behaviour.
- The skill's live path was verified through the fake transport (identical code
  path) and the equivalent live REST shapes were verified via the session MCP
  (§6.B) — but the skill has **not** itself authenticated end-to-end with a
  private app token, because none exists here. That last mile is the only thing
  standing between this and a green `ready_for_pilot`.

**To go green (operator, ~10 min):**

1. HubSpot → **Settings → Integrations → Private Apps → Create a private app**.
2. Grant scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`
   (covers note writeback), and leave `oauth` for the account-info health probe.
3. Copy the access token (`pat-…`).
4. Provide it to the skill's environment as `HUBSPOT_ACCESS_TOKEN` (via the
   Hermes/MCP env or the deployment secret store — **never commit it**).
5. Verify: `python3 hubspot_skill.py health` → expect `"connection": "ok"`,
   `"ready_for_pilot": true`, `account.portal_id: 343344751`.
6. Rehearse safely first: `HUBSPOT_DRY_RUN=1 python3 hubspot_skill.py sync
   --email you@example.com --note "rehearsal"` (plans, never writes), then drop
   `HUBSPOT_DRY_RUN` for the real run.

---

## 7. Operator runbook (quick reference)

```bash
cd hermes/skills/hubspot-skill

# Is the integration ready?
python3 hubspot_skill.py health

# What has it done lately?
HUBSPOT_AUDIT_LOG=/var/log/hermes/hubspot.audit.jsonl \
  python3 hubspot_skill.py status

# Live pilot action (token in env):
python3 hubspot_skill.py sync --email lead@example.com --note "Demo booked" \
        --firstname Pat --lastname Lee
```

Required env: `HUBSPOT_ACCESS_TOKEN`. Optional: `HUBSPOT_BASE_URL`,
`HUBSPOT_DRY_RUN`, `HUBSPOT_TIMEOUT`, `HUBSPOT_MAX_RETRIES`,
`HUBSPOT_RETRY_BASE_SECONDS`, `HUBSPOT_RETRY_CAP_SECONDS`, `HUBSPOT_AUDIT_LOG`,
`HUBSPOT_HEALTH_PROBE_DISABLE`. Full table in the skill README.

---

## 8. Security & shared-files check

- **No security regression.** No secrets are committed; tokens are read only
  from the environment, redacted everywhere, and never returned. The skill
  performs no network calls without a token and no writes in dry-run.
- **Shared files touched:** **none.** This lane is purely additive —
  `hermes/skills/hubspot-skill/**` (new) and `docs/handoffs/lane-c.md` (new).
  Nothing under the existing `vision-skill/` was modified, so there is no merge
  surface shared with other lanes.

---

## 9. Honest bottom line

The HubSpot path is **code-complete and offline-verified**, and its live REST
mechanics are **proven against the real portal** via session OAuth. The only
thing not yet exercised is the in-repo skill authenticating with **its own
private app token**, which does not exist in this environment. The skill fails
closed and reports exactly that, rather than pretending to be ready. Drop a
`HUBSPOT_ACCESS_TOKEN` in and `health` flips to `ready_for_pilot: true`.
