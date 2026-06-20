# Discovery Console — UI Spec

The Discovery Console turns a completed discovery config into a transparent
recommendation: a package tier, a set of enabled modules, a roadmap emphasis, the
proof metrics to track, and any approval-gated flags. It is deterministic — the
same inputs always produce the same output, and every recommendation can be
explained from the rules below. The working prototype is `discovery-console.html`.

> Guardrails: the console recommends **scope and process**, never a guaranteed
> outcome. It surfaces `[REQUIRES HUMAN APPROVAL]` flags for any finance/trade-in
> selection. See `../internal/guardrails.md`.

---

## Purpose

- Make scoping objective and repeatable instead of gut-feel.
- Show the dealer _why_ a tier is recommended (the score is visible).
- Emit a config object that flows into the proposal, pricing, and proof plan.

## Inputs

The console consumes the config object emitted by
`../discovery/01-discovery-questionnaire.md`. Field tags and allowed values are
canonical there. The console reads these fields:

`dealership_type`, `inventory_size`, `inventory_update_method`, `current_website`,
`current_crm`, `lead_channels[]`, `sales_team_size`, `primary_goal`,
`monthly_ad_budget`, `markets_languages[]`, `finance_handling`, `tradein_handling`.

## Screens

| #   | Screen                 | Fields collected                                                              |
| --- | ---------------------- | ----------------------------------------------------------------------------- |
| 1   | **Dealership Profile** | `dealership_type`, `markets_languages[]`                                      |
| 2   | **Inventory & Tech**   | `inventory_size`, `inventory_update_method`, `current_website`, `current_crm` |
| 3   | **Channels & Team**    | `lead_channels[]`, `sales_team_size`                                          |
| 4   | **Goals & Budget**     | `primary_goal`, `monthly_ad_budget`, `finance_handling`, `tradein_handling`   |
| 5   | **Recommendation**     | (output — see below)                                                          |

Controls: single-select fields render as chips/radio; `lead_channels[]` and
`markets_languages[]` render as multi-select chips. Each screen has Back/Next; the
Recommendation screen updates live as any selection changes.

### States

- **Empty** — nothing selected; Recommendation screen shows a prompt to begin.
- **Partial** — some required (★) fields unset; Recommendation shows a provisional
  result with a "missing fields" note and disables Export.
- **Complete** — all ★ fields set; full recommendation + Export enabled.

Required (★) fields for a recommendation: `inventory_size`,
`inventory_update_method`, `current_website`, `current_crm`, `lead_channels[]`
(≥1), `sales_team_size`, `primary_goal`, `monthly_ad_budget`.

## Recommendation engine

### Step 1 — Complexity score

Each field contributes points. The total is the complexity score (shown to the
user so the recommendation is never a black box).

| Field                     | Value → points                                               |
| ------------------------- | ------------------------------------------------------------ |
| `inventory_size`          | under_50=0 · 50_200=1 · 200_500=2 · 500_plus=3               |
| `inventory_update_method` | dms_feed=1 · spreadsheet=1 · manual_entry=2 · phone_photos=2 |
| `current_website`         | modern=0 · outdated=1 · basic=1 · none=2                     |
| `current_crm`             | dealer_crm=0 · generic_crm=1 · spreadsheet=1 · none=2        |
| `lead_channels[]`         | max(0, count − 2) × 1, capped at 3                           |
| `sales_team_size`         | solo=0 · team_2_5=1 · team_6_15=2 · team_15_plus=3           |
| `monthly_ad_budget`       | under_1k=0 · 1k_3k=1 · 3k_7k=2 · 7k_plus=3                   |
| `markets_languages[]`     | adds 1 if more than one language / any bilingual value       |

Maximum ≈ 18.

### Step 2 — Base tier from score

| Score | Base tier |
| ----- | --------- |
| 0–4   | Launch    |
| 5–9   | Growth    |
| 10+   | Scale     |

### Step 3 — Budget adjustment

- `monthly_ad_budget = under_1k` → cap recommendation at **Launch**.
- `monthly_ad_budget = 7k_plus` → floor recommendation at **Growth** (stays Scale
  if score already reached it).

The final tier and its price come from `../proposal/11-pricing-packages.md`.

### Step 4 — Module recommendations

Derived directly from fields, independent of tier (tier sets depth; these set
which modules and at what level):

