# Brain ⇆ GTM Integration Seam

The seam lets existing GTM agents perform a task **without hardcoding a model**.
A caller names a _task_ — `prospect.research`, `gtm.routing`, or `outreach.draft`
— and `runGtmBrainTask` routes it through the canonical **#206 `ModelRouter`**,
then records an append-only GTM proof event carrying **hashes only**.

- Adapter: `packages/agents/src/brain/gtmBrainAdapter.ts`
- Tests: `packages/agents/src/brain/gtmBrainAdapter.test.ts`

## Thin adapter — no parallel router

The seam owns **no routing or policy logic**. The earlier #207 implementation
carried its own `resolveBrainRoute` + `decideBrainPolicy` and a Family-C registry
(`createDefaultBrainRegistry`, `provider.isEnabled()`, `getEnabled`); both
duplicated decisions the #206 router already makes. Here the adapter simply:

1. maps the GTM task to a #206 `taskType` and a per-task **preferred provider**,
2. calls `runTask(...)` — which performs provider resolution, the workspace
   policy gate, the **high-risk approval gate**, the **V1 mock-only invariant**,
   and execution on the deterministic mock, and
3. builds a `GtmProofEvent` (via `@cognitia/core` `createGtmProofEvent`) from the
   returned `RouterResult` / usage receipt.

`gtm.routing` was added to the #206 task registry (low risk, internal) so the
seam's three tasks all resolve through the canonical registry.

## Model-agnostic routing, demonstrated

`outreach.draft` prefers `anthropic` — **disabled in V1**. The router walks past
the disabled preferred model and serves the **mock** from the fallback chain,
setting `fallbackUsed: true`. The GTM caller never names a model; switching the
preferred provider later requires no caller change.

## Safety invariants (mock-safe V1)

- **Mock provider only.** The router enforces the V1 mock-only invariant, so a
  disabled/non-mock provider can never execute through this seam.
- **High-risk approval gate.** `outreach.draft` is high-risk: without `approval`
  the router blocks at the gate (`high_risk_requires_approval`) and **no provider
  runs** (`outputHash: null`, proof kind `gtm.outreach.review_required.v1`).
- **Hashes only.** The result exposes `promptHash` / `outputHash` (sha256) from
  the usage receipt — never the raw prompt or output. `assertNoRawPii` (gtm-os
  guards) is run over the assembled result as a belt-and-braces backstop.
- **No live egress.** Every result carries a `NoEgressAttestation`
  (`assertNoLiveEgress('mock')`).
- **Source-scanned.** The file lives under `brain/`, so `brainSourceScan.test.ts`
  enforces no network primitive and no vendor-SDK import.

## Result shape

`runGtmBrainTask` returns `{ task, executed, blocked, policyDecision, provider,
model, fallbackUsed, proofRef, proof, promptHash, outputHash, attestation }`.
When routing halts at a gate, `provider`/`model` are `none` (nothing routed) and
`executed` is `false` — the honest router outcome, not a fabricated route.
