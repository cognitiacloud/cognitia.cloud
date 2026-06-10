# Operator Handoff — first live CRM-writeback test

> The shortest path for a human to take Cognitia V1 live for ONE tenant and verify the
> first real `approve → HubSpot task` round-trip. CRM write-back only — no email.
> Companion detail: `docs/runbooks/hubspot-onboarding.md`, `docs/runbooks/deploy-verification.md`.

## Prereqs you must provide (live secrets — outside the repo)

| Item                                     | How to obtain                                                                                                                                             | Goes into                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| HubSpot **private-app token** (or OAuth) | HubSpot → Settings → Integrations → Private Apps; scopes below                                                                                            | SecretStore (encrypted)            |
| HubSpot **idempotency property**         | create custom property `cognitia_idempotency_key` (single-line text) on **Tasks** AND **Notes**                                                           | HubSpot portal                     |
| HubSpot **provenance properties** (×6)   | create the six `cognitia_*` properties from `hubspot-onboarding.md` §2a on **Tasks** AND **Notes** (a write to a missing property is REJECTED by HubSpot) | HubSpot portal                     |
| **AES data key** (32-byte, base64)       | generate in KMS: `openssl rand -base64 32` (store in KMS, not a file)                                                                                     | `CREDENTIAL_SECRET_KEY_BASE64` env |
| `SESSION_SECRET`                         | random ≥32 chars from secret manager                                                                                                                      | env                                |
| `HUBSPOT_WEBHOOK_SECRET`                 | HubSpot app's client secret                                                                                                                               | env                                |
| `DATABASE_URL`                           | managed Postgres, connecting as **`app_user`** (non-superuser)                                                                                            | env                                |

**Least-priv HubSpot scopes (V1):** `crm.objects.companies.read`, `crm.objects.contacts.read`,
`crm.objects.deals.read`, `crm.objects.contacts.write`, plus tasks/notes (engagement) **write**.
❌ No marketing-email, account-settings, or admin scopes.

## 12-step go-live (one tenant)

1. **Provision DB**: apply migrations `0001–0008`; create role `app_user` (non-superuser) with table grants; enable backups + PITR.
2. **Set env**: `DATABASE_URL`, `SESSION_SECRET`, `HUBSPOT_WEBHOOK_SECRET`, `CREDENTIAL_SECRET_KEY_BASE64`.
3. **Deploy** API + worker; run the automated smoke:
   `BASE_URL=… OPERATOR_TOKEN=… VIEWER_TOKEN=… node apps/api/scripts/smoke-deploy.mjs`
   (health/auth-fail-closed/email-fence/governance/kill-switch/RBAC — exits non-zero on failure),
   then finish the manual checks in `docs/runbooks/deploy-verification.md`.
   Confirm NO `crm.hubspot.client_unconfigured` log (else the AES key is missing).
4. **Create the HubSpot custom properties** on Tasks AND Notes: `cognitia_idempotency_key`
   **plus the six provenance properties** (`hubspot-onboarding.md` §2/§2a). Do not skip the
   provenance set — HubSpot rejects writes to non-existent properties.
5. **Seed the tenant**: insert `tenants` row; create an `integration_connections` row (`external_system='hubspot'`, `status='active'`, a `credential_ref`).
6. **Store the credential**: encrypt the HubSpot token via `SecretStore.put(credential_ref, { accessToken, refreshToken?, expiresAt, clientId?, clientSecret? })`.
7. **Issue an operator session** (for the console/API): a signed session token for `{ tenantId, userRef, role: 'operator' }` (HMAC with `SESSION_SECRET`).
8. **Readiness gate (must be READY before anything writes):** `GET /integrations/readiness`
   (or console "Check readiness"). It verifies the connection is `active` and every required
   `cognitia_*` property exists on Tasks and Notes, and **names exactly what is missing**.
   Fix and re-run until `READY`. This catches the #1 go-live failure (write rejected on a
   missing property) before any write can happen.
