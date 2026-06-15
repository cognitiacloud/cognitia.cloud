# Pilot Proof Harness (PILOT-001)

A local/dev simulation that exercises human and AI‑agent operation paths through
Cognitia, so the Tenant Zero / Demandara pilots can be rehearsed and proven
**without touching production**.

> **Scope guarantee.** This harness is dev/simulation only. It uses:
> no production DB, no real SMS, no real payments, no auth token, no external
> API credentials, and it performs no deploy. These properties are *structural*
> (enforced by code), not just documented — see [Guardrails](#guardrails).

---

## What it is

A small, dependency‑light TypeScript module under `apps/api/src/harness/` plus a
test suite at `apps/api/src/pilotProofHarness.test.ts`. Everything runs in‑memory
with a deterministic clock, so two identical runs produce identical Action Ledger
hashes.

| Concern | Module | Notes |
| --- | --- | --- |
| Append‑only audit trail | `actionLedger.ts` | SHA‑256 hash‑chained, tamper‑evident |
| Marketplace + work orders | `marketplace.ts` | listing → work order lifecycle |
| Escrow | `escrow.ts` | **simulated units only**, never real money |
| Proof evaluation | `proof.ts` | `verified_fact` strength is *derived*, not asserted |
| Reputation | `reputation.ts` | earned only on a verified release |
| Agent Fabric | `agentFabric.ts` | **simulated** route → simulated proof receipt |
| Public trust feed | `trustFeed.ts` | **safe‑empty** unless explicitly configured on |
| Notifications (SMS) | `notifier.ts` | **simulated** outbox only |
| Environment guards | `environment.ts` | refuses production / real channels |
| Orchestrator | `cognitiaHarness.ts` | wires scenarios together |

---

## The eight scenarios

1. **Human operator creates/approves work.** A human with the right capabilities
   creates a listing and approves work; everything lands on the Action Ledger.
2. **AI agent proposes accept/deliver through the Action Ledger.** The agent can
   only *propose* (status `proposed`); a human converts it to `executed`. The
   agent cannot self‑approve.
3. **Marketplace listing → work order → escrow reserve.** Opening a work order
   reserves a simulated escrow hold for the listing price.
4. **`verified_fact` proof → owner verify → release + reputation.** A strong
   proof releases escrow to the worker and awards reputation.
5. **Weak proof path refused.** A proof lacking a verifiable artifact (or
   independent signals, or strength) is refused. Escrow stays reserved, no
   reputation is awarded, and a `refused` entry is logged.
6. **Dispute refund/split path.** A resolver refunds the payer in full or splits
   the hold. Disputes never award reputation.
7. **Agent Fabric simulated route → simulated proof receipt → deliver.** The
   fabric returns a `simulated: true` receipt; the agent delivers and the owner
   verifies/releases.
8. **Public trust feed remains safe‑empty unless configured.** With the feed
   off (default), `feed()` returns `[]`. With it on, only sanitized summaries
   (no actor ids, no amounts) are published.

---

## How to run

```bash
pnpm install        # installs typescript + @types/node only
pnpm check          # typecheck (tsc --noEmit) + tests (node --test)
```

`pnpm check` from the repo root delegates to `@cognitia/api`:

- **Typecheck:** `tsc --noEmit` under `strict` + `erasableSyntaxOnly`.
- **Tests:** `node --test --experimental-strip-types "src/**/*.test.ts"` — uses
  Node 22's native TypeScript type‑stripping and built‑in test runner, so the
  only dev dependencies are `typescript` and `@types/node`.

Expected result: all tests pass, typecheck clean.

---

## Authorization model (human vs. AI agent)

| Capability | Human operator | AI agent |
| --- | :---: | :---: |
| `create_work` | ✅ | ❌ |
| `approve_work` | ✅ | ❌ |
| `propose_action` | ✅ | ✅ |
| `deliver_work` | ✅ | ✅ |
| `verify_proof` | ✅ | ❌ |
| `release_escrow` | ✅ | ❌ |
| `resolve_dispute` | ✅ | ❌ |

The agent is *structurally* unable to approve its own work, verify a proof, or
release escrow — attempting any of these throws `AuthorizationError`. This is the
core safety property of the human‑in‑the‑loop design.

---

## Proof strength rules (`verified_fact`)

A proof is **strong** only if all three hold:

1. There is a non‑empty verifiable `artifactRef` (hash / receipt / URL stub).
2. At least **2 independent** (externally checkable) evidence signals are present.
3. The weighted strength of present signals clears the threshold (**0.60**).

Anything else is **weak** and the owner‑verify path refuses to release escrow.

---

## Guardrails

| Promise | Enforcement |
| --- | --- |
| No production DB | Everything is in‑memory `Map`s; no DB driver is imported. |
| No production execution | `createSafeConfig` throws `ProductionGuardError` on `NODE_ENV=production` or real‑looking creds in `DATABASE_URL`, `TWILIO_AUTH_TOKEN`, `STRIPE_SECRET_KEY`, `COGNITIA_API_TOKEN`. |
| No real SMS | `Notifier` writes to an in‑memory outbox marked `delivered: "simulated"`. |
| No real payments | `EscrowService` moves abstract units; every mutator asserts the `payments` simulation guard. |
| No token | `authTokenRequired` is the literal type `false`; no token is read or required. |
| No external API credentials | `AgentFabric` opens no socket; every route asserts the `external_api` guard. |
| No deploy | There is no deploy script, Dockerfile, or CI publish step in this package. |

The config type makes real channels **unrepresentable**: `realSms`, `realPayments`,
and `realExternalApis` are the literal type `false`, so no override can enable them.

---

## What this proves — and what it does not

**Proves:** the *shape* and *safety invariants* of the pilot flows — human
approval gating, agent proposal constraints, escrow‑on‑verified‑release, weak‑proof
refusal, dispute settlement, fabric simulation, and safe‑empty trust feed.

**Does not prove:** production readiness, real payment settlement, real messaging
delivery, real agent routing, database/RLS behaviour under load, or any
performance/security characteristic of the production system. This is a rehearsal
harness, not a production claim.

---

## Related docs

- [`TENANT_ZERO_PILOT_SCRIPT.md`](./TENANT_ZERO_PILOT_SCRIPT.md)
- [`DEMANDARA_PILOT_SCRIPT.md`](./DEMANDARA_PILOT_SCRIPT.md)
- [`HUMAN_OPERATOR_VS_AI_AGENT_RUNBOOK.md`](./HUMAN_OPERATOR_VS_AI_AGENT_RUNBOOK.md)
- [`../execution/PILOT_001_HANDOFF.md`](../execution/PILOT_001_HANDOFF.md)
