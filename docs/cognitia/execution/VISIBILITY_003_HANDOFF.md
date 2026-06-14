# VISIBILITY-003 — Handoff

Branch `claude/visibility-003-diligence-discoverability` from `main` @ `e46e6ac`.

## Done

- **README** "Trust & diligence" section links `/trust`, `SECURITY.md`, and the
  public pack (RESEARCHER_PACK, VERIFY_IT_YOURSELF, TOKEN_STATUS_AND_GATES,
  CLAIMS_WE_DO_NOT_MAKE) + entrypoints index + diligence overview.
- **`/trust` metadata** updated: title "Cognitia Trust & Proof", description
  "proof-backed agent economy diligence surface" (no sale/investment wording).
- New docs: `public/RESEARCHER_ENTRYPOINTS.md`, `public/DISCOVERABILITY_PLAN.md`,
  `execution/VISIBILITY_003_BASELINE.md`, this handoff.
- Updated: `PUBLIC_DILIGENCE_OVERVIEW.md`, `public/RESEARCHER_REVIEW_ORDER.md`,
  `research/CRYPTO_VISIBILITY_001_ROADMAP.md`, `execution/NEXT_BUILD_PILOT_QUEUE.md`,
  `execution/NEXT_PROMPTS_FOR_AGENTS.md`.
- Guard test: `packages/core/src/visibilityDiscoverability.guard.test.ts` —
  README + entrypoints link the pack; no purchase CTA / price-return / hype;
  `/trust` metadata is diligence-framed with no sale/investment wording; managed-
  RLS caveat + token-gates-NOT-PASSED remain visible.

## Verification

- Baseline `pnpm check` 499/499. Final: see report (all green).
- No code behavior changed (docs + README + metadata string + a guard test).

## Not done (founder-gated / out of scope)

- Default branch → `main` (founder one-click) — biggest remaining discoverability lever.
- Public docs site / team page — founder decisions.
- V-6 managed-Postgres RLS verification — needs a safe dev `DATABASE_URL` (absent).

## Guardrails respected

No token launch/sale/CTA/price/return/DEX/liquidity/staking/yield; no production-
ready/SOC2/decentralized/unstoppable claims; no deploy/migration; no GTM/COG-016/
TOKEN-LAB-003.
