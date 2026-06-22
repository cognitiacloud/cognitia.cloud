# Demandara Operator Console — UX Spec

> **Status:** PLANNED. This spec describes the operator console to be built.
> No console currently exists in this repository. All screens are design
> proposals; all data shown in examples is **MOCK** within the **SANDBOX**
> tenants (Tenant Zero / Client Zero). Nothing here is REAL or production.
>
> Anchor: see `cognitia-demandara-design-direction.md` for brand, tokens, and
> the control-room principle this spec inherits.

---

## 1. What the console is for

The Demandara operator console is the **control room for revenue actions**. An
operator (RevOps person, dealer manager, or admin) sits here to:

1. **See** what the system proposes (an action queue).
2. **Decide** — approve, reject, or edit each proposed action.
3. **Trust** — every decision produces a Cognitia proof receipt.
4. **Measure** — scorecards/reports summarize outcomes.

It is keyboard-first, dense, and built for repetitive expert use — not a
dashboard to admire.

---

## 2. Layout

### 2.1 The shell (3-zone control room)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TOP BAR:  [Demandara ▸]  ⌘K search   ENV: CLIENT ZERO (SANDBOX)   user ⌄    │
├──────────────┬────────────────────────────────────────────┬────────────────┤
│ LEFT NAV     │  PRIMARY WORKSPACE                          │  CONTEXT /     │
│              │                                             │  DETAIL PANEL  │
│ DEMANDARA    │  ┌───────────────────────────────────────┐ │                │
│  • Queue (3) │  │  ACTION QUEUE / detail / scorecard     │ │  selected      │
│  • Actions   │  │                                        │ │  action's      │
│  • Scorecards│  │                                        │ │  who/what/     │
│              │  │                                        │ │  consent +     │
│ COGNITIA     │  │                                        │ │  proof preview │
│  • Trust Ctr │  │                                        │ │                │
│  • Receipts  │  │                                        │ │  [Approve]     │
│  • Disputes  │  │                                        │ │  [Reject]      │
│  • Policies  │  └───────────────────────────────────────┘ │  [Edit]        │
├──────────────┴────────────────────────────────────────────┴────────────────┤
│ STATUS STRIP:  4 pending · 1 executing · last receipt 14:02 UTC · policy v4 │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Top bar** — brand context (Demandara/Cognitia), `⌘K` command palette, and a
  persistent **environment indicator** (always shows SANDBOX in demos).
- **Left nav** — two grouped sections mirroring the brand split: Demandara
  (act) and Cognitia (prove). Pending count badge on Queue.
- **Primary workspace** — the queue, an action detail, or a scorecard.
- **Context/detail panel (right)** — when an action is selected, shows its
  provenance, consent, policy check, and a proof-receipt preview, plus the
  decision buttons. This is the *single decision area* and gets the most air.
- **Status strip** — live counts + last receipt time + active policy version.

### 2.2 Action queue (primary workspace, default view)

A dense table. Each row = one proposed revenue action.

| Col | Content |
|-----|---------|
| ☐ | Multi-select for batch review |
| Status | Status pill (pending / blocked / executing) — color + icon + label |
| Action | Verb + target, e.g. "Send follow-up · 12 stalled deals (MOCK)" |
| Source | Provenance chip → which data + consent state |
| Risk | Low / Med / High pill (drives whether approval is required) |
| Proposed | Timestamp (tabular-nums, UTC; local on hover) |
| Policy | Policy gate result: ✓ allowed / ⛔ blocked |
| | Row actions: Approve · Reject · Open |

Behaviors:
- Keyboard: `↑/↓` move, `Enter` open, `a` approve, `r` reject, `e` edit,
  `x` select, `]`/`[` next/prev pending.
- Sticky header, sortable, filter bar (status, risk, source, policy).
- Dense / comfortable density toggle.
- Selecting a row populates the right context panel — no full-page nav needed.

---

## 3. Key flow: review action → approve/reject → proof receipt

```
 ┌────────────┐   open    ┌──────────────────┐  decide   ┌─────────────────┐
 │  QUEUE     │ ───────▶  │  ACTION DETAIL   │ ───────▶  │  CONFIRM        │
 │  (pending) │           │  + context panel │           │  (consequences) │
 └────────────┘           └──────────────────┘           └─────────────────┘
                                  │                              │
                                  │ approve / reject / edit      │ confirm
                                  ▼                              ▼
                          ┌──────────────────┐          ┌─────────────────┐
                          │  EXECUTING       │ ───────▶ │  PROOF RECEIPT  │
                          │  (in flight)     │  done    │  (Cognitia)     │
                          └──────────────────┘          └─────────────────┘
```

