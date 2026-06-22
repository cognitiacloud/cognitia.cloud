# Demandara Sales Closer — Superiority Plan

> **Status legend:** `REAL` (exists and works) · `SANDBOX` (works only in isolated demo/Tenant Zero) · `PLANNED` (designed, not built) · `MOCK` (simulated stub, no real effect).
>
> **Greenfield notice:** This repository is currently near-empty. Almost every claim below is `PLANNED`. Nothing in this document authorizes live calls, emails, SMS, WhatsApp, or any CRM write to a real system. This is a specification, not a production-readiness statement.

---

## 1. Purpose and scope

This plan defines how **Demandara Sales Closer** intends to match and then exceed the capabilities of **SalesCloser AI**, while remaining lawful, consent-first, and proof-governed.

The thesis: a fully autonomous outbound sales agent is fast but legally and reputationally fragile. Demandara's differentiator is **proof-governed automation** — every action is simulated, recorded, and human-approved before any real-world egress is even possible. We aim to beat SalesCloser on *trust, auditability, and controllability*, not on "how many calls per hour" alone.

**Current readiness self-assessment: 18/100** (mock scaffolding only). This plan targets **80+** via the gates and acceptance criteria below — all reachable *without* turning on a single live outbound channel.

Companion documents:
- `live-readiness-gates.md` — the gates and maturity ladder that govern any future live channel.
- `salescloser-gap-map.md` — capability-by-capability gap table and prioritization.

---

## 2. The proof-governed pipeline

All Sales Closer work flows through one fixed pipeline. No stage may be skipped, and stages 8 is permanently blocked until the release gate in `live-readiness-gates.md` is fully satisfied.

```
1. Lead intake
2. Consent / compliance gate
3. Human approval
4. Mock appointment
5. Mock CRM writeback
6. Proof receipt / report
7. Operator console
8. Future live calls / chat / email  ── BLOCKED behind legal + release gates
```

| # | Stage | What it does | Status |
|---|-------|--------------|--------|
| 1 | Lead intake | Ingests lead records (synthetic only) into the pipeline. | `PLANNED` |
| 2 | Consent / compliance gate | Verifies consent records, suppression lists, jurisdiction rules; blocks anything lacking lawful basis. | `PLANNED` |
| 3 | Human approval | A human operator must approve each campaign/action before it advances. | `PLANNED` |
| 4 | Mock appointment | Simulates booking a meeting; writes to a sandbox calendar only. | `PLANNED` / `MOCK` |
| 5 | Mock CRM writeback | Writes the result to a sandbox CRM mirror — never a live CRM. | `PLANNED` / `MOCK` |
| 6 | Proof receipt / report | Emits a signed, immutable record of every decision and simulated action. | `PLANNED` |
| 7 | Operator console | Human dashboard to review, approve, replay, and audit. | `PLANNED` |
| 8 | Live channels | Real calls/chat/email/SMS/WhatsApp. | `BLOCKED` — see release gate |

---

## 3. SalesCloser AI capability map

A neutral capability inventory of what SalesCloser AI (the competitor) is positioned to do. Listed so we can answer each one.

| ID | Capability | Description |
|----|------------|-------------|
| SC-1 | AI voice sales agent | Autonomous AI conducts live outbound/inbound sales calls. |
| SC-2 | AI chat sales agent | AI handles live web chat / messaging sales conversations. |
| SC-3 | Multilingual support | Conducts conversations across many languages. |
| SC-4 | Automated scheduling | Books meetings/demos directly into calendars. |
| SC-5 | CRM integration | Reads and writes lead/deal data to live CRMs. |
| SC-6 | Lead qualification | Scores and qualifies leads conversationally. |
| SC-7 | Knowledge base / training | Ingests product docs to answer prospect questions. |
| SC-8 | Analytics & reporting | Dashboards on calls, conversions, performance. |
| SC-9 | 24/7 availability | Always-on autonomous operation. |
| SC-10 | Personalization at scale | Tailors pitch per prospect automatically. |
| SC-11 | Follow-up automation | Sends automated follow-up sequences across channels. |
| SC-12 | Human handoff / escalation | Transfers to a human when needed. |

