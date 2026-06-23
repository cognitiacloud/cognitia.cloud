# Cognitia Brain Harness (V1)

> Status: living document. The harness is **mock-safe**: V1 makes **no real
> provider calls**. Update this doc (and the dependent tests) before changing any
> contract here. See [`docs/architecture.md`](../architecture.md) for the system
> boundary this sits inside.

## 1. Why this exists

Cognitia's agents must run through a **governed model router** instead of
hardcoding one LLM. The harness makes the "brain" model-agnostic so the platform
can adopt OpenAI, Anthropic, DeepSeek, xAI (Grok), OpenRouter, and **local**
models (Ollama / vLLM / LM Studio) without rewriting agent logic — while keeping
every routing decision policy-gated, privacy-safe, and auditable.

**V1 scope:** the deterministic mock provider is the only executable model. Every
external/local provider is registered as **metadata only** and fails closed. No
network, no vendor SDK, no secrets.

Module: `@cognitia/agents` → `packages/agents/src/brain/` (re-exported from the
package barrel).

## 2. Components

| File                        | Role                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| `modelProvider.ts`          | Provider contract + capability / tier vocabulary                         |
| `modelRegistry.ts`          | Registry of providers; `createDefaultModelRegistry()`                    |
| `modelPolicy.ts`            | `WorkspaceModelPolicy` + fail-closed `evaluateModelPolicy`               |
| `taskRegistry.ts`           | `taskType` → required capabilities, risk tier, data class                |
| `modelRouter.ts`            | `ModelRouter.route()` — the governed entry point                         |
| `modelUsageLedger.ts`       | `UsageReceipt` + in-memory append-only ledger                            |
| `providers/mockProvider.ts` | Deterministic mock model (the only executable one)                       |
| `providers/*.disabled.ts`   | local / OpenRouter / OpenAI / Anthropic / DeepSeek / xAI — metadata only |
| `brainApi.ts`               | Programmatic surface behind the documented CLI + eval suite              |

## 3. Provider contract (`ModelProvider`)

Each provider exposes a `ModelDescriptor`:

- `providerId`, `modelId`
- `capabilities` (`text`, `reasoning`, `code`, `tool_call`, `structured_output`,
  `vision`, `long_context`)
- `contextWindow`
- `mode` — `mock` | `external_disabled` | `local_disabled` | `local_ready`
- `location` — `local` | `external`
- `costPer1kTokensUsd` (blended estimate)
- `latencyTier` — `fast` | `standard` | `slow`
- `privacyTier` — `public` | `private` | `on_device`
- `toolCallSupport`, `structuredOutputSupport`
- `enabled` — only enabled providers may execute

`generate(request)` is required. `stream()` is intentionally **out of scope for
V1** (reserved for a later, still-governed iteration).

## 4. Router decision order

`ModelRouter.route(input)` evaluates, in order, and **fails closed**:

1. **Task resolution (fail-closed)** — `taskRegistry.get(taskType)`. Unknown task
   types are **blocked** (`blockedReason: unknown_task_type`); there is no
   permissive default that maps an unknown task to low-risk/internal.
2. **High-risk approval gate (mandatory)** — if the task is `riskTier: 'high'` the
   call is blocked unless `approvalGranted` is set
   (`blockedReason: high_risk_requires_approval`). This is unconditional in V1:
   there is no policy field to waive it.
3. **Candidate ordering** — `preferredModel`, then `fallbackChain`, then (if
   neither given) the policy-allowed enabled models in registration order.
4. **Per-candidate checks** — registered → enabled → **capability match**
   (task + request-implied `tool_call`/`structured_output`) → **policy**
   (`evaluateModelPolicy`) → **V1 mock-only invariant**. The mock-only gate is the
   last check: any candidate that is not the `mock` provider in `mock` mode is
   rejected (`blockedReason: v1_mock_only`), independent of policy and registry
   contents — so even an injected, `enabled`, policy-allowed non-mock provider can
   never be selected or executed. A defensive re-check in `execute()` re-asserts
   the same invariant immediately before `generate()`.
5. **Selection** — the first eligible candidate serves the task; `fallbackUsed` is
   true when it wasn't the first candidate tried. Disabled/blocked candidates are
   skipped.
6. **Receipt** — a privacy-safe `UsageReceipt` is appended for every outcome
   (allow or block).

### Policy checks (`evaluateModelPolicy`)

`provider_not_allowed` · `model_not_allowed` · `local_only_policy` ·
`cost_ceiling_exceeded` · `latency_tier_exceeded` ·
`data_classification_not_allowed` · `data_classification_requires_higher_privacy`.

Data classification ↔ privacy: `confidential` requires a `private`+ provider;
`restricted` requires `on_device`. The mock provider is `on_device`, so it can
serve any classification locally.