| Module                   | Rule                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Website**              | `current_website ∈ {none, basic, outdated}` → Full build; `modern` → Optimize-only                                                           |
| **Inventory automation** | `dms_feed` or `500_plus` → Advanced; `spreadsheet`/`200_500` → Standard; `manual_entry`/`phone_photos`/`under_50` → Basic (assisted)         |
| **Intake channels**      | Connect each channel in `lead_channels[]` to one inbox; flag if > tier's included channel count (add-on)                                     |
| **CRM-lite**             | `current_crm = none` → provide CRM-lite; else integrate-around the existing system                                                           |
| **AI Sales Closer**      | `primary_goal = faster_response` or staffed hours limited → 24/7 priority; else after-hours baseline. Bilingual if `markets_languages[]` > 1 |
| **SEO / AEO / GEO**      | `primary_goal = online_presence` or `current_website ∈ {none, basic}` → full program priority; else foundation                               |

### Step 5 — Roadmap emphasis

Front-load the workstream that fixes the stated leak first (mirrors
`../proposal/10-roadmap-30-60-90.md`):

| `primary_goal`      | Phase-1 front-load                                   |
| ------------------- | ---------------------------------------------------- |
| `faster_response`   | AI auto-response + one-inbox intake                  |
| `more_leads`        | Website + inventory publishing + paid-channel intake |
| `higher_close_rate` | CRM-lite + follow-up + AI qualification              |
| `online_presence`   | Website + SEO/AEO foundation                         |
| `inventory_online`  | Inventory automation + vehicle pages                 |

### Step 6 — Proof metrics

The console lists the headline metrics for the dashboard, keyed to `primary_goal`
(table in `../proposal/12-proof-reporting-plan.md`).

### Step 7 — Approval flags

- `finance_handling ≠ none` → surface `[REQUIRES HUMAN APPROVAL] — finance copy`.
- `tradein_handling ≠ none` → surface `[REQUIRES HUMAN APPROVAL] — trade-in value`.

These always appear in the output when triggered; they cannot be dismissed in the
UI — they are routed to the named approver.

## Output / data model

The Recommendation screen renders, and Export emits, this object:

```json
{
  "config": {
    "dealership_type": "used",
    "inventory_size": "50_200",
    "inventory_update_method": "spreadsheet",
    "current_website": "outdated",
    "current_crm": "spreadsheet",
    "lead_channels": ["walk_in", "phone", "whatsapp", "facebook_marketplace"],
    "sales_team_size": "team_2_5",
    "primary_goal": "faster_response",
    "monthly_ad_budget": "1k_3k",
    "markets_languages": ["bilingual_en_es"],
    "finance_handling": "collect_only",
    "tradein_handling": "collect_only"
  },
  "recommendation": {
    "complexity_score": 9,
    "tier": "Growth",
    "modules": {
      "website": "full_build",
      "inventory_automation": "standard",
      "intake_channels": ["walk_in", "phone", "whatsapp", "facebook_marketplace"],
      "crm_lite": "integrate_around",
      "ai_sales_closer": "24_7_bilingual",
      "seo_aeo_geo": "foundation"
    },
    "roadmap_emphasis": "ai_auto_response_one_inbox",
    "proof_metrics": ["first_response_time", "after_hours_capture_rate"],
    "approval_flags": [
      "finance copy — REQUIRES HUMAN APPROVAL",
      "trade-in value — REQUIRES HUMAN APPROVAL"
    ]
  }
}
```

## Mapping back to the proposal

| Console output     | Consumed by                                             |
| ------------------ | ------------------------------------------------------- |
| `tier`             | `../proposal/11-pricing-packages.md` (price + scope)    |
| `modules`          | `../playbooks/04…09` (which specs apply, at what level) |
| `roadmap_emphasis` | `../proposal/10-roadmap-30-60-90.md`                    |
| `proof_metrics`    | `../proposal/12-proof-reporting-plan.md`                |
| `approval_flags`   | `../internal/guardrails.md` approval gate               |

## Branding & build constraints

- Single self-contained HTML file: HTML + vanilla JS + inline CSS. No build step,
  no network, no dependencies — opens directly in a browser.
- Light Cognitia / Demandara branding; legible, mobile-friendly.
- Output includes the guardrail disclaimer and a JSON export + copy-summary action.
