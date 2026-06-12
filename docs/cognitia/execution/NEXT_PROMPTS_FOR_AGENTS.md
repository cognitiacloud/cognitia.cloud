# Next Prompts for Agents (economy track)

Date: 2026-06-12. Ready-to-issue mission prompts for follow-up sessions.
Standing guardrails on all: no public token/coin surface, no DEX/liquidity/
staking/yield pages, no price/return language, no real payments, no token
transfers, no production deploys/migrations, no secrets printed, doctrine
guards green, evidence tags on all claims.

> Merge note: the open GTM PR #45 also creates a file with this name carrying
> GTM-track prompts (COG-013/014/015). When both land, UNION the two —
> nothing conflicts semantically.

## ~~AGENT-ECONOMY-002 — Dispute resolution~~ EXECUTED 2026-06-12

Built on `claude/agent-economy-002-dispute-resolution` (migration 0017, owner
arbitration release/refund/split, append-only records, verified_fact
resolution proofs, honest reputation). The original prompt, for the record:

Build the arbitration path over held escrow: a dispute can be resolved by an
owner decision (release / refund / split) that carries its own structured
reason, emits its own proof (resolution evidence), books reputation honestly
(resolution against the worker → negative; vindication → no positive without
verified_fact), and unblocks the escrow account. New migration widening the
work-order trigger deliberately — never edit 0016. Tests on memory + PGlite.

## ~~AGENT-ECONOMY-003 — Agent-driven accept/deliver~~ EXECUTED 2026-06-12

Built on `claude/agent-economy-003-agent-actions` (ledger asks with ATC +
deny-by-default permission scopes, approval-required, operator execute via
the safe path; verify/resolve never agent-proposable). Original prompt:

Let the WORKER AGENT (not an operator) accept and deliver work orders through
the existing action-ledger approval machinery: agent proposes `economy.accept`
/ `economy.deliver` actions, human approves, execution runs the lab service.
No new trust logic; the point is to prove agent-to-agent flow uses the same
approval discipline as customer-facing actions.

## ~~AGENT-ECONOMY-004 — Marketplace listings + tier-aware matching~~ EXECUTED 2026-06-12

Built on `claude/agent-economy-004-marketplace` (0018 internal-only listings,
evidence-backed tier ranking, order-from-listing wiring into the 003 ledger
asks). Original prompt:

Add the listings/pricing table (internal-visibility check-locked, like 0016's
simulation lock) and matching that ranks by SkillProof tier (tier ≥2
preferred for verified work) + reputation score. Marketplace stays internal;
no public surface.

## AGENT-ECONOMY-005 — Cross-tenant settlement design (doc only)

Internal design doc: what the economy layer spanning tenants means without
breaking RLS — settlement accounts, platform-level escrow, isolation
boundaries. This is the technical half of the multi-tenant token gate
(`docs/cognitia/crypto/TOKEN_GATES.md` #3). No code.

## GTM track (pilot work, unchanged priority rules)

COG-013 (Twilio SANDBOX behind the triple gate), COG-015 (moveros-staging
HTTP integration spike — never shared DB), vertical-aware draft templates:
see PR #45's version of this file; those prompts remain valid for pilot
sessions and run on the proof-environment track.
