# Brain ⇆ GTM Integration Seam

## Why this exists

GTM agents need to call the Brain to do real work — research a prospect, route a
lead, draft outreach — **without hardcoding which model runs**. Models change;
the policy, approval, and audit guarantees around them must not. This seam
proves a GTM caller can name a _task_ and let the Brain Core registry resolve
the provider and model, while the existing GTM safety rails (risk policy,
human approval, proof ledger, PII redaction, no-egress attestation) stay in
force.

It is a thin **adapter over the Brain Core Contracts** (PR #202,
`packages/agents/src/brain/`). It introduces **no new provider or router
contract** — routing is the `ModelRegistry`'s job, generation is the
`BrainProvider`'s job. The adapter only maps GTM tasks onto those contracts and
applies GTM policy.

## What it reuses

| Concern             | Reused from                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Provider contract   | `BrainProvider` / `BrainRequest` / `BrainResponse` (`brain/modelProvider.ts`)                  |
| Routing (registry)  | `ModelRegistry` / `createDefaultBrainRegistry` (`brain/modelRegistry.ts`)                      |
| Mock execution      | `MockBrainProvider` (`brain/providers/mockProvider.ts`) — only enabled provider in V1          |
| Risk + approval     | `PolicyGate` / `classifyRisk` / `decideApproval` (`@cognitia/core`)                            |
| Proof ledger        | `createGtmProofEvent` / `GtmProofEvent` (`@cognitia/core`)                                     |
| PII + egress safety | `assertNoRawPii` / `assertNoLiveEgress` / `proofCarriesNoRawPii` (`gtm-os/assembly/guards.ts`) |
| Hashing             | `contentFingerprint` (sha256, `@cognitia/core`)                                                |

## Tasks and their policy

| Task                | Action type (for risk) | Risk | Approval                         | Preferred provider                            |
| ------------------- | ---------------------- | ---- | -------------------------------- | --------------------------------------------- |
| `prospect.research` | `crm.note.create`      | low  | required, easily granted         | `mock`                                        |
| `gtm.routing`       | `crm.task.create`      | low  | required, easily granted         | `mock`                                        |
| `outreach.draft`    | `email.draft.send`     | high | **required — blocks without it** | `anthropic` (disabled → falls back to `mock`) |

`outreach.draft` is the high-risk path: without operator approval the seam
**blocks before any provider call** and emits a `gtm.outreach.review_required.v1`
proof event. There is no autonomous outreach.

## Model-agnostic routing

`resolveBrainRoute(registry, preferredProviderId)` reads provider descriptors
only — it never calls `generate`. It tries the preferred provider; if that
provider is unknown or disabled, it falls back to the first enabled provider and
sets `fallbackUsed: true`. The `model` is taken from the resolved provider's
descriptor, so **the GTM caller never names a model**. In V1 only the mock is
enabled, so `outreach.draft` (which prefers the disabled `anthropic`) always
falls back to `mock` with `fallbackUsed: true`.

Disabled providers can never execute: `ModelRegistry.getEnabled` throws
`ProviderDisabledError` for them, and the seam only ever calls `generate` on the
provider returned by `getEnabled`.

## Flow

```
runGtmBrainTask({ task, promptText, approval? })
  → resolveBrainRoute(registry, preferred)        // pure; picks provider + model
  → decideBrainPolicy(task)                        // classifyRisk + decideApproval
  → gated = blocked || (requiresApproval && !approval)
      gated   → emit review proof, executed:false  // provider.generate NOT called
      allowed → provider.generate(...)             // mock only
              → outputHash = contentFingerprint(content)
              → emit completion proof
  → assertNoLiveEgress('mock') + assertNoRawPii(result)
```

## Result shape

Every call returns the lane-required fields plus hashes and the attestation:

```ts
{
  task, executed, blocked,
  policyDecision: { riskLevel, requiresApproval, blocked, reason },
  provider, model, fallbackUsed,
  proofRef,                 // == proof.id
  proof,                    // append-only GtmProofEvent (hashes + routing only)
  promptHash,               // sha256 of the prompt — never the raw prompt
  outputHash,               // sha256 of the output, or null when blocked
  attestation: { mode: 'mock', liveSendOccurred: false, statement }
}
```

## Invariants (mock-safe V1)

- **Mock provider only.** Real providers are scaffolded but disabled and throw
  `ProviderDisabledError`; the seam never reaches them.
- **No live egress.** No network, no vendor SDK, no live email/SMS/call/CRM
  sync. Enforced in code by `assertNoLiveEgress` and in CI by the
  `brainSourceScan.test.ts` source scan (which recurses `brain/`).
- **No raw PII at rest.** Prompts/outputs are reduced to sha256 hashes; the
  result and proof event are checked by `assertNoRawPii` / `proofCarriesNoRawPii`.
- **High-risk requires human approval.** `outreach.draft` cannot execute without
  approval and never invokes the provider when blocked.

## Tests

`gtmBrainAdapter.test.ts` covers: approved low-risk executes the mock;
high-risk without approval blocks and the provider's `generate` is never called
(asserted with a throwing spy); high-risk with approval executes; hashes only /
no raw PII in result or proof; `proofRef` present on both paths; no-egress
attestation on every result; and `fallbackUsed` true (preferred disabled) vs
false (preferred enabled).
