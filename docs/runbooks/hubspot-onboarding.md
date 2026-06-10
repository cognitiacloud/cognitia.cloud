# Runbook — HubSpot onboarding (per tenant)

> Operator/admin steps to connect a tenant's HubSpot for V1 (CRM write-back only).
> Supports Go-Live Gate 1. **No email/marketing setup in V1.**

## Prerequisites

- Tenant exists in Cognitia (`tenants` row) with an authenticated owner.
- Deployment secret manager holds the AES data key (for `AesGcmSecretStore`).

## 1. Create the HubSpot app credential

Choose ONE:

- **Private app token** (simplest for a single portal), or
- **OAuth app** (recommended for multi-tenant; supports refresh-token rotation — already implemented in `ConnectionTokenProvider`).

**Least-privilege scopes (write only what V1 needs):**

- `crm.objects.contacts.read`, `crm.objects.companies.read`, `crm.objects.deals.read` (sync).
- `crm.objects.contacts.write` (notes), engagement/task write scope for **tasks & notes**.
- ❌ Do NOT grant marketing-email, account-settings, or owner-admin scopes.

## 2. Prepare the idempotency property (REQUIRED — blocks idempotency)

In the HubSpot portal, create a custom property on **Tasks** and **Notes**:

- Internal name: `cognitia_idempotency_key` · type: single-line text.
- Without it, `HttpHubspotClient`'s search-based dedupe silently no-ops → **duplicate objects**. Verify it exists before go-live.

## 2a. Prepare the provenance properties (REQUIRED — blocks writes)

PROV-1 stamps execution lineage onto every CRM object Cognitia creates, so the
write is auditable inside the customer's own HubSpot. Create these custom
properties on **Tasks** and **Notes** (a write to a non-existent property is
rejected by HubSpot, so these are required before go-live):

| Internal name              | Type             | Meaning                               |
| -------------------------- | ---------------- | ------------------------------------- |
| `cognitia_agent`           | single-line text | Producing agent (e.g. `mira`).        |
| `cognitia_agent_run_id`    | single-line text | The agent run that produced it.       |
| `cognitia_agent_action_id` | single-line text | The ledgered action (audit anchor).   |
| `cognitia_evidence_count`  | number           | Evidence items backing the action.    |
| `cognitia_risk_level`      | single-line text | Risk tier at proposal time.           |
| `cognitia_approved_by`     | single-line text | Approver principal/role (no raw PII). |

## 2b. Write content (GOV-1 — no portal setup needed)

Since GOV-1, every write also carries typed human-readable content using
**standard** HubSpot properties (no custom setup): `hs_task_subject`,
`hs_task_body`, `hs_task_status`, `hs_note_body`, and `hs_timestamp` (pinned
to proposal time, so re-executions are byte-identical). The exact property
map for any action is visible pre-approval at
`GET /agent-actions/:id/preview` and in the console's "Preview write" panel —
what the operator previews is what is sent, byte for byte (CI-enforced
invariant in `writePlan.test.ts`).

Source of truth for the internal names: `PROVENANCE_PROPERTIES` in
`packages/integrations/src/hubspot/httpClient.ts`. Values are refs/roles only —
never raw PII. Provenance is not part of idempotency.

## 3. Store the credential (encrypted at rest)

- Do **not** put the raw token in the DB or env.
- Put it through the deployment's `SecretStore.put(credential_ref, credential)` (AES-256-GCM).
- Insert/confirm the `integration_connections` row: `external_system='hubspot'`, `status='active'`, `credential_ref=<ref>`.

## 4. Verify

- Run a read sync (worker) → accounts/contacts/deals appear; `sync_runs` row `completed`.
- Run Mira → approve a `crm.task.create` → execute → confirm **one** task in HubSpot tagged with the idempotency key. Re-execute → no second task.
- On that task, confirm the `cognitia_*` provenance properties are populated (agent / run / action / evidence count / risk / approved_by). Re-execute → values unchanged (no re-stamp).
- Confirm tokens never appear in logs (grep the structured logs for the token — must be absent).

## 5. Operational controls

- **Kill switch:** set `integration_connections.status='paused'` to halt all execution for that tenant (no redeploy).
- **Revocation:** on HubSpot 401, the connection flips to `error`; rotate/re-authorize, then set back to `active`.
- **Rate limits:** `HttpHubspotClient` backs off on 429 (honors Retry-After).

## Rollback

- Pause the connection (kill switch). No data is mutated in HubSpot by reads; only approved write-backs create objects, all idempotent.

## Evidence to capture (SOC 2)

- Screenshot of scopes granted (least-privilege).
- Confirmation the idempotency property exists.
- Confirmation the `cognitia_*` provenance properties exist on Tasks and Notes.
- Log sample proving no raw token leakage.
