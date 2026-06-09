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

## 3. Store the credential (encrypted at rest)

- Do **not** put the raw token in the DB or env.
- Put it through the deployment's `SecretStore.put(credential_ref, credential)` (AES-256-GCM).
- Insert/confirm the `integration_connections` row: `external_system='hubspot'`, `status='active'`, `credential_ref=<ref>`.

## 4. Verify

- Run a read sync (worker) → accounts/contacts/deals appear; `sync_runs` row `completed`.
- Run Mira → approve a `crm.task.create` → execute → confirm **one** task in HubSpot tagged with the idempotency key. Re-execute → no second task.
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
- Log sample proving no raw token leakage.
