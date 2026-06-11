# Lane A — MoverOS Pilot Readiness

> Framing (Architecture Lock A1): MoverOS is **Tenant Zero** — the first
> vertical proof environment for the Cognitia GTM Control Plane, the first
> production application of Cognitia Core. Moving is the proving ground
> (measurable lead + booking outcomes), not the company focus.

Date: 2026-06-11. Verdict: **READY for a simulation-mode pilot now; gated
items listed for live-SMS mode.** Evidence tags throughout.

## What the pilot can run TODAY (verified_fact, live-smoke verified)

- Lead intake (manual/web/simulated-SMS) with encrypted PII + consent capture.
- AI-drafted replies into the human approval queue; simulated sends with
  response-time proofs; the operator does the actual customer reply manually
  from their own phone ("simulation + human send" mode).
- Evidence-tagged outcomes with revenue receipts; verified-only reputation;
  Lead Rescue summary + Command Dashboard for the weekly pilot review.
- PIPEDA purge on request.

## Pilot runbook (warm-network mover)

1. Operator setup: dev DB (see POST_MERGE_VERIFICATION.md), real
   `COGNITIA_PII_KEY_BASE64`, operator + owner tokens.
2. Mover forwards missed-call/web leads; operator (or webhook later) enters
   them as intakes with consent noted.
3. For each lead: propose SMS reply → approve → execute simulated send →
   operator sends the approved text manually → record outcome with evidence
   (booking ref, CRM deal id) — verified_fact only when real evidence exists.
4. Weekly: open /cognitia + /moveros/front-desk with the mover; the verified
   booked value line IS the pilot scorecard.

## Gates before live SMS (in order)

1. Founder merges the stack + dev DB live (POST_MERGE_VERIFICATION.md).
2. CASL-compliant consent wording reviewed (counsel) — ticket 7 in the final
   handoff.
3. Twilio SANDBOX integration behind the existing owner-gated
   `sms.send_real` + approval flow — ticket 5; no real customer traffic until
   gates 1–2 pass.
4. Lead-detail console page (ticket 6) for operator ergonomics.

## Business assumptions (NOT facts)

$997/mo managed-service price point; warm-network mover willingness; lead
volumes. Kill gates (Command Book §I): no warm-network tester by Week 4 →
simplify the offer; no paying pilot by Week 8 → Lane C token work stays
frozen.

## unknown

Pilot-customer commitments; real lead volumes; live-DB behavior under load.
