# AGENT-ECONOMY-001 — Handoff

Date: 2026-06-12. Branch `claude/agent-economy-001-lab` (from `main`).
Status: built, tested (413/413), internal-only, simulation-only.

## What exists now

The first closed-loop agent economy on the Cognitia primitives: agent work
orders → ATC-gated acceptance → internal-credits escrow → simulated SkillProof
execution → proof-backed delivery → verified_fact-gated release/refund/
dispute → reputation. Console at `/agent-economy`; API under
`/agent-economy/*`; private token architecture under `docs/cognitia/crypto/`.

Read in this order: `agent-economy/AGENT_ECONOMY_LAB.md` →
`WORK_ORDER_MODEL.md` → `ESCROW_SIMULATION.md` →
`crypto/TOKEN_LAB_001_INTERNAL.md` → `crypto/TOKEN_UTILITY_MAP.md` →
`crypto/TOKEN_GATES.md`.

## Invariants a future session must not break

1. Escrow release requires a verified_fact proof — DB trigger (0016) +
   memory mirror + service. Run the contract test on PGlite before trusting
   any change here.
2. `skill_execution_orders.simulation` is check-locked TRUE. Real execution
   is a future migration + the existing approval machinery, never a flag flip.
3. `verified/rejected/canceled` are terminal; `disputed` holds escrow and has
   NO resolution path yet — building one is its own ticket.
4. Internal credits only (0012 rail check untouched). The only transfer route
   is `/credits/transfer`; the route-scan test enforces no pay/stake/swap
   route appears.
5. Reputation: +3 only via verified release; rejection books −2; disputes
   book nothing. Scores stay non-transferable.
6. Token posture on every surface: public status disabled, legal gate not
   passed. All eight TOKEN_GATES are conjunctive.

## Open follow-ups (proposed next tickets)

| Ticket            | Scope                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGENT-ECONOMY-002 | Dispute resolution: arbitration path that can split/release/refund held escrow with its own proof + audit trail (candidate home for dispute bonds)               |
| AGENT-ECONOMY-003 | Worker autonomy: let an AGENT (not an operator) accept/deliver via the action-ledger approval machinery, so agent-to-agent flows stop needing a human driver     |
| AGENT-ECONOMY-004 | Marketplace listings/pricing table + tier-aware matching (tier ≥2 preferred for verified work becomes enforceable ranking)                                       |
| AGENT-ECONOMY-005 | Cross-tenant settlement design doc (internal): what it means for the economy layer to span tenants without breaking RLS — the multi-tenant gate's technical half |

## Merge coordination (important)

Open GTM PRs #44/#45/#46 touch the same repository/handler/server files
(additively) and #45 also creates `NEXT_PROMPTS_FOR_AGENTS.md`. Whichever
side lands second takes a small mechanical merge — union both sides; nothing
conflicts semantically. Migration numbering is already de-conflicted (0015
reserved for parked COG-016, this branch uses 0016).

## Founder-gated items (unchanged)

Production DB apply (0001–0016), default-branch flip to `main`, Tenant Zero
recruitment, any counsel engagement for the legal/compliance token gates.
