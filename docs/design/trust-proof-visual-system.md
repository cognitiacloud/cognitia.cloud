# Cognitia — Trust & Proof Visual System

> **Status:** PLANNED. This describes the trust/proof visual language to be
> built. No Trust Center, proof receipt, or dispute pack exists yet in this
> repository. Every artifact below is a design proposal. All example records are
> **MOCK** within **SANDBOX** tenants (Tenant Zero / Client Zero). Nothing here
> is REAL or production-ready.
>
> Anchor: inherits tokens, the brand split, and the control-room principle from
> `cognitia-demandara-design-direction.md`. Where Demandara is the *act* surface,
> Cognitia is the *prove* surface — accent **trust-teal**, register **ledger /
> vault**.

---

## 1. Trust Center — visual language

The Trust Center is Cognitia's home: the place where an operator, auditor, or
prospect goes to answer "can I believe what this system did?"

**Register:** a ledger / vault, not a dashboard. Calm, evidentiary, mono-typed
where verbatim records appear. Trust-teal as the only accent; status ramp for
state. No charts-of-traction, no "trusted by" logo walls (that would be trust
theater).

**Layout (overview):**

```
┌─ COGNITIA · TRUST CENTER ───────────────────────  ENV: CLIENT ZERO (SANDBOX) ┐
│                                                                              │
│  ┌── How this works ───────────┐   ┌── Active policies ─────────────────┐   │
│  │ Every action is recorded as │   │ Approval policy v4   ✓ active      │   │
│  │ a proof receipt: provenance │   │ Consent policy v2    ✓ active      │   │
│  │ + consent + approval +      │   │ Retention 18mo       ✓ active      │   │
│  │ before/after.               │   └────────────────────────────────────┘   │
│  └─────────────────────────────┘                                            │
│                                                                              │
│  ┌── Recent receipts ─────────────────────────────────────  [SANDBOX] ──┐   │
│  │ R-9007 · stage update · 8 leads · 14:02 UTC · ✓ proven  [MOCK]       │   │
│  │ R-9006 · follow-up send · 12 deals · 13:48 UTC · ✓ proven [MOCK]     │   │
│  │ R-9005 · discount blast · BLOCKED by policy v4 · 13:30 UTC [MOCK]    │   │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Verify a receipt:  [ paste receipt ID / hash ]   →                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Principles:
- **Provenance is the hero.** The first thing surfaced is *how* trust is
  established (the receipt anatomy), not vanity metrics.
- **State over sentiment.** "✓ proven", "blocked by policy v4" — concrete,
  verifiable, never "AI-powered" adjectives.
- **Every record badged** with environment + claim labels.

---

## 2. Proof receipt — visual template

The proof receipt is the signature artifact of the whole system. It is what
makes a Demandara action *proven* rather than asserted.

### 2.1 Required fields

| Section | Fields |
|---------|--------|
| **Header** | Receipt ID, action ID, action verb + target, status (proven / partial / failed / blocked), env + claim badge |
| **Provenance** | Data source(s), source snapshot/timestamp, dataset/tenant, data version/hash |
| **Consent** | Consent state (granted / partial / revoked / unknown), basis/scope, consent record reference |
| **Approval** | Proposed-by (engine + version), approved/rejected-by (person), decision, reason (if rejected), decision timestamp (UTC) |
| **Outcome** | Before/after audit (diff), success/partial/failure counts, downstream system response |
| **Policy** | Governing policy + version, gate result (allowed / blocked), any escalation |
| **Seal** | Content hash, signed timestamp, verification instructions |

### 2.2 Layout

```
┌══════════════════════════════════════════════════════════════════════════┐
║ COGNITIA PROOF RECEIPT            R-9007        [SANDBOX]  [MOCK]  ✓ PROVEN ║
╠════════════════════════════════════════════════════════════════════════════╣
║ ACTION    Update lead stage · 8 leads · A-1042                             ║
║ TENANT    budget_wheels_demo (Tenant Zero · SANDBOX)                       ║
║                                                                            ║
║ ── PROVENANCE ─────────────────────────────────────────────────────────── ║
║   source     CRM export · budget_wheels_demo                               ║
║   snapshot   2026-06-22T13:55:00Z                                          ║
║   data_hash  sha256:9f2a…c10b   (MOCK example hash)                        ║
║                                                                            ║
║ ── CONSENT ──────────────────────────────────────────────────────────────  ║
║   state      ● granted          scope  marketing-followup                  ║
║   record     consent://bw-demo/2026-05/▢▢▢  (SANDBOX reference)            ║
║                                                                            ║
║ ── APPROVAL ─────────────────────────────────────────────────────────────  ║
║   proposed   rules-engine v4                                               ║
║   decided    APPROVED by J. Rivera                                         ║
║   when       2026-06-22T14:02:11Z (UTC)                                    ║
║                                                                            ║
║ ── OUTCOME (before → after) ──────────────────────────────────────────────  ║
║   stage:      "Cold"        →  "Re-engaged"      ▲                          ║
║   owner:      unassigned     →  J. Rivera         ▲                          ║
║   result:     8 of 8 updated · 0 failed                                    ║
║                                                                            ║
║ ── POLICY ───────────────────────────────────────────────────────────────  ║
║   gate       Approval policy v4 — ✓ allowed                                ║
║                                                                            ║
║ ── SEAL ─────────────────────────────────────────────────────────────────  ║
║   receipt_hash  sha256:1c44…ab90   (MOCK example)                          ║
║   signed_at     2026-06-22T14:02:12Z                                       ║
║   verify        Trust Center ▸ paste R-9007                                ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### 2.3 How provenance + consent + approval are shown

