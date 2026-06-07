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
