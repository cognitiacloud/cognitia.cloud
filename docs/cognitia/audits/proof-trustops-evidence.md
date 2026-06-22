# Proof & TrustOps Evidence

> **MOCK / SANDBOX ONLY.** Everything described here runs offline, dry-run-only,
> against the `budget_wheels_demo` / Tenant Zero sandbox. There is **no live
> egress**, **no real CRM write**, **no raw PII**, and **no live-automation
> readiness claim**. This document strengthens the _proof_ and _TrustOps
> evidence_ over the existing mock-safe GTM system (PR #158 lanes B1–B6 +
> PR #159 integration island + PR #160 Command Center).

## What this adds

A single **correlated proof / action trace** — the evidence spine — plus a
**TrustOps report computed directly from the real integrated run packets**, and
the tests that prove neither output carries raw PII.

| Artifact                                  | Module                                    | Status                                |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------- |
| `buildProofActionTrace(packet)`           | `packages/agents/src/proof/proofTrace.ts` | **REAL** code, **MOCK** data          |
| `buildTrustOpsReportFromPackets(packets)` | `packages/agents/src/proof/proofTrace.ts` | **REAL** code, **MOCK** data          |
| `assertProofTraceNoRawPii(trace)`         | `packages/agents/src/proof/proofTrace.ts` | **REAL** guard                        |
| Proof-trace panel + packet TrustOps       | `apps/web/.../gtm-os-integrated-demo`     | **REAL** render of real-module output |

## The trace

`buildProofActionTrace` reads an already-built, mock-safe `IntegratedRunPacket`
(the PR #159 island, which _composes_ — never re-implements — lanes B1–B6) and
folds it into one ordered, correlated trace mapped across the canonical loop:

```
lead → compliance → approval → dry-run plan → CRM-lite → TrustOps
```

- **Correlated.** Every step shares the run's opaque prospect id
  (`correlationId`) and `workspaceId`.
- **Evidence-backed.** Each step references the _real_ underlying evidence —
  proof-event outcomes, B2 channel `planRef`s, B3 CRM timeline event ids, the B5
  trust score — never a fabricated receipt.
- **Honest.** A stage step is emitted **only when that stage actually occurred**.
  A compliance-blocked lead yields `lead → compliance` and nothing downstream; a
  rejected-approval lead never reaches a dry-run plan or CRM-lite. The
  `coverage` checklist and `complete` flag report this truthfully. The
  integration packet plans channels unconditionally (a capability demo), but the
  _trace_ gates the dry-run-plan step on the lead clearing human approval.

## TrustOps over the real integrated packet

`buildTrustOpsReportFromPackets` adapts each integrated packet's own workflow run
through the already-tested `toWorkflowRunSummary` adapter, then runs the existing
B5 analytics. The funnel, approval coverage, and 0–100 trust score are therefore
computed from the **exact runs the Command Center proved end-to-end** — not from
hand-fed synthetic summaries. The Command Center surfaces this packet-derived
score alongside the per-lead traces.

## What is REAL / MOCK / PLANNED / BLOCKED

### REAL (code that genuinely runs)

- The proof-trace builder, the packet-derived TrustOps builder, and the PII
  guards are real, pure, deterministic TypeScript with unit tests.
- The Command Center route renders this output from the real `@cognitia/agents`
  modules through a server-only adapter (no hand-authored mirror).

### MOCK / SANDBOX (deliberately not live)

- Every workflow run uses in-memory mock ports — no network, no vendor SDK, no
  database, no real CRM.
- All channel actions are dry-run plans: `mode:'dry_run'`, `sent:false`,
  `liveStatus:'BLOCKED'`.
- All data is the `budget_wheels_demo` / Tenant Zero sandbox with synthetic,
  reserved-range contacts only (`.example`/`.test`/`.invalid`, `555-01xx`).

### PLANNED (explicitly out of scope here)

- Persisting traces to a durable proof registry.
- TrustOps over a real, persisted `WorkflowRun` store (today the trace is
  computed from packets produced in-process).
- Live channel execution, real CRM connector wiring, licensed-provider audience.

### BLOCKED (fails closed; not a code toggle)

- Live send: `sendLive()` always throws; no release gate in the dry-run layer can
  open. The integrated packet asserts this fail-closed before returning.
- `controlled_live` release gate: requires 7 organizational/legal sign-offs
  (incl. counsel + founder). Until every one is satisfied and recorded, no live
  send is possible.

## No raw PII — proof

`assertProofTraceNoRawPii` scans the whole serialized trace for raw emails (only
reserved-TLD addresses pass) and scans every human-readable `summary` for raw
phone numbers (only the reserved `555-01xx` range passes). Opaque ids / uuids /
plan refs are exempt from the phone scan — the same accepted boundary the
integration packet already draws — because they are references, not PII.

Tests proving it (`packages/agents/src/proof/proofTrace.test.ts`):

- happy-path trace and blocked-path trace both pass the guard;
- the serialized trace contains no real-looking email; the TrustOps markdown
  contains no email;
- the guard **throws** when a raw email or raw phone is injected into a step
  summary, and **allows** reserved-range synthetic contacts;
- a source scan asserts the module imports no network / vendor SDK.

Web-side (`apps/web/src/lib/server/gtmIntegratedDemoData.test.ts`): every
rendered trace passes the existing demo PII guard individually, and the full
serialized Command Center payload passes it as a whole.

## Verification

- `pnpm check` (format + typecheck + full vitest suite) — green.
- `pnpm --filter @cognitia/web run typecheck` — green (web route touched).
- Safety scans: no live egress / vendor send SDKs / raw PII / non-demo Budget
  Wheels wording in the new code (matches in tests are intentional negative
  fixtures and source-scan regex literals).
