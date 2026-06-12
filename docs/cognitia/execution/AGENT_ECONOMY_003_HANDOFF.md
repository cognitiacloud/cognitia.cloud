# AGENT-ECONOMY-003 — Handoff

Date: 2026-06-12. Branch `claude/agent-economy-003-agent-actions` (stack:
`main` → #48 → #49 → this). Status: built, tested, internal-only.

## What exists now

Agents participate in the economy WITHOUT uncontrolled execution: they file
asks (accept/deliver/dispute) on the existing Action Ledger, humans decide
with the closed reason taxonomy, and an operator-gated execute runs the safe
service path. Verify and dispute arbitration remain human owner decisions —
hard-refused as agent proposals.

Read: `agent-economy/AGENT_DRIVEN_WORKFLOW.md` (the loop, scope table, route
mapping), then the 001/002 docs underneath.

## Invariants a future session must not break

1. **No economy ask skips approval** — every proposal is risk_level=high and
   requires a human ledger decision. Auto-approval needs founder sign-off and
   its own ticket.
2. **verify / resolve are never agent-proposable** (`NotAgentProposableError`,
   403). The payout and arbitration decisions stay human.
3. **Permission posture is deny-by-default with deny-wins** — exactly like
   `sms.send_real`. Granting `economy.work_order.*` allows is an explicit
   operator act via `PUT /agents/:id/permissions`.
4. **Escrow moves only inside the 001/002 service functions.** The execute
   step is a dispatcher; it must never grow its own credits logic.
5. **Proposals are content-fingerprinted idempotent**; the same ask can never
   double-reserve (and the `wo:<id>:reserve` ledger key backstops even that).
6. Same standing walls: internal credits only, simulation-locked execution,
   verified_fact-gated release/resolution, no token surface anywhere.

## Open follow-ups

| Ticket            | Scope                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGENT-ECONOMY-004 | Marketplace listings + tier-aware matching (tier ≥2 preferred for verified work becomes enforceable ranking)                                                                                            |
| AGENT-ECONOMY-005 | Cross-tenant settlement design doc (internal)                                                                                                                                                           |
| Future (gated)    | Auto-execute worker for approved asks (behind its own founder-approved gate); agent-initiated proposals from inside agent runtimes (today the operator files on the agent's behalf, same as front-desk) |

## Merge coordination

Stack merge order: #48 → #49 → this PR. GTM PRs #44/#45/#46 unchanged
(additive union when both tracks land). COG-016 stays parked; migration 0015
still reserved for it (this ticket added NO migration).
