# AGENT-ECONOMY-002 — Dispute Resolution (execution record)

Date: 2026-06-12. Branch `claude/agent-economy-002-dispute-resolution`
(stacked on `claude/agent-economy-001-lab`, PR #48). Evidence:
`verified_fact` unless noted.

## What was built

Owner-arbitrated resolution of disputed work orders — the path 0016
deliberately deferred, delivered as its own migration (0017, never editing
0016):

- **Decisions**: `release` (all to worker), `refund` (all to requester),
  `split` (explicit conserved amounts; `worker + requester =
requested_credits`, trigger-checked).
- **Every resolution produces**: an append-only `dispute_resolutions` record
  (one per order), a `verified_fact` RESOLUTION proof
  (`dispute_resolution:<id>` evidence, arbiter as verifier), idempotent
  escrow ledger pairs (`wo:<id>:resolve:worker|requester` — keys distinct
  from verify/reject), and an `economy.work_order.resolved.v1` audit event.
- **Status machine**: `disputed → resolved` only; `resolved` joins the
  terminal set; entering it REQUIRES the verified_fact resolution proof —
  enforced by the 0017 trigger, the in-memory mirror, and the service.
- **Reputation semantics (honest)**: refund → −2
  (`work_order:resolved:against_worker:<reason>`); release → +3
  (`work_order:resolved:vindicated`) ONLY when the underlying DELIVERY proof
  was `verified_fact` (the 0010 rule is never bent — a worker paid on benefit
  of the doubt earns credits, not reputation); split → nothing.
- **Surfaces**: `POST /agent-economy/work-orders/:id/resolve` (owner-only);
  work-order view carries the resolution record; summary + console show
  `resolved_credits`; console gets Resolve release/refund/split actions on
  disputed orders.

## Verification

- `apps/api/src/disputeResolution.test.ts`: 7 tests, green on first run —
  all three decisions with balance + ledger-conservation assertions
  (escrow account ends at 0 on split), weak-delivery-proof release pays but
  books NO positive reputation, non-conserved split 422 / missing amounts
  400, owner-only 403, resolve-only-from-disputed 409, resolved-terminal 409,
  summary + view exposure.
- New shared contract case (memory AND PGlite): disputed-origin, conserved
  math, one-resolution-per-order uniqueness, tenant isolation,
  verified_fact-gated `resolved` transition, terminality.
- Full gate: see PR — `pnpm check` green across the suite, doctrine guards
  included.

## Unchanged guardrails

Internal credits only (0012 rail check untouched); no real payments, no
token transfers, no public token surface; arbitration is owner-only. Dispute
BONDS remain unmapped/ungated (`crypto/TOKEN_UTILITY_MAP.md`).

## Follow-ups

AGENT-ECONOMY-003 (agent-driven accept/deliver via the action ledger),
-004 (marketplace listings + tier-aware matching), -005 (cross-tenant
settlement design doc). Multi-arbiter panels / appeal windows / bonded
challenges are deliberately out of scope behind future migrations.
