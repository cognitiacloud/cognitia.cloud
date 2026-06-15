# Lane C — HubSpot Live Path & Integration Health

**Owner scope:** HubSpot live path and integration health.
**Status:** seam-complete and fully unit-tested; **live round-trip blocked on
operator-provided credentials** (none present in this environment).
**Skill:** `hermes/skills/hubspot-skill/` (`hubspot_skill.py`).

---

## 1. What this delivers

| Mission requirement                           | Where it lives                                                       |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Audit current HubSpot client / auth           | No prior code existed; built from scratch (see §2)                   |
| Complete missing production code              | `hubspot_skill.py` — auth, HTTP, retries, ops                        |
| Contact lookup / association                  | `contact_lookup`, `contact_associate`                                |
| Activity write-back                           | `activity_writeback` (note **and** task)                             |
| Integration health/status contract for UI     | `health_check` → `IntegrationHealth`                                 |
| Sync failure states, retries, operator status | `SyncResult`, error categories, backoff, audit log                   |
| Document credential/env/operator requirements | §4, §5 below                                                         |
| Fail closed                                   | seam mode; `state:"blocked"`; no fabricated success                  |
| Preserve auditability                         | `HUBSPOT_AUDIT_LOG` JSONL + redacted INFO logs                       |
| Keep secrets out of logs                      | redacting log filter; masked auth describe                           |
| Make real-vs-seam boundary explicit           | single `_http_call()` seam; `mode` field; opt-in labelled simulation |
| Clean interface for UI                        | stable `IntegrationHealth` / `SyncResult` `.to_dict()`               |

---

## 2. Audit of the starting point

At the start of this lane the repo contained **no HubSpot code at all** — only
`hermes/skills/vision-skill/`. So "take the existing path further" meant
**building the path** as a new sibling skill, matching the established Hermes
skill conventions (env-var config, redacting stderr logger, `urllib` HTTP,
`unittest`, dual CLI + MCP-stdio entrypoint). Nothing in `vision-skill/` was
modified; redaction/logger patterns were **copied, not imported**, so each
skill stays independently droppable (per the vision-skill README).

---

## 3. Architecture & the real-vs-seam boundary

```
caller (CLI / MCP tool)
        │
        ▼
operation  (health_check | contact_lookup | contact_associate | activity_writeback)
        │   ── fail-closed gate: select_auth() is None? ──► state:"blocked"  (seam, no network)
        ▼
   _request()         retries + backoff + error categorization
        │
        ▼
   _http_call()  ◄────── THE ONLY NETWORK SEAM (tests patch this) ──────►  api.hubapi.com
```

- **Live mode** (`mode:"live"`): credentials present; real HubSpot REST calls.
- **Seam mode** (`mode:"seam"`): no credentials. Operations return
  `state:"blocked"` and make **no** network calls. This is the fail-closed
  default.
- **Simulation** (`HUBSPOT_ALLOW_SIMULATION=1`, off by default): for UI
  development only. Returns deterministic responses stamped
  `"simulated": true, "source": "seam"` so a UI can build against the contract
  without ever mistaking them for live data.

### Status / result contracts (UI-facing)

- `IntegrationHealth` — `status` (`ok|degraded|down|unconfigured`), `mode`,
  `auth` (masked), `checks[]` (per-probe ok/latency), `portal` (account
  context when live), `last_error`, `checked_at`.
- `SyncResult` — `operation`, `state` (`success|failed|blocked|skipped|
simulated`), `mode`, `attempts`, `target_id`, `request_id`, `http_status`,
  `error`, `error_category`, `simulated`, `details`, timing fields.

### Failure states & retries

| Category     | Statuses             | Retried?                   |
| ------------ | -------------------- | -------------------------- |
| `auth`       | 401, 403             | no                         |
| `rate_limit` | 429                  | yes (honors `Retry-After`) |
| `validation` | 400, 409, 422        | no                         |
| `server`     | 500/502/503/504      | yes                        |
| `network`    | timeout / connection | yes                        |
| `config`     | no credentials       | n/a → `blocked`            |

Backoff is exponential (`2,4,8…s`), capped by `HUBSPOT_MAX_RETRIES` (default 3).

---

## 4. Credential / env / operator requirements

| Env var                                                                 | Required             | Purpose                                                                |
| ----------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `HUBSPOT_ACCESS_TOKEN`                                                  | for private-app mode | Private App access token (`pat-…`)                                     |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` / `HUBSPOT_REFRESH_TOKEN` | for OAuth mode       | OAuth refresh-token credentials                                        |
| `HUBSPOT_AUTH_MODE`                                                     | optional             | Force `private_app` or `oauth` (else auto-detect)                      |
| `HUBSPOT_BASE_URL`                                                      | optional             | Defaults to `https://api.hubapi.com` (same for all regions, incl. NA3) |
| `HUBSPOT_MAX_RETRIES`                                                   | optional             | Default `3`                                                            |
| `HUBSPOT_TIMEOUT`                                                       | optional             | Per-request seconds, default `30`                                      |
| `HUBSPOT_AUDIT_LOG`                                                     | optional             | Path for redacted JSONL audit trail                                    |
| `HUBSPOT_ALLOW_SIMULATION`                                              | optional             | `1` to enable labelled seam simulation (UI dev)                        |

