# Tenant Zero — Pilot Script

A rehearsal of the first tenant's first verified job, run against the
[mainline proof harness](./PILOT_PROOF_HARNESS.md) using the real Cognitia
primitives. Emphasis: the **human operator path** and the safety gates.

> **Simulation only.** No production DB, real SMS, real payments, token, external
> credentials, or deploy. Escrow is internal credits; amounts are abstract units.

---

## Goal

Show that a new tenant can list internal work, reserve escrow, deliver against a
`verified_fact` proof, and release credits with reputation — and that weak proofs
and disputes behave safely.

## Pre-flight

```bash
pnpm install
pnpm check    # green baseline (539 tests) before running the pilot
```

No environment variables are required. The public trust feed stays safe-empty
because `COGNITIA_PUBLIC_TENANT_ID` is unset.

## Cast (mainline fixtures)

| Actor            | Kind           | Trust                                | Role                             |
| ---------------- | -------------- | ------------------------------------ | -------------------------------- |
| Requester agent  | `internal_ops` | funded 500 credits                   | orders work                      |
| Worker agent     | `internal_ops` | **active ATC** + economy permissions | provides skill                   |
| Operator / Owner | human          | —                                    | approves / verifies / arbitrates |

## Script (maps to `pilotProofHarness.test.ts`, scenario 1)

1. **List work.** `createMarketplaceListing` (operator) for the worker's active
   skill version, `price_credits: 100`, `visibility: 'internal'`.
2. **Order.** `orderFromListing` (operator) with the requester → a `proposed`
   work order priced from the listing.
3. **Accept → reserve escrow.** `acceptWorkOrder` (worker, active ATC) →
   `status: accepted`, `escrow_status: reserved`; requester balance `500 → 400`.
4. **Deliver.** `deliverWorkOrder` → the simulated skill execution emits a
   `verified_fact` proof; `status: delivered`, `evidence_tag: verified_fact`.
5. **Owner verify → release.** `verifyWorkOrder` (**owner**) → `status: verified`,
   `escrow_status: released`; worker balance `0 → 100`; reputation event
   `work_order:verified`.
6. **Audit.** `economy.work_order.verified.v1` is on the audit trail.

### Negative rehearsals (same harness)

- **Weak proof** (`likely_inference` / `unknown`): delivery succeeds but **owner**
  verify is refused (409); escrow stays reserved; no reputation.
- **Dispute → refund**: held escrow returns fully to the requester; a negative
  reputation event is booked; an operator cannot arbitrate (owner only).

## Acceptance criteria

- [ ] `pnpm check` green (539 tests).
- [ ] Escrow releases only on a `verified_fact` proof.
- [ ] Weak proofs never release; disputes are owner-arbitrated.
- [ ] Public trust feed is empty (no tenant configured).
- [ ] No production credentials needed.

## What this does **not** claim

Not production readiness; managed-Postgres RLS under a restricted role is not yet
verified (see the public-feed caveat). This is a deterministic rehearsal on the
real stack.