---

## 4. Demandara differentiated response

For each competitor capability, our intended posture. The recurring pattern: **we simulate first, prove everything, and put a human gate before any egress.**

| SC ID | SalesCloser does | Demandara response | Status | Why it is better |
|-------|------------------|--------------------|--------|------------------|
| SC-1 Voice | Live autonomous calls | Dry-run voice simulation: full script + state machine executes against a mock telephony adapter with **zero egress**; transcript and decisions captured as proof. Live calls gated. | `PLANNED` / `MOCK` | No accidental dials, no consent violations; every call is auditable before it could ever happen. |
| SC-2 Chat | Live autonomous chat | Sandbox chat runner replays conversations against a mock channel; operator can review the full transcript. | `PLANNED` / `MOCK` | Conversation quality is provable offline; nothing reaches a real prospect un-reviewed. |
| SC-3 Multilingual | Many languages live | Multilingual simulation with per-language proof transcripts and reviewer notes. | `PLANNED` | Language accuracy is verified by proof artifacts, not assumed. |
| SC-4 Scheduling | Writes to live calendar | Mock appointment to a sandbox calendar; proof receipt records the intended booking. | `PLANNED` / `MOCK` | No double-bookings or spam invites to real people. |
| SC-5 CRM | Live CRM read/write | Mock CRM writeback to a sandbox mirror only (`budget_wheels_demo` / Tenant Zero). | `PLANNED` / `MOCK` | Zero risk of corrupting a customer's production CRM. |
| SC-6 Qualification | Conversational scoring | Deterministic + model-assisted scoring run in simulation, with the score rationale stored as proof. | `PLANNED` | Scoring is explainable and replayable, not a black box. |
| SC-7 Knowledge base | Ingests docs | Versioned knowledge pack with citation-linked answers in dry-run. | `PLANNED` | Answers are traceable to a source; hallucinations are catchable in review. |
| SC-8 Analytics | Dashboards | Operator console + proof-derived analytics (built from immutable receipts). | `PLANNED` | Metrics are tamper-evident because they derive from the proof ledger. |
| SC-9 24/7 | Always-on autonomy | Always-on *simulation*; live always-on is gated and rate-limited. | `PLANNED` | Availability without unsupervised real-world action. |
| SC-10 Personalization | Auto-tailored pitch | Personalization templates evaluated in dry-run with synthetic profiles. | `PLANNED` | Personalization logic is reviewable before exposure to real people. |
| SC-11 Follow-up | Multi-channel auto follow-up | Follow-up sequences simulated end-to-end; each send is a mock with a proof receipt. | `PLANNED` / `MOCK` | No surprise messages; cadence is auditable. |
| SC-12 Handoff | AI-to-human transfer | Human-in-the-loop is the *default*, not the fallback — every campaign already passes through stage 3. | `PLANNED` | Humans are upstream, so escalation is structural rather than reactive. |

---

## 5. Why proof-governed beats autonomous sales reps

1. **Legal defensibility.** Consent, suppression, and jurisdiction checks run at stage 2 *before* anything can advance. Every decision is recorded, so "did we have the right to contact this person?" always has a documented answer.
2. **No silent failures.** An autonomous rep that mis-dials, ignores a do-not-call flag, or hallucinates a price causes real harm immediately. In a dry-run pipeline that same error is caught in review with no external impact.
3. **Tamper-evident audit trail.** Stage 6 emits immutable proof receipts. Analytics, compliance reports, and dispute resolution all derive from this ledger.
4. **Human accountability is structural.** Stage 3 forces a named human to approve. Autonomy is opt-in per gate, never the default.
5. **Reversibility.** Because writebacks go to sandbox mirrors (stage 5), any mistake is contained and reversible until a live connector is explicitly approved.
6. **Trust as a feature.** Enterprises buy auditability. Proof-governance is a sales advantage, not just a safety measure.

