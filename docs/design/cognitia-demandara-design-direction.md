# Cognitia / Demandara — Design Direction

> **Status of this document:** PLANNED. This is a greenfield design direction.
> No UI exists yet in this repository. Every screen, component, and token
> described here is a design proposal to be built, not a description of
> shipping software. Where this document references sample data, that data is
> **MOCK** or **SANDBOX** and is labelled as such.

**Claim legend (used throughout this doc set):**

| Label | Meaning |
|-------|---------|
| **REAL** | Verified, production-grade fact about a live system. *None in this doc — nothing is live.* |
| **SANDBOX** | Exists only in a controlled demo tenant (Tenant Zero / Client Zero). |
| **PLANNED** | Intended design or behavior, not yet built. |
| **MOCK** | Illustrative sample data for layout/communication; not derived from real activity. |

---

## 1. The thesis: a control room, not an agency template

The product must read as a **serious control room for revenue actions** — the
visual register of a trading desk, an air-traffic console, or a SOC (security
operations center), not the register of an "AI agency" landing page.

What that rules out, deliberately:

- **No AI-purple gradients.** No violet-to-magenta hero washes, no glowing
  orbs, no "sparkle" iconography as a primary motif.
- **No fake traction.** No invented dashboards full of up-and-to-the-right
  charts presented as real. Sample states are always labelled MOCK/SANDBOX.
- **No marketing-template chrome.** No oversized rounded cards floating on
  pastel blobs. Density, legibility, and auditability win over decoration.

What it argues for:

- **Calm density.** Operators scan many actions quickly. Information density is
  a feature; whitespace is spent where decisions are made.
- **Status legibility at a glance.** Color and shape encode state (pending,
  approved, rejected, blocked, executing) consistently everywhere.
- **Provenance everywhere.** Anything the system did or proposes carries a
  visible trail: who/what proposed it, on what data, with what consent, and who
  approved it.

---

## 2. Brand separation: Demandara vs Cognitia

The system is intentionally split into two brands that live in one product, so
the *action surface* and the *trust surface* never blur together.

### Demandara — the operator brand (the revenue-action surface)

- **What it is:** the working surface where revenue actions are proposed,
  reviewed, approved, rejected, and executed. The operator console, the action
  queue, the scorecards, the day-to-day cockpit.
- **Voice:** direct, operational, present-tense. "3 actions awaiting approval."
  "Send follow-up to 12 stalled deals."
- **Visual register:** the control room. Dense tables, status pills, action
  queues, keyboard-first ergonomics.
- **Primary accent:** Signal Blue (see palette) — the "act" color.

### Cognitia — the trust / control layer

- **What it is:** the governance, provenance, consent, approval-policy, and
  proof layer. The Trust Center, proof receipts, dispute/replay packs, audit
  history. (Detailed in `trust-proof-visual-system.md`.)
- **Voice:** precise, evidentiary, past-tense and conditional. "Approved by
  J. Rivera at 14:02 UTC, on consented data, under policy v4."
- **Visual register:** the ledger / the vault. Receipts, seals, immutable
  records, signed timestamps.
- **Primary accent:** Verdigris/Teal (see palette) — the "trust" color, distinct
  from the "act" blue so operators never confuse *doing* with *proving*.

### How they relate

```
        ┌─────────────────────────────────────────────┐
        │                 ONE PRODUCT                  │
        │                                              │
        │   DEMANDARA  ──proposes/executes──▶ actions  │
        │   (operator)                                 │
        │       │                                      │
        │       │ every action emits                   │
        │       ▼                                      │
        │   COGNITIA  ──records/proves──▶ proof receipt │
        │   (trust/control)                            │
        └─────────────────────────────────────────────┘
```

- Demandara is where decisions *happen*. Cognitia is where decisions are
  *governed and proven*.
- A Demandara action is never "done" until Cognitia has a proof receipt for it.
- Visually: Demandara surfaces lean on Signal Blue and dense work layouts;
  Cognitia surfaces lean on Teal and receipt/ledger layouts. Shared shell,
  typography, and spacing keep them one product.

---

## 3. Design principles

1. **Auditability is the default, not a feature flag.** If the UI shows an
   outcome, it must be one click from "why / who / on what."
2. **State is honest.** Empty is empty, loading is loading, error explains
   itself. Never fake data to fill a layout. Sample data is labelled.
