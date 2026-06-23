# Cognitia Brain CLI — compatibility harness (mock-safe)

> **This is not the final model-provider Brain Harness.** It is a temporary,
> mock-safe CLI over the **existing GTM modules** plus the Brain Core registry
> from PR #202. Every command calls a real module; none performs live egress.

## What it is

`scripts/brain.mjs`, wired as `pnpm brain <command>` (which runs
`tsx scripts/brain.mjs`). `tsx` is dev-only tooling that lets the script import
the workspace TypeScript directly; it is **never** imported by runtime brain
code, and no vendor/model SDK is added.

The CLI is a thin dispatcher. The real work lives in:

- `@cognitia/agents` `brain/` — `createDefaultBrainRegistry()`, `ModelRegistry`,
  `BrainProvider`, the deterministic mock provider, `ProviderDisabledError`
  (from PR #202, merged into this branch as a stacked dependency).
- `@cognitia/agents` — `createGtmServices`, `MiraAgent`, `ActionLedger`,
  `PolicyGate`.
- `@cognitia/core` — `classifyRisk`, `decideApproval`, the `actionType` schema.
- `@cognitia/db` — `InMemoryRepository`.
- `@cognitia/evals` — `runGoldenEval`, `loadRegressionDataset`.

## Honest-output contract

Every command prints a meta block so the surface never overstates what it did:

- `status`
  - `REAL` — calls a real module that fully implements the command.
  - `ALIAS` — real module, but the requested name aliases a different real
    concept (documented below).
  - `DISABLED` — the requested provider is a disabled V1 scaffold.
  - `BLOCKED` — cannot be served by a real module; nothing is faked.
- `backing` — the real module(s) invoked.
- `limitation` — plain-English limitation.

## Mock-safety invariants

- No network, no `fetch`, no vendor/model SDK imports, no real model API calls.
- No real CRM writes and no outreach (`run` uses `v1Mode` — the CRM-only fence,
  no executable email/send path).
- No API key **values** are read or logged; the registry surfaces env-var
  **names** only.
- No raw PII: prompts/outputs are referenced by hash (FNV-1a `hashBrainText`);
  the `run` command prints only ids, refs, and hashes — never raw prompt,
  contact, email, or phone. Any synthetic seed data uses `.example` domains and
  `555-01xx` numbers.
- Operates only on the `budget_wheels_demo` sandbox (Tenant Zero); any other
  `--workspace` is `BLOCKED`.

## Commands

### `pnpm brain models:list`

Lists the brain agent/model surface via `createDefaultBrainRegistry()`: the
`mock` provider is `ENABLED`; OpenAI, Anthropic, DeepSeek, xAI/Grok, OpenRouter,
Ollama, and CLI are `DISABLED` scaffolds. **status: REAL.**

Limitation: this is the brain surface, not live external models. No external
provider is enabled in V1.

### `pnpm brain providers:test --provider <id>`

- `--provider mock` → runs a deterministic probe `generate()` and prints
  `promptHash`/`outputHash`/`finishReason`/`deterministic`. **status: REAL.**
- `--provider ollama` (or any disabled scaffold) → confirms `generate()` throws
  `ProviderDisabledError` with no IO. **status: DISABLED.**
- unknown id → **status: BLOCKED** (known ids listed).

### `pnpm brain run --task prospect.research --workspace budget_wheels_demo --provider mock`

Runs the real Mira propose-only pass (`MiraAgent.run`) over a seeded
`InMemoryRepository` of synthetic, non-PII sandbox accounts/contacts, then
records the deterministic brain step via the mock provider. Prints the run id,
ranked accounts, proposed action ids with their idempotency-key proofRefs and
evidence refs, and the suppressed contact that was excluded. **status: REAL.**

Limitation / alias: `prospect.research` is a CLI alias for the real Mira pass —
there is no separate task registry in V1. Non-`mock` providers print
**DISABLED** and the run is skipped.

### `pnpm brain eval --suite gtm-routing-v1`

- `gtm-routing-v1` → runs the real `runGoldenEval()` golden suite and prints
  per-scenario rubric scores. **status: ALIAS** (no `gtm-routing-v1` dataset
  exists; it aliases the real `golden-v1` suite).
- `golden-v1` → same suite, **status: REAL.**
- `regressions-v1` → runs the regression dataset when present, else **BLOCKED.**
- unknown suite → **BLOCKED.**

Exit code is non-zero if any scenario fails.

### `pnpm brain policy:explain --workspace budget_wheels_demo`

Explains the deterministic V1 approval policy for every real `ActionType`
(`email.draft.send`, `crm.task.create`, `crm.note.create`) across
suppressed/non-suppressed targets, via `PolicyGate` + `classifyRisk` /
`decideApproval`. **status: REAL.** Read-only; no state is written.

## Known limitations

- The canonical GTM platform has no model-provider/model/task/eval-suite layer
  of its own; `models:list` and `providers:test` depend on the Brain Core
  registry from PR #202, which is stacked into this branch until #202 merges.
- `prospect.research` (task) and `gtm-routing-v1` (suite) are CLI aliases over
  real concepts; they are labelled `ALIAS` in output and here.
- Only the deterministic mock provider executes. All external providers are
  disabled scaffolds and will print/return `DISABLED` until a future lane
  enables them deliberately.
