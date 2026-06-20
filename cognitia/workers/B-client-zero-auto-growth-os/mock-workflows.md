# Mock Workflows — Auto Growth OS (Client Zero)

**Status:** MOCK WALKTHROUGHS. Every outbound step is labeled **MOCK / NOT SENT**.
**PII:** SYNTHETIC personas only. No real customers.
**Date:** 2026-06-20

> These are dry-run traces of the growth loop. No message in this file was, or would be, transmitted in this loop (hard stops #4, #6). The `ActionLedgerEntry` blocks show what the system *would record*, not what it sent.

Synthetic personas used:
- **Jordan Sample** — `+1-555-0100` — `lead+demo@example.invalid`
- **Riley Placeholder** — `+1-555-0142` — `service+demo@example.invalid`
- **Casey Fictional** — `+1-555-0188` — `noshow+demo@example.invalid`
- Human reps: `REP-DEMO-7` (Sales), `REP-DEMO-3` (Service)
- Vehicle: `2026 Sample Motors EV-Demo`, VIN `FAKE-VIN-0000-DEMO` (obviously fake)

---

## Workflow 1 — New internet lead → qualify → book test drive

**Persona:** Jordan Sample. **Source:** `web_form_mock`. **VOI:** 2026 Sample Motors EV-Demo.

### Trace

1. **Lead lands** (web form mock fires). Intake Agent normalizes + dedups (no match) + links VOI.

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000001", actor_agent:"intake",
     capability_contract:"intake.v1", action:"lead.ingested",
     subject_ref:"LEAD-DEMO-0001", send_status:"N/A", result:"ok" }
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000002", actor_agent:"intake",
     action:"voi.linked", subject_ref:"VOI-DEMO-0001", result:"ok" }
   ```

2. **Sales Closer (qualification mode)** opens a chat-intent conversation.

   > **[MOCK / NOT SENT — agent turn]** "Hi Jordan, thanks for your interest in the 2026 EV-Demo. To point you at the right car — is this mainly for commuting, family, or weekend driving?"
   > _claims_filter: pass · send_status: MOCK_NOT_SENT_

   > **[SIMULATED lead reply]** "Family, and I want to test drive this weekend."

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000003", actor_agent:"sales_closer",
     capability_contract:"sales_closer.v1", action:"conversation.turn",
     subject_ref:"CONV-DEMO-0001", outputs_summary:"qualify Q1 asked, no guarantees",
     send_status:"MOCK_NOT_SENT", result:"ok" }
   ```

3. **Qualification computed** → score 0.78 (clear intent + timeframe + VOI match).

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000004", actor_agent:"sales_closer",
     action:"lead.qualified", subject_ref:"LEAD-DEMO-0001",
     inputs_hash:"sha256:<synthetic>", outputs_summary:"score=0.78", result:"ok" }
   ProofRecord { proof_id:"PROOF-DEMO-0001", proof_type:"proof.qualification",
     ledger_entry_id:"LEDG-DEMO-000004",
     attests:"qualification computed at 0.78 from inputs <hash> under sales_closer.v1",
     does_not_attest:"any sale or financing outcome",
     verification_method:"replay_ledger + recompute_from_inputs_hash" }
   ```

4. **Booking** — Scheduler (SANDBOX) proposes Sat 11:00.

   > **[MOCK / NOT SENT — agent turn]** "Great — I can hold Saturday 11:00 AM for a test drive of the EV-Demo. Want me to reserve it?" _(no inventory or approval guarantee)_

   > **[SIMULATED lead reply]** "Yes."

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000005", actor_agent:"scheduler",
     action:"appointment.proposed", subject_ref:"APPT-DEMO-0001",
     outputs_summary:"test_drive Sat 11:00, calendar_adapter=SANDBOX_MOCK", result:"ok" }
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000006", actor_agent:"scheduler",
     action:"appointment.confirmed", subject_ref:"APPT-DEMO-0001",
     outputs_summary:"confirmed_by=lead_mock", result:"ok" }
   ProofRecord { proof_id:"PROOF-DEMO-0002", proof_type:"proof.appointment",
     ledger_entry_id:"LEDG-DEMO-000006",
     attests:"test_drive appointment confirmed for Sat 11:00 (sandbox)",
     does_not_attest:"attendance, sale, or financing" }
   ```

5. **Handoff** to human rep for the live drive.

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000007", actor_agent:"handoff",
     action:"handoff.accepted", subject_ref:"LEAD-DEMO-0001",
     outputs_summary:"packet->REP-DEMO-7, hot intent, VOI EV-Demo", result:"ok" }
   ProofRecord { proof_id:"PROOF-DEMO-0003", proof_type:"proof.handoff",
     ledger_entry_id:"LEDG-DEMO-000007", attests:"context packet handed to REP-DEMO-7",
     does_not_attest:"any downstream sale" }
   ```

**Result:** lead → qualified → booked → handed off, fully on the ledger, zero real sends.

---

## Workflow 2 — Service-to-sales upsell

**Persona:** Riley Placeholder. **Source:** `service_mock` (in for service on an aging vehicle). **Trigger:** vehicle age + mileage band suggests upgrade fit.

### Trace

1. **Service event ingested** (mock); Intake links existing customer record (synthetic) + creates upgrade VOI.

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000101", actor_agent:"intake",
     action:"lead.ingested", subject_ref:"LEAD-DEMO-0002", outputs_summary:"source=service_mock", result:"ok" }
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000102", actor_agent:"intake",
     action:"voi.linked", subject_ref:"VOI-DEMO-0002", outputs_summary:"upgrade fit, EV-Demo", result:"ok" }
   ```

