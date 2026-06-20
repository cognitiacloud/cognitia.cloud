# Client Zero — Auto Growth OS

This folder is the complete proposal and discovery system for the first car
dealership engagement ("Client Zero"). It is the **first real proof loop** for
the Cognitia + Demandara stack: a scoped, productized engagement we can run, win,
measure, and then repeat for the next dealership and the next vertical.

> **Scope.** This is a Client Zero artifact / prototype lane — proposal,
> specifications, templates, and a static console prototype. It does **not** wire
> any live vendor (CRM, WhatsApp, Telegram, ads, Zapier/Make) and does **not**
> modify core Cognitia / Hermes / pipeline architecture. See
> [`internal/guardrails.md`](internal/guardrails.md).

## How Cognitia and Demandara fit

- **Cognitia** — the agent trust / control plane, proof registry, compliance
  layer, and Sales Closer / GTM OS. It governs how agents behave (disclosure,
  handoff, approval gates) and records verifiable proof of outcomes. The AI Sales
  Closer in this package runs *under* Cognitia's control plane.
- **Demandara** — the demand / go-to-market surface that packages this into a
  sellable offer: the proposal, the pricing, the discovery motion, and the case
  study that comes out the other side.
- **Hermes Vision Skill** (`hermes/skills/vision-skill/`) — a supporting media /
  publish-safety artifact, reused to QC vehicle photos before publish. Not the
  platform; not modified here.

## What's inside

### `proposal/` — client-facing
| File | Deliverable |
| --- | --- |
| [`00-proposal-outline.md`](proposal/00-proposal-outline.md) | Master proposal outline |
| [`03-auto-growth-os-offer.md`](proposal/03-auto-growth-os-offer.md) | (3) The Auto Growth OS offer |
| [`10-roadmap-30-60-90.md`](proposal/10-roadmap-30-60-90.md) | (10) 30 / 60 / 90-day roadmap |
| [`11-pricing-packages.md`](proposal/11-pricing-packages.md) | (11) Pricing packages (USD) |
| [`12-proof-reporting-plan.md`](proposal/12-proof-reporting-plan.md) | (12) Proof & reporting plan |

### `discovery/` — discovery system
| File | Deliverable |
| --- | --- |
| [`01-discovery-questionnaire.md`](discovery/01-discovery-questionnaire.md) | (1) Discovery questionnaire |
| [`02-meeting-script.md`](discovery/02-meeting-script.md) | (2) Meeting script |

### `console/` — Auto Growth OS Discovery Console
| File | Purpose |
| --- | --- |
| [`discovery-console-spec.md`](console/discovery-console-spec.md) | UI spec: screens, options, recommendation logic, data model |
| [`discovery-console.html`](console/discovery-console.html) | Working single-file prototype (open in a browser) |

### `playbooks/` — internal build specs
| File | Deliverable |
| --- | --- |
| [`04-website-blueprint.md`](playbooks/04-website-blueprint.md) | (4) Dealership website blueprint |
| [`05-inventory-automation.md`](playbooks/05-inventory-automation.md) | (5) Inventory automation workflow |
| [`06-whatsapp-telegram-intake.md`](playbooks/06-whatsapp-telegram-intake.md) | (6) WhatsApp/Telegram vehicle intake |
| [`07-crm-lite-pipeline.md`](playbooks/07-crm-lite-pipeline.md) | (7) CRM-lite pipeline |
| [`08-ai-sales-closer-script.md`](playbooks/08-ai-sales-closer-script.md) | (8) AI Sales Closer script |
| [`09-seo-aeo-geo-page-map.md`](playbooks/09-seo-aeo-geo-page-map.md) | (9) SEO / AEO / GEO page map |

### `internal/`
| File | Purpose |
| --- | --- |
| [`implementation-plan.md`](internal/implementation-plan.md) | Internal build plan: sequencing, owners, tools, risks |
| [`guardrails.md`](internal/guardrails.md) | Canonical guardrails (referenced everywhere) |

## The one shared vocabulary

The questionnaire (1) collects tagged fields → the Discovery Console reads those
same fields and recommends a configuration → the proof plan (12) measures the
same fields as outcomes. One vocabulary, end to end:
`dealership_type`, `inventory_size`, `current_website`, `lead_channels[]`,
`current_crm`, `sales_team_size`, `primary_goal`, `monthly_ad_budget`,
`markets_languages[]`, `finance_handling`, `tradein_handling`.

## Guardrails (always on)

No guaranteed sales. No guaranteed rankings. No guaranteed ROI or lead volume. No
unsafe financing claims. No trade-in value claims without sign-off. No spam. Every
finance / trade-in / price claim is marked `[REQUIRES HUMAN APPROVAL]` until a
named human signs off. Full list: [`internal/guardrails.md`](internal/guardrails.md).
