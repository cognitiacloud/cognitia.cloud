# Codex handoff pack

Everything an implementing agent needs to extend this repo without breaking core
contracts. Read [architecture.md](./architecture.md), [data-model.md](./data-model.md),
[event-taxonomy.md](./event-taxonomy.md), and [agent-contracts.md](./agent-contracts.md)
first. **Do not silently change contracts** — propose, update docs + tests, then code.

## 0. Architectural invariants (non-negotiable)

1. Postgres/Supabase is the source of truth; events + `agent_actions` are the audit trail.
2. Tenants are isolated by RLS; tenant context is **transaction-scoped** (`SET LOCAL`,
   `withTenant` in `packages/db/src/client.ts`) — never session-level, so it cannot
   leak across pooled connections (`packages/db/src/client.test.ts`).
3. Every external side effect has an `agent_action` (risk + approval + idempotency).
4. Side-effect tools are propose-only; the `ActionLedger` is the only path to execution.
5. RAG is for qualitative context only; CRM facts come from SQL.
6. Human approval is default for send/call/CRM-mutation/ads.
7. No raw PII in logs/events — refs and hashes only.
8. DB library is **Kysely**; keep it.

## 1. Repo tree

```
apps/
  api/   src/{handlers.ts, server.ts, handlers.test.ts}     # HTTP surface (Fastify)
  web/   src/lib/{apiClient.ts, approvalQueue.ts}           # approval-queue client + view-model
  worker/ src/index.ts                                      # background job shell
packages/
  core/        src/{schemas,events,policies,types,logging}  # Zod schemas, event registry, policies
  db/          migrations/0001-0007, src/{schema,client,repository,memory}, fixtures/
  agents/      src/{runtime,context,tools,policies,ledger,guardrails,feedback,mira}
  integrations/ src/{types,provider,registry,email,hubspot}
  evals/       src/index.ts, {datasets,rubrics,scripts}/
  workflows/   src/index.ts, n8n/*.json
docs/          architecture, data-model, event-taxonomy, agent-contracts,
               integration-contracts, n8n-workflows, security-and-compliance, evals,
               CODEX_HANDOFF, AltaSpec_v2.yaml
```

(Generate the exact current tree with: `git ls-files | grep -v '^hermes/'`.)

## 2. Stub / scaffold / complete matrix

Legend: **Complete** = implemented + tested · **Scaffold** = real shape, body deferred
· **Stub** = signature/seam only (Codex fills).

| Area         | Item                                                                                      | State                                                                             |
| ------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| core         | schemas, event registry, policies, logging                                                | **Complete**                                                                      |
| db           | migrations 0001–0007 (RLS/indexes/fixtures)                                               | **Complete**                                                                      |
| db           | `Repository` + `InMemoryRepository`                                                       | **Complete**                                                                      |
| db           | `KyselyRepository` (production) + `createPostgresRepository`                              | **Complete** (PGlite contract-tested; RLS-role + Supabase checks pending)         |
| db           | Kysely `client` (`createDbClient`, `withTenant`, `tenantContextPlan`)                     | **Complete** (needs `pg` at runtime)                                              |
| db           | `apply-migrations.mjs`                                                                    | **Scaffold** (works with `pg`; Supabase CLI preferred)                            |
| agents       | AgentRunService, ContextBuilder, ToolRegistry, PolicyGate, ActionLedger, FeedbackRecorder | **Complete**                                                                      |
| agents       | Mira scoring v0, template generator, guardrails, reply classifier, orchestrator           | **Complete**                                                                      |
| agents       | `ContextBuilder` vector retrieval (`VectorRetriever`)                                     | **Stub** (`nullRetriever`)                                                        |
| agents       | `TemplateMessageGenerator` (LLM swap-in)                                                  | **Scaffold** (deterministic; `MessageGenerator` is the seam)                      |
| integrations | `IntegrationAdapter`/`ProviderAdapter`/`AdapterRegistry`                                  | **Complete**                                                                      |
| integrations | `StubEmailAdapter` (refuses unapproved, idempotent)                                       | **Complete** (no real provider)                                                   |
| integrations | `StubHubspotAdapter` → `HubspotClient` seam                                               | **Complete**                                                                      |
| integrations | `HttpHubspotClient` (OAuth, cursor paging, rate-limit, idempotent writes)                 | **Complete**                                                                      |
| integrations | `verifyHubspotSignatureV3` (webhook auth)                                                 | **Complete**                                                                      |
| integrations | `ConnectionTokenProvider` + `AesGcmSecretStore` (per-tenant OAuth, encrypted at rest)     | **Complete** (wired into `buildCrmSyncRuntime`)                                   |
| integrations | `HubspotSyncService` (companies/contacts/deals, idempotent, tenant-safe)                  | **Complete**                                                                      |
| integrations | `HubspotProvider` (connect/sync/read/write)                                               | **Stub** (throws; superseded by `HttpHubspotClient` + sync)                       |
| worker       | `crm-sync` job + `buildCrmSyncRuntime` (Kysely repo + HttpHubspotClient)                  | **Complete** wiring (needs `pg` + OAuth `TokenProvider`)                          |
| api          | all endpoints (`handlers.ts` + Fastify `server.ts`)                                       | **Complete** for Mira flow + signed HubSpot webhook; other webhooks/jobs **Stub** |
| web          | API client + approval-queue view-model                                                    | **Complete**                                                                      |
| web          | Next.js pages/components                                                                  | **Stub** (see `apps/web/README.md`)                                               |
| worker       | job runner shell                                                                          | **Stub** (no jobs registered)                                                     |
| evals        | evaluators (evidence/reply/lead)                                                          | **Scaffold**                                                                      |
| workflows    | n8n contracts + placeholder JSON                                                          | **Stub**                                                                          |