### Operator runbook — Private App (pilot path)

1. In HubSpot: **Settings → Integrations → Private Apps → Create a private app.**
2. Grant scopes (confirm exact names in the scope picker):
   - `crm.objects.contacts.read`, `crm.objects.contacts.write`
   - `crm.objects.companies.read` (for contact→company association)
   - Notes & Tasks write (engagement object scopes shown in the picker).
     The connected portal already reports CONTACT / NOTE / TASK **read+write**
     available (see §6), so these scopes are grantable on this account.
3. Copy the access token; provision it to the runtime as `HUBSPOT_ACCESS_TOKEN`
   (secret manager / env — **never** commit it).
4. Verify:
   ```bash
   python3 hermes/skills/hubspot-skill/hubspot_skill.py health   # expect status:"ok", mode:"live"
   ```
5. Live acceptance round-trip:
   ```bash
   python3 …/hubspot_skill.py lookup    --email someone@known-contact.com
   python3 …/hubspot_skill.py writeback --contact-id <id> --type note --body "Cognitia pilot test"
   python3 …/hubspot_skill.py writeback --contact-id <id> --type task --subject "Cognitia follow-up"
   ```

### Operator runbook — OAuth (alternative)

Set `HUBSPOT_AUTH_MODE=oauth` plus the three OAuth vars. The skill mints and
caches access tokens via `POST /oauth/v1/token`; the operator only provisions
the refresh-token credentials.

---

## 5. Security properties (verified)

- **No secrets in logs:** with a canary token in the env, the token appears
  **0 times** in stderr and **0 times** in the audit log; the redacting filter
  and known-secret registry scrub it. Verified manually + by unit test
  (`RedactionTests`, `AuditTests`).
- **Fail closed:** without credentials, `lookup`/`associate`/`writeback`
  return `state:"blocked"` with `target_id: null` — no network, no fabricated
  object (`ContactLookupTests`, `WritebackTests`, `AssociateTests`).
- **No write without credentials:** writes are unreachable in seam mode.
- **No deletes:** the skill exposes no delete operation.

---

## 6. Verified vs. Blocked by live credentials

### ✅ Verified in this environment

- **The integration target is real.** A read-only probe of the connected
  HubSpot platform MCP confirms a live portal: account **`343344751`**, owner
  `cognitiacloud@gmail.com`, type **STANDARD**, currency USD, region
  **`app-na3.hubspot.com`**.
- **The object model this skill writes to is real and writable** on that
  portal: **CONTACT**, **NOTE**, **TASK** all report `read+write AVAILABLE`;
  **COMPANY** read available. So contact lookup/association and note/task
  write-back are genuinely supported by the target account.
- **Outbound connectivity works.** A request with a deliberately invalid token
  reached `api.hubapi.com` and was correctly rejected `403` → categorized
  `auth`, not retried, token not leaked. The live code path executes for real;
  only a _valid_ credential is missing.
- **All 30 unit tests pass offline**, exercising auth selection (both modes),
  OAuth refresh+cache, redaction, retries (429+`Retry-After`, 5xx exhaustion,
  network), fail-closed seam behavior, labelled simulation, the health/status
  contracts, and audit-log redaction.

### ⛔ Blocked by live credentials

- **No `HUBSPOT_ACCESS_TOKEN` / OAuth credentials are provisioned** in this
  repo environment (`env | grep -i hubspot` → none). The skill's **own**
  credential path therefore cannot be exercised end-to-end against the live
  portal here.
- Consequently, a real `health` → `ok` and a live `lookup`/`writeback`
  round-trip are **operator-gated** (runbook §4 step 5). They are covered by
  mocked unit tests, **not** by a live call in this environment. No live
  success has been fabricated.

> **Important boundary:** the read-only probe used the _platform's_ OAuth-backed
> HubSpot MCP connection, which is a **different** auth path from the skill's
> `HUBSPOT_ACCESS_TOKEN`. The probe proves the portal and object model are real;
> it does **not** validate the skill's token path. That validation is the first
> operator step once a Private App token exists.

---

## 7. Shared files touched

**None.** All work is additive:

- `hermes/skills/hubspot-skill/` (new, self-contained skill)
- `docs/handoffs/lane-c.md` (this file; new `docs/handoffs/` tree)

`hermes/skills/vision-skill/` is untouched. There is no root-level shared
config in the repo, so no shared file was modified and no other lane's surface
area is affected.

---

## 8. Run it

```bash
# Tests (offline, no credentials)
python3 hermes/skills/hubspot-skill/test_hubspot_skill.py

# Honest seam-mode status here (no creds)
python3 hermes/skills/hubspot-skill/hubspot_skill.py health   # -> status:"unconfigured", mode:"seam"

# UI-contract shape without live creds (clearly labelled)
HUBSPOT_ALLOW_SIMULATION=1 python3 hermes/skills/hubspot-skill/hubspot_skill.py lookup --email a@b.com
```
