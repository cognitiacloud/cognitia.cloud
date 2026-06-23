# Cognitia Brain Evals

The **brain** is Cognitia's model-routing decision layer. Given a generation
request, it decides **which provider (if any)** the request should be routed to,
subject to policy, human-approval, data-residency, cost, and provider-availability
constraints. The brain holds no credentials and, in V1, performs **no live model
calls** — the only generation path is an in-process deterministic mock.

This document describes the **Brain Eval Harness**: the deterministic eval suite
that pins the routing decision logic so regressions are caught in CI.

- Engine + harness: `packages/agents/src/brain/brainEvalHarness.ts`
- Tests: `packages/agents/src/brain/brainEvalHarness.test.ts`

## Why evals

The routing decision is the single chokepoint that keeps the brain mock-safe and
policy-compliant. A silent regression here (e.g. routing a high-risk send before
approval, or ignoring a cost ceiling) is exactly the class of bug that does not
surface in a demo but matters in production. The harness encodes each routing
outcome as a deterministic scenario with a declared expectation, so the decision
logic is verified on every `pnpm check`.

## Mock-safe invariants

The harness enforces, in code:

1. **No real model/API calls.** The only provider ever _invoked_ is the
   in-process deterministic mock (`invokeMockProvider`). Invoking a non-mock
   provider throws — there is no live path in V1.
2. **No network / vendor SDKs.** The module imports only `@cognitia/core` (pure
   helpers/types) and `node:crypto` (hashing). No `fetch`, no vendor SDKs.
3. **No raw PII / no raw prompts in output.** Prompts and model outputs are
   referenced only by `sha256` hash (ledger-style). The assembled suite result is
   asserted PII-free (`assertNoRawPiiInEvalOutput`) before it is returned.

## The decision engine

`routeBrainRequest(request, config)` is **pure and deterministic**: same input ⇒
same decision, no IO. It evaluates gates in a fixed precedence order and returns a
single terminal `outcome`:

| #   | Gate                                     | Outcome                     |
| --- | ---------------------------------------- | --------------------------- |
| 1   | Requested provider disabled/unknown      | `blocked_disabled_provider` |
| 2   | Policy hard block (suppressed/opted-out) | `blocked_policy`            |
| 3   | Risk requires approval, not approved     | `needs_approval`            |
| 4   | Local-only required, no local provider   | `blocked_local_only`        |
| 5   | No eligible provider at all              | `blocked_disabled_provider` |
| 6   | Estimated cost over ceiling              | `blocked_cost_ceiling`      |
| 7   | Otherwise route                          | `routed` / `fallback`       |

Risk classification and approval reuse the shared policy gate
(`classifyRisk` / `decideApproval` from `@cognitia/core`), so the brain cannot
drift from the rest of the platform's approval semantics. A `fallback` is a
successful route where a more-preferred provider was skipped (disabled).

The decision carries `promptHash` and (when routed) `outputHash` — sha256
references only, never raw text — mirroring how prompts/outputs are recorded in
ledgers.

## The `gtm-routing-v1` suite

`runBrainEvalSuite()` runs the canonical scenarios (`GTM_ROUTING_V1_SCENARIOS`)
and returns `{ suite, total, passed, failed, results[] }`. Each scenario pins
exactly one routing outcome:

| Scenario                      | What it proves                                             |
| ----------------------------- | ---------------------------------------------------------- |
| `routing-to-mock`             | An approved, in-budget request routes to the mock provider |
| `fallback`                    | A disabled preferred provider falls back to the next mock  |
| `policy-block`                | A suppressed/opted-out target is hard-blocked              |
| `high-risk-approval-required` | A high-risk send with no approval is held, not routed      |
| `local-only-block`            | A local-only tenant with only a remote provider is blocked |
| `cost-ceiling-block`          | A request over the cost ceiling is blocked                 |
| `disabled-provider-block`     | Explicitly requesting a disabled provider is blocked       |

A caller may pass its own scenarios: `runBrainEvalSuite(scenarios, suiteName)`.

## Running

```bash
# Full gate (format + typecheck + tests)
pnpm check

# Just the brain evals
pnpm exec vitest run packages/agents/src/brain/brainEvalHarness.test.ts
```

## Example output

`runBrainEvalSuite()` on the canonical suite (hashes truncated for readability):

```json
{
  "suite": "gtm-routing-v1",
  "total": 7,
  "passed": 7,
  "failed": 0,
  "results": [
    {
      "scenario": "routing-to-mock",
      "passed": true,
      "expected": { "outcome": "routed", "provider": "mock-primary", "fallbackUsed": false },
      "actual": {
        "outcome": "routed",
        "provider": "mock-primary",
        "requiresApproval": true,
        "fallbackUsed": false,
        "promptHash": "00208ab0…ca186c44",
        "outputHash": "a6bab64d…55369fd4"
      },
      "mismatches": []
    }
  ]
}
```

Every result records `promptHash`/`outputHash` as 64-char sha256 digests — there
is no raw prompt, email, or phone anywhere in the output.

## Eval discipline

- **A deliberately wrong expectation must fail.** The suite is only useful if a
  mismatch increments `failed` and records field-level `mismatches`; this is
  asserted directly in the test suite.
- **Determinism.** No clocks, no randomness, no IO. Identical input yields
  identical hashes, so eval output is diffable and CI is stable.
- **PII tripwire.** `assertNoRawPiiInEvalOutput` runs before any result is
  returned and throws on raw email/phone shapes — a regression backstop, not the
  primary defense (the primary defense is that only hashes are ever stored).

## Extending

When the brain gains a new routing gate (e.g. a per-region allowlist), add the
gate to `routeBrainRequest` in precedence order, add a scenario that pins its
outcome to `GTM_ROUTING_V1_SCENARIOS` (or a new suite id), and assert it in the
test file. Keep every scenario PII-free and mock-only.
