# Cognitia Brain Evals (`gtm-routing-v1`)

The **brain** is Cognitia's model-routing decision layer. Given a generation
request, it decides **which provider (if any)** the request is routed to, subject
to allow-list, human-approval, data-residency (local-only), cost, latency, and
capability constraints. The brain holds no credentials and, in V1, performs **no
live model calls** — the only executable provider is the deterministic mock.

This document describes the **`gtm-routing-v1` eval suite**: a deterministic set
of scenarios that pins the routing decision logic so regressions are caught in CI.

- Suite: `packages/agents/src/brain/gtmRoutingEvals.ts`
- Tests: `packages/agents/src/brain/gtmRoutingEvals.test.ts`
- Engine (reused, not duplicated): the canonical `ModelRouter` + `evalModelRouterSuite`
  in `modelRouter.ts` / `brainApi.ts`.

## Design: one router, no parallel engine

The suite does **not** ship its own routing engine. Earlier exploratory work
(PR #203) carried a standalone `routeBrainRequest` decision function; that
duplicated logic the canonical #206 `ModelRouter` already owns and could drift
from it. Here every scenario is an `EvalCase` executed through the **real**
`brainApi.runTask` → `ModelRouter.route`, and scored by `evalModelRouterSuite`.
Pinning the production router is the whole point — a second engine would pin the
wrong thing.

## Why evals

The routing decision is the single chokepoint that keeps the brain mock-safe and
policy-compliant. A silent regression here — routing a high-risk send before
approval, ignoring a cost ceiling, or letting an injected non-mock provider
execute — is exactly the class of bug that does not surface in a demo but matters
in production. Each routing outcome is encoded as a deterministic scenario with a
declared expectation, verified on every `pnpm check`.

## Mock-safe invariants (enforced in code)

1. **No real model/API calls.** The only executable provider is the in-process
   deterministic mock. Scenarios that probe a policy gate register an _extra mock
   variant_ with a tuned descriptor (e.g. `location: 'external'` for the
   local-only gate); these are still mocks — there is no live path.
2. **No network / vendor SDKs / secrets.** The module imports only sibling brain
   modules; the colocated `brainSourceScan.test.ts` enforces it.
3. **No raw PII / no raw prompts.** The router records SHA-256 hashes only, and
   `assertNoRawPiiInEvalReport` scans the assembled report before it is returned.

## Scenarios

Each scenario pins exactly one outcome of the canonical router:

| Scenario                      | Expected                      | Governed gate                                                    |
| ----------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| `routing-to-mock`             | `ok`                          | mock serves a low-risk task                                      |
| `fallback-to-mock`            | `ok`                          | preferred (disabled) provider skipped → mock from fallback chain |
| `provider-not-allowed-block`  | `provider_not_allowed`        | workspace allow-list                                             |
| `high-risk-approval-required` | `high_risk_requires_approval` | mandatory high-risk approval gate                                |
| `local-only-block`            | `local_only_policy`           | data-residency (local-only)                                      |
| `cost-ceiling-block`          | `cost_ceiling_exceeded`       | cost ceiling                                                     |
| `disabled-provider-block`     | `provider_disabled`           | disabled providers never execute                                 |
| `unknown-task-fail-closed`    | `unknown_task_type`           | unregistered task fails closed                                   |
| `v1-mock-only-invariant`      | `v1_mock_only`                | injected enabled non-mock provider still cannot run              |

The last two are #206-specific invariants added on top of the ported #203
coverage: unknown task types fail closed, and the V1 mock-only runtime invariant
blocks even an `enabled`, policy-allowed non-mock provider.

## A note on suppression

Contact suppression / opt-out is a **GTM PolicyGate** concern (handled by the
Brain⇆GTM seam), not a model-routing decision. The legacy #203 "suppressed
target" scenario is therefore re-expressed here as a model-level
`provider_not_allowed` policy block — which is what the model router actually
governs. Suppression coverage lives with the GTM seam, not this suite.

## Running

```bash
pnpm --filter @cognitia/agents test gtmRoutingEvals
# or the whole gate
pnpm check
```

`runGtmRoutingV1Suite()` returns a scored `EvalReport` (`suite`, `total`,
`passed`, `score`, per-case `deterministic`) and is consumed by the
`brain eval --suite gtm-routing-v1` CLI surface.
