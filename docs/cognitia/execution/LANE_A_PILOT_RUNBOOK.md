# Lane A — MoverOS Pilot Runbook (warm-network)

> Framing (Architecture Lock A1): MoverOS is **Tenant Zero** — the first
> vertical proof environment for the Cognitia GTM Control Plane, the first
> production application of Cognitia Core. Moving is the proving ground
> (measurable lead + booking outcomes), not the company focus.

Date: 2026-06-11. Mode: **simulation + human send** — works today with zero
new infrastructure. No real SMS, no real payments, doctrine guards in force.

## One-time setup (operator)

1. Checkout `main` (contains the full merged v1.1 stack; verified 400/400).
2. `pnpm install`.
3. Terminal A: `SESSION_SECRET=<random> API_PORT=3001 npx tsx apps/api/src/server.ts`
   (in-memory mode until the dev DB from LANE_A_DEV_DB_VERIFICATION.md exists —
   note in-memory state resets on restart, fine for week-one piloting).
4. Terminal B: web console (`pnpm --filter @cognitia/web dev`).
5. Tokens: `SESSION_SECRET=<same> node apps/api/scripts/issue-session.mjs
--tenant 11111111-1111-1111-1111-111111111111 --role operator` (and one
   `--role owner` kept aside for permission changes only).
6. Bootstrap once on `/agents` + `/skills`: register the front-desk agent,
   issue its ATC, Import Core 20.

## Per-lead loop (target: under 5 minutes per lead)

1. Mover forwards a missed-call / web lead → operator enters it on
   `/moveros/front-desk` (consent box reflects what the customer agreed to).
2. Click **Propose action → propose_sms_reply**. The AI draft lands in
   `/approvals`.
3. Review the draft; approve with a reason (or reject — rejections are good
   evidence too).
4. **Execute simulated send** — this records the response-time proof.
5. Send the approved text to the customer **manually from the business
   phone** (this is the "human send" — Cognitia never touches the customer).
6. When the customer books / goes quiet / declines: **Record outcome** with
   the right evidence tag. Booked jobs get `verified_fact` ONLY with a real
   reference (booking ID, CRM deal, invoice). No reference → likely_inference.
7. PIPEDA: purge any lead's PII on request via the Purge button.

## Weekly review with the mover (10 minutes)

Open `/cognitia`: leads handled, response times, rescued/booked funnel, and
the one line that matters — **verified booked value**. That number only moves
on evidence; that is the pitch.

## Integration note (discovered 2026-06-11, likely_inference)

The founder's Supabase hosts `moveros-staging` — a full MoverOS operations
app (jobs, quotes, SMS templates, voice agent, lead_outreach_jobs). The
natural phase-2 integration: that app's inbound leads become Cognitia
`lead_intakes` via webhook, and Cognitia's `evidence_source` points at its
job/invoice IDs — real CRM-grade receipts. Do NOT share a database (schema
collision documented); integrate over HTTP. Scope this as its own ticket.

## Escalation rules

- Anything ambiguous with a customer → `handoff_to_human` action.
- Owner token is required to ever change `sms.send_real` — it stays deny for
  the whole pilot.
- If the mover asks for live SMS: that is the gate list in
  LANE_A_BLOCKERS.md, not a setting.
