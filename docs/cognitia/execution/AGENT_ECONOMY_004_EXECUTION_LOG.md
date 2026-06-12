# AGENT-ECONOMY-004 Execution Log

## Build order

1. Schema + migration `0018_marketplace_listings.sql`: `marketplace_listings`
   table (visibility CHECK has no `public`; no price column; credits estimate
   range with min≤max CHECK), `work_orders.listing_id` link, RLS, updated_at
   trigger. Added to the PGlite harness migration list.
2. Repository: `MarketplaceListingRow` + `ListListingsFilter`; interface methods
   `insert/get/list/updateMarketplaceListingStatus`; `listing_id` added to the
   `updateWorkOrder` patch Pick. Implemented on **both** engines (memory mirrors
   the `public`-visibility refusal). Shared contract case added.
3. Service `apps/api/src/marketplace.ts`: `createListing` (zod with no `public`
   visibility, activation rules), `pause/yank/activateListing`,
   `matchWorkOrderToListings` (deterministic scoring, `likely_inference`),
   `createWorkOrderFromListing` (reuses `createWorkOrder`, links listing,
   inherits `proof_required`, no escrow), `buildMarketplaceSummary`.
4. Handlers + routes: 8 `/agent-economy/*` routes; `toMarketplaceHttpError`.
5. Web: apiClient views/methods; `/agent-economy/marketplace` console page.
6. Tests: `marketplace.test.ts` (21) + contract case (both engines).
7. Docs: this set + lab/work-order/token-doc updates + §0a record.

## Honest corrections during the build

- **Schema field churn:** adding the required `listing_id` to `WorkOrdersTable`
  broke three existing `insertWorkOrder` literals (service + two contract
  cases); fixed by adding `listing_id: null` to each.
- **Test/handler contract:** the economy handlers `throw` `HttpError` (the
  server catches it) rather than returning a status body. Error-case tests had
  to `.catch((e) => e)` and assert `e.status` — five tests were corrected.
- **"Yanked skill after activation" test:** the service _correctly_ refuses to
  ACTIVATE a listing whose skill is yanked, so that path can't be created via
  the service. The test now inserts an active listing row directly (modelling a
  version yanked _after_ the listing went active) to exercise the matcher's
  `skill_version_yanked` blocker.

## Truthful posture

- The matcher's `model`/scoring is deterministic and rule-based — no LLM is
  involved; match results are `likely_inference` by construction.
- No migration was applied to any live database; no real payment, token
  transfer, or production deploy occurred.

## Doctrine-guard reconciliation (COG-005)

The COG-005 guard in `skillproof.test.ts` ("no public marketplace") was a blunt
string check that forbade the words `marketplace`/`listing` in ANY route and a
`marketplace` web dir — which collided with the AGENT-ECONOMY-004 internal
routes (`/agent-economy/listings`, `/agent-economy/marketplace/summary`,
`/agent-economy/work-orders/:id/matches`) and the `/agent-economy/marketplace`
console. The guard was NARROWED to its real intent: still forbids `buy`,
`pricing`, and `token` routes/dirs everywhere and any PUBLIC/top-level
marketplace, but permits the authorized internal marketplace under
`/agent-economy/*` (operating-plan §0a-bis). The price-field assertion is
unchanged. Public marketplace / pricing / token surfaces remain forbidden.
