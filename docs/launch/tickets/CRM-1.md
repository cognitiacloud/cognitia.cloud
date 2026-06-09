# CRM-1 — HubSpot side-effect adapter wired + worker secret injection

**Owner:** ENG-integrations · **Risk:** High · **Effort:** ~3d · **Gate:** 1 (V1 go-live)
**Deps:** API-1, KMS key, HubSpot portal property · **Scope fence:** CRM write-back is the V1 channel — in scope.

## Objective

Make an approved `crm.task.create` / `crm.note.create` action actually execute against
live HubSpot, idempotently, with per-tenant OAuth — and run it from the worker with
deployment-owned secrets. This is the **V1 product action**.

## Current reality (HEAD ea7677e)

- `StubHubspotAdapter` already delegates `createTask/createNote` to a `HubspotClient`, but **defaults to `FakeHubspotClient`** (writes to memory).
- `createGtmServices()` registers `new StubHubspotAdapter()` (fake) in the `AdapterRegistry`.
- `HttpHubspotClient` (real CRM v3, OAuth, idempotent via dedupe property) **exists and is tested**.
- `buildCrmSyncRuntime({ databaseUrl, secrets })` already builds the `ConnectionTokenProvider` from the repo + an injected `SecretStore`.

## Files likely to change

- `packages/agents/src/services.ts` — allow injecting the execute-path adapter; in prod, register `StubHubspotAdapter(new HttpHubspotClient({ token: ConnectionTokenProvider }))`.
- `apps/worker/src/runtime.ts` — already composes the real client; add a **scheduler** that lists active `integration_connections` and runs sync/execute per tenant.
- `apps/worker/src/jobs/crmSync.ts` — wire to the live runtime.
- `packages/core/src/events/index.ts` — add `crm.task.created.v1`, `crm.note.created.v1` (additive, vN).
- `apps/api/src/server.ts` — ensure the API execute path uses the same real adapter composition (not the default fake).

## Acceptance criteria

1. An approved `crm.task.create` creates **exactly one** HubSpot task (idempotent on `idempotency_key`); re-execute is a no-op.
2. Per-tenant token resolved from `integration_connections.credential_ref` → encrypted `SecretStore`; the `Authorization: Bearer` header carries the tenant's token.
3. Emits `crm.task.created.v1` (or `crm.push.failed.v1` on failure → `execution_status='failed'`, no partial write).
4. Unapproved execute is refused (409) — human-approval invariant intact.
5. Kill switch: `integration_connections.status='paused'` prevents execution.
6. No fake client in the production composition.

## Test plan

- E2E (mocked HTTP, fake `SecretStore`): approve → execute → one HubSpot create; idempotent re-run; bearer token asserted (extend `apps/api/src/e2e.hubspotSync.test.ts`).
- Failure path: adapter 4xx → action `failed`, `crm.push.failed.v1`, no retry storm.

## Security notes

- Tokens never logged; `credential_ref` is a pointer only; AES-256-GCM at rest; key from KMS.
- Worker runs under `app_user` (non-superuser, RLS).

## Blockers

- **B-3 (STOP for planning agent):** requires a **real HubSpot private-app token + portal config** (custom property `cognitia_idempotency_key` on tasks/notes). This is live-credential work → **Codex/human**, not the planning agent.
- **Smallest next step for Codex:** add an injectable adapter to `createGtmServices` + a worker scheduler over `integration_connections`; keep the fake client for tests; document the portal steps (done in `docs/runbooks/hubspot-onboarding.md`). **Blocks V1 (Gate 1).**

## V1 vs post-V1

V1. CRM-2 (stage-update depth) is the follow-up.
