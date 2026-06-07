# Integration contracts

> Adapters in `packages/integrations` are the only code that talks to external
> systems. They are typed, idempotent, and never decide policy.

## 1. Adapter principles

1. **Typed I/O:** every adapter method has Zod-validated input and output.
2. **Idempotent writes:** every write takes an `idempotency_key`; a repeated key
   returns the original result without re-performing the side effect.
3. **No policy decisions:** adapters do not check approval or suppression — that
   is `PolicyGate`/`ActionLedger`. An adapter refuses to act only when handed an
   action that is not approved (defense in depth).
4. **Signature verification:** inbound webhooks verify provider signatures.
5. **No raw PII in logs:** adapters log refs/hashes (see security doc).
6. **Mapping via `external_object_maps`:** all create/upsert paths resolve or
   record external↔internal mappings to stay idempotent.

## 2. Common adapter shape

```ts
interface IntegrationAdapter {
  readonly system: string; // "hubspot" | "salesforce" | "email" | ...
  // Reads are free; writes require an approved, ledgered action.
  execute(action: ApprovedAgentAction): Promise<AdapterResult>;
}
```

`execute()` asserts `action.approval_status === 'approved'` and applies
`action.idempotency_key`. Calling it with an unapproved action throws.

## 3. Per-integration scope (MVP)

| Integration  | MVP reads                                 | MVP writes (approved only)             | Notes                          |
| ------------ | ----------------------------------------- | -------------------------------------- | ------------------------------ |
| `hubspot`    | companies, contacts, deals (sync+webhook) | create task, create note               | Mira's CRM-task mode.          |
| `salesforce` | accounts, contacts, opportunities (stub)  | create task (stub)                     | Parity target; stubbed in MVP. |
| `email`      | delivery/open/reply/bounce webhooks       | send (refuses without approved action) | Core outbound path.            |
| `calendar`   | meeting booked webhook                    | (none in MVP)                          | Echo later.                    |
| `slack`      | —                                         | notify approval queue (low risk)       | Operator notifications.        |
| `voice`      | —                                         | (none in MVP)                          | Echo later.                    |
| `ads`        | —                                         | (none in MVP)                          | Beacon later.                  |

## 3a. HubSpot sync (companies, contacts, deals)

`HubspotSyncService` (`packages/integrations/src/hubspot/sync.ts`) is the
repo-native sync. It reads through the `HubspotClient` seam and writes through the
real `Repository` — no ad-hoc data access.

Flow (tenant-scoped throughout):

1. `createSyncRun(running)`.
2. Page **companies** → `ingestExternalAccount` → emit `crm.account.created|updated.v1`.
3. Page **contacts** → resolve account via `findInternalIdByExternal(..., 'company', companyExternalId)`
   → `ingestExternalContact` → emit `crm.contact.created|updated.v1`.
4. Page **deals** → resolve account → `ingestExternalOpportunity` → emit
   `crm.opportunity.updated.v1`. Deals with no resolvable company are skipped
   (`opportunities.account_id` is `NOT NULL`).
5. `updateSyncRun(completed, stats)` (or `failed` on error).

Idempotency: every ingest resolves via `external_object_maps`
(`unique (tenant_id, external_system, external_type, external_id)`, migration
`0002`), so a repeated sync updates existing rows instead of creating duplicates.
PII: only `email_hash` and refs cross into rows/events — never raw emails.

## 4. Idempotency key derivation

Keys are deterministic so retries collapse:

```
idempotency_key = sha256(tenant_id + action_type + target_ref + content_fingerprint)
```

- `content_fingerprint` is a stable hash of the semantically meaningful payload
  (e.g. normalized email subject+body draft, or task title+due).
- The key is stored on `agent_actions`; the adapter and the external system both
  honor it.

## 5. Webhook ingestion contract

1. Verify signature; reject on mismatch.
2. Validate payload with a Zod schema.
3. Resolve/record `external_object_maps` to dedupe.
4. Upsert canonical entity (idempotent).
5. Write an immutable `event`.
6. Enqueue follow-up work for the worker.

Duplicate webhooks resolve to the same internal row (unique constraint) and do
not duplicate contacts (tested).

## 6. Error handling

- Transient errors: bounded retry with backoff; the idempotency key makes
  retries safe.
- Permanent errors: mark `execution_status = failed`, emit
  `agent.action.failed.v1`, write an `audit_event`, surface in the queue.
- Never partially apply a multi-step write without a compensating record.