3. **Color carries meaning, not mood.** Accent colors map to action/trust/state,
   not to decoration. A screen with no actionable state is mostly neutral.
4. **Density with air where it counts.** Tight tables, generous breathing room
   around the single decision an operator is making right now.
5. **Keyboard-first.** Approve/reject/skip/next are reachable without a mouse.
   The console is a tool for repetitive expert use.
6. **Two brands, one shell.** Demandara and Cognitia share the frame, the type,
   the grid; they diverge only in accent and content register.
7. **Earn trust, don't assert it.** No "AI-powered" badges, no trust theater.
   Trust is shown through receipts and provenance, not adjectives.

---

## 4. Color direction

A credible enterprise palette built on a near-neutral graphite base with two
purposeful accents (act / trust) and a disciplined status ramp. No purple
gradients.

### 4.1 Neutrals (the room)

| Token | Hex | Use |
|-------|-----|-----|
| `--bg-canvas` | `#0E1116` | App background (dark control-room default) |
| `--bg-surface` | `#161B22` | Panels, cards |
| `--bg-surface-2` | `#1C232C` | Raised/active rows, popovers |
| `--bg-inset` | `#0A0D12` | Wells, code/receipt insets |
| `--border-subtle` | `#262D38` | Hairlines, table grid |
| `--border-strong` | `#3A434F` | Focused/active borders |
| `--text-primary` | `#E6EAF0` | Primary text |
| `--text-secondary` | `#9BA6B4` | Secondary/labels |
| `--text-muted` | `#6B7686` | Disabled, timestamps |

Light theme mirror (for print/exports and accessibility preference):

| Token | Hex |
|-------|-----|
| `--bg-canvas` (light) | `#F6F8FA` |
| `--bg-surface` (light) | `#FFFFFF` |
| `--border-subtle` (light) | `#E3E8EF` |
| `--text-primary` (light) | `#13181F` |
| `--text-secondary` (light) | `#4A5663` |

### 4.2 Accents

| Token | Hex | Brand | Meaning |
|-------|-----|-------|---------|
| `--act-blue` | `#2F6FED` | Demandara | Primary action, "do it" |
| `--act-blue-strong` | `#1F54C2` | Demandara | Hover/active |
| `--trust-teal` | `#1E9E8E` | Cognitia | Proof, provenance, "proven" |
| `--trust-teal-strong` | `#157A6E` | Cognitia | Hover/active |

These two accents are intentionally distinct in hue (blue vs teal) so an
operator never confuses an *action* affordance with a *proof* affordance.

### 4.3 Status ramp (state, everywhere)

| Token | Hex | State |
|-------|-----|-------|
| `--status-pending` | `#D9A227` | Awaiting review/approval (amber) |
| `--status-approved` | `#2E9C5A` | Approved / passed (green) |
| `--status-executing` | `#2F6FED` | In flight (blue, pulsing) |
| `--status-rejected` | `#C8462F` | Rejected / failed (red-clay) |
| `--status-blocked` | `#8B5CF6` | Blocked by policy/consent (muted violet — used *only* as a state, never as brand) |
| `--status-info` | `#5B8DB8` | Neutral informational |

> Note on violet: a single muted violet (`#8B5CF6`) is reserved exclusively for
> the **blocked** state because it reads as "stop and look." It is never used
> for branding, gradients, or decoration. This is the only purple in the system.

### 4.4 Color rules

- Maintain WCAG AA (4.5:1) for body text on every surface; status colors used
  for text get darkened/lightened variants to clear AA.
- Never encode state by color alone — pair with an icon and/or label (see
  status pills, §6).
- Gradients, if used at all, are limited to a 1–2% luminance shift within the
  same neutral (e.g. subtle panel headers). No hue gradients.

---

## 5. Typography & spacing

### 5.1 Type

- **UI / interface:** `Inter` (or system fallback `-apple-system, Segoe UI,
  Roboto`). Chosen for legibility at small sizes and dense tables.
- **Numeric / tabular:** `Inter` with `font-variant-numeric: tabular-nums` for
  all numbers in tables, scorecards, timestamps, and receipts so columns align.
- **Monospace (receipts, IDs, hashes):** `JetBrains Mono` (fallback
  `ui-monospace, SFMono-Regular, Menlo`). Used in proof receipts, IDs, hashes,
  diffs — anything that must read as a verbatim record.

