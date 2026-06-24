# Local Brain Runbook — Local Model Readiness (V1: DISABLED)

> STATUS: **MOCK / SANDBOX**. Local model providers are first-class in the Brain
> from day one, but every one is **hard-disabled in V1**. Nothing in this layer
> performs network IO. This document explains the design and the exact, gated
> steps to enable real local model egress **later** — not now.

## Why this exists

The Brain should be able to run on **local / self-hosted models** (developer
laptops, on-prem GPU boxes, air-gapped pilots) without a code rewrite when that
day comes. So the provider **descriptors exist now** and carry the full #206
`ModelDescriptor` contract, but they cannot execute: each is built via
`createDisabledProvider`, so `generate()` always throws `ProviderDisabledError`,
and there are no fetch / HTTP / socket / vendor-SDK imports anywhere under
`brain/` (the `brainSourceScan.test.ts` guard enforces this).

This keeps V1 safe (no real model/API calls, no egress) while guaranteeing local
models are a deliberate flip — not a future re-architecture.

## What ships in V1

Local descriptors are expressed in the **canonical #206 vocabulary** — there is
no parallel local provider contract. Each is a `ModelDescriptor`
(`location: 'local'`, `mode: 'local_disabled'`, `privacyTier: 'on_device'`,
`enabled: false`) registered in `createDefaultModelRegistry()` and exported from
the brain barrel.

| File                                                                            | Role                                                                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/agents/src/brain/providers/localProvider.disabled.ts`                 | Generic local OpenAI-compatible descriptor (`local` / `local-openai-compatible`). Disabled.         |
| `packages/agents/src/brain/providers/ollamaProvider.disabled.ts`                | Descriptor for a local **Ollama** endpoint (`ollama` / `llama-3.1-8b-local`). Disabled.             |
| `packages/agents/src/brain/providers/openAiCompatibleLocalProvider.disabled.ts` | Descriptor for a local **OpenAI-compatible** endpoint — **vLLM / LM Studio / llama.cpp**. Disabled. |

### Provider config (NAMES only — values are never read or logged)

The descriptors export the env var **NAMES** they would read once enabled. In V1
nothing reads them; there is no `process.env` access under `brain/` (the source
scan forbids it). A later lane reads the ambient env from **outside** `brain/`
(the CLI / server boundary) and passes it in.

| Provider                                 | Env vars (NAMES only)                         |
| ---------------------------------------- | --------------------------------------------- |
| Ollama (`ollama`)                        | `OLLAMA_BASE_URL`, `OLLAMA_MODEL`             |
| OpenAI-compatible local (`local-openai`) | `LOCAL_OPENAI_BASE_URL`, `LOCAL_OPENAI_MODEL` |

A local OpenAI-compatible server usually needs **no API key**; none is required,
and no key value is ever read here.

## Selection vs execution

Registering a local descriptor makes it **selectable** by policy (a `localOnly`
workspace can prefer it), but **execution still fails closed** in V1: the model
is `enabled: false`, so the router rejects it (`provider_disabled`), and even if
it were enabled the V1 mock-only runtime invariant blocks any non-mock provider
(`v1_mock_only`). Selection is not execution.

## Enabling real local egress (LATER — gated)

This is a deliberate, out-of-band action, not a V1 capability. Per local
provider, in order:

1. Implement `generate()` against the local endpoint's OpenAI-compatible HTTP API
   using the built-in `fetch` (no vendor SDK), reading config from the injected
   env at the CLI/server boundary — never inside `brain/`.
2. Flip `enabled: true` and set `mode` to `local_ready` on the descriptor.
3. Lift the V1 mock-only invariant for that provider behind the **`controlled_live`
   release gate** (founder + counsel sign-off — see
   `docs/architecture/cognitia-brain-harness.md` §9).
4. Add live-egress tests behind the same gate, and ensure prompts/outputs are
   **hashed** into the usage ledger — never stored raw.

Until all four are done and gated, local models remain registered metadata that
cannot execute.
