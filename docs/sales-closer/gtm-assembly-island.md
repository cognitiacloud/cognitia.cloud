# GTM Assembly Island

The **canonical mock-safe GTM assembly island**. One module that composes a Sales
Closer workflow run + workspace attribution + proof/run trace + an operator
timeline into a single **run packet**.

> **MOCK / SANDBOX ONLY.** Every capability here is an in-memory mock. There is
> **no** live outreach, **no** network, **no** vendor SDK, **no** live
> email/SMS/call/CRM sync. This is not production-ready and makes no
> production-readiness claims.

## What it composes

`assembleGtmRunPacket` runs **one** lead through the existing Sales Closer
workflow (`packages/agents/src/closer/`) via injected ports — mock ports by
default — and folds the `WorkflowRun` into a single operator-facing artifact:

```
RawGtmProspectInput
        │
        ▼
 assembleGtmRunPacket
   ├─ createSalesCloserWorkflow(createMockCloserPorts(...))   ← closer/ (reused)
   ├─ run() → WorkflowRun (prospect, state, status, transitions, proofs)
   ├─ toPiiSafeProspect(run.prospect)        ← drops contact identity
   ├─ derive compliance / approval / appointment / crm state
   ├─ toOperatorTimeline(run.transitions)    ← ordered phase log
   └─ assertNoLiveEgress('mock') + assertNoRawPii(packet)
        │
        ▼
   GtmRunPacket  ──►  toGtmAssemblyConsoleView()  (apps/web view-model)
```

### Files

| File | Role |
| --- | --- |
| `packages/agents/src/gtm-os/assembly/index.ts` | `assembleGtmRunPacket` + packet types |
| `packages/agents/src/gtm-os/assembly/guards.ts` | no-PII / no-egress guards + `PiiSafeProspect` |
| `packages/agents/src/gtm-os/assembly/timeline.ts` | `toOperatorTimeline` |
| `packages/agents/src/gtm-os/assembly.test.ts` | assembly tests (happy/blocked/rejected/pending) |
| `apps/web/src/lib/gtmOsAssemblyViewModel.ts` | operator-console view-model (pure, no React) |
| `apps/web/src/lib/gtmOsAssemblyViewModel.test.ts` | view-model tests |

## Packet shape (`GtmRunPacket`)

| Field | Meaning |
| --- | --- |
| `mode` | always `'mock'` |
| `workspace` | `{ workspaceId, sandbox }` — attribution (default `budget_wheels_demo`, `sandbox: true`) |
| `prospect` | `PiiSafeProspect` — id + company + business/source/compliance/pipeline fields only |
| `status` | `'completed' \| 'blocked' \| 'awaiting_approval'` (straight from the run) |
| `finalState` | terminal/halt `SalesCloserState` |
| `blockedReason` | reason when blocked |
| `compliance` | `{ passed, blocked, reason? }` |
| `approval` | `{ status: approved\|rejected\|pending, reason? }` |
| `appointment` | `{ requested, reason? }` |
| `crm` | `{ written, reason? }` (mock writeback) |
| `proofs` | `GtmProofEvent[]` recorded during the run |
| `timeline` | ordered `TimelineRow[]` derived from the workflow transitions |
| `noEgress` | `{ mode, liveSendOccurred: false, statement }` attestation |

The packet **reflects every terminal/halt state honestly**: a blocked/rejected
run records no spurious downstream success, and a pending-approval run halts at
the human gate with no appointment/CRM/proof state.

## No-egress guarantee

- The island imports **only** `@cognitia/core` and the sibling `closer/`
  workflow. No `fetch`/`axios`/`node:http(s)`/`node:net`/`node:tls`/
  `child_process`, no vendor SDK (Twilio/Apify/Anthropic/HubSpot), no
  `@cognitia/db`, no `@cognitia/integrations`. A test asserts this over every
  non-test source file in `assembly/`.
- `assertNoLiveEgress('mock')` is a runtime attestation recorded on every
  packet (`liveSendOccurred: false`); it throws on any non-mock mode.
- A live send is **impossible by construction** — there is no network/vendor
  port in the dependency graph.

## No-raw-PII guarantee

- `toPiiSafeProspect` drops contact identity entirely: no `contactName`, no
  email/phone **hashes**, no **masked** email/phone, no email **domain**. Raw
  `contactEmail`/`contactPhone` never reach a `GtmProspect` (they are
  hashed/dropped by `normalizeGtmProspect`); the packet narrows further to zero
  re-identification surface.
- `assertNoRawPii(packet, ...)` is a belt-and-braces check run before the packet
  is returned — it throws if a raw email ever serializes into the packet.
- Fixtures use only `.example` domains and `555-01xx` phone numbers.

## Alta parity mapping

| Alta capability | Island equivalent | Status |
| --- | --- | --- |
| Lead → outreach orchestration | Sales Closer workflow run (compliance → approval → appointment → CRM → proof) | **MOCK** |
| Workspace / tenant attribution | `packet.workspace` (`budget_wheels_demo` sandbox) | **SANDBOX** |
| Human-in-the-loop approval | `packet.approval` + `awaiting_approval` halt (no autonomous send) | **MOCK** |
| Compliance / suppression gate | `packet.compliance` + `canContactProspect` doctrine | **REAL** (pure guardrail logic) |
| Appointment / scheduler | `packet.appointment` (mock appointment ref) | **MOCK** |
| CRM sync / writeback | `packet.crm` (mock record ref, no live sync) | **MOCK** |
| Proof / activity trace | `packet.proofs` (`GtmProofEvent[]`) | **REAL** (event shapes) / **MOCK** (recording boundary) |
| Operator console / timeline | `packet.timeline` + `toGtmAssemblyConsoleView` | **MOCK** view-model |
| Live email/SMS/call egress | none — attested absent | **PLANNED** (out of scope; gated by future lanes) |

### Status legend

- **REAL** — pure deterministic logic that would ship as-is (guardrails, event/packet shapes).
- **SANDBOX** — runs only against the Budget Wheels demo / Tenant Zero sandbox.
- **MOCK** — backed by an in-memory mock behind a real port interface; no IO.
- **PLANNED** — not implemented here; deliberately out of scope and attested absent.

## Usage (offline, deterministic)

```ts
import { assembleGtmRunPacket } from '@cognitia/agents'; // once the parent wires the export

const packet = await assembleGtmRunPacket({
  lead: {
    companyName: 'Lakeshore Motors',
    website: 'https://lakeshore-motors.example',
    source: 'public_registry',
    consentStatus: 'implied_possible',
  },
  // portOverrides drives blocked / rejected / pending paths:
  // portOverrides: { approval: { status: 'pending' } },
});
```

## Tests

```
pnpm vitest run packages/agents/src/gtm-os apps/web/src/lib/gtmOsAssemblyViewModel.test.ts
```

Both files run under the root vitest config (`apps/**/*.test.ts` is included).
The view-model is intentionally decoupled from `@cognitia/agents` (it declares
the packet shape structurally), so it typechecks under the web tsconfig — which
maps only `@cognitia/core` — without a cross-package import.
