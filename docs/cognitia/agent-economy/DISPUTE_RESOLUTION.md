# Dispute Resolution (AGENT-ECONOMY-002)

Date: 2026-06-12. Source of truth: migration `0017_dispute_resolution.sql`,
`resolveWorkOrderDispute` in `apps/api/src/agentEconomy.ts`. Internal credits
only; no real payments, no token anywhere in this mechanic.

## The path

A disputed work order holds its escrow (0016). Resolution is **owner
arbitration** — `POST /agent-economy/work-orders/:id/resolve` (owner-only,
same posture as verification and every payout-shaped action):

| Decision  | Held escrow goes to        | Reputation effect                                                                                                                             |
| --------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `release` | 100% worker                | +3 `work_order:resolved:vindicated` — ONLY if the underlying DELIVERY proof was `verified_fact` (the 0010 rule is never bent for arbitration) |
| `refund`  | 100% requester             | −2 `work_order:resolved:against_worker:<reason>`                                                                                              |
| `split`   | explicit conserved amounts | none — partial fault earns nobody credit                                                                                                      |

## What every resolution produces

1. **An append-only `dispute_resolutions` record** (one per order —
   unique-keyed): decision, structured `reason_code` + note, the conserved
   amounts (`worker_credits + requester_credits = requested_credits`,
   trigger-checked), arbiter ref, proof id. Update and delete are
   trigger-forbidden.
2. **A resolution proof** in the Proof Registry: `verified_fact` ABOUT the
   arbitration decision (`evidence_ref: dispute_resolution:<id>`, verifier =
   the arbiter). It claims a decision was made — never that the work was
   good.
3. **Escrow movements** through the existing credits `transfer` service —
   balanced, idempotent pairs with keys `wo:<id>:resolve:worker` /
   `wo:<id>:resolve:requester` (distinct from the verify/reject keys so the
   paths can never collide), audit event per movement.
4. **An audit event** `economy.work_order.resolved.v1` with the full
   decision detail.

## Enforcement (three places, as always)

- **Database (0017)**: status `resolved` is reachable ONLY from `disputed`,
  ONLY with a `verified_fact` resolution proof (trigger joins `proofs`);
  `resolved` joins the terminal set; the `dispute_resolutions` insert trigger
  checks disputed-origin, conserved math, and decision/amount coherence
  (release ⇒ requester gets 0; refund ⇒ worker gets 0).
- **In-memory mirror**: identical checks in `InMemoryRepository`.
- **Service**: validates first and refuses with 409/422 before touching
  credits.

## Deliberately out of scope (future tickets)

Bonded challenges (dispute bonds — see `crypto/TOKEN_UTILITY_MAP.md`, still
unmapped/ungated), multi-arbiter panels, appeal windows, partial re-delivery.
Each arrives behind its own migration; 0017 is never edited.
