# Tenant Zero (MoverOS) — Pilot Execution Plan (FINAL)

Date: 2026-06-11. Mode: **simulation + human send** — no real SMS, no real
payments, no production deploys. Operating procedure: `LANE_A_PILOT_RUNBOOK.md`.
This document finalizes the who/when/what-counts.

## Objective

Produce the platform's first verified vertical track record: N rescued leads
and $X **verified booked value** for one warm-network mover, every number
backed by an evidence-tagged proof. This proves the GTM Control Plane, which
then onboards Demandara/Skillucate/AlphaInvesto (TENANT_MAP.md).

## Roles

- **Operator** (founder initially): runs the per-lead loop, sends approved
  texts manually from the business phone.
- **Owner token**: kept aside; only used if a permission ever needs changing
  (`sms.send_real` stays deny for the entire pilot).
- **Mover (pilot customer)**: forwards missed/slow leads; confirms bookings
  so outcomes get real evidence refs.

## Week-by-week (4-week pilot)

| Week      | Focus                                                                                                   | Exit criteria                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 (setup) | Recruit the mover (warm network); bootstrap agent + ATC + Core 20; dry-run 3 synthetic leads end-to-end | Mover agreed; dry-run produced 3 proofs incl. 1 verified outcome                                                                              |
| 1         | Live leads, low volume; operator handles every lead same-day                                            | ≥5 real leads processed; median response < 1h; zero PII incidents                                                                             |
| 2         | Volume + speed: target < 15 min lead-to-approved-draft                                                  | First **verified** booking receipt recorded                                                                                                   |
| 3         | Consistency + weekly review with mover off `/cognitia` dashboard                                        | Mover can read the verified-value line themselves                                                                                             |
| 4         | Decision week                                                                                           | Pilot report: rescued count, response-time delta, verified booked value → pricing conversation ($997/mo remains an assumption until they pay) |

## Evidence rules (non-negotiable, enforced by the platform anyway)

- A booking is `verified_fact` ONLY with a real reference (booking ID,
  invoice, CRM deal). Mover's verbal "they booked" = `likely_inference`.
- Lost/no-response leads get recorded too — the funnel is only credible if
  the denominator is honest.
- Customer PII: encrypted at intake, purge on request, never in proofs.

## Kill-gate checkpoints (Command Book §I, restated)

- End of Week 0+: no mover agreed → simplify the offer (free pilot, smaller
  scope) before building anything new.
- Week 8 from doctrine start: no PAYING pilot → Lane C token-adjacent work
  stays frozen (it already is).

## What would unlock live SMS (not part of this pilot)

CASL counsel review → Twilio sandbox behind the existing owner gate → only
then a controlled real-send trial. Tracked in NEXT_BUILD_PILOT_QUEUE.md.

## Pilot data hygiene

Run against a persistent dev DB once provided (LANE_A_DEV_DB_VERIFICATION.md
options); until then the in-memory or session-local Postgres modes work but
do not survive restarts — acceptable for Week 0 dry-runs only, not Week 1+.
**Decision needed from founder before Week 1: persistent dev DB.**
