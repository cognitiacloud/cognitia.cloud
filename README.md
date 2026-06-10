# Cognitia — Governed GTM Action System

A TypeScript-first, **CRM-first, approval-gated, governed** GTM action system.
The thesis is not breadth — it is being more coherent, inspectable,
simulation-safe, and accountable than broader competitors exactly where
enterprise operators feel risk: before an action, during approval, at write
time, during simulation, in audit review, and on rollback.

The live agent (**Mira**) proposes CRM actions — **two governed write types
today: follow-up tasks and grounded account-context notes** — and every side
effect passes a governed lifecycle (preview → human approval with a mandatory reason →
idempotent, provenance-stamped execution → reversible undo), and every claim
below is backed by a test that runs in CI.

| Agent  | Role                                      | Status        |
| ------ | ----------------------------------------- | ------------- |
| Mira   | CRM action agent (tasks + grounded notes) | **Live (v1)** |
| Echo   | Inbound / voice qualification             | Planned       |
| Atlas  | RevOps intelligence                       | Planned       |
| Beacon | Paid acquisition                          | Later         |

> Cognitia is an independent product. It is not affiliated with, and does not
> copy the branding, names, UI, prompts, or proprietary behavior of, any other
> vendor.

## Governed action system — shipped and CI-proven

Every row is live in code with an operator-visible surface and a test that
fails in CI if the behavior regresses. This is the evidence index a technical
evaluator should read first.

| Capability                                                                                                        | Operator/admin surface                                                   | Proof (test)                                        |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Per-action human approval with a mandatory structured reason                                                      | `POST /agent-actions/:id/approve\|reject`; console reason panel          | `decisionReasons.test.ts`, `fence.test.ts`          |
| "Why this action" — fit/timing score, grounding CRM facts, **data freshness** with a stale-since-proposal warning | `GET /agent-actions/:id/rationale`; "Why" expander                       | `rationale.test.ts`                                 |
| Typed write preview, **byte-identical** to the executed write                                                     | `GET /agent-actions/:id/preview`; "Preview write"                        | `writePlan.test.ts`, `previewAction.test.ts`        |
| Zero-write preflight simulation over real tenant data                                                             | `POST /agent-runs/mira/preflight`; "Preflight"                           | `preflight.test.ts`                                 |
| Connection readiness gate (portal properties verified before first write)                                         | `GET /integrations/readiness`; "Check readiness"                         | `readiness.test.ts`, `integrationReadiness.test.ts` |
| Idempotent, provenance-stamped CRM execution                                                                      | `POST /agent-actions/:id/execute`                                        | `crmExecute.test.ts`, `provenance.test.ts`          |
| Accountable undo (reversible CRM archive, same label/event/audit as execution)                                    | `POST /agent-actions/:id/rollback`; "Undo write"                         | `rollback.test.ts`                                  |
| Enforced tenant kill switch (any operator pauses; owner-only resume)                                              | `POST /integrations/:system/pause\|resume`                               | `killSwitch.test.ts`                                |
| Code-derived governance matrix + queryable audit trail                                                            | `GET /governance`, `GET /audit`; console panels                          | `governance.test.ts`                                |
| Live-derived trust metrics + exportable trust packet (eval re-run + CI-pointed attestations)                      | `GET /metrics/trust`, `GET /reports/trust-packet`; "Export trust packet" | `trustMetrics.test.ts`, `trustPacket.test.ts`       |
| Rejection → anonymized CI regression flywheel                                                                     | `GET /agent-actions/:id/regression-candidate`; "Export regression"       | `regression.test.ts`, `regressionCandidate.test.ts` |
| Falsifiable golden eval gate over the real runtime                                                                | CI gate                                                                  | `golden.test.ts`                                    |
| Full-lifecycle acceptance (the entire governed loop, one test)                                                    | CI gate                                                                  | `lifecycle.acceptance.test.ts`                      |
| Post-deploy smoke (fails on fence drift / auth regressions)                                                       | `apps/api/scripts/smoke-deploy.mjs`                                      | `smokeDeploy.test.ts`                               |
| Tenant isolation proven on Postgres (RLS)                                                                         | —                                                                        | `kysely.rls.pglite.test.ts`                         |

**Scope fence (V1):** CRM write-back only (HubSpot tasks/notes). No email,
voice, or ads execution — those surfaces are disabled in the production
composition and the fence is enforced in tests and the deploy smoke. See
`docs/competitive/operating-plan.md` (including §0a, forbidden thesis pivots).

**Known remaining work:** live operator setup needs human-provided HubSpot
credentials (`docs/launch/operator-handoff.md`); risk-tiered/earned-autonomy
review is gated on accumulated decision-label volume (`docs/evals.md` §3a).

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
  agents/      Agent runtime: Mira (live), context, tools, guardrails, ledger
  integrations/ HubSpot CRM (live read+write); email adapter present but fenced off
  evals/       Golden dataset, rubrics, regression flywheel, eval harness
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

**Working governed CRM action system, not a scaffold.** The full lifecycle —
sync → propose → preview → approve → execute → undo, with provenance, audit,
kill switch, trust export, and a falsifiable eval gate — is implemented and
CI-enforced (see the capability table above). The remaining work to operate it
live is human-blocked (HubSpot credentials + portal setup) and data-blocked
(earned-autonomy needs decision-label volume), not unbuilt.

Run `pnpm check` (format + typecheck + full test suite) to verify the claims
above locally; the same suite gates every change in CI.
