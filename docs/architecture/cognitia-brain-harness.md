# Cognitia Brain Harness — V1 Architecture

> **Status: MOCK-SAFE / V1.** The brain harness routes a task to a model under
> policy. In V1 the **only enabled provider is an in-process mock**. There are
> **no real provider calls, no API keys, no vendor SDK imports, and no raw PII**
> anywhere in the harness. Real providers are scaffolded but disabled and ship
> ready to be enabled later.

## Why this exists

Cognitia agents need a **model-agnostic brain**: the ability to send a task to
the right LLM provider/model based on capability, cost, latency, privacy and
workspace policy — instead of hard-wiring a single vendor. V1 lands the routing,
policy, registry, ledger and eval scaffolding behind a mock provider, so routing
behaviour can be developed, tested and demoed safely now, and real models can be
plugged in later when keys/infra and approvals exist.

## Module map

All code is self-contained under `packages/agents/src/brain/` and imports **only**
`node:crypto` plus its own relative files (no `@cognitia/*` dependency), so it is
portable and its compiled output is runnable by the CLI.

| File                         | Responsibility                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `taskRegistry.ts`            | Task taxonomy: required capabilities, privacy, latency tier, risk, approval, cost ceiling.                             |
| `brainPolicy.ts`             | `PROVIDER_REGISTRY` (model registry) + fail-closed policy engine + workspace policy + `explainWorkspacePolicy`.        |
| `providers/brainProvider.ts` | Provider boundary contracts (`BrainProvider`, `BrainRequest/Response`, `ProviderDescriptor`, `ProviderDisabledError`). |
| `providers/mockProvider.ts`  | The only **enabled** provider — deterministic, offline, zero-cost.                                                     |
| `providers/*.disabled.ts`    | OpenRouter, Ollama, OpenAI, Anthropic, DeepSeek, xAI, CLI — all **disabled** (`generate()` throws).                    |
| `brainRunLedger.ts`          | Append-only run ledger; stores **hashes only**; refuses entries containing raw PII.                                    |
| `brainRouter.ts`             | Orchestrator: candidate chain → policy → execute first cleared+enabled provider → ledger.                              |
| `brainEvalHarness.ts`        | Deterministic routing/regression suites (e.g. `gtm-routing-v1`).                                                       |
| `brainRouter.test.ts`        | The V1 safety-invariant tests.                                                                                         |

## Routing & policy flow

```
route(task, workspacePolicy, input)
  → resolve task in TASK_REGISTRY        (unknown ⇒ blocked, fail closed)
  → build candidate chain                (preferred → fallbackChain → mock)
  → for each candidate (provider, model):
        evaluateBrainPolicy(...)         (ordered, fail-closed checks below)
          1. provider enabled?           (V1: only mock)
          2. mode vs locality            (local-only blocks external; mock blocks local/external)
          3. workspace allow/block lists
          4. capability match            (model offers every required capability)
          5. cost ceiling                (min(task, workspace) ceiling)
          6. latency tier                (model meets stricter of task/workspace)
          7. privacy ceiling             (task data ≤ model & workspace max)
          8. high-risk human approval    (terminal — never silently falls back)
        allowed ⇒ provider.generate(...) ⇒ record ledger ⇒ return
        blocked ⇒ try next candidate (fallbackUsed = true)
  → write exactly ONE ledger record per call (including blocked/approval outcomes)
```

A disabled provider can never execute: even if one were wired into the executable
set, its `generate()` throws `ProviderDisabledError` and the router advances the
chain.

## Run ledger schema

Every routing decision writes one immutable `BrainRunRecord`:

| Field                                                  | Notes                                                 |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `workspaceId`, `taskType`, `provider`, `model`, `mode` | routing context                                       |
| `inputHash`, `outputHash`                              | **sha256 only** — never the raw prompt/output         |
| `costEstimate`, `latencyMs`                            | 0 for mock/local/blocked                              |
| `fallbackUsed`, `policyDecision`                       | which candidate served & terminal decision code       |
| `proofRef`                                             | `brain-proof:<sha256 of the canonical routing facts>` |

