# Operator Handoff — first live CRM-writeback test

> The shortest path for a human to take Cognitia V1 live for ONE tenant and verify the
> first real `approve → HubSpot task` round-trip. CRM write-back only — no email.
> Companion detail: `docs/runbooks/hubspot-onboarding.md`, `docs/runbooks/deploy-verification.md`.

## Prereqs you must provide (live secrets — outside the repo)

| Item                                     | How to obtain                                                                                   | Goes into                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| HubSpot **private-app token** (or OAuth) | HubSpot → Settings → Integrations → Private Apps; scopes below                                  | SecretStore (encrypted)            |
| HubSpot **idempotency property**         | create custom property `cognitia_idempotency_key` (single-line text) on **Tasks** AND **Notes** | HubSpot portal                     |
| **AES data key** (32-byte, base64)       | generate in KMS: `openssl rand -base64 32` (store in KMS, not a file)                           | `CREDENTIAL_SECRET_KEY_BASE64` env |
| `SESSION_SECRET`                         | random ≥32 chars from secret manager                                                            | env                                |
| `HUBSPOT_WEBHOOK_SECRET`                 | HubSpot app's client secret                                                                     | env                                |
| `DATABASE_URL`                           | managed Postgres, connecting as **`app_user`** (non-superuser)                                  | env                                |

**Least-priv HubSpot scopes (V1):** `crm.objects.companies.read`, `crm.objects.contacts.read`,
`crm.objects.deals.read`, `crm.objects.contacts.write`, plus tasks/notes (engagement) **write**.
❌ No marketing-email, account-settings, or admin scopes.

## 10-step go-live (one tenant)

1. **Provision DB**: apply migrations `0001–0008`; create role `app_user` (non-superuser) with table grants; enable backups + PITR.
2. **Set env**: `DATABASE_URL`, `SESSION_SECRET`, `HUBSPOT_WEBHOOK_SECRET`, `CREDENTIAL_SECRET_KEY_BASE64`.
3. **Deploy** API + worker; run `docs/runbooks/deploy-verification.md` (all 9 checks). Confirm NO `crm.hubspot.client_unconfigured` log (else the AES key is missing).
4. **Create the HubSpot idempotency property** on Tasks and Notes.
5. **Seed the tenant**: insert `tenants` row; create an `integration_connections` row (`external_system='hubspot'`, `status='active'`, a `credential_ref`).
6. **Store the credential**: encrypt the HubSpot token via `SecretStore.put(credential_ref, { accessToken, refreshToken?, expiresAt, clientId?, clientSecret? })`.
7. **Issue an operator session** (for the console/API): a signed session token for `{ tenantId, userRef, role: 'operator' }` (HMAC with `SESSION_SECRET`).
8. **Sync**: trigger a CRM read sync; confirm accounts/contacts/deals appear; `sync_runs` row `completed`.
9. **First live action**: run Mira → in the queue, **approve** a `crm.task.create` (a **structured reason is required** — pick a reason code, add a note if helpful; the API refuses approve/reject without one) → **execute**. Confirm **exactly one** task in HubSpot, tagged with the idempotency key. The decision is recorded as a feedback label — verify via `GET /agent-actions/:id/decisions`.
10. **Verify idempotency**: execute the same action again → **no second task** created.

## Verify checklist (must all be true)

- [ ] `/health` → 200 `{db:up}`; logs show the **real** HubSpot client (no `client_unconfigured`).
- [ ] Mira proposed only `crm.*` actions (no `email.draft.send`).
- [ ] Execute was refused (409) before approval; succeeded after.
- [ ] Exactly one HubSpot task created; re-execute created none.
- [ ] No raw token/PII in logs.

## Rollback (if the live test misbehaves)

1. **Pause** the tenant: `update integration_connections set status='paused'` → halts all execution (no redeploy).
2. If a duplicate/incorrect object was created, delete it in HubSpot; confirm the idempotency property exists (its absence is the usual cause).
3. If a secret may be exposed: rotate per `secret-rotation.md` and treat as SEV-1 (`incident-response.md`).
4. Re-enable (`status='active'`) only after the root cause is fixed.

## Capture for SOC 2

Deploy id + commit; the verify checklist results; screenshot of HubSpot scopes (least-priv);
confirmation the idempotency property exists; a log sample showing no token leakage.

## Tooling (added after rollout verification)

Steps 5–7 are now scripted (secrets via env only, never argv/logged):

- Seed tenant + encrypted credential: `DATABASE_URL=… CREDENTIAL_SECRET_KEY_BASE64=… HUBSPOT_PRIVATE_APP_TOKEN=… node apps/api/scripts/seed-hubspot-credential.mjs --tenant <uuid>`
- Issue operator session: `SESSION_SECRET=… node apps/api/scripts/issue-session.mjs --tenant <uuid> --role operator`
  Credentials persist in `credential_ciphertexts` (migration 0008; ciphertext only — see security model in the migration header).
  Use `docs/launch/alpha-rollout-record.md` as the live execution log + evidence artifact.
