# Design Lessons Extracted from the #94 Prototype

> **Status:** Extraction memo (docs-only). Captures the reusable **UI / design /
> narrative** thinking from the greenfield prototype in PR #94
> (`apps/sales-closer`, branch `claude/sales-closer-architecture-989w7r`) before that
> PR is archived as reference. **No code is ported here** — #94's implementation
> (parallel monorepo, Drizzle tables, raw-PII columns, standalone app) is explicitly
> *not* adopted; the canonical home is the platform `apps/web` on top of the #93
> foundation. This memo records *what the screens should communicate and look like*,
> mapped to platform-native homes, so the lessons survive the prototype's closure.

## Why keep the design, discard the code

#94 was a boardroom-grade visual + narrative spike. Its **value is the UX doctrine**
— how to make a human-supervised B2B closer pipeline *legible and trustworthy at a
glance* — not its greenfield plumbing. The plumbing conflicts with platform doctrine
(hashed-PII-only, reuse `accounts`/`contacts`/`agent_actions`, single `apps/web`,
approval via `/approvals`). So we extract the design language and the information
architecture and rebuild them natively when the #93 foundation's UI phase begins.

## 1. Design system (transferable tokens)

A restrained "boardroom" palette + type scale. Worth reproducing as platform tokens
(or Tailwind theme extension) for the closer surfaces:

| Token | Value | Role |
| ----- | ----- | ---- |
| `canvas` | `#F4F6F9` | Off-white app background |
| `surface` | `#FFFFFF` | Card / panel surface |
| `ink` | `#0B1220` | Primary text |
| `navy` (DEFAULT `#0B2447`, 50–900 scale) | brand | Headings, sidebar, primary structure |
| `gold` (DEFAULT `#B9892F`, `soft #FBF3DD`) | **sparingly** | Emphasis + **A-tier** only |
| `mint` (DEFAULT `#0FB5A6`, `soft #E1F6F3`) | tech accent | Eyebrows, secondary signals, mid-score |
| font | **Inter** (system fallbacks) | — |
| shadow `card` / `panel` | soft navy-tinted | Elevation |
| radius `xl` | `0.875rem` | Cards |

Principle: **navy carries structure, gold is rationed to signal the best accounts,
mint is the small "intelligence" accent.** Color is a status language, not decoration.

## 2. Component kit (rebuild as platform `apps/web` components)

The prototype's `components/ui.tsx` is a tight, reusable kit. Re-create the *intent*
of each on the platform:

- **`Card`** — titled surface with optional `action` slot; the primary container on every screen.
- **`PageHeader`** — `eyebrow` (mint, uppercase) + `title` + `subtitle` + `action`. The eyebrow names the pipeline stage, giving every screen a consistent "where am I" cue.
- **`TierBadge`** — A/B/C/D with tier-coded styling (A=gold, B=mint, C=navy, D=slate). One glanceable priority signal.
- **`Badge`** (toned) + **`StatusDot`** — small status language for source risk, consent, channel posture.
- **`StatTile`** — big-number dashboard metric with `hint` + tone accent.
- **`ScoreMeter`** — 0–100 horizontal bar, color-banded (≥75 gold, ≥55 mint, else navy). Makes score *felt*, not just printed.
- **`Field`** — label/value definition row for profile panels.
- **`CheckRow`** — pass/fail (✓/✕) row for the **website audit** (present/missing facts).
- **`SafetyBanner`** — 🛡️ banner stating governance facts (e.g. *"nothing sends automatically"*). **This is the single most important reusable element** — see §4.

## 3. Information architecture (the 7 screens → platform homes)

The prototype's 7 admin screens map onto the platform rather than a new app:

| Prototype screen | Platform-native home (post-#93) |
| ---------------- | ------------------------------- |
| Prospect list | `apps/web` closer list over `accounts` + `closer_account_profiles` (tier/score) |
| Account detail | `apps/web` account view joining `accounts` + profile + `signals` |
| Website audit | A `CheckRow` panel fed by `closer_scrape_runs` / website-profile signals |
| Closer brief | View over `closer_briefs` (markdown + structured + **evidence-tagged claims**) |
| Approval queue | **Reuse the existing `/approvals`** surface — do **not** build a new one |
| Call dashboard | Deferred until a voice channel is gated on; read from `agent_actions`/`events` |
| Compliance | View over append-only `events`/`audit_events` + the #92 `compliance_log` model |

## 4. Trust narrative (the lesson that matters most)

Three UX patterns make the "human-supervised, evidence-grounded" story legible.
These are **product requirements**, not decoration, and should be enforced on the
platform closer screens:

1. **Evidence vs. inference, visually separated on every screen.** Observed/verifiable
   facts (scraped, sourced) are rendered distinctly from AI inference. This is the UI
   counterpart of #93's evidence doctrine (`evidence_tag`; `verified_fact` requires an
   `evidence_ref`) and #92's required-evidence rules. The UI should *show* the tag.
2. **The human-approval gate is reinforced, not hidden.** A persistent `SafetyBanner`
   states plainly that nothing sends automatically and that a person approves every
   outbound step — matching #92's Gate A/B/C and #93's "approval flows through
   `agent_actions` + `/approvals`."
3. **Believable, governed seed data.** Realistic dealership fixtures (e.g. auto
   dealerships, OEM brands, rooftops, CRM vendor) make the pipeline legible end to end
   — but on the platform these must be **fixtures with hashed PII only**, never raw
   contact data, and never persisted outside the closer fixtures.

## 5. The boardroom walkthrough (`/demo`)

The prototype added a `/demo` page that guided through the full pipeline end to end,
deep-linking into the top-scored account. Worth reproducing later as a **read-only,
fixture-backed** walkthrough on `apps/web` for stakeholder demos — gated behind the
same simulation/no-outreach posture, with the `SafetyBanner` present throughout.

## What NOT to carry over (explicit)

- The parallel pnpm/Turborepo monorepo and standalone `apps/sales-closer` app.
- Drizzle tables / raw `email`/`phone` columns / `MOCK_MODE` global / direct
  `createVendorLead`→`scheduleCall` POST flow.
- Any live vendor/voice wiring. Design only; build native against #93 when the UI
  phase is authorized.