---

## 6. Dry-run channel architecture (no egress)

Every channel (voice, chat, email, SMS, WhatsApp) runs through a common adapter interface with a hard egress boundary.

```
   ┌──────────────────────────────────────────────────────┐
   │                  Channel Orchestrator                  │
   │  (runs scripts / state machines for each conversation) │
   └───────────────┬───────────────────────┬────────────────┘
                   │                        │
        ┌──────────▼─────────┐   ┌──────────▼──────────┐
        │  Mock Channel       │   │  Egress Guard        │
        │  Adapters           │   │  (default: CLOSED)   │
        │  voice/chat/email/  │   │  Allows real send    │
        │  sms/whatsapp       │   │  ONLY when release    │
        │  → /dev/null sink   │   │  gate = PASS         │
        └──────────┬─────────┘   └──────────┬──────────┘
                   │                         │
        ┌──────────▼─────────────────────────▼──────────┐
        │            Proof Receipt Emitter                │
        │  (every simulated action → immutable record)    │
        └─────────────────────────────────────────────────┘
```

**Design rules:**

- **Egress Guard default-CLOSED.** No adapter can transmit externally unless the Egress Guard returns `PASS`, which requires the full release gate. In all current states it returns `BLOCKED`.
- **Mock adapters route to a null sink.** Simulated voice/chat/email/SMS/WhatsApp actions produce transcripts and receipts but send nothing.
- **Synthetic data only.** Adapters accept only sandbox leads. Examples use `.example` / `.test` / `.invalid` domains and `555-01xx` phone numbers. No real PII.
- **Tenant isolation.** All demo activity is confined to `budget_wheels_demo` / Tenant Zero.
- **Deterministic replay.** Any simulated conversation can be re-run from its proof record for review.
- **Single egress chokepoint.** There is exactly one place external transmission could ever happen, making it auditable and kill-switchable.

---

## 7. Acceptance criteria for 80+ readiness

The following must all be true to claim **80/100** readiness. None require a live channel.

**Pipeline completeness (stages 1–7)**
- [ ] Lead intake accepts synthetic leads and rejects anything failing schema/PII checks.
- [ ] Consent/compliance gate blocks records lacking a consent reference or hitting suppression.
- [ ] Human approval is mandatory and recorded with operator identity and timestamp.
- [ ] Mock appointment writes only to sandbox calendar; proof receipt generated.
- [ ] Mock CRM writeback writes only to sandbox mirror; no live connector wired.
- [ ] Proof receipts are immutable, signed, and replayable.
- [ ] Operator console can list, filter, approve, reject, and replay any pipeline run.

**Egress safety**
- [ ] Egress Guard returns `BLOCKED` in all environments; live path is unreachable without release gate.
- [ ] All channel adapters are mocks routing to a null sink.
- [ ] No vendor API credentials present in any environment.

**Proof & audit**
- [ ] 100% of pipeline actions emit a proof receipt.
- [ ] Audit log is tamper-evident and externally verifiable.
- [ ] Analytics are derived solely from the proof ledger.

**Capability parity (in simulation)**
- [ ] Each SalesCloser capability (SC-1…SC-12) has a working dry-run equivalent producing proof artifacts.
- [ ] Multilingual simulation covers the target launch languages.

**Governance**
- [ ] `live-readiness-gates.md` release gate documented and signed off as the sole path to stage 8.
- [ ] Kill switch documented and testable in sandbox.
- [ ] No production-readiness or live-action claims anywhere in the product or docs.

Reaching 80+ proves Demandara matches SalesCloser's *capability surface* in a safer, fully auditable form. Going to live (stage 8) is a separate, gated decision owned by founder + counsel + customer — never an engineering default.
