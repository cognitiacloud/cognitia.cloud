# KPIs & Proof Layer — Auto Growth OS (Client Zero)

**Status:** DESIGN ARTIFACT. Distinguishes VERIFIED ledger claims from UNSAFE marketing claims.
**Date:** 2026-06-20

> Core principle: **the proof layer attests to actions and conditions the ledger observed — never to outcomes the dealership controls.** A sale, a financing approval, and a lead-volume number are all outside the system's control and are hard-stop #9 territory.

---

## 1. The dealership KPI tree (lead → appt → show → sale funnel)

```
                         LEAD VOLUME (in)        ← NOT a Cognitia guarantee
                              │
                       Capture rate
                              ▼
                     CAPTURED / CONTACTED
                              │
                       Qualification rate
                              ▼
                        QUALIFIED LEADS  ──────────────┐
                              │                        │
                        Booking rate              (recycle / nurture
                              ▼                     from no-show & lost)
                       APPOINTMENTS (booked) ◀─────────┘
                              │
                          Show rate
                              ▼
                         SHOWS (attended)
                              │
                        Close rate            ← dealer-side, human + finance
                              ▼
                           SALES            ← NOT a Cognitia guarantee
```

### Funnel metrics (definitions)

| Metric | Definition | Owner | Cognitia can *influence* | Cognitia can *guarantee* |
|--------|-----------|-------|--------------------------|--------------------------|
| Lead volume | inbound leads / period | Marketing / ad spend | indirectly | **No** (hard stop #9) |
| Capture rate | leads engaged ÷ leads in | OS Intake | Yes | No |
| Qualification rate | qualified ÷ captured | OS Closer | Yes | No |
| Booking rate | booked ÷ qualified | OS Closer/Scheduler | Yes | No |
| Show rate | shows ÷ booked | OS + reminders (mocked) + human | partially | No |
| Close rate | sales ÷ shows | Dealer sales + F&I | minimally | **No** |
| Speed-to-lead | time: lead-in → first qualified turn | OS | **Yes (strong)** | response-time bound only |
| Re-engagement recovery | recycled leads re-booked ÷ no-shows | OS Nurture | Yes | No |

`[INFERRED]` The metrics the OS can *most credibly* move are **speed-to-lead**, **capture rate**, **booking rate**, and **re-engagement recovery** — they are mechanical and observable on the ledger. Show rate and close rate depend heavily on humans and finance.

`[RECOMMENDED]` Headline the OS on **speed-to-lead** and **booking-from-qualified**, since those are both high-impact and ledger-verifiable.

---

## 2. What the proof layer VERIFIABLY attests

Each is backed by a `ProofRecord` derived from an append-only `ActionLedgerEntry` (replayable, `inputs_hash` recomputable).

| VERIFIED claim the ledger CAN make | Backed by |
|------------------------------------|-----------|
| "This lead was ingested at time T from source S." | `lead.ingested` |
| "A qualification was computed at score X from inputs <hash> under contract C." | `proof.qualification` |
| "An appointment of type test_drive was proposed/confirmed for slot T (sandbox)." | `proof.appointment` |
| "First agent response occurred N seconds after lead ingest." (speed-to-lead) | ledger timestamps |
| "A context packet was handed to human REP-DEMO-7 at T." | `proof.handoff` |
| "An unsafe guarantee phrase was blocked by the claims filter." | `action.denied` |
| "No customer message was transmitted (all sends MOCK_NOT_SENT)." | `send_status` on every entry |
| "N nurture touches were *scheduled/simulated* (not sent)." | `nurture.touch.simulated` |

These are claims of the form **"the system did X under conditions Y, and here is the replayable record."** That is the entire value proposition of the proof layer.

`[VERIFIED]` Every claim above maps to a concrete ledger event defined in `auto-growth-os-spec.md` §5.5–5.6.

---

## 3. What the proof layer must NOT claim (UNSAFE)

These touch hard-stop #9 (no guaranteed ROI, sales, rankings, financing approval, or lead volume) or assert outcomes the system did not observe.

| `[UNSAFE]` claim — DO NOT make | Why |
|-------------------------------|-----|
| "We guarantee X more sales / Y% more revenue." | Outcome the dealer + market control. Hard stop #9. |
| "We guarantee N leads per month." | Lead volume is not Cognitia-controlled. Hard stop #9. |
| "Your customers will be approved for financing." | Financing approval is a lender decision. Hard stop #9. |
| "Guaranteed test-drive show rate of Z%." | Attendance depends on the human; not attestable. |
| "The proof layer certifies this sale closed." | Only valid if a human/DMS feeds a confirmed `sale.recorded`; never agent-asserted. |
| "Guaranteed ROI on ad spend." | Hard stop #9. |
| "Verified that the customer received our message." | Sends are MOCK_NOT_SENT this loop; would be false. |
| "Best SEO ranking guaranteed." | Hard stop #9 (rankings). |

`[RECOMMENDED]` Wire these phrases (and synonyms: "guaranteed," "will close," "definitely approved," "+X sales") into the claims filter blocklist used by the Sales Closer, so they cannot reach a draft turn. Demonstrated in `mock-workflows.md` Workflow 2.

---

## 4. VERIFIED vs UNSAFE — the dividing line

| Dimension | VERIFIED (ledger may claim) | UNSAFE (never claim) |
|-----------|-----------------------------|----------------------|
| Subject | an **action** the system took | an **outcome** the market/dealer controls |
| Observability | recorded + replayable | unobserved / future / external |
| Example | "appointment proposed at T" | "customer will buy" |
| Example | "responded in 12s" | "we'll get you 50 leads/mo" |
| Example | "qualification scored 0.78" | "this lead will be approved for financing" |

**Rule of thumb:** if it ends in `-ed` and is in the ledger, it may be a VERIFIED claim. If it is in the future tense or about money/approval/volume, it is UNSAFE.

---

## 5. Proof integrity properties (MVP target)
- **Append-only:** entries immutable; `prev_entry_hash` chains them (tamper-evident).
- **Replayable:** a `ProofRecord` can be re-verified by replaying the referenced ledger entry and recomputing from `inputs_hash`.
- **Self-limiting:** every `ProofRecord` carries `does_not_attest`, stating in-band what it does NOT prove.
- **Synthetic-safe:** `pii_class: SYNTHETIC` required; ledger stores `inputs_hash`, not raw inputs (hard stop #8).

`[RECOMMENDED]` Top 2 KPIs to instrument first: **speed-to-lead** and **booking-rate-from-qualified** — highest-impact AND fully ledger-verifiable, so they double as the cleanest proof demos.