**Step by step:**

1. **Review.** Operator opens a pending action. The context panel shows:
   *what* will happen, *to whom/what* (target count, sample target as MOCK),
   *on what data* (source + consent chip), *risk*, and the *policy gate* result.
2. **Decide.**
   - **Approve** → if Med/High risk or policy requires, a **Confirm dialog**
     restates the consequence ("Will send 12 emails. Reversible? No."). Low-risk
     allowed actions can be one-key approved without a modal (configurable).
   - **Reject** → requires a reason (selectable + free text); reason is recorded
     on the receipt.
   - **Edit** → operator adjusts parameters (e.g. message, target subset) before
     approving; edits are diffed and recorded.
3. **Execute.** Status flips to `executing` (blue pulse). Action runs; failures
   surface as an error state with retry, never silently.
4. **Proof receipt.** On completion, Cognitia emits a **proof receipt** (full
   template in `trust-proof-visual-system.md`). A toast confirms with a link;
   the receipt is filed under Cognitia ▸ Receipts. **An action is not "done"
   until its receipt exists.**

State machine for an action:

```
proposed → (pending) → approved → executing → executed → [receipt]
                  │                     │
                  ├─ rejected           └─ failed → (retry | escalate)
                  └─ blocked (policy/consent) → escalate
```

---

## 4. Client Zero dealer demo flow

A scripted, end-to-end walkthrough in the **Client Zero** sandbox (the dealer
demo). All entities are SANDBOX; all numbers are MOCK.

> Data note: dealer is "Client Zero." If the auto-dealer dataset is referenced,
> it is `budget_wheels_demo` under **Tenant Zero**. Sample leads use
> `.example`/`.test` domains and `555-01xx` phones. Nothing is REAL.

**Demo script (happy path):**

