# Auto Growth OS — System Spec (Client Zero: Car Dealership)

**Worker:** B — Client Zero Auto Growth OS
**Status:** DESIGN ARTIFACT. No real outreach, no real sends, no real PII.
**Date:** 2026-06-20
**Classification legend:** VERIFIED / INFERRED / RECOMMENDED / UNSAFE (per `cognitia/loop/GUARDRAILS.md`).

> All data shown is SYNTHETIC. No vendor adapter in this spec is implemented; every external connector is marked SANDBOX/MOCK. The proof layer attests *that an action occurred under stated conditions* — it never guarantees a sales/financing/lead-volume outcome.

---

## 1. Purpose

The Auto Growth OS is Cognitia's proof deployment for a car dealership. It runs the dealership growth loop end-to-end with an agent **trust / proof / action-ledger** layer underneath every step:

```
lead source ─▶ capture ─▶ qualify ─▶ book ─▶ nurture ─▶ human handoff ─▶ ledger/proof
      ▲                                                              │
      └──────────────── re-engagement / recycle ◀────────────────────┘
```

The differentiator is not "an AI chatbot for dealers." It is that **every agent action is recorded as a signed, replayable ledger entry plus a verifiable proof record**, so the dealer (and Cognitia) can audit *what the system claimed, did, and was permitted to do* — and so marketing claims stay bounded to what the ledger can actually prove.

`[RECOMMENDED]` Position the OS as "the dealership growth loop with receipts," not "more leads guaranteed."

---

## 2. The Growth Loop (stage by stage)

| # | Stage | Trigger | Primary agent | Output | Ledger event(s) |
|---|-------|---------|---------------|--------|-----------------|
| 1 | **Lead source / ingest** | New record from a SANDBOX lead source (web form mock, marketplace mock, walk-in mock) | Intake Agent | normalized `Lead` | `lead.ingested` |
| 2 | **Capture / enrich** | New `Lead` | Intake Agent | dedup + `Vehicle-of-interest` linkage | `lead.enriched`, `voi.linked` |
| 3 | **Qualify** | Captured lead | Sales Closer (qualification mode) | qualification score + needs profile | `lead.qualified`, `proof.qualification` |
| 4 | **Book** | Qualified + intent | Sales Closer (booking mode) → Scheduler | `Appointment` (proposed) | `appointment.proposed`, `appointment.confirmed` |
| 5 | **Nurture** | No book yet, or future-dated | Nurture Agent | scheduled touch plan (MOCK, NOT SENT) | `nurture.scheduled`, `nurture.touch.simulated` |
| 6 | **Human handoff** | Hot lead / escalation trigger | Handoff Agent | task + context packet to human rep | `handoff.requested`, `handoff.accepted` |
| 7 | **Ledger / proof** | Every step above | Proof/Ledger service (cross-cutting) | `ActionLedgerEntry` + `ProofRecord` | (records all of the above) |
| 8 | **Re-engage / recycle** | No-show, stale, lost | Nurture Agent | recycle plan (MOCK) | `lead.recycled`, `nurture.scheduled` |

`[VERIFIED]` Stage list and ordering are consistent with the loop described in `GUARDRAILS.md` system glossary (Client Zero = Auto Growth OS; Cognitia owns proof registry + action ledger + Sales Closer).

---

## 3. Agents, responsibilities, guardrails

Each agent runs under a **capability contract**: the set of actions it is allowed to take. Anything outside the contract is denied and logged as `action.denied`.

### 3.1 Intake Agent
- **Does:** normalize inbound records, dedup against existing `Lead`s, link/create a `Vehicle-of-interest`, set initial stage.
- **Must not:** send any outbound message; invent missing PII; merge leads across conflicting identities without a confidence threshold.
- **Guardrail:** ingest-only. No outbound capability in its contract.

### 3.2 Sales Closer Agent (qualification + objection + booking modes)
- **Does:** run a structured qualification dialogue (synthetic), handle objections from a bounded library, and *propose* appointment slots.
- **Must not:** promise financing approval, quote guaranteed pricing, guarantee inventory availability, or claim "you will be approved." Cannot itself transmit a message — it produces **DRAFT** turns that the (mocked) channel layer would send. In this loop the channel layer is hard-stopped: **MOCK / NOT SENT**.
- **Guardrail:** every closer turn passes a **claims filter** that strips/blocks guarantee language (see `kpis-and-proof.md` UNSAFE list). Booking writes are `proposed` until a confirmation event.

