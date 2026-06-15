# Final Stitching Plan — Overnight Sprint

Date: 2026-06-15. How the sprint closes out under **STITCH-001**, after the
parallel lanes have merged per `MERGE_ORDER.md`. `recommended` plan; STITCH-001
owns execution and the shared docs. Evidence tags per `OVERNIGHT_PLAN.md`.

## Ownership

- **STITCH-001 is the only lane** that edits shared roadmap / master booklet /
  `docs/cognitia/audits/*`. All other lanes (including this orchestrator) write
  only their own files. This avoids the MED-risk doc collision in
  `CONFLICT_RISK_LEDGER.md`.

## Close-out sequence

1. **Confirm the merged base.** Verify `main` reflects every landed lane in the
   recommended order; record final merge commit. Start point this sprint:
   **e0de0e5**, baseline **532/532**.
2. **Re-run `pnpm check` on merged main.** Must be green. Record the new
   `NNN/NNN` test count; it should be **≥ 532** (lanes add tests, never weaken
   guard tests). Any drop is a blocker, not a merge.
3. **Reconcile migration ledger.** Confirm migrations remain a clean sequence
   with exactly one new number per DB lane, `0015` still reserved/absent, and no
   duplicate `0020`.
4. **Reconcile audit booklet + public docs.** Update the master booklet and
   public diligence surface to match what actually merged — Agent Fabric Lab and
   any FABRIC-002 hardening stay **simulation-only**; BOND-001 stays
   **simulation-locked**; pilot stays **no production deploy**.
5. **Guardrail attestation.** Confirm, in writing, that the merged result holds
   every global hard guardrail: no production deploy/migration/DB, no token
   launch / purchase CTA / DEX / liquidity / staking / yield, no price/return
   language, no real payments/transfers, no mainnet contracts, no
   TOKEN-LAB-003, no COG-016, no weakened guard tests, and **no claims** of
   SOC2 certification / production readiness / decentralized / unstoppable /
   cannot-be-shut-down.
6. **Final status.** Produce the sprint's closing status: lanes merged, final
   test count, migrations added, blockers resolved/outstanding, and any owner
   decisions still pending.

## What STITCH must NOT do

- Not deploy, not run production migrations, not touch a production DB.
- Not upgrade any lane's claim beyond what that lane proved (no overclaim).
- Not launch, price, or create a purchase path for the token.
- Not delete sibling branches as part of reconciliation.

## Handoff

On completion, STITCH-001 updates `LANE_STATUS.md` (all lanes → `merged` or a
recorded terminal state) and clears resolved entries in `BLOCKERS.md`, leaving a
single coherent record of the night.