- **Provenance** = top section, mono, with a `data_hash` so the input is
  pinned. Source + snapshot time answer "on what data."
- **Consent** = its own section with a state dot (granted/partial/revoked/
  unknown), scope, and a consent record reference. Consent is never implied; if
  `unknown`, it says so and the action is flagged.
- **Approval** = who/what proposed (engine + version) vs who decided (a named
  person) — the human accountability line — with a UTC timestamp.
- These three together are the **trust triad**: *what data · whose consent ·
  whose approval*. A receipt missing any of the three renders as **incomplete**
  (amber) and cannot be marked "proven."

### 2.4 Visual rules

- Double-rule border distinguishes a receipt from an ordinary card — it reads as
  a sealed document.
- Monospace throughout (verbatim record register); tabular-nums for counts.
- Trust-teal accent only; status badge (proven/partial/failed/blocked) at top
  right.
- Hashes shown truncated with copy-full affordance; example hashes labelled MOCK.

---

## 3. Surfacing REAL / SANDBOX / PLANNED / MOCK

A single four-state badge system used everywhere a claim is made. Consistent
shape (pill), distinct color + icon + label, never color-alone.

```
 ┌─────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐
 │ ✓ REAL  │  │ ⌬ SANDBOX  │  │ ▱ PLANNED  │  │ ⚗ MOCK  │
 └─────────┘  └────────────┘  └────────────┘  └─────────┘
   green         slate-blue       gray            amber
```

| Label | Token | Icon | Meaning | Rule |
|-------|-------|------|---------|------|
| **REAL** | `--status-approved` green | check-seal | Verified live record | Only when a named live source backs it. None today. |
| **SANDBOX** | `--status-info` slate-blue | beaker `⌬` | Tenant Zero / Client Zero demo data | All current demos. |
| **PLANNED** | `--text-muted` gray | blueprint `▱` | Designed, not built | All UI in this doc set. |
| **MOCK** | `--status-pending` amber | flask `⚗` | Illustrative sample data | Any sample number/chart/receipt. |

Placement rules:
- **In-context, not footnoted.** The badge sits on the surface that makes the
  claim (receipt header, scorecard header, chart corner).
- **Stacking is allowed and expected.** Demo data is usually both `SANDBOX` and
  `MOCK`. Planned screens that also show sample data carry `PLANNED` + `MOCK`.
- **Escalation by color weight:** REAL (green) is the strongest/most reassuring;
  the others visibly signal "do not treat as live."
- A surface with **no** badge is reserved for the rare case of a verified REAL
  record — its absence is meaningful, so unlabeled-by-default is forbidden in
  the demo build (the shell forces SANDBOX).

---

## 4. Dispute / replay pack — visual

When a recipient or auditor disputes an action, Cognitia produces a **replay
pack**: a self-contained bundle that lets a third party re-trace exactly what
happened, deterministically.