### 5.2 Type scale (1.200 minor-third, rounded to even px)

| Token | px / line-height | Use |
|-------|------------------|-----|
| `--text-2xs` | 11 / 16 | Micro labels, table meta |
| `--text-xs` | 12 / 18 | Secondary labels, pills |
| `--text-sm` | 13 / 20 | Table body, dense UI default |
| `--text-base` | 15 / 24 | Body, form controls |
| `--text-md` | 18 / 26 | Card titles |
| `--text-lg` | 22 / 30 | Section headers |
| `--text-xl` | 28 / 36 | Page titles |
| `--text-2xl` | 36 / 44 | Hero numbers (scorecards) |

Weights: 400 (body), 500 (labels/UI), 600 (titles), 700 (hero metrics only).

### 5.3 Spacing scale (4px base)

`--space-1: 4` · `--space-2: 8` · `--space-3: 12` · `--space-4: 16` ·
`--space-5: 24` · `--space-6: 32` · `--space-7: 48` · `--space-8: 64`

- Table row vertical padding: `--space-2` (dense) / `--space-3` (comfortable).
- Card padding: `--space-5`. Panel gutters: `--space-5`/`--space-6`.
- The single active decision area gets `--space-6`+ of breathing room.

### 5.4 Radii

| Token | px | Use |
|-------|----|----|
| `--radius-sm` | 4 | Pills, inputs, small badges |
| `--radius-md` | 8 | Cards, panels, buttons |
| `--radius-lg` | 12 | Modals, large surfaces |
| `--radius-pill` | 999 | Status pills |

Restraint: no oversized 24px+ "marketing card" radii. The system reads
engineered, not playful.

### 5.5 Elevation

Elevation is conveyed primarily by **surface tint + hairline border**, with
shadow used sparingly (dark UI relies on tint more than shadow).

| Token | Definition | Use |
|-------|------------|-----|
| `--elev-0` | flat on canvas, no shadow | base content |
| `--elev-1` | `--bg-surface` + `--border-subtle` | cards, panels |
| `--elev-2` | `--bg-surface-2` + `--border-strong` + `0 2px 8px rgba(0,0,0,.35)` | popovers, dropdowns |
| `--elev-3` | `--bg-surface-2` + `0 12px 32px rgba(0,0,0,.45)` + backdrop scrim | modals, drawers |

---

## 6. Component inventory

The shared component library (used across both Demandara and Cognitia surfaces).

### Actions & inputs
- **Buttons** — variants: `primary` (act-blue), `proof` (trust-teal),
  `secondary` (neutral outline), `danger` (rejected-red), `ghost`. Sizes: sm /
  md. Always have a focus ring (`--border-strong`, 2px). Loading state shows
  inline spinner + disables, never silently no-ops.
- **Icon buttons** — square, tooltip-labelled, used in table row actions.
- **Inputs / selects / textareas** — `--radius-sm`, `--bg-inset`, hairline
  border, clear error and helper text slots.
- **Toggle / segmented control** — for view switches (queue / history,
  dense / comfortable).
- **Command palette** — `⌘K` global; jump to action, deal, policy, receipt.

### Data display
- **Tables** — dense by default, sticky header, sortable columns, row
  selection, inline status pill column, row action affordances, keyboard row
  navigation. Zebra optional (off by default; rely on hairlines).
- **Cards** — `elev-1`. Variants: metric card, action card, **audit card**
  (before/after — spec in operator console doc), receipt card.
- **Scorecard** — hero metric + delta + sparkline + period label. Sample data
  always carries a MOCK/SANDBOX tag (see §8).
- **Badges** — small static labels (category, brand, environment).
- **Status pills** — `--radius-pill`, color + icon + label. Always all three;
  never color alone. Maps to the status ramp (§4.3).
- **Provenance/source chips** — small chip showing data source + consent state,
  links to Cognitia detail.
- **Timeline / activity log** — vertical, timestamped (tabular-nums, UTC +
  local on hover), each node typed (proposed / approved / executed / disputed).
- **Diff view** — before/after for the audit card and replay packs; mono font;
  additions/removals use status green/red at low saturation.
