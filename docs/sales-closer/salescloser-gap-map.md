# Demandara Sales Closer — SalesCloser Gap Map

> **Status legend:** `REAL` (exists and works) · `SANDBOX` (works only in isolated demo / Tenant Zero) · `PLANNED` (designed, not built) · `MOCK` (simulated stub, no real effect).
>
> **Greenfield notice:** The repository is near-empty. There is **no shipped Sales Closer code today**. Every Cognitia status below is `PLANNED` or `MOCK`. This is an honest gap inventory, not a feature claim. No live channel exists or is authorized.

See also: `superiority-plan.md` (main spec) and `live-readiness-gates.md` (gates + ladder).

---

## 1. Capability → gap table

For each SalesCloser AI capability: Cognitia's current status, the gap, how we close it **safely** (without live outreach where possible), and the blocker.

| SC ID | SalesCloser capability | Cognitia status | Gap | How we close it safely | Blocker |
|-------|------------------------|-----------------|-----|------------------------|---------|
| SC-1 | AI voice sales agent (live calls) | `MOCK` / `PLANNED` | No call engine; only the simulation concept exists. | Build dry-run voice state machine + mock telephony adapter (null sink) producing transcripts and proof receipts. Live calls stay behind release gate. | Engine unbuilt; live calls blocked by release gate (legal + scope + connector). |
| SC-2 | AI chat sales agent (live chat) | `MOCK` / `PLANNED` | No chat runner. | Build sandbox chat runner that replays conversations with reviewable transcripts. | Runner unbuilt; live chat blocked by release gate. |
| SC-3 | Multilingual support | `PLANNED` | No language coverage built. | Add per-language simulation with proof transcripts and reviewer notes; verify accuracy offline. | Depends on chat/voice simulators (SC-1/SC-2). |
| SC-4 | Automated scheduling | `MOCK` / `PLANNED` | No scheduling integration. | Mock appointment writes to a **sandbox calendar only**; proof receipt records intended booking. | Live calendar write blocked by connector approval. |
| SC-5 | CRM integration (live R/W) | `MOCK` / `PLANNED` | No CRM connector. | Mock CRM writeback to a **sandbox mirror** (`budget_wheels_demo` / Tenant Zero). | Live CRM write blocked by connector approval + signed scope. |
| SC-6 | Lead qualification / scoring | `PLANNED` | No scoring logic. | Deterministic + model-assisted scoring in simulation, with rationale stored as proof (explainable, replayable). | Scoring model and rules unbuilt. |
| SC-7 | Knowledge base / training | `PLANNED` | No knowledge ingestion. | Versioned knowledge pack with citation-linked answers; hallucinations catchable in review. | Ingestion + citation layer unbuilt. |
| SC-8 | Analytics & reporting | `PLANNED` | No dashboards. | Operator-console analytics derived solely from the immutable proof ledger (tamper-evident). | Depends on proof receipts (SC pipeline stage 6). |
| SC-9 | 24/7 availability | `PLANNED` | No always-on runtime. | Always-on **simulation**; live always-on stays gated and rate-limited. | Live always-on blocked by deployment controls + release gate. |
| SC-10 | Personalization at scale | `PLANNED` | No personalization engine. | Templates evaluated in dry-run against synthetic profiles; logic reviewable before exposure. | Engine unbuilt; synthetic-data only. |
| SC-11 | Follow-up automation (multi-channel) | `MOCK` / `PLANNED` | No cadence engine. | Simulate follow-up sequences end-to-end; each send is a mock with a proof receipt. | Live sends blocked by release gate (per channel). |
| SC-12 | Human handoff / escalation | `PLANNED` | Not yet implemented, but architecturally favored. | Make human-in-the-loop the **default** via pipeline stage 3 (approval is structural, not a fallback). | Operator console (stage 7) unbuilt. |

---

## 2. Prioritized gaps — most needle-moving without live outreach

Ranked by impact on closing the SalesCloser gap while requiring **zero** live channels. Delivering 1–6 is what moves readiness from 18 toward 80+.

1. **Proof receipt / audit ledger (pipeline stage 6).**
   Highest leverage. Everything else — analytics, compliance, trust — derives from it. Unlocks SC-8 and underpins the whole "proof-governed" claim. *No egress required.*

2. **Consent / compliance gate (stage 2).**
   The core safety and legal differentiator. Blocks anything without lawful basis. Required before any later live step is even conceivable. *No egress required.*

3. **Operator console (stage 7) + human approval (stage 3).**
   Makes human-in-the-loop structural (answers SC-12) and is the surface where review, replay, and approval happen. *No egress required.*

4. **Dry-run channel architecture + Egress Guard (default-CLOSED).**
   Lets us simulate SC-1, SC-2, SC-11 with proof artifacts while guaranteeing no accidental egress. The single chokepoint that keeps everything else safe. *No egress required.*

5. **Lead intake with synthetic-data + PII guards (stage 1).**
   Foundation for the pipeline; enforces `.example`/`.test`/`.invalid` and `555-01xx` examples, Tenant Zero isolation. *No egress required.*

6. **Mock appointment + mock CRM writeback (stages 4–5).**
   Demonstrates SC-4 and SC-5 parity entirely in sandbox; proves the value loop without touching a real calendar or CRM. *No egress required.*

7. **Lead qualification / scoring (SC-6).**
   Explainable, replayable scoring strengthens the conversation quality story. *No egress required.*

8. **Knowledge base with citations (SC-7) and personalization in dry-run (SC-10).**
   Improve simulated conversation quality and make answers traceable. *No egress required.*

9. **Multilingual simulation (SC-3).**
   Broadens capability surface; verified via proof transcripts. *No egress required.*

**Deferred (live-gated, intentionally last):** SC-1/SC-2/SC-11 live channels, SC-5 live CRM writes, SC-9 live always-on. These are blocked by the release gate in `live-readiness-gates.md` and require founder + counsel + customer sign-off. They contribute **nothing** to the 80+ target and are out of scope until governance is complete.

---

## 3. Honest summary

- Today: `18/100` — only mock scaffolding is conceived; nothing is shipped.
- Items 1–6 above are achievable without any live channel and represent the bulk of the path to 80+.
- A high readiness score reflects **simulation maturity and governance readiness only**. It is **not** a production-readiness or live-action claim, and it does not authorize any real call, email, SMS, WhatsApp, or live CRM write.
