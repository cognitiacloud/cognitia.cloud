# WORKER OWNERSHIP MAP — file-ownership for when build resumes

**Compiled:** 2026-06-21 · companion to `BOARD.md`. **Status: PARKED MAP — no build workers are launched from this board.** The first wave is review + reconciliation only (BOARD §7). This map exists so that *when an authorized build session starts*, parallel workers have **non-overlapping file ownership** and cannot collide on the merged spine.

> Using this map = a future, explicitly-authorized decision. Nothing here instructs anyone to start building now.

## Ownership principle

- The **merged spine is read-only to all workers** (`packages/core/src/gtm/**`, `packages/core/src/schemas/closer.ts`, `packages/db/**`, migrations `0020`/`0021`, `apps/web/src/lib/complianceTypes.ts`). Extend via **new files**; do not rewrite landed contracts.
- One worker owns a path prefix; **no two workers write the same file.** Cross-cutting changes route through the controller.
- Every worker runs the full guard/doctrine test suite before handing back (PII, source-risk, evidence, Phase-1 containment).

## Lane → owner → file boundary (proposed, parked)

| Lane | Owner (parked) | Writes ONLY under | Must NOT touch | Gated by |
| --- | --- | --- | --- | --- |
| **W0 Controller** | this board | `docs/execution/**` | any code | — (active now) |
| **W1 Closer persistence** | parked | new files in `packages/db/**` (new repo methods/migrations ≥0022) | existing `0020`/`0021`, `closer.ts` contracts | review-gate clear |
| **W2 GTM schemas (zod)** | parked | `packages/core/src/schemas/gtm.ts` (new) | `types/index.ts` unions, `gtm/` helpers | #97 read-through |
| **W3 Compliance/runtime** | parked | `apps/api/src/compliance*` (new) | `complianceTypes.ts`, core | #92 sign-off owner named |
| **W4 Web surfaces** | parked | `apps/web/src/app/(closer)/**` (new routes) | shared `lib/complianceTypes.ts` | design ratified |
| **W5 Client Zero proof** | parked | `apps/web` Auto-Growth-OS demo route (#106 lane) | finance/trade-in autonomy (handoff only) | #106 guardrail review + consent confirmed |
| **W6 Goal-loop harness** | parked | `harness/**`, `goals/**` (#105 lane) | app/packages prod code | sandbox boundary review |
| **W7 Apify Phase-2** | parked | `packages/integrations/apify/**` (sim only) | network/`ApifyClient` in prod paths | #99 retargeted + legal sign-off |

## Hard collision rules

1. **No worker edits another worker's prefix.** Shared-file needs → controller mediates a single change.
2. **Spine contracts are append-only.** Need a different shape? New file + adapter, never a rewrite of landed schemas/migrations.
3. **Parked lanes (economy/crypto/token) get no worker** regardless of demand (see DECISIONS §3–4).
4. **Containment preserved:** W5/W7 stay simulated — no live vendor/network/outreach until the named legal owner signs off.
5. A worker is "done" only when the full guard-test suite passes and its diff is confined to its prefix.

## Activation order (when authorized — NOT now)

Review-gate clears (BOARD §8) → ratify canonical lanes (QUEUE §D) → name legal sign-off owner → then activate **W1 → W2 → W3 → W4** in sequence (each on green CI), with **W5/W6/W7** only after their specific gate. The controller updates this file at each activation.
