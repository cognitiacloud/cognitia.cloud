# GTM Integration Hardening — Unified Run Packet

Module: `packages/agents/src/gtm-os/integration/` (`runPacket.ts`, `adapters.ts`, `runPacket.test.ts`)
Barrel: exported from `@cognitia/agents` (`packages/agents/src/index.ts`)
Base: `overnight/gtm-implementation` · PR #158 (draft) lanes B1–B6
Branch: `claude/alta-80-integration-hardening`

> **Status:** `MOCK ONLY / DRY-RUN ONLY / NO LIVE EGRESS / NO RAW PII`.
> This is an **adapter / read-model** layer. It composes the existing B1–B6
> lanes; it does not rewrite them, add a live integration, or change any
> package/lockfile. Every boundary remains an in-memory mock for the
> `budget_wheels_demo` / Tenant Zero sandbox.

## What this adds

One canonical server-side composer — `assembleIntegratedRunPacket` — that runs a
single lead through the whole mock GTM surface and folds the result into **one
unified `IntegratedRunPacket`** the Command Center can prove in a single object.
This island **actually calls** the tested lane modules, so it is the
authoritative integration artifact. The web routes consume it (and the other
lane modules) through **server-only adapters** under
`apps/web/src/lib/server/` — a Next.js server component can depend on
`@cognitia/agents` as long as no client component does. There is no structural
mirror of lane semantics in `apps/web`.

### The eight combined sections

| Section in packet             | Lane | Source called                                          |
| ----------------------------- | ---- | ------------------------------------------------------ |
| `audience.score`              | B4   | `buildAudience` / `scoreSignals`                       |
| `run.status` / `finalState`   | B1   | `assembleGtmRunPacket` (workflow state)                |
| `workspaceId`                 | B1   | workspace attribution                                  |
| `channelPlans`                | B2   | `planDryRunAction` (+ `assertNoLiveSend` per plan)     |
| `crm.timeline`                | B3   | `MockCrmLite` projection (`projectCrmLite` adapter)    |
| `trustOps`                    | B5   | `buildTrustOpsReport` (`toWorkflowRunSummary` adapter) |
| `releaseGate`                 | B6   | `evaluateReleaseGate` (operative + fail-closed live)   |
| `run.proofs` / `run.timeline` | B1   | proof events + ordered operator action trace           |

`verifyIntegratedRunPacket(packet)` returns a `{ complete, present, missing }`
checklist over `REQUIRED_PACKET_SECTIONS` so the Command Center can render
completeness rather than trust a type.

### Adapters (pure read-models, no lane rewrites)

- `toWorkflowRunSummary(packet)` — maps the B1 run packet onto the B5 analytics
  unit. Honest: boundary outcomes are `undefined` for any phase the run never
  reached (e.g. approval is `undefined` when compliance blocked first).
- `projectCrmLite(packet, deps)` — drives the B3 `MockCrmLite` entity graph +
  operator timeline from the run, recording one PII-safe event per phase walked.
- `deriveOpportunityStage(packet)` — `lost` on rejected approval, `proposal` on a
  completed run, `appointment_set` when the appointment was reached, else `lead`.

## Safety guarantees (asserted before any packet is returned)

1. **No live egress.** Every channel action is `{ mode:'dry_run', sent:false }`;
   each is run through `assertNoLiveSend`, and `assertSendLiveFailsClosed` proves
   `sendLive` throws for the impossible default gate. The packet carries a
   combined `attestation.noLiveEgress: true` plus B1's and B5's own attestations.
2. **No raw PII.** `assertIntegratedPacketNoRawPii` scans the whole serialized
   packet for email-shaped tokens and permits only reserved fictional TLDs
   (`.example` / `.test` / `.invalid`) or already-masked values; anything
   real-looking throws. (Phone PII is guarded at its write boundaries — B3
   timeline records and the B4 audience drop — and never enters the PII-safe
   prospect, so the packet-level scan targets emails to avoid false positives on
   opaque uuids / plan refs.)

## Tests (`runPacket.test.ts`)

- **Integration / completeness:** one unified packet contains all eight sections;
  `verifyIntegratedRunPacket` reports `complete`; happy path scores 100/100 trust,
  `dry_run` passes while `controlled_live` fails closed; deterministic given
  injected `now`/`newId`; a compliance-blocked run stays _complete_ but honestly
  halted; the verifier reports `missing` sections rather than silently passing.
- **Safety:** no live egress (every plan unsent; `sendLive` throws per channel);
  no raw PII (every email token uses a reserved TLD; the prospect exposes no
  contact-identity fields); the PII scan throws on an injected real email; a
  disallowed audience source is rejected, not scored.
- **No network/vendor imports** in the production sources (same source-scan the
  B1/B2 lanes use).

## Run

```
pnpm --filter @cognitia/agents exec vitest run src/gtm-os/integration/
pnpm check
```

## Final report — does Claude Loop 1 have everything needed?

**Yes.** The integration-hardening island gives the Command Center a single,
self-contained, deterministic object that proves the entire mock-safe GTM loop
for a lead — audience score, workflow state, workspace, dry-run channel plans,
CRM-lite timeline, TrustOps report, release-gate result, and the proof/action
trace — with completeness verified programmatically and both safety invariants
(no live egress, no raw PII) asserted at build time. Acceptance is met:

- targeted tests pass (`src/gtm-os/integration/` — 8 tests);
- `pnpm check` passes (format + typecheck + 794 tests);
- live-egress scan: clean in production sources (only the source-scan regex
  literal and the intentional guard-rejection fixture appear, in test files);
- raw-PII scan: clean (no off-list emails; no off-range phones in production
  sources).

**Out of scope / still PLANNED** (unchanged by this lane, by design): live
channel sends, real CRM/vendor SDKs, network egress, and any production-readiness
claim. Going live remains blocked behind the B6 `controlled_live` gate (7
sign-offs incl. counsel + founder), which this packet proves fails closed.
