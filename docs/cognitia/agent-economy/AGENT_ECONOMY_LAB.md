# Agent Economy Lab (AGENT-ECONOMY-001)

Date: 2026-06-12. Status: built, internal-only, simulation-only.
Evidence: `verified_fact` unless noted.

## What this is

The first closed-loop agent economy on the Cognitia trust primitives. It is a
LAB: every economic movement is internal-credits accounting, every execution
is a simulation, and nothing here is public. The mission doctrine (founder,
2026-06-12): Cognitia is the agent trust, execution, economy, and future
crypto platform; GTM and MoverOS are proof environments, not the destination.
This lab is the first build on the destination side.

## The loop

```
agent requests work            POST /agent-economy/work-orders         (proposed)
→ another agent accepts        POST .../:id/accept                     (accepted)
    trust gate: worker must hold an ACTIVE Agent Trust Credential
    skill gate: yanked SkillProof versions take no new work
    escrow: requester credits RESERVED into the order's escrow account
→ work is delivered            POST .../:id/deliver                    (delivered)
    simulated skill execution order runs (simulation check-locked TRUE)
    proof created or linked — proofless delivery is refused
→ completion is judged
    verify  POST .../:id/verify  → escrow RELEASED  + reputation +3    (verified)
    reject  POST .../:id/reject  → escrow REFUNDED  + reputation −2    (rejected)
    dispute POST .../:id/dispute → escrow HELD, no reputation          (disputed)
→ disputes resolve by OWNER arbitration (AGENT-ECONOMY-002)
    resolve POST .../:id/resolve → release / refund / split held escrow (resolved)
    every resolution = append-only record + verified_fact resolution proof
→ reputation updates only from verified_fact (0010 trigger, unchanged)

AGENT-DRIVEN VARIANT (AGENT-ECONOMY-003): agents FILE the accept/deliver/
dispute steps as asks on the Action Ledger (active ATC + explicit
permission, deny-by-default) → human approves/rejects on the existing
ledger → operator-gated execute runs the SAME safe path above.
verify + resolve are never agent-proposable. See AGENT_DRIVEN_WORKFLOW.md.
```

## The rule that makes it an economy and not a game

**Escrow releases ONLY against a `verified_fact` proof.** Enforced in three
places, like every Cognitia invariant:

1. **Database** — the 0016 `work_orders` trigger joins `proofs` and refuses
   `status='verified'` / `escrow_status='released'` unless the linked proof
   is tagged `verified_fact`.
2. **In-memory mirror** — `InMemoryRepository.updateWorkOrder` enforces the
   same check, so tests cannot drift.
3. **Service** — `verifyWorkOrder` refuses with 409 before touching credits.

`likely_inference` and `unknown` proofs can be delivered and discussed — they
just cannot move money or reputation.

## What it reuses (zero new trust logic)

| Primitive                    | Use in the lab                                               |
| ---------------------------- | ------------------------------------------------------------ |
| Agent Trust Credential (ATC) | acceptance gate: no active ATC, no work                      |
| Proof Registry               | completion proofs; append-only, evidence-tagged              |
| SkillProof                   | skill versions are the work product; yanked = no new work    |
| Reputation                   | +3 on verified release, −2 on rejection; verified_fact-gated |
| Credits ledger               | escrow = balanced, idempotent, internal-rail-locked pairs    |
| Wallet placeholders          | counted on the lab surface; still inert                      |
| Crypto readiness             | the lab UI repeats: token disabled, legal gate not passed    |

## Boundaries (hard)

No public token/coin page. No DEX/liquidity/staking/yield surface. No
price/return language. No real payments. No token transfers. No production
deploys or migrations. Internal credits are bookkeeping units — the only
"transfer" route in the API is `/credits/transfer` on the check-locked
internal rail.

## Where this goes next

The lab is single-tenant by design. The cross-tenant evolution — clearing
model, reputation attestations, platform arbitration, and where
credits/stablecoin/token evaluation can ever slot — is DESIGNED (not built)
in `CROSS_TENANT_SETTLEMENT_DESIGN.md` (AGENT-ECONOMY-005), behind the
TOKEN_GATES.

## Surfaces

- API: `/agent-economy/work-orders` (+ accept/deliver/verify/reject/dispute/
  cancel), `/agent-economy/summary`.
- Console: `/agent-economy` (operator paste-token page) — work orders, escrow
  totals, reputation impact, wallet placeholder count, and the locked token
  posture.
- Docs: `WORK_ORDER_MODEL.md`, `ESCROW_SIMULATION.md` (this directory);
  private token mapping under `docs/cognitia/crypto/`.
