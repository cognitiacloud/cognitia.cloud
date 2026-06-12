# Token Utility Map — INTERNAL (legal-gated; never public)

Date: 2026-06-12. Classification: INTERNAL. Candidate mappings only — every
row is `likely_inference` about future design, not a commitment. No token
exists (see TOKEN_LAB_001_INTERNAL.md), and nothing maps until every gate in
TOKEN_GATES.md passes.

## Method

Each candidate utility must trace to a mechanic that ALREADY runs on internal
credits in the Agent Economy Lab. If a utility cannot be expressed in credits
today, it does not belong on this map — that rule keeps the map honest and
strips out anything speculative by construction.

| Candidate utility              | Credits-lab mechanic it maps from (verified_fact: built + tested)                                  | Notes / open questions                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Verifier staking**           | `verifier_ref` on proofs; escrow release gated on verifier-confirmed `verified_fact`               | a verifier with skin-in-the-game backs its attestations; slashing semantics undefined                   |
| **Agent reputation bonds**     | reputation events (+3 verified / −2 rejected) tied to escrowed work                                | reputation itself stays NON-transferable; a bond would collateralize behavior, never tokenize the score |
| **SkillProof publisher bonds** | yanked-version rule (yanked skills take no new work); tier upgrades requiring verified_fact proofs | publisher posts a bond against defect/yank events                                                       |
| **Dispute bonds**              | dispute path holds escrow with no resolution mechanic yet                                          | the future resolution mechanism is the natural home for bonded challenge                                |
| **Marketplace incentives**     | work-order matching (requester ↔ worker via ATC + skill tiers)                                     | incentives for honest matching/liquidity of WORK, never of tokens                                       |
| **Governance**                 | owner-gated verify/release; founder-gated platform decisions                                       | narrow parameter governance at most; safety gates stay off-chain                                        |
| **Contributor rewards**        | credits grants from `system` accounts (the internal grant source)                                  | rewards for platform contribution, settled like any other work order                                    |

## Hard exclusions (do not map, do not revisit without founder + counsel)

- Anything that is primarily a yield, return, or appreciation mechanic.
- DEX/liquidity provisioning, exchange listings, market-making.
- Tokenizing reputation scores or proofs themselves (they are evidence, not
  assets).
- Any utility scoped to a single tenant (violates Lock A1).

## Status

All candidates: **unmapped, ungated, internal.** Token public status:
disabled. Legal gate: not passed.

## AGENT-ECONOMY-004 — marketplace-later mapping (mapped, NOT built)

The internal Marketplace Lab uses **internal credits only**. Token mechanics
remain candidates, each traced to a built marketplace primitive — none are
implemented; all gates remain NOT PASSED.

| Later token mechanic       | Built primitive it would attach to             | Status            |
| -------------------------- | ---------------------------------------------- | ----------------- |
| Listing bonds              | `marketplace_listings` (a bond posted to list) | later — not built |
| Verifier staking           | Proof Registry verifier identities             | later — not built |
| Dispute bonds              | `dispute_resolutions` arbitration              | later — not built |
| SkillProof publisher bonds | `skill_versions` publishing                    | later — not built |
| Marketplace governance     | registry parameters                            | later — not built |

Hard exclusions remain: no liquidity, no public sale, no launch date, no price
or return language, no exchange listing. Current marketplace = internal credits;
token status disabled.
