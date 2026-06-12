# Marketplace Lab (AGENT-ECONOMY-004)

The first discoverable marketplace skeleton for the Agent Economy Lab. It
connects the existing primitives — ATC, SkillProof, Proof Registry, Reputation,
Work Orders, Credits Escrow Simulation, Dispute Resolution, and the Action
Ledger — into a browsable internal economy.

This is **internal only**. There is no public marketplace, no token surface, no
real payments, no on-chain anything. Visibility is `internal | tenant | private`
and the credits fields are an internal estimate range, never a price.

## The loop

1. An operator creates an **internal listing** (`LISTING_MODEL.md`) offering an
   agent service / skill / workflow. Activation rules apply (yanked skill, ATC,
   tier-0 scope, declared proof requirement).
2. A requester's **work order** is matched against active listings
   (`MATCHING_ENGINE.md`) — ranked `likely_inference` proposals with blockers.
3. The operator **creates a work order from a listing**
   (`createWorkOrderFromListing`), which reuses the existing governed
   work-order path (every 0016 guard re-applies), links the order to the
   listing, and inherits `proof_required`. **No escrow is reserved here** —
   escrow reservation still happens at _accept_, downstream, unchanged.
4. From there the order follows the existing AGENT-ECONOMY-001/002/003 lifecycle:
   accept (active ATC + escrow reserve) → deliver (simulated) → verify (release
   on `verified_fact`) / reject / dispute → resolve. Listings change none of
   that.

## What a listing is NOT

- Not a price. There is no price column; credits are an internal estimate.
- Not a guarantee. A listing cannot imply a guaranteed outcome; matches are
  `likely_inference`.
- Not a reputation source. Creating/holding a listing yields no reputation.
  Only completed, `verified_fact`-proven work moves reputation (0010 trigger).
- Not public. `public` visibility is unrepresentable (DB CHECK + mirror).

## Routes

| Route                                                | Purpose                             | Gate      |
| ---------------------------------------------------- | ----------------------------------- | --------- |
| `GET /agent-economy/listings`                        | list (tenant-scoped)                | authed    |
| `POST /agent-economy/listings`                       | create                              | operator+ |
| `GET /agent-economy/listings/:id`                    | detail                              | authed    |
| `POST /agent-economy/listings/:id/pause`             | pause                               | operator+ |
| `POST /agent-economy/listings/:id/yank`              | yank                                | operator+ |
| `POST /agent-economy/listings/:id/create-work-order` | create work order from listing      | operator+ |
| `GET /agent-economy/work-orders/:id/matches`         | ranked matches (`likely_inference`) | authed    |
| `GET /agent-economy/marketplace/summary`             | counts + locked posture             | authed    |

## Console

`/agent-economy/marketplace` — internal operator page: listings with type /
status / visibility / risk / credits estimate / proof badges, a create form,
pause/yank actions, and the repeated locked posture (**token public status:
disabled · legal gate: not passed · rail: internal credits**). No buy/sell, no
token, no stake language.

## Token (later, not now)

See `../crypto/TOKEN_UTILITY_MAP.md` for the marketplace-later mapping (listing
bonds, verifier staking, dispute bonds, publisher bonds, governance — all gated,
none built). Current marketplace uses internal credits only; token status is
disabled; no liquidity; no public sale; no launch date.
