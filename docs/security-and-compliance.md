# Security & compliance

> These are invariants, not guidelines. Each has at least one test.

## 1. No raw PII in logs

- Structured JSON logs only. Allowed fields: `level`, `message`, `trace_id`,
  `tenant_id`, `agent_run_id`, `agent_action_id`, `entity_ref`, `event_name`,
  `duration_ms`.
- **Never logged:** raw emails, phone numbers, transcripts, OAuth tokens/secrets,
  API keys, or generated message body content.
- Log **references and hashes** instead: `entity_ref: "contact:uuid"`,
  `email_hash: sha256(...)`, `payload_ref: "..."`.
- Example:

```json
{
  "level": "info",
  "message": "action.proposed",
  "trace_id": "...",
  "tenant_id": "...",
  "agent_run_id": "...",
  "agent_action_id": "...",
  "entity_ref": "account:uuid",
  "event_name": "agent.action.proposed.v1",
  "duration_ms": 123
}
```

A log redaction helper in `packages/core` strips/【hashes】 disallowed fields; a
unit test asserts known PII keys never pass through.

## 2. Action audit trail

- Every external side effect is preceded by an `agent_action` record.
- Every status transition (`proposed → approved → executing → executed/failed`,
  or `rejected`) emits an immutable event and writes an `audit_event`.
- `audit_events` and `events` are append-only (insert/select; no update/delete
  under RLS).
- The trail answers: who/what proposed it, what evidence backed it, who
  approved it, when it executed, and the result.

## 3. Opt-out / suppression

- A per-tenant suppression list (emails/domains/contacts) is authoritative.
- `PolicyGate` checks suppression/consent **before** an action can be proposed
  for execution; suppressed targets are blocked at proposal time.
- `unsubscribe` replies add the contact to suppression and halt the sequence.
- **Test:** Mira cannot propose an executable email to a suppressed contact.

## 4. Tenant isolation

- Every table is `tenant_id`-scoped with RLS enabled and forced.
- Queries run under `app.current_tenant_id`; no cross-tenant reads.
- **Test:** Tenant A cannot read Tenant B records.
- See [data-model.md](./data-model.md) §4, §6.

### 4.1 No tenant-context leakage across pooled connections

Production runs against a pooled Postgres connection (Supabase/pgBouncer). The
risk with connection pooling is that one request's session state survives onto
the next request that checks out the same physical connection.

We make that impossible by construction:

- Every request runs inside a transaction (`withTenant`, `packages/db/src/client.ts`).
- The tenant GUC is set with `set_config(key, value, is_local := true)` — i.e.
  **`SET LOCAL`**, which Postgres scopes to the current transaction and resets
  automatically at `COMMIT`/`ROLLBACK`, _before_ the connection returns to the
  pool.
- We never issue a session-level `SET` or `set_config(..., false)`. The
  `bypassRls` path is also transaction-local and opt-in for trusted jobs only.
- `tenantContextPlan()` is a pure function describing exactly what gets applied,
  so the "every statement is local" invariant is unit-tested without a database.
- **Test:** `packages/db/src/client.test.ts` — asserts every context statement is
  `SET LOCAL`, and that interleaved concurrent tenant operations never observe
  each other (no shared mutable tenant context exists to leak; `tenant_id` is
  threaded per call).

### 4.2 Repository contract verification (PGlite)

`packages/db/src/repository.contract.ts` is a shared suite run against **both**
the in-memory repo and the production `KyselyRepository` over **PGlite** (real
Postgres, in-process WASM; `kysely.pglite.test.ts`). It runs the real migrations
and validates idempotent ingest (`external_object_maps`), account/contact/deal
linkage, JSONB round-trips, numeric parsing, `agent_action` idempotency, and
`sync_runs`, plus repository-layer tenant isolation (explicit predicates +
`withTenant` GUC).

**Caveat:** PGlite's default role is a superuser, which **bypasses RLS**. So the
RLS _engine_ (policies blocking cross-tenant access under a non-superuser role)
is **not** exercised here — that still requires a privileged-role harness or live
Supabase. The application-layer isolation is verified; the database-enforced
backstop is verified separately on real Postgres.