## 3. Integration contracts

Full detail: [integration-contracts.md](./integration-contracts.md). Key seams:

```ts
// packages/integrations/src/types.ts
interface IntegrationAdapter {
  readonly system: string;
  readonly kind: ProviderKind; // 'crm'|'comms'|'calendar'|'ads'|'voice'|'notify'
  handles(actionType: string): boolean;
  execute(action: ApprovedAgentAction): Promise<AdapterResult>; // assertApproved() inside
}

// packages/integrations/src/provider.ts — connect/sync/read/write framework
interface ProviderAdapter {
  connect(input): Promise<ProviderConnection>;
  sync(conn, opts?): Promise<SyncResult>;
  read(conn, query): Promise<unknown>;
  write(conn, { type, idempotencyKey, payload }): Promise<{ externalRef: string }>;
}
```

Rules: adapters **don't** decide approval (PolicyGate does); writes are idempotent
on `idempotency_key`; webhooks verify signatures; no raw PII in logs.

## 4. DB entity contracts

Source of truth is `packages/db/migrations`. Typed rows the code uses
(`packages/db/src/schema.ts`); the `Repository` (`repository.ts`) is the access
contract. Every row carries `tenant_id`, `created_at`, `updated_at`.

| Table                  | Key columns (beyond id/tenant_id/timestamps)                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounts`             | name, domain, industry, employee_count, region, fit_score, timing_score, attributes                                                                                     |
| `contacts`             | account_id, full_name, title, persona, email_hash, phone_hash, **is_suppressed**, attributes                                                                            |
| `events`               | event*name, entity_type, entity_id, source, occurred_at, ingested_at, payload, trace_id *(append-only)\_                                                                |
| `agent_runs`           | agent, objective, input_refs, status, trace_id                                                                                                                          |
| `agent_actions`        | agent_run_id, action_type, risk_level, **idempotency_key (uniq)**, approval_status, execution_status, target_ref, evidence_refs, payload_ref, guardrail_results, result |
| `audit_events`         | actor*ref, action, subject_ref, detail, occurred_at *(append-only)\_                                                                                                    |
| `external_object_maps` | external*system, external_type, external_id, internal_type, internal_id *(uniq dedupe)\_                                                                                |

`Repository` methods (all tenant-scoped): `listAccounts/getAccount/listContactsByAccount/getContact`,
`insertEvent/listEvents`, `createAgentRun/getAgentRun/updateAgentRunStatus`,
`createAgentAction/getAgentAction/findActionByIdempotencyKey/listAgentActions/updateAgentAction`,
`insertAuditEvent/listAuditEvents`, `ingestExternalContact`.

**Production Repository task:** implement `Repository` over Kysely using
`withTenant(db, tenantId, trx => …)` for every call so RLS enforces isolation.
The `InMemoryRepository` is the behavioral reference (and stays for tests).

## 5. Task: first concrete HubSpot adapter

Boundary is ready: `packages/integrations/src/hubspot/client.ts` defines
`HubspotClient`; `StubHubspotAdapter` already delegates to it and an in-memory
`FakeHubspotClient` makes the approval→execute path pass today.

**Implement `class HubspotClient`** (real REST v3 + OAuth):

- `createTask(input)` / `createNote(input)` — create engagements.
  - **Idempotent on `input.idempotencyKey`**: a replay returns the original
    `externalRef` with `idempotentReplay: true` (use HubSpot idempotency or a
    dedupe lookup keyed on the action). The `ActionLedger` already won't
    double-dispatch, but the client must be safe on retry.
- `listCompanies` / `listContacts` — page CRM facts (cursor/`updatedAt`) for
  sync; map to `HubspotCompany` / `HubspotContact` (email as **hash**, not raw).

**Sync task (worker):** register a `crm-sync` job that, per tenant connection:

1. `withTenant` + page `listCompanies`/`listContacts`,
2. upsert canonical rows + `external_object_maps` (idempotent — duplicate webhook
   must not duplicate contacts; see `Repository.ingestExternalContact`),
3. emit `crm.account.*`/`crm.contact.*` events,
4. record a `sync_runs` row.

OAuth: tokens come from `integration_connections.credential_ref` (encrypted,
never logged). Webhook endpoint `POST /webhooks/hubspot` must verify the HubSpot
signature before trusting the payload (currently a TODO).

**Definition of done:** `HubspotClient` implemented with a contract test mirroring
`FakeHubspotClient` (idempotency, paging, PII-hash mapping); `crm-sync` job with a
test proving duplicate sync does not duplicate contacts; webhook signature verified.

## 6. Acceptance criteria (must stay green)

Run: `pnpm install && pnpm typecheck && pnpm test` (and `pnpm run check` for format).

- Tenant A cannot read Tenant B records.
- No tenant context leaks across pooled requests/transactions (`SET LOCAL` only).
- Mira cannot propose email to a suppressed contact.
- Email adapter refuses to send without an approved action.
- `POST /agent-runs/mira` creates a run + proposed actions; `GET /agent-actions?status=proposed`
  returns drafts; approve → execute; **execute refused (409) until approved**.
- Duplicate webhook does not duplicate contacts.
- Duplicate action execution (same idempotency key) does not send twice.
- Generated messages include evidence refs in metadata.
- Reply classifier handles `unsubscribe` and `wrong_person`.

New work adds tests in the same file-adjacent style (`*.test.ts`, Vitest).