The ledger never stores the raw prompt or raw model output, and `record()` runs a
PII tripwire (`assertLedgerNoRawPii`) that **refuses** any entry containing a raw
email or phone shape.

## CLI (mock-safe)

`pnpm brain` compiles the self-contained brain subtree
(`tsc -p packages/agents/tsconfig.brain.json` → `packages/agents/dist/brain`, which
is git-ignored) and runs `scripts/brain.mjs`. Nothing here can make a real call.

```bash
pnpm brain models:list
pnpm brain providers:test --provider mock
pnpm brain providers:test --provider ollama        # reports DISABLED in V1
pnpm brain run --task prospect.research --workspace budget_wheels_demo --provider mock
pnpm brain eval --suite gtm-routing-v1
pnpm brain policy:explain --workspace budget_wheels_demo
```

## Environment variables (names only — never commit values)

These are the variable **names** a future real implementation would read. V1
reads only their presence (a boolean) for readiness reporting; it never reads or
logs the value. **Do not commit secrets.**

| Provider       | Env var              |
| -------------- | -------------------- |
| OpenRouter     | `OPENROUTER_API_KEY` |
| OpenAI         | `OPENAI_API_KEY`     |
| Anthropic      | `ANTHROPIC_API_KEY`  |
| DeepSeek       | `DEEPSEEK_API_KEY`   |
| xAI / Grok     | `XAI_API_KEY`        |
| Ollama / local | `OLLAMA_BASE_URL`    |

## How to enable OpenRouter later

1. Rename `providers/openRouterProvider.disabled.ts` → `openRouterProvider.ts`.
2. Implement `generate()` using `fetch` against `https://openrouter.ai/api/v1`,
   reading `process.env.OPENROUTER_API_KEY` (no SDK needed). Map the request to
   the chat-completions payload; return a `BrainResponse` with real token counts,
   `costEstimateUsd`, and measured `latencyMs`.
3. In `brainPolicy.ts`, set `PROVIDER_REGISTRY.openrouter.enabled = true` (and
   adjust its models/cost as needed).
4. Register the provider instance in the router's `providers` map.
5. Opt a workspace in: `mode: 'external-api'`, `allowExternal: true`, and add
   `'openrouter'` to its `fallbackChain`/`allowedProviders`.
6. Add an eval suite that compares OpenRouter vs mock on golden tasks before
   relying on it.

## How to enable Ollama / local later

1. Rename `providers/ollamaProvider.disabled.ts` → `ollamaProvider.ts`.
2. Implement `generate()` using `fetch` against `${OLLAMA_BASE_URL}/api/generate`
   (default `http://localhost:11434`). No API key; it is a **local** provider, so
   it keeps data on-box and may serve `restricted` data.
3. Set `PROVIDER_REGISTRY.ollama.enabled = true` and register the instance.
4. Opt a workspace in with `mode: 'local-only'` and add `'ollama'` to its
   `fallbackChain`. Local-only mode keeps external providers blocked.

(The CLI runner — `cliProvider.disabled.ts` — follows the same pattern but spawns
an explicitly allow-listed **local** binary via `node:child_process`. It must
never invoke a hosted/web assistant or browser automation.)

## Hard-rule guarantees (V1)

- **No live outreach** — the brain never sends; `outreach.draft` is high-risk and
  requires human approval even to draft.
- **No real API call / no vendor SDK** — only the mock executes; every other
  provider throws. No vendor SDK is imported anywhere.
- **No ChatGPT web automation / no Claude Code harness usage** — the CLI provider
  is disabled and, when enabled, is restricted to local allow-listed binaries.
- **No raw PII** — the ledger stores sha256 hashes only and refuses raw PII.
- **No secrets** — only env var _names_ appear, in code (readiness booleans) and
  in this doc.

## Readiness

V1 is a **trustworthy routing skeleton**, not a production model gateway. Routing,
policy, registry, ledger, eval and CLI are real and tested; all real providers are
disabled and their `generate()` bodies are unimplemented. See the enablement
runbooks above to take a provider live.
