# AGENT-ECONOMY-004 — Internal Marketplace + Tier-Aware Matching (execution record)

Date: 2026-06-12. Branch `claude/agent-economy-004-marketplace` (stack:
`main` → #48 → #49 → #51 → this). Evidence: `verified_fact` unless noted.

## Baseline

PRs #48/#49/#51 open, CI green, unmerged → stacked from the 003 tip.
`pnpm check` baseline on that tip: **430/430 green**.

## What was built

The listings table 001 deliberately deferred, now that matching needs it:

- **Migration `0018_marketplace_listings.sql`** — internal-only listings
  (visibility check-locked, 0012/0016 lock style), one per (agent, skill
  version), yank guard trigger on insert AND update (re-activation re-runs
  it), RLS. No other table touched.
- **Twin repositories + contract case** (memory AND PGlite): internal-only
  check, uniqueness, tenant isolation, withdraw, yank-blocked re-activation
  and new listings.
- **Service `marketplace.ts`**:
  - `createListing` — active-ATC trust gate, yank gate, audit;
  - `buildMarketplaceView` — the matching layer:
    `match_score = proof_tier*1000 + reputation*10 + verified_work_orders`;
    tier ≥ 2 ⇒ `eligible_for_verified_work`; yanked/ATC-less listings land
    in `suppressed` with reasons (honest surface);
  - `createWorkOrderFromListing` — normal work order at the listed price +
    version; files the worker's ACCEPT ask via AGENT-ECONOMY-003 when
    permitted, else returns `accept_ask_blocked` with the exact reason;
    audit `economy.work_order.from_listing.v1`.
- **Routes**: `GET /agent-economy/marketplace`, `POST .../listings`,
  `POST .../listings/:id/withdraw|reactivate|order`.
- **Console**: marketplace section — list a version, ranked match table
  (tier badge "eligible for verified work" vs "simulated work only",
  reputation, verified orders, match score, price, Order/Withdraw),
  suppressed reasons line. Summary gains listing counts +
  `visibility: internal`.

## Why the ranking is honest by construction

Every input is evidence-gated upstream: tiers ≥ 2 require verified_fact
skill proofs (0013), reputation only moves on verified_fact (0010), and
`verified` work orders required a verified_fact release (0016). The
marketplace ranks receipts, not claims.

## Test results

- `marketplace.test.ts`: **6 tests** — tier-dominant ranking + eligibility
  flags + ATC suppression; reputation/verified-order tiebreak via a real
  verified loop; yank lifecycle (refused listing, suppression, blocked
  re-activation); order-from-listing at listed price with accept ask →
  approve → execute → escrow reserved through the safe path; honest
  `accept_ask_blocked` when unpermissioned; withdrawn-order refusal + RBAC +
  isolation + summary counts. One mid-build fix: yank-blocked re-activation
  initially surfaced as an unmapped raw error — added the service-level
  pre-check throwing the mapped `SkillVersionYankedError` (409); the 0018
  trigger stays the backstop.
- New contract case green on memory AND PGlite.
- Full gate: see PR (`pnpm check` green across the suite).

## Follow-ups

AGENT-ECONOMY-005 (cross-tenant settlement design doc) is the last queued
economy ticket. Marketplace incentives stay an unmapped token-utility
candidate behind TOKEN_GATES. A hard tier gate (refusing T0/T1 for future
REAL work) arrives with real execution, behind its own migration.
