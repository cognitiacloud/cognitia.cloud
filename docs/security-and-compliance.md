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
- Webhook endpoints verify provider signatures before trusting payloads.

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