2. **Eligibility / fit check** — Sales Closer runs a soft qualification. IMPORTANT: must NOT imply guaranteed trade value or financing.

   > **[MOCK / NOT SENT — agent turn]** "Hi Riley, while your car's in for service — a lot of owners with similar mileage are exploring an upgrade. No pressure: would you like a side-by-side of your current car vs. the 2026 EV-Demo? Any figures would be estimates only, confirmed by our team."
   > _claims_filter: pass (estimate language, no guarantee)_

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000103", actor_agent:"sales_closer",
     action:"conversation.turn", subject_ref:"CONV-DEMO-0002",
     outputs_summary:"upsell offer, estimate-only framing", send_status:"MOCK_NOT_SENT", result:"ok" }
   ```

3. **Claims-filter catch (demonstration).** Closer drafted "you'll definitely get approved." Filter BLOCKS it.

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000104", actor_agent:"sales_closer",
     action:"action.denied", subject_ref:"CONV-DEMO-0002",
     outputs_summary:"blocked guarantee phrase 'definitely get approved' (hard-stop #9)",
     result:"denied" }
   ```

4. **Soft book** — Riley wants to "think about it." Nurture Agent schedules a follow-up (SIMULATED).

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000105", actor_agent:"nurture",
     action:"nurture.scheduled", subject_ref:"LEAD-DEMO-0002",
     outputs_summary:"1 touch +3d, channel_intent=sms_mock", send_status:"MOCK_NOT_SENT", result:"ok" }
   ```

   > **[MOCK / NOT SENT — scheduled touch, +3 days]** "Hi Riley, here's that EV-Demo comparison whenever you're ready. No rush."

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000106", actor_agent:"nurture",
     action:"nurture.touch.simulated", subject_ref:"LEAD-DEMO-0002",
     send_status:"MOCK_NOT_SENT", result:"ok" }
   ```

**Result:** service visit surfaced as a sales opportunity, an unsafe guarantee was caught and logged, no real send. No `proof.appointment` minted (none booked) and no nurture proof (sends mocked).

---

## Workflow 3 — No-show re-engagement

**Persona:** Casey Fictional. **State:** had `APPT-DEMO-0003` (test drive) → `no_show`.

### Trace

1. **No-show detected** (sandbox calendar marks the slot missed).

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000201", actor_agent:"scheduler",
     action:"appointment.no_show", subject_ref:"APPT-DEMO-0003", result:"ok" }
   ```

2. **Recycle** — lead moved to recycle; Nurture builds a graceful re-engagement plan (SIMULATED).

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000202", actor_agent:"nurture",
     action:"lead.recycled", subject_ref:"LEAD-DEMO-0003", outputs_summary:"reason=no_show", result:"ok" }
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000203", actor_agent:"nurture",
     action:"nurture.scheduled", subject_ref:"LEAD-DEMO-0003",
     outputs_summary:"2 touches: +1d soft, +5d offer-rebook", send_status:"MOCK_NOT_SENT", result:"ok" }
   ```

   > **[MOCK / NOT SENT — touch 1, +1 day]** "Hi Casey, sorry we missed you Saturday — life happens! Want me to find another time for the EV-Demo drive?"
   > **[MOCK / NOT SENT — touch 2, +5 days]** "Still happy to hold a slot for you, Casey. Mornings or afternoons better?"

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000204", actor_agent:"nurture",
     action:"nurture.touch.simulated", subject_ref:"LEAD-DEMO-0003", send_status:"MOCK_NOT_SENT", result:"ok" }
   ```

3. **Re-book** (simulated positive reply) → Scheduler proposes a new slot.

   > **[SIMULATED lead reply]** "Sunday afternoon works."

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000205", actor_agent:"scheduler",
     action:"appointment.proposed", subject_ref:"APPT-DEMO-0004",
     outputs_summary:"test_drive Sun 14:00, SANDBOX_MOCK", result:"ok" }
   ProofRecord { proof_id:"PROOF-DEMO-0010", proof_type:"proof.appointment",
     ledger_entry_id:"LEDG-DEMO-000205",
     attests:"rebooked test_drive proposed Sun 14:00 after a no_show",
     does_not_attest:"attendance or sale" }
   ```

4. **Cap on re-engagement.** If 2 touches yield no response, Nurture stops and marks `lost` (no infinite pestering — frequency guardrail).

   ```
   ActionLedgerEntry { entry_id:"LEDG-DEMO-000206", actor_agent:"nurture",
     action:"nurture.capped", subject_ref:"LEAD-DEMO-0003",
     outputs_summary:"max touches reached; mark lost if silent", result:"ok" }
   ```

**Result:** a no-show is recycled, re-booked, and the ledger proves the *rebooking proposal* — never the attendance. A frequency cap prevents over-contact.

---

## Cross-workflow notes
- `[VERIFIED]` Not one entry above has `send_status:"SENT"`. Every customer-facing line is `MOCK / NOT SENT`.
- `[RECOMMENDED]` The `action.denied` entry in Workflow 2 is the single most demo-able artifact: it shows the proof layer catching an unsafe claim in real time.
- `[RECOMMENDED]` Frequency cap (Workflow 3) should be a first-class config, since over-contact is the top compliance/brand risk once sends ever go live.
- `[UNSAFE]` Un-mocking any touch requires consent capture + founder sign-off (hard stops #4, #6).
