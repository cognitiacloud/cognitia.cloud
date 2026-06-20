# Demandara Engine Overview

The "engine" is a small, repeatable workflow plus a set of reusable artifacts.
It is deliberately lightweight: a single operator can run it, a reviewer can
audit it in minutes, and nothing goes live without a human signature.

## The workflow

```
INTAKE ──► BRIEF ──► ASSET ──► REVIEW ──► READINESS GATE ──► (human) LAUNCH
  │          │         │         │            │
  │          │         │         │            └─ compliance + the four hard rules
  │          │         │         └─ Reviewer checks copy/claims/targeting
  │          │         └─ produce reel / post / ad concept / landing page
  │          └─ pick objective, audience theme, offer framing, disclaimers
  └─ what are we promoting? which platform? what inventory?
```

1. **Intake** — Capture the request: inventory or offer, target platform(s),
   goal (leads, calls, store visits, awareness), and any time sensitivity.
   Fill placeholders: `{{DEALER_NAME}}`, `{{CITY}}`, `{{STATE}}`, `{{OFFER}}`.
2. **Brief** — Choose objective + audience *theme* (not prohibited targeting),
   the offer framing, and which disclaimers from [08](08-compliance-disclaimers.md)
   apply. Cross-check [09](09-what-not-to-claim.md) for banned language.
3. **Asset** — Produce the creative (reel from [05](05-reel-ideas.md), calendar
   post from [04](04-content-calendar.md), or ad concept from
   [06](06-ad-campaign-concepts.md)) and/or the landing page per
   [07](07-landing-page-tracking-plan.md).
4. **Review** — Reviewer checks copy, claims, targeting, and required
   disclaimers. Anything financing-related routes to Counsel.
5. **Readiness gate** — Run the platform checklist ([01](01-google-ads-readiness.md)
   / [02](02-meta-ads-readiness.md) / [03](03-tiktok-readiness.md)) end-to-end.
   The last item is always a sign-off.
6. **Launch** — A human (the Reviewer) sets the budget and goes live in the
   platform. Demandara's job ends at the gate.

## Roles (RACI-lite)

| Step | Operator | Reviewer | Counsel |
|------|----------|----------|---------|
| Intake / Brief | **R** | C | — |
| Asset production | **R** | I | — |
| Copy & claims review | C | **R/A** | C (financing) |
| Readiness checklist | **R** | A | — |
| Launch gate sign-off | I | **A** | — |
| Budget / go-live | — | **R/A** | — |

R = Responsible, A = Accountable, C = Consulted, I = Informed.

## Placeholder conventions

Keep every artifact dealer-agnostic. Replace at intake, never hard-code:

| Placeholder | Meaning | Example |
|-------------|---------|---------|
| `{{DEALER_NAME}}` | Legal/brand name | Client Zero Motors |
| `{{CITY}}` / `{{STATE}}` | Primary market | Springfield, IL |
| `{{OFFER}}` | The thing being promoted | "Certified pre-owned SUVs" |
| `{{URL}}` | Destination landing page | dealer.example/cpo-suv |
| `{{PHONE}}` | Tracked call number | (555) 010-0000 |
| `{{DISCLAIMER_*}}` | A block from [08](08-compliance-disclaimers.md) | OAC, plus-fees, etc. |

## The launch gate (must be human-signed)

No campaign goes live until every box is checked and the gate is signed. This
enforces hard rules #1 (no spend) and #2 (no launch) — Demandara stops here.

```
LAUNCH GATE — {{DEALER_NAME}} — {{PLATFORM}} — {{DATE}}

[ ] Platform readiness checklist 100% complete (01 / 02 / 03)
[ ] All claims pass "what not to claim" review (09)
[ ] Every triggered disclaimer present and correct (08)
[ ] No financing promise without Counsel sign-off
[ ] Targeting reviewed; Special Ad Category set if credit-adjacent (Meta)
[ ] Advertised price = real price, all fees included (Google pricing policy)
[ ] Tracking validated in test mode (07) — consent signals firing correctly
[ ] Budget to be set by: ____________________  (a human, not Demandara)

Reviewer signature: ____________________   Date: __________
Counsel signature (if financing): ____________________   Date: __________
```

## How the artifacts fit together

- **Plan** the cadence with [04](04-content-calendar.md).
- **Make** organic creative with [05](05-reel-ideas.md).
- **Design** paid concepts with [06](06-ad-campaign-concepts.md).
- **Land** traffic and measure it with [07](07-landing-page-tracking-plan.md).
- **Stay legal** with [08](08-compliance-disclaimers.md) +
  [09](09-what-not-to-claim.md).
- **Go live (later, by a human)** only after the relevant platform checklist
  ([01](01-google-ads-readiness.md) / [02](02-meta-ads-readiness.md) /
  [03](03-tiktok-readiness.md)) and the launch gate above.
