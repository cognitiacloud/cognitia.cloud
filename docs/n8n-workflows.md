# n8n workflows

> n8n holds glue/orchestration only — never business invariants. Anything whose
> breakage would violate a first principle lives in code with a test.

## 1. What belongs here

- Cross-system fan-out and scheduling that reads clearer as a visual flow.
- Non-critical notifications and routing (e.g. ping Slack on new proposal).
- Connector prototyping before promotion into `packages/integrations`.

## 2. What does NOT belong here

- Tenant isolation, authz, RLS.
- Event writes / schema validation.
- The action ledger, policy gate, idempotency, guardrails.
- Any state that must be transactional with Postgres.

## 3. Planned workflows (MVP)

| Workflow             | Trigger                         | Effect                                              |
| -------------------- | ------------------------------- | --------------------------------------------------- |
| `proposal-notify`    | `agent.action.proposed.v1`      | Notify operators (Slack) that a proposal is queued. |
| `crm-sync-schedule`  | cron                            | Kick `POST /jobs/crm-sync` per connected tenant.    |
| `reply-ingest-route` | email reply webhook (prototype) | Normalize and forward to API for classification.    |

## 4. Conventions

- Definitions are exported as JSON under `packages/workflows/n8n/`.
- Each workflow calls the API/worker over authenticated endpoints; it never
  writes Postgres directly.
- Idempotency is preserved by calling endpoints that carry idempotency keys.
- Secrets are referenced via n8n credentials, never inlined.

## 5. Promotion path

A connector prototyped in n8n graduates to `packages/integrations` once it needs
tests, idempotency guarantees, or participates in the action ledger.