### 3.3 Scheduler (sub-capability of Sales Closer)
- **Does:** map intent to an `Appointment` slot via a SANDBOX calendar adapter.
- **Must not:** write to a real calendar in this loop. `[UNSAFE]` Live Calendly/Google Calendar booking — sandbox only until founder sign-off.

### 3.4 Nurture Agent
- **Does:** build a *scheduled* touch plan (cadence, channel intent, message template reference). In this loop touches are **simulated**, never transmitted.
- **Must not:** send WhatsApp/SMS/email (hard stop #6). No real outreach (hard stop #4).
- **Guardrail:** all touches emit `nurture.touch.simulated`, explicitly labeled MOCK / NOT SENT.

### 3.5 Handoff Agent
- **Does:** detect escalation triggers (hot intent, explicit human request, repeated objection, high-value VOI), assemble a context packet, create a human task.
- **Must not:** auto-close a deal or speak on the human's behalf post-handoff.
- **Guardrail:** handoff is a *stop* point for autonomous action; the human owns the next outbound.

### 3.6 Proof / Ledger Service (cross-cutting, not a conversational agent)
- **Does:** append `ActionLedgerEntry` for every agent action and emit a `ProofRecord` for attestable steps (qualification computed, appointment proposed/confirmed, handoff accepted).
- **Must not:** attest outcomes it did not observe (no "sale closed" proof unless a human-confirmed sale event is fed in).
- **Guardrail:** append-only; entries are immutable and replayable.

`[INFERRED]` A claims filter on Sales Closer output is the cheapest place to enforce hard-stop #9 (no guaranteed sales/financing/lead volume), because that agent is the one producing customer-facing language.

---

## 4. Where the proof registry + action ledger record each step

Two cooperating stores:

- **Action Ledger** — append-only event log. One `ActionLedgerEntry` per agent action. Purpose: *audit + replay* ("what did the system do, when, under what contract, with what inputs/outputs").
- **Proof Registry (ProofRecord)** — a subset of ledger events promoted to **attestable claims** with a verification method. Purpose: *external proof* ("we can show, verifiably, that step X happened under conditions Y"). Each `ProofRecord` references the `ActionLedgerEntry` it was minted from.

Mapping:

| Loop step | Ledger entry (always) | Proof record (attestable)? |
|-----------|----------------------|-----------------------------|
| ingest | `lead.ingested` | No (internal) |
| qualify | `lead.qualified` | **Yes** — `proof.qualification` (score + inputs hash) |
| book | `appointment.proposed/confirmed` | **Yes** — `proof.appointment` (slot, who confirmed) |
| nurture | `nurture.touch.simulated` | No — MOCK, explicitly NOT a real-contact proof |
| handoff | `handoff.accepted` | **Yes** — `proof.handoff` (packet hash, human acceptor) |
| sale (external, human-confirmed) | `sale.recorded` | **Yes only if a human/DMS feeds it** — never agent-asserted |

`[RECOMMENDED]` Keep nurture touches OUT of the proof registry while sends are mocked, so the proof layer can never imply a customer was actually contacted.

---

## 5. Data model sketch (SYNTHETIC fields only)

All examples use fake personas: `Jordan Sample`, `+1-555-0100`, `lead+demo@example.invalid`. VINs/plates are obviously fake and labeled.

### 5.1 `Lead`
```
Lead {
  lead_id:            "LEAD-DEMO-0001"          # synthetic
  display_name:       "Jordan Sample"           # SYNTHETIC persona
  phone:              "+1-555-0100"             # reserved fake range
  email:              "lead+demo@example.invalid"
  source:             "web_form_mock" | "marketplace_mock" | "walk_in_mock" | "service_mock"
  stage:              "ingested|enriched|qualified|booked|nurturing|handed_off|recycled|lost"
  qualification_score: 0.0–1.0                  # computed, see ProofRecord
  consent_status:     "synthetic_demo_only"     # NEVER a real consent flag in this loop
  created_at:         ISO-8601
  owner_human_id:     "REP-DEMO-7" | null
  pii_class:          "SYNTHETIC"               # hard requirement, every record
}
```

### 5.2 `Conversation`
```
Conversation {
  conversation_id:    "CONV-DEMO-0001"
  lead_id:            "LEAD-DEMO-0001"
  channel_intent:     "chat_mock|sms_mock|email_mock"   # intent only; NOT SENT
  turns: [
    { role: "agent|lead|human", text: "...", at: ISO-8601,
      claims_filter: "pass|blocked", send_status: "MOCK_NOT_SENT" }
  ]
  active_agent:       "intake|sales_closer|nurture|handoff"
  status:             "open|paused|handed_off|closed"
}
```

### 5.3 `Vehicle-of-interest` (VOI)
```
VehicleOfInterest {
  voi_id:             "VOI-DEMO-0001"
  lead_id:            "LEAD-DEMO-0001"
  year_make_model:    "2026 Sample Motors EV-Demo"   # SYNTHETIC, non-real model
  vin:                "FAKE-VIN-0000-DEMO"           # obviously fake, labeled
  stock_status:       "in_stock_mock|inbound_mock|sold_mock"
  budget_band:        "synthetic_band_A|B|C"          # never a real financial figure
  intent_signal:      "browse|compare|ready_to_drive"
}
```

### 5.4 `Appointment`
```
Appointment {
  appointment_id:     "APPT-DEMO-0001"
  lead_id:            "LEAD-DEMO-0001"
  voi_id:             "VOI-DEMO-0001"
  type:               "test_drive|sales_consult|service_to_sales"
  slot_start:         ISO-8601
  status:             "proposed|confirmed|completed|no_show|cancelled"
  calendar_adapter:   "SANDBOX_MOCK"                  # never a live calendar this loop
  confirmed_by:       "lead_mock|human_rep_mock|null"
}
```

### 5.5 `ActionLedgerEntry`
```
ActionLedgerEntry {
  entry_id:           "LEDG-DEMO-000001"
  ts:                 ISO-8601
  actor_agent:        "intake|sales_closer|nurture|handoff|scheduler|proof_service"
  capability_contract: "intake.v1 | sales_closer.v1 | ..."   # what it was allowed to do
  action:             "lead.ingested|lead.qualified|appointment.proposed|nurture.touch.simulated|handoff.accepted|action.denied|..."
  subject_ref:        "LEAD-DEMO-0001 | APPT-DEMO-0001 | ..."
  inputs_hash:        "sha256:<hash-of-synthetic-inputs>"     # not the raw inputs
  outputs_summary:    "human-readable, claim-bounded"
  send_status:        "N/A|MOCK_NOT_SENT"
  result:             "ok|denied|error"
  prev_entry_hash:    "sha256:..."                            # chain for tamper-evidence
}
```

### 5.6 `ProofRecord`
```
ProofRecord {
  proof_id:           "PROOF-DEMO-0001"
  proof_type:         "proof.qualification|proof.appointment|proof.handoff|proof.sale"
  ledger_entry_id:    "LEDG-DEMO-000004"          # the entry this attests
  attests:            "qualification computed at score 0.72 from inputs <hash> under contract sales_closer.v1"
  does_not_attest:    "any sale, financing approval, or lead-volume outcome"   # explicit
  verification_method: "replay_ledger + recompute_from_inputs_hash"
  minted_at:          ISO-8601
  pii_class:          "SYNTHETIC"
}
```

`[RECOMMENDED]` Every `ProofRecord` carries an explicit `does_not_attest` field. This is the structural enforcement of hard-stop #9 inside the data model — the proof object itself states its own limits.

---

## 6. Cross-cutting guardrails (mapped to GUARDRAILS.md hard stops)

| Hard stop | Enforcement point in this design |
|-----------|----------------------------------|
| #4 No real outreach | Channel layer hard-disabled; all sends `MOCK_NOT_SENT` |
| #6 No WhatsApp/SMS/email | Nurture/Closer emit *intent + template ref* only; no transport adapter |
| #7 No vendor adapter unless SANDBOX/MOCK | Scheduler + lead sources are `SANDBOX_MOCK` connectors |
| #8 No raw PII | `pii_class: SYNTHETIC` mandatory; `inputs_hash` instead of raw inputs in ledger |
| #9 No guarantees | Claims filter on Closer turns + `does_not_attest` on every ProofRecord |

`[UNSAFE]` Turning on any real channel adapter, real calendar write, or real lead-source ingest requires founder sign-off + consent/compliance review. Out of scope this loop.

---

## 7. Open design questions for founder
1. `[RECOMMENDED]` Should `ProofRecord` be cryptographically signed (key-based) or hash-chained only, for the MVP? (Hash-chain is cheaper; signing enables third-party verification.)
2. `[RECOMMENDED]` Is `sale.recorded` fed from a dealer DMS later, or always human-entered? Determines whether a "sale proof" is ever in scope.
3. `[UNSAFE]` Which channel goes live first (post-loop) and under what consent capture? Needs legal review before any send is un-mocked.