1. **Land in the console**, env indicator reads `CLIENT ZERO (SANDBOX)`. Queue
   shows ~5 MOCK pending actions (e.g. "Re-engage 8 cold test-drive leads
   (MOCK)").
2. **Open the top action.** Context panel shows the proposal, the source
   ("CRM export · budget_wheels_demo", SANDBOX), consent = granted, risk = Low,
   policy ✓ allowed.
3. **Edit lightly** — operator tweaks the follow-up template. Edit is captured.
4. **Approve.** Low-risk → one confirm tap (demo shows the consequence summary
   for teaching value).
5. **Watch execute** — pulse, then complete.
6. **Open the proof receipt** — show provenance + consent + approval + the
   before/after audit. This is the "aha": the action is *proven*, not asserted.
7. **Show a reject** on a second action (e.g. High-risk discount blast) →
   blocked by policy → demonstrates the control layer stopping bad actions.
8. **End on the scorecard** — a SANDBOX/MOCK summary of the session's actions
   (counts, approvals, receipts), explicitly labelled MOCK.

**What the demo must never do:** present any number as REAL, show real customer
data, or imply production readiness. Every panel keeps its SANDBOX/MOCK badge.

---

## 5. Before/after audit card

The audit card is how the console proves *what changed* for any action. It pairs
with the proof receipt and appears in the action detail and in receipts.

```
┌─ AUDIT · Action #A-1042 ───────────────────────────  [SANDBOX] [MOCK] ┐
│  Update lead stage · 8 leads · budget_wheels_demo                     │
│                                                                       │
│   BEFORE                          │   AFTER                           │
│  ───────────────────────────────  │  ──────────────────────────────  │
│   stage:      "Cold"              │   stage:      "Re-engaged"   ▲    │
│   owner:      unassigned          │   owner:      J. Rivera      ▲    │
│   next_touch: —                   │   next_touch: 2026-06-25     ▲    │
│   consent:    granted             │   consent:    granted        =    │
│                                                                       │
│  Diff: 3 changed · 0 removed · 0 added                                │
│                                                                       │
│  Proposed by: rules-engine v4 · Approved by: J. Rivera · 14:02 UTC    │
│  Provenance: CRM export 2026-06-22 (SANDBOX) · Consent: granted       │
│  ▸ Open proof receipt                                                 │
└───────────────────────────────────────────────────────────────────────┘
```

Spec:
- **Two columns**, before (left, muted) / after (right, primary). Changed fields
  marked with a `▲` change-marker and low-saturation green; unchanged `=` muted.
- **Diff summary line** (changed/removed/added counts).
- **Attribution footer**: proposed-by (engine/version), approved-by (person),
  timestamp (UTC), provenance source, consent state — all carried into the
  receipt.
- **Always badged** with the environment/claim labels.
- Monospace for field values so diffs align; tabular-nums for any numbers.

---

## 6. Scorecard / report visual pattern

Scorecards summarize outcomes. They are the most "chart-like" surface, so the
honesty rules are strictest here.

```
┌─ SESSION SCORECARD ─────────────────────────────  [SANDBOX · MOCK DATA] ┐
│                                                                          │
│   ACTIONS REVIEWED        APPROVED            RECEIPTS EMITTED           │
│        12                    9                     9                     │
│   ▁▂▃▅▃▂▄ (MOCK)         ████░ 75%            100% of approved           │
│                                                                          │
│   Rejected: 2   ·   Blocked by policy: 1   ·   Avg review: 41s (MOCK)   │
│   Period: this session · Tenant: budget_wheels_demo (SANDBOX)           │
└──────────────────────────────────────────────────────────────────────────┘
```

Rules:
- **Header carries a persistent `MOCK DATA` / `SANDBOX` label** — not a
  footnote. If a future scorecard ever shows REAL data, the label changes to
  REAL and the data source is named.
- **Hero metric** uses `--text-2xl`, weight 700, tabular-nums.
- **Sparklines/bars are explicitly labelled (MOCK)** when illustrative — never
  an unlabeled up-and-to-the-right chart.
- Deltas show direction + magnitude with sign; neutral gray when no comparison
  baseline exists (don't invent a baseline to color a delta).
- Exportable as a report (PDF/print uses the light theme mirror); the export
  retains all claim labels.

---

## 7. Empty, loading, and error states

Every primary surface defines all three. Honesty over filler.

**Empty**
- Queue empty: "No actions awaiting review." + secondary: "New proposals appear
  here as the engine runs." + primary action ("Run proposals (SANDBOX)" in demo).
- Receipts empty: "No receipts yet — approve an action to generate the first."
- Never auto-fill with fake rows.

**Loading**
- **Skeletons** that mirror layout structure but **do not resemble real
  numbers** (gray bars, no digits). Respect `prefers-reduced-motion` (static
  skeleton, no shimmer).
- Long operations (executing) show a determinate or labelled-indeterminate
  progress with a cancel/escalate affordance.

**Error**
- Errors **explain and offer a path**: what failed, why (if known), and Retry /
  Escalate / View log. Example: "Execution failed: downstream CRM rejected 2 of
  8 updates. Retry failed only · View details."
- Partial success is shown honestly (succeeded vs failed counts), and the proof
  receipt reflects partial outcome — never rounded up to "done."
- Policy/consent blocks are not errors — they render as the `blocked` state with
  the governing policy named and an escalation path.

---

## 8. Accessibility notes

- **Keyboard:** full path for the core loop (navigate queue → open → approve /
  reject / edit → confirm) without a mouse. Visible focus ring
  (`--border-strong`, 2px) on every interactive element. Focus trapped in
  modals; ESC closes non-destructive ones.
- **Contrast:** body text ≥ 4.5:1 on its surface; status pills and icons ≥ 3:1.
  Status colors use AA-cleared text variants when used as text.
- **Never color-only:** status pills always carry icon + text label. Diff
  markers use `▲`/`=` glyphs in addition to color.
- **Targets:** ≥ 32px (dense) / ≥ 40px (comfortable) hit areas.
- **Motion:** executing-pulse and skeleton-shimmer disabled under
  `prefers-reduced-motion`; conveyed instead by label/state text.
- **Screen readers:** action rows expose a label like "Action A-1042, pending,
  high risk, blocked by policy v4." Live region announces status transitions
  (executing → executed, or failed). Timestamps read as absolute UTC.
- **Numbers/time:** tabular-nums for alignment; UTC announced, local time as an
  additional affordance, not the only one.