- **Empty state** — explicit illustration-light message + primary next action.
- **Skeleton loaders** — shimmer at low contrast; never fake content shapes
  that look like real numbers.

### Trust-specific (Cognitia)
- **Proof receipt** — the signature artifact (spec in trust-proof doc).
- **Environment/claim labels** — REAL / SANDBOX / PLANNED / MOCK badge set (§8).
- **Consent indicator** — granted / partial / revoked / unknown.
- **Seal/signature block** — hash + signed timestamp in mono.

### Overlays & feedback
- **Modal** — `elev-3`, scrim, focus-trapped, ESC to close (unless destructive
  confirm). Used for approve/reject confirmation with consequences summary.
- **Drawer** — right-side, for action detail and proof receipt inspection.
- **Toast** — bottom, transient, status-colored, with undo where reversible.
- **Tooltip / popover** — hover/focus, for timestamps, IDs, definitions.
- **Confirm dialog** — for irreversible actions; restates consequence.

### Navigation & shell
- **Top bar** — env indicator (TENANT ZERO / CLIENT ZERO sandbox), brand mark,
  command palette, user/policy context.
- **Left nav** — sectioned: Demandara (Queue, Actions, Scorecards) /
  Cognitia (Trust Center, Receipts, Disputes, Policies).
- **Breadcrumbs**, **tabs**, **pagination**.

---

## 7. Environment & sandbox labelling (design rule)

Because nothing here is production:

- The shell **always** shows an environment indicator. Demo tenants render as
  `TENANT ZERO — budget_wheels_demo (SANDBOX)` or `CLIENT ZERO (SANDBOX)`.
- Budget Wheels appears **only** as `budget_wheels_demo` / Tenant Zero. The
  dealer demo is **Client Zero**. Never as a real customer.
- No PII. Sample contacts use `*.example` / `*.test` / `*.invalid` domains and
  `555-01xx` numbers.

---

## 8. Surfacing REAL / SANDBOX / PLANNED / MOCK (overview)

A four-state badge, consistent across the system (full visual spec in
`trust-proof-visual-system.md`):

| Label | Color | Icon | Where |
|-------|-------|------|-------|
| **REAL** | `--status-approved` (green) | check-seal | Live, verified records |
| **SANDBOX** | `--status-info` (slate-blue) | beaker | Tenant Zero / Client Zero |
| **PLANNED** | `--text-muted` (gray) | blueprint | Designs not yet built |
| **MOCK** | `--status-pending` (amber) | flask | Illustrative sample data |

Rule: any number, chart, or receipt that is not REAL must carry one of the other
three labels in-context (not just in a footnote).

---

## 9. Design QA checklist

Run before any screen is considered "design complete."

**Honesty / trust**
- [ ] No sample number, chart, or receipt is unlabeled — each carries REAL /
      SANDBOX / PLANNED / MOCK.
- [ ] No fabricated traction (no invented growth charts presented as real).
- [ ] Budget Wheels appears only as `budget_wheels_demo` / Tenant Zero; dealer
      demo only as Client Zero.
- [ ] No raw PII; sample contacts use `.example/.test/.invalid`, `555-01xx`.
- [ ] No production-readiness claims anywhere in copy.

**Brand**
- [ ] Action surfaces use act-blue; proof surfaces use trust-teal; the two are
      never swapped.
- [ ] No AI-purple gradient, no sparkle/orb motifs, no marketing-template chrome.
- [ ] The only violet present is the `blocked` status, used as state only.

**State & legibility**
- [ ] Every state has a design: empty, loading (skeleton), error, success.
- [ ] Status is never encoded by color alone (icon + label present).
- [ ] Numbers use tabular-nums and align in columns.
- [ ] Timestamps show UTC and a local-time affordance.

**Accessibility**
- [ ] Body text ≥ 4.5:1 contrast on its surface; UI text/icons ≥ 3:1.
- [ ] Focus ring visible on all interactive elements; full keyboard path for
      approve / reject / next.
- [ ] Hit targets ≥ 32px in dense mode, ≥ 40px comfortable.
- [ ] Motion (pulses, shimmer) respects `prefers-reduced-motion`.

**System**
- [ ] Tokens used (no raw hex in components).
- [ ] Radii within the defined scale (no oversized marketing radii).
- [ ] Markdown/spec renders cleanly; tables and diagrams are legible.
