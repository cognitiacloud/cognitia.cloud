# Data model

> Postgres is the source of truth. Every table is tenant-scoped, timestamped,
> and RLS-protected. Migrations live in `packages/db/migrations`.

## 1. Canonical entities

| Domain       | Entity                    | Notes                                                      |
| ------------ | ------------------------- | ---------------------------------------------------------- |
| Tenancy      | `tenants`                 | Root isolation boundary.                                   |
| Tenancy      | `users`                   | Global identity.                                           |
| Tenancy      | `memberships`             | user ↔ tenant ↔ role.                                      |
| Tenancy      | `roles`                   | Named permission sets.                                     |
| Integrations | `integration_connections` | Per-tenant connection to an external system.               |
| Integrations | `external_object_maps`    | Maps external IDs ↔ internal UUIDs (idempotency backbone). |
| Integrations | `sync_runs`               | One CRM/import sync execution.                             |
| GTM          | `accounts`                | Companies / target organizations.                          |
| GTM          | `contacts`                | People at accounts.                                        |
| GTM          | `leads`                   | Unqualified inbound/sourced persons.                       |
| GTM          | `opportunities`           | Pipeline deals.                                            |
| GTM          | `meetings`                | Scheduled/held meetings.                                   |
| Agent core   | `events`                  | Immutable event log.                                       |
| Agent core   | `agent_runs`              | One agent execution.                                       |
| Agent core   | `agent_actions`           | Proposed/approved/executed side effects (audit unit).      |
| Agent core   | `recommendations`         | Non-side-effect suggestions (scores, next steps).          |
| Agent core   | `audit_events`            | Human/system audit trail.                                  |
| Outbound     | `campaigns`               | Outbound program.                                          |
| Outbound     | `audience_segments`       | Targeting definitions.                                     |
| Outbound     | `sequences`               | Multi-step sequence.                                       |
| Outbound     | `sequence_steps`          | Ordered steps within a sequence.                           |
| Outbound     | `touchpoints`             | Individual planned/sent touches.                           |
| Outbound     | `conversations`           | Threaded exchanges with a contact.                         |
| Intelligence | `signals`                 | Buying / timing signals.                                   |
| Intelligence | `playbooks`               | Tenant ICP + strategy config.                              |
| Intelligence | `documents`               | Source docs for grounding.                                 |
| Intelligence | `document_chunks`         | Chunked docs.                                              |
| Intelligence | `embeddings`              | pgvector vectors for chunks.                               |
| Evals        | `experiments`             | A/B or rubric experiment.                                  |
| Evals        | `eval_runs`               | One eval execution.                                        |
| Evals        | `eval_items`              | Per-item eval result.                                      |
| Evals        | `feedback_labels`         | Human labels / outcomes.                                   |

## 2. Table list by migration

| Migration                                  | Tables                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `0001_tenants_users.sql`                   | tenants, users, memberships, roles (+ RLS helpers)                                  |
| `0002_integrations_external_maps.sql`      | integration_connections, external_object_maps, sync_runs                            |
| `0003_gtm_entities.sql`                    | accounts, contacts, leads, opportunities, meetings                                  |
| `0004_events_agent_runs_actions.sql`       | events, agent_runs, agent_actions, recommendations, audit_events                    |
| `0005_campaigns_sequences_touchpoints.sql` | campaigns, audience_segments, sequences, sequence_steps, touchpoints, conversations |
| `0006_signals_playbooks_embeddings.sql`    | signals, playbooks, documents, document_chunks, embeddings                          |
| `0007_evals_experiments.sql`               | experiments, eval_runs, eval_items, feedback_labels                                 |

## 3. Common columns

Every table includes:

- `id uuid primary key default gen_random_uuid()`
- `tenant_id uuid not null references tenants(id)` (except `tenants`, `users`)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` (maintained by trigger)

`users` is global identity; tenant scoping is via `memberships`.

## 4. Tenant isolation policy

- **Hard rule:** no query returns rows across tenants. Enforced by RLS, not by
  application discipline alone.
- **Mechanism:** a per-request/per-connection setting `app.current_tenant_id`
  (`SET LOCAL`) drives every RLS policy:
  `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`.
- **Service role:** the worker/admin path may set `app.bypass_rls` only for
  trusted system jobs; this is logged and never exposed to request handlers.
- **Tests:** Tenant A must never read Tenant B rows (see
  `packages/db/fixtures/tenant_isolation.fixture.sql` and the integration test
  in the testing requirements).

## 5. External object mapping

`external_object_maps` is the idempotency backbone for ingest:

| Column            | Purpose                              |
| ----------------- | ------------------------------------ |
| `tenant_id`       | Isolation.                           |
| `connection_id`   | Which `integration_connections` row. |
| `external_system` | e.g. `hubspot`, `salesforce`.        |
| `external_type`   | e.g. `company`, `contact`.           |
| `external_id`     | ID in the external system.           |
| `internal_type`   | e.g. `account`, `contact`.           |
| `internal_id`     | UUID of the canonical row.           |

Unique constraint on
`(tenant_id, external_system, external_type, external_id)` guarantees a
duplicate webhook resolves to the same internal row instead of creating a new
one.

## 6. RLS requirements

- RLS **enabled and forced** on every tenant-scoped table.
- Standard policy set per table: `select`, `insert`, `update`, `delete`, each
  scoped to `tenant_id = current_setting('app.current_tenant_id')::uuid`.
- `events`, `agent_actions`, and `audit_events` are **append-mostly**:
  - `events` and `audit_events`: insert + select only (no update/delete) to
    preserve immutability.
  - `agent_actions`: update is allowed only for status/result columns via the
    ledger; never delete.
- Helper function `app.current_tenant_id()` centralizes the setting read.
- Migration files carry an `-- RLS:` comment block documenting each table's
  policy intent.

## 7. Indexing conventions

- Every `tenant_id` column is indexed (often as the leading column of a
  composite index matching the hottest query).
- Foreign keys are indexed.
- `events`: index on `(tenant_id, entity_type, entity_id, occurred_at)` and on
  `(tenant_id, event_name, occurred_at)`.
- `embeddings`: ivfflat/hnsw index on the vector column (pgvector), plus
  `(tenant_id)`.
- Idempotency uniques double as lookup indexes.

## 8. Fixtures

Each migration ships at least one fixture path under `packages/db/fixtures/`:

- `0001_tenants_users.fixture.sql`
- `tenant_isolation.fixture.sql` (two tenants, used by isolation tests)
- additional fixtures added as later migrations land.
