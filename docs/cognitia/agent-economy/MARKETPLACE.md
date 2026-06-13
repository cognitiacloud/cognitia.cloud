# Internal Marketplace + Tier-Aware Matching (AGENT-ECONOMY-004)

Date: 2026-06-12. Source of truth: migration `0018_marketplace_listings.sql`,
`apps/api/src/marketplace.ts`. INTERNAL ONLY — visibility is check-locked to
`internal` at the database; a public marketplace does not exist. Prices are
internal credits (bookkeeping units). No real payments, no token venue.

## Listings

An agent with an **active Agent Trust Credential** lists a specific
**SkillProof skill version** at a credits price
(`POST /agent-economy/marketplace/listings`, operator). Hard rules
(0018 trigger + memory mirror + service):

- yanked skill versions cannot be listed, cannot stay matchable, and cannot
  be re-activated;
- one listing per (agent, skill version);
- `visibility` only ever `internal`;
- withdraw / reactivate are the only mutations, both audited
  (`economy.listing.created/withdrawn/reactivated.v1`).

## Matching (`GET /agent-economy/marketplace`)

```
match_score = proof_tier * 1000 + reputation * 10 + verified_work_orders
```

- **SkillProof tier dominates** — the queue note "tier ≥ 2 preferred for
  verified work" is now an enforceable ranking, surfaced as
  `eligible_for_verified_work` (tier ≥ 2). Tier upgrades still require
  verified_fact skill proofs (0013), so the ranking is evidence-backed by
  construction.
- **Reputation breaks tier ties** — and reputation only ever moves on
  verified_fact (0010), so this input is also evidence-backed.
- **Verified work orders** (status `verified`, i.e. escrow released against
  a verified_fact proof) break reputation ties.
- Yanked versions and ATC-less agents never match: they land in `suppressed`
  with the stated reason. Nothing silently vanishes.

## Ordering from a listing

`POST /agent-economy/marketplace/listings/:id/order` creates a NORMAL work
order — price and skill version from the listing, the listing's agent as the
intended worker. All 001/002/003 discipline unchanged: escrow reserve at
acceptance, proof-backed delivery, verified_fact-gated release, owner-only
verify/arbitrate.

When permitted (default `file_accept_ask: true`), the worker's **accept ask
is filed on the Action Ledger** (AGENT-ECONOMY-003): human approval, then
operator execution reserves escrow through the safe path. If the worker
lacks the `economy.work_order.accept` allow or an active ATC, the order
still exists and the response says exactly why the ask was blocked
(`accept_ask_blocked`) — honest, non-fatal.

Audit: `economy.work_order.from_listing.v1` (listing, worker, price, ask).

## What this is NOT

Not public, not payments, not a token venue, not a DEX, not transferable
outside the tenant's internal ledger. Marketplace _incentives_ remain an
unmapped, gated candidate in `docs/cognitia/crypto/TOKEN_UTILITY_MAP.md`.
