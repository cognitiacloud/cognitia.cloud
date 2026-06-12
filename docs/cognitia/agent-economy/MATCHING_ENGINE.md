# Matching Engine (AGENT-ECONOMY-004)

`matchWorkOrderToListings(repo, tenantId, workOrderId)` scores every **active**
listing against a work order's needs and returns ranked candidates. The result
is always tagged `likely_inference` — a match **ranks**, it never proves or
guarantees, and it moves no credits or reputation.

## Candidate set

Only `status = 'active'` listings are candidates. Yanked / paused / draft /
archived listings are never returned — so a **yanked listing is never matched**.

## Per-listing scoring (deterministic)

For each candidate, the engine computes `match_score`, `match_reasons[]`, and
`blockers[]`:

| Signal                                         | Effect                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Skill version exists, not yanked               | base `score += proof_tier × 10`; reason `skill_tier:N`                                       |
| Skill version missing / yanked                 | **blocker** `skill_version_missing` / `skill_version_yanked`                                 |
| Owner agent active + active ATC                | reputation `score += clamp(repScore,0..100) × 0.5`; reason `reputation:N`                    |
| Owner agent suspended/retired                  | **blocker** `owner_agent_inactive`                                                           |
| Owner ATC not active                           | **blocker** `owner_atc_not_active`                                                           |
| `required_proof_tier` not met                  | **blocker** `below_required_proof_tier`                                                      |
| `minimum_reputation_score` not met             | **blocker** `below_minimum_reputation`                                                       |
| Exact skill match with the order               | `score += 50`; reason `exact_skill_match`                                                    |
| Credits fit the listing range                  | reason `credits_in_range`; else **blocker** `credits_below_range` / `credits_above_range`    |
| Proof-required order vs proof-required listing | compatible → reason `proof_required`; else **blocker** `listing_does_not_require_proof`      |
| High-risk listing                              | `score -= 5`; reason `high_risk_requires_approval` (soft — flags approval, does not exclude) |

A listing with a **non-empty `blockers` array is not matchable**: its
`match_score` is forced to `0`.

## Ranking

Matchable listings (no blockers) sort first, by descending `match_score`;
blocked listings follow. So a higher-tier skill ranks above a lower-tier one
when other factors are equal, and reputation breaks ties between equal tiers.

## Evidence posture

The return shape:

```
{ work_order_id, evidence_tag: 'likely_inference',
  matches: [ { listing_id, match_score, match_reasons, blockers,
               evidence_tag: 'likely_inference' } ] }
```

Per ARCHITECTURE_LOCK_V1_1 §7, a match is a proposal. Upgrading anything to
`verified_fact` requires explicit human verification or a whitelisted automation
verifier — never the matcher. No reputation, escrow, or economic outcome flows
from a match.
