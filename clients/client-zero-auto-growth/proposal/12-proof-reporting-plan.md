# Proof & Reporting Plan — Auto Growth OS

This is the loop that makes Client Zero worth more than a website: a measurable
baseline, honest weekly/monthly numbers, and a recorded result that becomes the
proof case for the next dealership. Every metric below ties back to a discovery
field tag, so the questionnaire, the console, and this dashboard speak one language.

> Guardrails: we report **real numbers, including flat and down weeks**. No
> guaranteed sales, rankings, ROI, or lead counts; no vanity-only dashboards. See
> `../internal/guardrails.md`.

---

## The proof loop in one picture

```
Baseline  →  Instrument  →  Operate  →  Measure  →  Review  →  Record
(week 0)     (the leak)     (the OS)    (weekly)    (cadence)  (proof registry)
   ▲                                                               │
   └───────────────  next client pitch / case study  ◀────────────┘
```

Cognitia's **proof registry** records outcomes so the Client Zero results are
verifiable and reusable — not a screenshot emailed to the client. Demandara owns
the relationship and the review cadence.

## Step 1 — Baseline (captured at kickoff)

Before anything goes live we record the starting line from the questionnaire and a
short audit. These are the honest "before" numbers:

| Baseline metric | Source field / question |
| --- | --- |
| Avg first-response time to a new inquiry | Q19 (`response_time` baseline) |
| Inbound inquiries per week | Q18 (volume baseline) |
| Avg days-on-lot before sale | Q8 |
| Where leads come from today | `lead_channels[]` (Q16) + best-channel (Q17) |
| Current website state | `current_website` |
| Current lead tracking | `current_crm` |
| Stated primary goal | `primary_goal` |

No baseline, no proof — so this step is mandatory before the build starts.

## Step 2 — Core metrics (tracked continuously)

| Metric | What it answers | Primary source |
| --- | --- | --- |
| **First-response time** | How fast does a new lead get a reply? | AI Sales Closer + CRM-lite timestamps |
| **Leads captured** | How many inquiries did we actually capture? | CRM-lite, by `source_channel` |
| **After-hours capture rate** | Share of leads caught outside staffed hours | AI Sales Closer logs |
| **Appointments booked** | Test drives / visits scheduled | CRM-lite stage `Appointment` |
| **Show rate** | Booked → actually visited | CRM-lite `Appointment → Visit` |
| **Stage conversion** | Where leads advance or stall | CRM-lite pipeline |
| **Source attribution** | Which channels produce real customers | CRM-lite `source_channel` |
| **Content / inventory output** | Vehicles published, pages/answers shipped | Inventory automation + SEO log |
| **Days-on-lot trend** | Is inventory moving faster? | Inventory automation |

We commit to *tracking and reporting* these. We do **not** pre-promise a target
value for any of them.

## Step 3 — Metric emphasis by `primary_goal`

The console flags which metrics lead the dashboard, so the report answers the
dealer's actual question first:

| `primary_goal` | Headline metrics |
| --- | --- |
| `faster_response` | First-response time, after-hours capture rate |
| `more_leads` | Leads captured, source attribution, cost per lead (if ads) |
| `higher_close_rate` | Stage conversion, show rate, appointments booked |
| `online_presence` | Pages/answers shipped, impressions, inventory indexed |
| `inventory_online` | Vehicles published, days-on-lot trend, listing reach |

## Step 4 — Reporting cadence

| Tier | Cadence | Format |
| --- | --- | --- |
| Launch | Monthly | Dashboard + written summary |
| Growth | Monthly | Dashboard + 30-min review call |
| Scale | Bi-weekly | Dashboard + review call + case-study build |

Every checkpoint is an **honest read-out** against baseline: what moved, what
didn't, and what we're changing next. Down weeks are reported as down weeks.

## Step 5 — Dashboard spec

A single dashboard view, refreshed on cadence:

- **Header strip:** baseline vs. current for the headline metrics (per goal).
- **Funnel:** New → Engaged → Qualified → Appointment → Visit → Won, with
  stage-to-stage conversion.
- **Response time:** trend line vs. baseline, day vs. after-hours split.
- **Attribution:** leads and appointments by `source_channel`.
- **Output:** vehicles published, pages/answers shipped this period.
- **Notes:** what changed, what we're testing next, any `[REQUIRES HUMAN APPROVAL]`
  items pending dealer sign-off.

Data sources are CRM-lite, the AI Sales Closer logs, and the inventory/SEO build
logs — the same systems the playbooks define, so no extra manual tracking.

## Step 6 — Record as proof

With the dealer's permission, the baseline → result delta is written to Cognitia's
proof registry and assembled into a Client Zero case study. That case study feeds
Demandara's pitch to the next dealership — closing the loop from "first paying
client" to "repeatable proof." Nothing is published without the dealer's consent,
and every figure shown externally is a real, recorded number.

## Field-vocabulary check

The tags used here (`response_time`, `source_channel`, `primary_goal`,
`lead_channels[]`, `current_website`, `current_crm`) are the same ones defined in
`../discovery/01-discovery-questionnaire.md` and consumed by
`../console/discovery-console-spec.md` — one vocabulary, end to end.
