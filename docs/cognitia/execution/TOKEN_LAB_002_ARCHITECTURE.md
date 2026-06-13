# TOKEN-LAB-002 — Internal Token Architecture Spec (execution record)

Date: 2026-06-12. Branch `claude/token-lab-002-architecture` (stack:
`main` → #48 → #49 → #51 → #52 → #53 → this). **Doc-first: zero code, zero
toolchain, zero deployable surface.** Evidence: design = `likely_inference`;
built-lab statements = `verified_fact`.

## Deliverable

`docs/cognitia/crypto/TOKEN_LAB_002_ARCHITECTURE_INTERNAL.md` — the private
architecture spec. Core decisions:

1. **Utility model in three layers**: settlement is deliberately NOT the
   token's job (stablecoin territory for cleared balances; credits for work
   pricing). The core thesis is **assurance collateral** — verifier /
   publisher / worker / dispute bonds, where platform-issued credits are
   provably insufficient (circular assurance). Coordination (contributor
   rewards, narrow parameter governance) comes last and smallest.
2. **Bonding/slashing, credits-first**: bonds are escrow-shaped credits
   accounts (future deliberate owner-type widening); a slash is an
   ARBITRATED, conserved transfer following the 0017 evidence pattern —
   never automatic, never a default-burn, with an appeal window. **Bonds
   earn nothing** — design rule and communications rule.
3. **The split**: credits = unit of account forever; stablecoin = external
   settlement of cleared balances only (Stage 2, legal-gated); token =
   assurance collateral + narrow coordination (Stage 3, all eight gates).
   One-token-does-everything explicitly rejected with reasons.
4. **Base/EVM sandbox plan**: S0 local-only chain (own ticket) → S1 Base
   Sepolia testnet, test value only, wallet placeholders become a TEST
   binding registry, EAS anchoring trialed (`external_attestation_ref`
   already reserved) → S2 external audit → mainnet never before ALL gates.
   Repo rule: no Solidity toolchain or contracts directory until S0 is
   ticketed.
5. **Legal-gates work packet**: the concrete counsel checklist (CA-first
   classification, bonding-mechanic impact, money-transmission exposure for
   stablecoin settlement, staged KYC/AML, comms constraints).
6. **Communications guardrails**: existing doctrine guards restated as the
   enforcement layer; banned-forever list; internal vocabulary discipline
   (bonding not staking, collateral not investment); any future public
   sentence requires counsel + founder + a guard extension FIRST.
7. **Contract skeleton**: included as a NON-DEPLOYABLE sketch inside the
   internal doc (text block, not code) — interfaces only, arbiter-gated,
   conserved math, and deliberately absent mint/burn/reward/claim/stake/swap
   surfaces. Keeping it out of buildable code keeps the deployable surface
   at zero and the doctrine guards untouched.
8. **Falsifiers recorded**: three conditions under which the correct outcome
   is to stop (no clearing volume; adverse classification; credits-bonds
   proving sufficient).

## Verification

Docs-only; `pnpm check` green across the unchanged suite (438 tests) +
format + doctrine guards (internal docs under `docs/cognitia/` may name
gated concepts in order to gate them).

## Follow-ups (founder-gated)

TOKEN-LAB-003 (S0 local sandbox spike, throwaway), counsel engagement using
§5, and the AGENT-ECONOMY 0019+ clearing tickets that give any of this a
substrate. None starts without explicit direction.
