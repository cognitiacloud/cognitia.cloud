# OBS-1 — Observability + audit dashboards

**Status:** implemented (GTM lane). **Backlog ref:** operating-plan §5 #4.
**Acceptance:** `*.failed.v1`/sync_run dashboards; worker heartbeat; PII-safe
log assertion in CI.

## What shipped

### 1. Operations overview read-model (`GET /ops/overview`)

Read-only, viewer-allowed (`apps/api/src/opsOverview.ts`). One answer to "is
this tenant healthy?":

- **failures** — every `*.failed.v1` event plus `agent.action.execution_denied.v1`,
  counted by event name, with the most recent occurrences. Projection carries
  refs only (event payloads hold refs/hashes by design — never raw PII).
- **sync** — sync_run health: counts by status, failure rate over settled runs,
  last completed / last failed timestamps.
- **actions** — the action ledger's execution-status and approval-status mix.
- **worker** — liveness from the latest heartbeat, with an explicit staleness
  verdict. **Fails closed:** no heartbeat ⇒ `stale: true`. Threshold defaults
  to 15 minutes (`?stale_after_minutes=` overridable).

Typed web seam: `ApiClient.opsOverview()` (`OpsOverviewView`). No new table, no
migration, no shared-contract change — zero conflict surface with other lanes.

### 2. Worker heartbeat

`worker.heartbeat.recorded.v1` — a new registered event (additive; validated by
the envelope + registry like every event). `recordWorkerHeartbeat`
(`apps/worker/src/heartbeat.ts`) appends it to the tenant's immutable event
stream after **every** crm-sync cycle — including failed ones (`finally`):
liveness ("the worker runs") and sync success are separate signals; the sync
failure itself is recorded in sync_runs. Worker identity is a deterministic
UUID derived from the worker name (the envelope requires a uuid entity id);
the human-readable name travels in the payload. Wired in both paths:
`crmSyncJob` and `buildCrmSyncRuntime.syncTenant`.

### 3. PII-safe log assertion (gates CI)

`apps/api/src/logSafety.guard.test.ts` — a static guard run by the normal test
gate. All runtime logging must flow through the redacting `log()` sink
(`packages/core/src/logging.ts`: allowlisted keys + forbidden-key redaction).
The guard scans every non-test source file in `apps/` and `packages/` and fails
on any raw `console.*` call site outside the explicit two-file allowlist (the
sink itself + the API bootstrap line, which is additionally asserted to be
static structured JSON). Complements the existing redaction unit tests in
`packages/core/src/logging.test.ts`.

## Backlog status note (supersedes operating-plan §9, which is self-dated)

API-1 is **complete** on this branch: `buildHandlersFromEnv` composes the
Kysely/Postgres repository when `DATABASE_URL` is set, `/health` performs a
real DB ping, operator tenant/role derive only from the verified session
principal (forged `x-tenant-id` is ignored — tested in `serverAuth.test.ts`),
and the PGlite contract suite gates CI. CRM-1 wiring (real HubSpot client +
encrypted per-tenant credentials) and UI-1 (approvals console) are also live.

## Tests

`opsOverview.test.ts` (failure counts/projection, sync health, action mix,
fail-closed staleness, tenant scoping, viewer-allowed endpoint),
`crmSync.test.ts` (heartbeat on success AND on sync failure, stable derived
identity), `logSafety.guard.test.ts` (no unredacted log path).