## 5. Usage receipt (proof, privacy-safe)

`UsageReceipt` records **only** these fields — never the raw prompt or output:

`workspaceId`, `taskType`, `provider`, `model`, `mode`, `inputHash` (SHA-256),
`outputHash` (SHA-256 or `null` when blocked), `costEstimate`, `latencyMs`,
`fallbackUsed`, `policyDecision` (`allow` | `blocked`), `blockedReason`,
`createdAt`.

`makeUsageReceipt` hashes the input/output and runs `assertNoRawPii`
(`crm-lite/timeline.ts`) over every free-form string field, so raw PII can never
enter a receipt. V1 stores receipts in memory; persisting them through the
side-effect `ActionLedger` (`repo.insertAuditEvent`) is **PLANNED**.

## 6. CLI surface (documented; programmatic-backed)

The repo has **no TypeScript script runner** (no `tsx` / `ts-node` / `vite-node`)
and the only script pattern (`scripts/dev/*.mjs` via `node`) cannot import the
raw-TS workspace packages. So V1 ships the CLI as **pure, testable functions**
(`brainApi.ts`) rather than a non-functional shell stub. A future thin CLI (once a
TS runner lands) maps 1:1:

| Command                                              | Function                 |
| ---------------------------------------------------- | ------------------------ |
| `brain models:list`                                  | `listModels()`           |
| `brain run --task prospect.research --provider mock` | `runTask()`              |
| `brain eval --suite model-router`                    | `evalModelRouterSuite()` |
| `brain providers:test --provider ollama`             | `testProvider()`         |

## 7. Local-model readiness

Local models are designed around a **local OpenAI-compatible endpoint** (Ollama,
vLLM, LM Studio). The local provider is `local_disabled` in V1 and carries the
`on_device` privacy tier (safe for `restricted` data). No endpoint URL or network
code exists in the source — it is enabled out-of-band only (Section 9).

## 8. Environment placeholders (documented only — never read in V1)

These names are **documentation placeholders**. No V1 code reads them, and tests
read no real secret:

```
OLLAMA_BASE_URL       # local OpenAI-compatible endpoint (Ollama / vLLM / LM Studio)
OPENROUTER_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
DEEPSEEK_API_KEY
XAI_API_KEY
```

## 9. Enabling a real provider later (out of scope for V1)

For each `providers/*.disabled.ts`, real wiring is **PLANNED** and must:

1. Implement `generate()` against the provider's **OpenAI-compatible** HTTP API
   using the built-in `fetch` (no vendor SDK), reading its key/endpoint from the
   env placeholder **behind explicit per-workspace configuration**.
2. Flip the descriptor `enabled: true` and set `mode` (`local_ready` for local).
3. Add live-egress integration tests **behind a release gate**
   (`security/releaseGate.ts`) — `controlled_live` requires founder + counsel
   sign-off, not a code toggle.
4. Keep the source-scan test green by confining all network code to the enabled
   provider module and updating that test's allow-list deliberately.

Until all of the above land, `generate()` throws `ProviderDisabledError` and the
router never selects a disabled provider.

### 9.1 Future model-egress gate (separate from the public path)

Enabling real model egress is a **separate concern** from the public/programmatic
surface, which is locked to mock-only:

- The default public path (`brainApi.runTask`, `createDefaultModelRegistry`) runs
  only the deterministic `mock` provider.
- Callers may inject a custom registry, but **programmatic/CLI injection cannot
  enable real providers**: the router's V1 mock-only runtime invariant blocks any
  non-`mock` candidate (`v1_mock_only`) and never calls its `generate()`.
- Real egress must therefore be introduced **deliberately**, behind the
  `controlled_live` release gate (`security/releaseGate.ts`, founder + counsel
  sign-off) together with the per-provider steps above — never by flipping a
  caller-supplied flag or injecting an `enabled` descriptor.

## 10. Guarantees (enforced by tests)

- Mock provider is **deterministic** (same input → same output + hashes).
- Fallback skips disabled/blocked models.
- Disallowed model, cost ceiling, local-only, and capability mismatch all
  **block**.
- **Unknown task types fail closed** (`unknown_task_type`) — no permissive default.
- **High-risk approval is mandatory** — high-risk tasks block without
  `approvalGranted`, with no policy opt-out.
- **V1 mock-only runtime invariant** — only the `mock` provider in `mock` mode can
  execute; an injected `enabled` non-mock provider is blocked (`v1_mock_only`) and
  its `generate()` is never called.
- Receipts store **no raw prompt** and **no raw PII** (SHA-256 hashes only).
- Disabled providers **cannot execute**.
- **No `fetch` / network builtin / vendor-SDK import, and no secret/env read**
  anywhere under `brain/` (`brainSourceScan.test.ts`).
