# Cognitia — AI GTM Workforce

A TypeScript-first platform for B2B top-of-funnel go-to-market, built as a
production-shaped MVP. Cognitia runs a workforce of auditable AI agents:

| Agent  | Role                          | Status   |
| ------ | ----------------------------- | -------- |
| Mira   | Outbound signal agent         | MVP (v1) |
| Echo   | Inbound / voice qualification | Planned  |
| Atlas  | RevOps intelligence           | Planned  |
| Beacon | Paid acquisition              | Later    |

> Cognitia is an independent product. It is not affiliated with, and does not
> copy the branding, names, UI, prompts, or proprietary behavior of, any other
> vendor.

## First principles

1. Postgres is the source of truth.
2. Events are immutable.
3. Agent actions are auditable.
4. External side effects require an `agent_action` record before execution.
5. Human approval is the default for outbound send, calling, CRM mutation, and ads launch.
6. Every integration write must be idempotent.
7. Every generated message must be grounded in an evidence pack.
8. Every table supports tenant isolation.
9. Logs are structured JSON and must not contain raw PII.
10. Tests are part of the feature, not cleanup.

## Repository layout

```
apps/
  web/         Next.js operator console (approval queue, dashboards)
  api/         Fastify-style modular TypeScript API service
  worker/      Background jobs (sync, agent runs, evals)
packages/
  core/        Shared schemas (Zod), event taxonomy, policies, types
  db/          SQL migrations, fixtures, DB access helpers
  agents/      Agent runtime: Mira/Echo/Atlas/Beacon, context, tools, guardrails
  integrations/ HubSpot, Salesforce, email, calendar, slack, voice, ads adapters
  evals/       Datasets, rubrics, eval scripts
  workflows/   n8n workflow definitions
docs/          Architecture, data model, event taxonomy, contracts, security
scripts/       Repo automation
```

## Stack

- Monorepo: pnpm workspaces · TypeScript
- Web: Next.js · API: Fastify-style modular service · Worker: TS jobs
- DB: Supabase Postgres + pgvector
- Runtime validation: Zod · Tests: Vitest (Playwright later)
- Python only for `/labs` and `packages/evals` analysis scripts

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm format
```

Copy `.env.example` to `.env` before running services.

## Documentation

Read these before changing core contracts — see [docs/](./docs):

- [architecture.md](./docs/architecture.md)
- [data-model.md](./docs/data-model.md)
- [event-taxonomy.md](./docs/event-taxonomy.md)
- [agent-contracts.md](./docs/agent-contracts.md)
- [integration-contracts.md](./docs/integration-contracts.md)
- [n8n-workflows.md](./docs/n8n-workflows.md)
- [security-and-compliance.md](./docs/security-and-compliance.md)
- [evals.md](./docs/evals.md)

## Status

Bootstrap scaffold: repo structure, documentation skeleton, tooling, core
schemas, and database migration files. Business logic is intentionally stubbed.