9. **Sync**: trigger a CRM read sync; confirm accounts/contacts/deals appear; `sync_runs` row `completed`.
10. **Preflight (zero writes):** `POST /agent-runs/mira/preflight` (or console "Preflight (no
    writes)"). Review the would-be proposals and their exact write plans — the real runtime
    over an ephemeral copy, `writes_performed: 0` guaranteed. Confirm targets and suppressed
    exclusions look right before any live run.
11. **First live action**: run Mira → in the queue, open **"Preview write"** (the byte-exact
    property map that will land in HubSpot) → **approve** the `crm.task.create` (a **structured
    reason is required**; the API refuses without one) → **execute**. Confirm **exactly one**
    task in HubSpot, tagged with the idempotency key and carrying the `cognitia_*` provenance
    properties. The decision is recorded as a feedback label — verify via
    `GET /agent-actions/:id/decisions`.
12. **Verify idempotency + undo**: execute the same action again → **no second task**. Then
    exercise **"Undo write"** (mandatory reason) → the task is archived in HubSpot (recycle
    bin, reversible) and the rollback appears in the audit trail. Re-create it by approving a
    fresh proposal if the task should stand.

## Verify checklist (must all be true)

- [ ] Smoke script exits 0; `/health` → 200 `{db:up}`; logs show the **real** HubSpot client (no `client_unconfigured`).
- [ ] `GET /integrations/readiness` → `READY` (all required properties present on Tasks AND Notes).
- [ ] Preflight reported the expected proposals with `writes_performed: 0`.
- [ ] Mira proposed only `crm.*` actions (no `email.draft.send`); `/governance` shows email not executable.
- [ ] Execute was refused (409) before approval — and the refusal appears in `GET /audit` as `execution_denied`.
- [ ] Exactly one HubSpot task created; re-execute created none.
- [ ] That task shows the `cognitia_*` provenance properties (agent/run/action/evidence/risk/approved_by); re-execute left them unchanged.
- [ ] "Undo write" archived the task and left `rolled_back` label + audit entries.
- [ ] No raw token/PII in logs.

## Rollback (if the live test misbehaves)

1. **Pause** the tenant (kill switch — enforced in product): console "Pause integration" or
   `POST /integrations/hubspot/pause` (any operator). All execution AND rollback halt with
   audited denials; resume is **owner-only** (`POST /integrations/hubspot/resume`). Break-glass
   fallback: `update integration_connections set status='paused'`.
2. If an incorrect object was created, prefer **"Undo write"** (audited, reversible archive)
   over manual deletion; confirm via the audit trail.
3. If a secret may be exposed: rotate per `secret-rotation.md` and treat as SEV-1 (`incident-response.md`).
4. Resume (owner) only after the root cause is fixed.

## Capture for SOC 2

Deploy id + commit; smoke-script output; the verify checklist results; **one exported trust
packet** (console "Export trust packet" — live metrics, decision history, full audit trail,
control attestations with CI evidence pointers, and the eval gate re-run at export); screenshot
of HubSpot scopes (least-priv); the readiness `READY` response; a log sample showing no token
leakage.

## Tooling

Steps 5–7 are scripted (secrets via env only, never argv/logged):

- Seed tenant + encrypted credential: `DATABASE_URL=… CREDENTIAL_SECRET_KEY_BASE64=… HUBSPOT_PRIVATE_APP_TOKEN=… node apps/api/scripts/seed-hubspot-credential.mjs --tenant <uuid>`
- Issue operator session: `SESSION_SECRET=… node apps/api/scripts/issue-session.mjs --tenant <uuid> --role operator`
- Post-deploy smoke: `BASE_URL=… node apps/api/scripts/smoke-deploy.mjs` (tokens optional; unauthed checks always run)
  Credentials persist in `credential_ciphertexts` (migration 0008; ciphertext only — see security model in the migration header).
  Use `docs/launch/alpha-rollout-record.md` as the live execution log + evidence artifact.
