# Architecture

> Status: living document. Update this (and dependent tests/contracts) before
> changing any core boundary. See [Iteration protocol](#iteration-protocol).

## 1. System overview

Cognitia is an AI GTM workforce for B2B top-of-funnel. It ingests signals and
CRM data, runs auditable agents that **propose** actions, routes those proposals
through an approval gate, and executes approved side effects idempotently
through integration adapters. Every step emits immutable events.

```
                 ┌─────────────────────────────────────────────────────────┐
                 │                    Postgres (source of truth)            │
                 │  tenants · gtm entities · events · agent_runs/actions    │
                 │  recommendations · audit_events · embeddings (pgvector)  │
                 └─────────────────────────────────────────────────────────┘
                      ▲              ▲                ▲              ▲
        writes/reads  │              │ events         │ context      │ audit
                 ┌────┴─────┐   ┌────┴──────┐   ┌──────┴─────┐  ┌─────┴──────┐
   webhooks ───▶ │   API    │   │  Worker   │   │  Agents    │  │  Approval  │
   operator ───▶ │ (Fastify)│◀─▶│ (jobs)    │◀─▶│  runtime   │  │  queue (UI)│
                 └────┬─────┘   └────┬──────┘   └──────┬─────┘  └─────┬──────┘
                      │              │                 │ propose      │ approve
                      │              ▼                 ▼              ▼
                      │        ┌───────────────────────────────────────────┐
                      └───────▶│         Integration adapters              │
                               │ hubspot · salesforce · email · calendar   │
                               │ slack · voice · ads  (idempotent writes)  │
                               └───────────────────────────────────────────┘
```

## 2. Service boundaries

| Service                 | Responsibility                                                                                                                                                                                                        | Does NOT do                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/api`              | HTTP surface: webhooks, REST endpoints, approval actions, health/metrics.                                                                                                                                             | Long-running work, direct LLM calls, side-effect sends.                                               |
| `apps/worker`           | Background jobs: CRM sync, agent runs, embedding, eval runs, scheduled tasks.                                                                                                                                         | Serve HTTP, own request auth.                                                                         |
| `apps/web`              | Operator console: approval queue, account context, dashboards.                                                                                                                                                        | Business logic; it calls the API.                                                                     |
| `packages/core`         | Shared Zod schemas, event taxonomy, policy primitives, shared types.                                                                                                                                                  | I/O, DB access, network.                                                                              |
| `packages/db`           | Migrations, fixtures, typed DB access, RLS helpers.                                                                                                                                                                   | Business decisions.                                                                                   |
| `packages/agents`       | Agent runtime: run lifecycle, context builder, tool registry, policy gate, action ledger, guardrails, per-agent logic, [brain harness](architecture/cognitia-brain-harness.md) (governed model router, mock-safe V1). | Direct external sends (must go through adapters + ledger); real model egress (brain V1 is mock-safe). |
| `packages/integrations` | Typed, idempotent adapters to external systems.                                                                                                                                                                       | Decide whether an action is allowed (that is PolicyGate).                                             |
| `packages/evals`        | Datasets, rubrics, eval/experiment runners.                                                                                                                                                                           | Run in the request path.                                                                              |
| `packages/workflows`    | n8n workflow definitions (glue/orchestration that is better expressed as flows).                                                                                                                                      | Hold business invariants that need tests.                                                             |

## 3. Data flow

### 3.1 Inbound (ingest)

1. External system (e.g. HubSpot webhook) or operator hits `apps/api`.
2. API validates payload with a Zod schema, verifies signature, and writes an
   **immutable `event`** (`domain.entity.action.vN`) with `tenant_id`,
   `trace_id`, `occurred_at`, `ingested_at`.
3. API upserts canonical entities via idempotent maps (`external_object_maps`)
   so duplicate webhooks do not duplicate records.
4. Heavy follow-up work is enqueued for the worker.

### 3.2 Agent run (propose)

1. `AgentRunService` creates an `agent_run` (objective + input refs), status
   `pending → running`.
2. `ContextBuilder` assembles a `ContextPack`: deterministic SQL context first,
   vector retrieval second. Every personalization claim carries an evidence ref.
3. The agent generates artifacts (research summary, sequence draft, scores).
4. **Side-effect tools never execute directly** — they emit a _proposed_
   `agent_action` via the `ActionLedger`.
5. `PolicyGate` classifies risk, checks tenant settings, suppression/consent,
   and sets `requires_approval`.
6. Guardrails (suppression, evidence, spamminess, brand voice, compliance) run;
   failures block or annotate the proposal.
7. Run transitions to `completed` (or `failed`) and emits events.

### 3.3 Approval → execution (act)

1. Proposed actions surface in the approval queue (`GET /agent-actions?status=proposed`).
2. A human approves/rejects (`POST /agent-actions/:id/approve|reject`).
3. On approval, `POST /agent-actions/:id/execute` runs the action through the
   matching integration adapter using its `idempotency_key`.
4. The adapter performs an idempotent write; result + `execution_status` are
   recorded on the action and as an `audit_event`.
5. `FeedbackRecorder` captures human edits/approvals/rejections and downstream
   outcomes (replies, meetings) as learning events.

## 4. What lives in code vs n8n

**In code (testable, invariant-bearing):**

- All tenant isolation, RLS, and authz.
- Event writes and schema validation.
- The action ledger, policy gate, idempotency, guardrails.
- Integration adapter write semantics.
- Anything requiring a unit/integration test to stay correct.

**In n8n (glue/orchestration, no hidden invariants):**

- Cross-system fan-out and scheduling that is clearer as a visual flow.
- Non-critical notifications and routing.
- Prototyping connectors before promoting them into `packages/integrations`.

Rule: if breaking it would violate a first principle, it belongs in code with a
test — not in n8n.

## 5. Agent execution lifecycle

```
create run ──▶ build context ──▶ generate ──▶ propose actions ──▶ policy gate
   │                │ (SQL+vector)    │            │ (ActionLedger)     │
   │                │                 │            ▼                    ▼
   │                │                 │      guardrails            requires_approval?
   │                │                 │            │              ┌────┴────┐
   ▼                ▼                 ▼            ▼              yes        no
 agent_runs     ContextPack      artifacts   agent_actions   approval     auto-eligible
 (status:        (evidence       (research,  (status:        queue        (still ledgered
  pending→        refs)          drafts,      proposed)        │            + audited)
  running→                       scores)                       ▼
  completed/                                              approve/reject
  failed)                                                       │
                                                                ▼
                                                            execute (adapter, idempotent)
                                                                │
                                                                ▼
                                                          audit_events + feedback
```

Status transitions for `agent_runs`: `pending → running → completed | failed`.
Status transitions for `agent_actions`:
`proposed → approved → executing → executed | failed`, or `proposed → rejected`.
Every transition emits an event and is auditable.

## 6. Cross-cutting concerns

- **Tenant isolation:** every table carries `tenant_id`; RLS enforces it. See
  [data-model.md](./data-model.md).
- **Idempotency:** every external write carries an `idempotency_key`; replays are
  no-ops. See [integration-contracts.md](./integration-contracts.md).
- **Observability:** structured JSON logs with `trace_id`, `tenant_id`,
  `agent_run_id`, `agent_action_id`, `entity_ref`. No raw PII. See
  [security-and-compliance.md](./security-and-compliance.md).
- **Validation:** Zod at every boundary (HTTP, queue, adapter I/O).

## Iteration protocol

Before changing a core contract: (1) read this doc, `data-model.md`,
`event-taxonomy.md`, `agent-contracts.md`; (2) propose the change here; (3)
update docs; (4) update tests; (5) update dependent code. Do not silently change
contracts.
