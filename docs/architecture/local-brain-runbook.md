# Local Brain Runbook — Local Model Readiness (V1: DISABLED)

> STATUS: **MOCK / SANDBOX**. Local model providers are first-class in the Brain
> from day one, but every one of them is **hard-disabled in V1**. Nothing in this
> layer performs network IO. This document explains the design and the exact,
> gated steps to enable real local model egress **later** — not now.

## Why this exists

The Brain should be able to run on **local / self-hosted models** (developer
laptops, on-prem GPU boxes, air-gapped pilots) without any code rewrite when that
day comes. So the provider **descriptors exist now** and carry the full contract,
but they cannot execute: `generate()` always throws `ProviderDisabledError`, and
there are no fetch / HTTP / socket / vendor-SDK imports anywhere in the layer.

This keeps V1 safe (no real model/API calls, no egress) while guaranteeing local
models are a deliberate flip — not a future re-architecture.

## What ships in V1

| File                                                                    | Role                                                                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/agents/src/brain/providers/localProviderContract.ts`          | Shared contract: `LocalBrainProviderDescriptor`, `ReadinessStatus`, `ProviderDisabledError`, `readinessFor()`, `selectProviders()` + `BrainSelectionPolicy`. |
| `packages/agents/src/brain/providers/ollamaProvider.disabled.ts`        | Descriptor for a local **Ollama** endpoint. Disabled.                                                                                                        |
| `packages/agents/src/brain/providers/openAiCompatibleLocal.disabled.ts` | Descriptor for a local **OpenAI-compatible** endpoint covering **vLLM / LM Studio / llama.cpp server**. Disabled.                                            |

The `.disabled.ts` suffix marks these as non-runtime in V1. They are intentionally
**not exported** from the package index; a later integration lane wires them in on
purpose.

### Provider config (NAMES only — values are never read or logged)

| Provider                                            | Env vars (presence-checked only)              |
| --------------------------------------------------- | --------------------------------------------- |
| Ollama (`ollama-local`)                             | `OLLAMA_BASE_URL`, `OLLAMA_MODEL`             |
| OpenAI-compatible local (`openai-compatible-local`) | `LOCAL_OPENAI_BASE_URL`, `LOCAL_OPENAI_MODEL` |

A local OpenAI-compatible server usually needs **no API key**; none is required
for readiness, and no key value is ever read here.

## Readiness helper — config status only

`readinessFor(enabled, requiredEnvVars, env)` returns a `ReadinessStatus`:

```ts
{ enabled: boolean; configured: boolean; ready: boolean; missing: readonly string[] }
```

- It checks env var **presence** (non-empty string) and nothing else.
- It never reads, returns, or logs an env var **value**.
- It never probes the network (no reachability ping).
- `ready === enabled && configured`. In V1 `enabled` is `false`, so `ready` is
  always `false` even when fully configured.

## Selection policy — `localOnly`

`selectProviders(policy, descriptors)` supports `'localOnly' | 'preferLocal' | 'default'`.
Under `localOnly` only `local === true` providers are returned. Selection is
**independent of `enabled`** so a future local-only deployment can _choose_ a
local provider today — but **executing** it still throws `ProviderDisabledError`
in V1. Selection is not execution.

## Local readiness score

The score tracks how much of the local-readiness surface is **built**, separate
from whether it is **runtime-enabled** (which is 0 by design in V1).

| Dimension                                                         | Built? |
| ----------------------------------------------------------------- | ------ |
| Ollama descriptor                                                 | ✅     |
| OpenAI-compatible local descriptor (vLLM / LM Studio / llama.cpp) | ✅     |
| Readiness helper (config status only, no value leak, no network)  | ✅     |
| `ProviderDisabledError` enforced on `generate()`                  | ✅     |
| `localOnly` selection policy                                      | ✅     |
| Source-scan proof: no fetch / network / HTTP / vendor SDK         | ✅     |
| Runbook + future enablement steps                                 | ✅     |

**Build readiness: 7 / 7.**
**Runtime egress enabled: 0 / 2 providers — intentionally disabled in V1.**

## Future enablement — behind the model egress release gate

Real local model egress is gated by a dedicated **model egress release gate**
(`controlled_model_egress`). This is **separate from live outreach** (email / SMS
/ calls / ads), which stays blocked independently: enabling local inference does
**not** enable any outbound contact. Enablement layers on the existing release-gate
primitive in `packages/agents/src/security/releaseGate.ts` and is a deliberate
later-lane change, never a config toggle in V1.

Exact steps, in order:

1. **Pass the model egress release gate.** Add a `controlled_model_egress` stage
   (fail-closed) requiring: founder signoff, security review of the egress path,
   monitoring enabled, and a tested rollback. Do not reuse the live-outreach
   `controlled_live` stage — model egress is a distinct gate.
2. **Add an isolated runtime adapter** in a **new** module (e.g.
   `brain/providers/runtime/`), NOT in these descriptor files. The adapter owns
   all network IO and the only fetch/HTTP code in the Brain. The `.disabled.ts`
   descriptors and their source-scan guard stay clean.
3. **Flip `enabled` to `true`** for a provider only once its adapter and gate are
   in place. Keep the kill switch flippable per provider.
4. **Wire ledger hashing.** Before any prompt is sent or output stored, **hash**
   prompt and output into the action ledger. No raw prompt/output/PII is ever
   stored. (See the ledger under `packages/agents/src/ledger/`.)
5. **Keep readiness value-safe.** The adapter may read env var values at call
   time, but readiness reporting and logs must still expose names/booleans only —
   never key or endpoint values.
6. **Export from the package index** as part of the integration lane, replacing
   the `.disabled.ts` files with runtime-enabled modules under the gate.

Until every step above lands with sign-off, local model calls remain disabled and
`generate()` throws.

## Verification

`pnpm check` (format + typecheck + vitest) is the source of truth. The suite
`localProviders.disabled.test.ts` proves: providers cannot execute, readiness
never leaks values, `localOnly` selection blocks execution in V1, and a
source-scan confirms no network / vendor-SDK imports.
