# AGENT-ECONOMY-004 Handoff

## What shipped

Internal marketplace listings + tier/reputation/ATC/tenant-aware matching +
work-order-creation-from-listing + marketplace console + docs, on top of the
AGENT-ECONOMY-001/002/003 stack. Internal-only, no token, no real payments.

## Files

- `packages/db/migrations/0018_marketplace_listings.sql`
- `packages/db/src/schema.ts` (`MarketplaceListingsTable`, `work_orders.listing_id`)
- `packages/db/src/repository.ts` / `memory.ts` / `kysely.ts` (listing methods)
- `packages/db/src/repository.contract.ts` + `kysely.pglite.test.ts` (contract case + harness)
- `apps/api/src/marketplace.ts` (service)
- `apps/api/src/handlers.ts` (handlers + `toMarketplaceHttpError`)
- `apps/api/src/server.ts` (8 routes)
- `apps/api/src/marketplace.test.ts` (21 tests + doctrine guards)
- `apps/web/src/lib/apiClient.ts` (views + methods)
- `apps/web/src/app/agent-economy/marketplace/page.tsx` (console)
- docs: marketplace-economy set + token-doc + lab/work-order updates

## Merge coordination

This branch is stacked on `claude/agent-economy-003-agent-actions` (PR #51,
unmerged). Merge order: **#48 → #49 → #51 → this**. The migration is `0018`;
if another lane claims `0018` first, renumber to the next free slot and update
the PGlite harness list + baseline doc.

## Residual / next

- The console lists + creates + pause/yank; a richer "matches per work order" UI
  panel and "create work order from listing" affordance are a small follow-up
  (the API + apiClient methods already exist).
- High-risk listings are flagged (`high_risk_requires_approval`) but do not yet
  auto-create an approval-required Action Ledger row from the listing path — a
  deliberate next ticket if listing-driven high-risk work becomes real.
- Token mechanics (listing/verifier/dispute/publisher bonds, governance) remain
  mapped-not-built in `crypto/TOKEN_UTILITY_MAP.md`; all gates NOT PASSED.
