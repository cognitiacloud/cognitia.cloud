# Next 7-Day Merge / Review Plan

> Goal: convert ~110 scattered lanes into a green `main` carrying the Client-Zero spine. **Consolidation over net-new build.** Each merge step ends with a green trunk.

## Day 1 — Freeze & index

- Stop net-new branch creation (communicate the freeze).
- Land `docs/gtm/` consolidation pack (this index) on the working branch.
- Confirm `main` build status.
- Tag WS12 for park/freeze (keep branches in place; no archive, no delete).

## Day 2 — Audit the shortlist

- Deep-dive the 7 critical-path branches (see `deep-dive-queue.md`).
- Pick canonical winners among duplicates; mark loser branches as superseded candidates with a pointer to the recommended canonical branch; **wait for manager review before closing anything.**
- Produce a written review note per branch.

## Day 3 — Merge the spine

- Merge `cog-002-schema-foundation` (data spine) → green.
- Merge compliance scaffold (`feat/cognitia-compliance-layer-scaffold`) → green.
- Merge the canonical Sales Closer architecture branch → green.

## Day 4 — CRM round-trip

- Merge the chosen HubSpot readiness branch + `meeting-notes-hubspot-writeback` → green.
- Reconcile the three `cog-011-lead-detail*` lanes into one; merge canonical.

## Day 5 — Pilot proof

- Merge the chosen `pilot-001-*-proof-harness` → green.
- Wire `auto-growth-dealership-proposal-22ntav` to a concrete Client Zero pilot definition (named dealership, success metric = booked appts that show).

## Day 6 — Park & UI

- Tag/freeze WS12 in place (park, keep branches).
- Merge `operator-ui-shell-yzuotn` + the canonical lead-detail console.

## Day 7 — Demonstrable v1 skeleton

- `main` shows the voice+text dealership appointment-setter end-to-end happy path:
  **lead in → instant call + SMS → qualify → book appointment → CRM write-back → human notify**, with consent/TCPA logging.
- Publish a one-page status + updated branch ledger.

## Definition of done (week)

- `main` carries the Client-Zero spine, green.
- ≤ ~15 active branches remain (rest merged, parked/frozen, or marked superseded pending manager review).
- Duplicates reconciled (one canonical each).
- A written deep-dive exists for each shortlist branch.

## Useful consolidation aids (mine, don't merge-for-feature)

- `pr-execution-order-oce1w6` — suggested PR/merge ordering.
- `parallel-build-merge-ob37sg` — parallel build/merge approach.
- `code-28-50-integrator-qo4x4b` — integrator tooling.