```
┌─ DISPUTE · D-4410  ▸  REPLAY PACK ──────────────────  [SANDBOX]  [MOCK] ┐
│  Re: action A-1042 (receipt R-9007)        opened 2026-06-22 by auditor  │
│                                                                          │
│  TIMELINE (replayable)                                                   │
│   ● 13:55 UTC  data snapshot taken         (provenance) ───────┐         │
│   ● 14:01 UTC  proposed by rules-engine v4                     │ replay  │
│   ● 14:02 UTC  approved by J. Rivera                           │ window  │
│   ● 14:02 UTC  executed · 8/8 updated                          │         │
│   ● 14:02 UTC  receipt R-9007 sealed       (seal) ─────────────┘         │
│                                                                          │
│  PACK CONTENTS                                                           │
│   □ Input snapshot (data_hash sha256:9f2a…c10b)                          │
│   □ Proposal + parameters (engine v4 config)                            │
│   □ Consent record reference                                            │
│   □ Approval decision + actor                                           │
│   □ Before/after audit (diff)                                           │
│   □ Proof receipt R-9007 (sealed)                                       │
│   □ Governing policy v4 snapshot                                        │
│                                                                          │
│  RESULT   Replaying inputs reproduces the same outcome.  ✓ consistent    │
│  [ Download replay pack ]   [ Mark resolved ]   [ Escalate ]            │
└──────────────────────────────────────────────────────────────────────────┘
```

Spec:
- **Timeline** is the spine — each node typed and timestamped (UTC), with the
  replay window bracketed from snapshot to seal.
- **Pack contents checklist** shows everything bundled; a complete pack lets an
  outside party re-run the inputs and confirm the same outcome.
- **Consistency result** states plainly whether replay reproduced the outcome
  (✓ consistent / ⚠ divergent). Divergence is shown honestly, never hidden.
- Badged SANDBOX/MOCK; mono for hashes/IDs.

---

## 5. Investor demo — screenshot plan (PLANNED, none exist)

> **Honesty gate:** As of 2026-06-22, **zero** screenshots exist — the UI is not
> built. This section is a *plan for what to build and capture next*, not a
> gallery. Do not present any of these as existing product. When captured, each
> must carry its SANDBOX/MOCK badges in-frame.

### 5.1 Narrative the screenshots must tell

"The system doesn't just *act* on revenue — it *proves* every action." The arc:
see proposals → make a decision → get a receipt → withstand a dispute.

### 5.2 Screenshot inventory to build next

| # | Working title | Surface | Must show | Labels in-frame |
|---|---------------|---------|-----------|-----------------|
| 1 | The control room | Operator console / queue | Dense action queue, env indicator, pending counts | SANDBOX · MOCK |
| 2 | A decision in context | Action detail + context panel | Provenance chip, consent, policy gate, decision buttons | SANDBOX · MOCK |
| 3 | Confirm with consequences | Confirm dialog | Restated consequence, reversibility | SANDBOX · MOCK |
| 4 | What changed | Before/after audit card | Diff, attribution footer | SANDBOX · MOCK |
| 5 | The receipt | Proof receipt | Provenance + consent + approval triad + seal | SANDBOX · MOCK |
| 6 | The guardrail | Blocked action | Policy v4 blocking a risky discount blast | SANDBOX · MOCK |
| 7 | The Trust Center | Cognitia home | Active policies, recent receipts, verify box | SANDBOX · MOCK |
| 8 | Standing up to scrutiny | Dispute / replay pack | Replayable timeline, pack contents, ✓ consistent | SANDBOX · MOCK |
| 9 | The scorecard | Session scorecard | Outcomes summary | SANDBOX · **MOCK DATA** (prominent) |

Capture conditions: Client Zero / Tenant Zero (`budget_wheels_demo`) only;
sample contacts on `.example/.test/.invalid` + `555-01xx`; light theme for any
PDF/export variants.

### 5.3 What must NOT be faked

- **No real customers or real metrics.** No invented revenue, conversion, or
  growth numbers presented as REAL. Scorecard stays MOCK until a real source
  exists and is named.
- **No fabricated traction visuals** — no up-and-to-the-right charts implying
  adoption that hasn't happened.
- **No screenshots of nonexistent screens passed off as built.** If a screen in
  the inventory isn't built yet, it is marked PLANNED, not shown as a product
  shot.
- **No removed/cropped-out badges.** SANDBOX/MOCK labels stay in-frame in every
  investor screenshot.
- **No production-readiness claims** in captions or surrounding deck copy.
- **Budget Wheels** appears only as `budget_wheels_demo` / Tenant Zero; the
  dealer demo only as Client Zero — never as a named real customer.