### 4.3 RLS engine verification under a non-superuser role

`packages/db/src/kysely.rls.pglite.test.ts` closes the §4.2 caveat. It runs the
real migrations on PGlite, then creates a **normal non-superuser role**
(`app_user`, with table/function grants but no RLS bypass) and `SET ROLE`s to it
so the policies are genuinely enforced. It proves:

- **Not in bypass mode (control):** a superuser sees both tenants' rows; the same
  unfiltered `SELECT` as `app_user` (scoped via `app.current_tenant_id`) sees only
  its own tenant.
- **Pure RLS** (raw SQL, no application predicate): tenant A reads only A's rows;
  cannot `SELECT` a B row by id; `UPDATE` of a B row affects 0 rows (B unchanged);
  `INSERT` for tenant B raises a `WITH CHECK` row-level-security violation.
- **Repository layer** under `app_user`: legitimate same-tenant reads succeed; an
  A-scoped `getAccount` cannot reach a B row.

Remaining gap → live Supabase: the same policies under Supabase's actual roles
(`authenticated`/`service_role`), pooled connections (pgBouncer), and `pgvector`
(migration `0006`) — to be confirmed with a Supabase MCP probe when authorized.

## 5. Idempotency

- Every integration write carries a deterministic `idempotency_key`.
- Adapters must treat a repeated key as a no-op returning the original result.
- Ingest dedupes via `external_object_maps` unique constraint.
- **Tests:** duplicate webhook does not duplicate contacts; duplicate action
  execution with the same idempotency key does not send twice.

## 6. Approval defaults

- Human approval is the default for: outbound send, calling, CRM mutation, ads
  launch.
- Side-effect tools are propose-only; they cannot bypass the `ActionLedger`.
- The email adapter refuses to send without an approved, ledgered action.
- **Tests:** side-effect tools cannot bypass the action ledger; email adapter
  refuses to send without an approved action.

## 7. Secrets handling

- Secrets come from environment/secret manager; never committed (`.env` is
  git-ignored; `.env.example` documents keys).
- OAuth tokens are stored encrypted at rest and referenced by id; never logged.
- **Per-tenant OAuth (HubSpot):** `integration_connections.credential_ref` holds
  only a _pointer_ — never a raw token. The token material lives in a `SecretStore`
  (`AesGcmSecretStore`, AES-256-GCM) so the at-rest representation is ciphertext.
  `ConnectionTokenProvider` resolves the connection, decrypts the credential,
  returns a valid access token, and transparently refreshes expired tokens
  (refresh-token grant), persisting the rotation. If a credential can't be
  refreshed (no refresh token), the connection must be re-authorized
  (`TokenExpiredError`). Tokens never appear in logs or error messages.
- **Tests:** `packages/integrations/src/hubspot/tokenProvider.test.ts` — token
  lookup, missing `credential_ref`/secret, refresh + rotation, documented
  no-refresh fallback, ciphertext-at-rest, and no token in logs/errors.
- Webhook endpoints verify provider signatures before trusting payloads. The
  HubSpot webhook (`POST /webhooks/hubspot`) verifies the v3 signature
  (`verifyHubspotSignatureV3`) over method+URI+raw body+timestamp using
  route-scoped raw-body capture, with a timing-safe compare and a 5-minute replay
  window. It **fails closed**: missing/invalid signature, expired timestamp, or an
  unconfigured secret all reject before any ingest. Rejections log a reason code
  - `trace_id` only (no body/headers/signature).

## 8. Data minimization & grounding

- Generated messages must be grounded in an evidence pack (no ungrounded
  personalization claims).
- Payloads stored in `events` reference entities and hashes, not raw PII.

## 9. Test matrix (minimum critical)

1. Tenant A cannot read Tenant B records.
2. Mira cannot propose email to a suppressed contact.
3. Email adapter refuses to send without an approved action.
4. Duplicate webhook does not duplicate contacts.
5. Duplicate action execution idempotency key does not send twice.
6. Context pack includes evidence refs for personalization claims.
7. Reply classifier handles `unsubscribe` and `wrong_person`.
