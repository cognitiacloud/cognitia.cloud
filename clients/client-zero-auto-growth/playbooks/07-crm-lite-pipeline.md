# CRM-Lite Pipeline — Auto Growth OS

Deliverable #7. Every lead tracked from first message to Won or Lost, with
source attribution, SLA timers, and consent-aware follow-up — so nothing goes
cold in a spreadsheet. Designed to fit around the tools the dealership already
keeps, not to rip and replace them.

> Guardrails: this pipeline tracks *work and process*, not guaranteed outcomes.
> Follow-up is consent-aware, rate-aware, and quiet-hours-respecting. Finance and
> trade-in are collect-and-handoff; any customer-facing number is
> `[REQUIRES HUMAN APPROVAL]`. See `../internal/guardrails.md`.

---

## What this module does

A lead is only worth what you do with it. CRM-lite is the spine that catches
every lead from the one inbox (`06-whatsapp-telegram-intake.md`), moves it
through a clear pipeline, times the dealership against its own SLA, and feeds the
proof loop honest numbers. It is deliberately lightweight: enough structure to
stop leaks, not a CRM migration project.

## Pipeline stages

```
New → Engaged → Qualified → Appointment → Visit → Negotiation → Won
                                                              └─► Lost
```

| Stage | Enters when | Exits when |
| --- | --- | --- |
| New | Lead captured from any channel | First reply sent |
| Engaged | Two-way conversation started | Buyer intent + fit established |
| Qualified | Vehicle, timeline, budget band known | Appointment offered/booked |
| Appointment | Test drive / visit booked | Buyer shows (or no-shows) |
| Visit | Buyer arrives on the lot | Active deal discussion begins |
| Negotiation | Terms / vehicle / trade-in in play | Deal closes or falls through |
| Won | Sale completed | — terminal |
| Lost | Buyer drops, no-shows, or goes cold | Reopen on consent-aware re-engage |

`Lost` is not the end. A `Lost` lead with valid consent can be reopened by the
lost-lead re-engagement sequence below.

## Fields per lead

| Field | Type | Notes |
| --- | --- | --- |
| `lead_id` | id | System-generated |
| `first_name` / `last_name` | text | Captured at intake |
| `contact` | text | Channel handle / phone / email |
| `source_channel` | enum | From `lead_channels[]` — attribution anchor |
| `markets_language` | enum | From `markets_languages[]` |
| `vehicle_interest` | text | Model / type / use-case |
| `timeline` | enum | now / weeks / browsing |
| `budget_band` | enum | Band only; never a quoted price |
| `stage` | enum | One of the pipeline stages above |
| `owner` | ref | Assigned salesperson or AI Sales Closer |
| `consent_state` | enum | granted / withdrawn / none |
| `finance_interest` | enum | Per `finance_handling`; collect-only default |
| `tradein_details` | text | Per `tradein_handling`; collect-only default |
| `first_response_at` | timestamp | Stamps the response-time metric |
| `stage_entered_at` | timestamp | Per stage; powers days-in-stage |
| `last_contact_at` | timestamp | Drives follow-up + quiet-hours logic |

### Proof-loop metrics (computed, not entered)

| Metric | Definition |
| --- | --- |
| `response_time` | `first_response_at` − lead-created time |
| `days_in_stage` | now − `stage_entered_at`, per current stage |
| `stage_conversion` | share of leads advancing each stage transition |
| `attribution_by_channel` | leads / appointments / Won grouped by `source_channel` |

Customer-facing numbers tied to finance or trade-in are never auto-filled. Any
such value is a draft tagged `[REQUIRES HUMAN APPROVAL]` until the named approver
signs off.

## Source attribution

Every lead carries `source_channel`, set at capture from `lead_channels[]`
(`walk_in` / `phone` / `whatsapp` / `telegram` / `facebook_marketplace` /
`instagram` / `web_form` / `referral` / `paid_ads`). This is the single
attribution anchor: it never changes after capture, so reporting stays honest as
the lead moves down the pipeline.

Attribution feeds `../proposal/12-proof-reporting-plan.md` directly — the proof
dashboard reads `source_channel`, `response_time`, and `days_in_stage` from
CRM-lite to show leads, appointments, and conversion **by channel**, including
flat weeks. No vanity metrics.

## Automations (all consent-aware)

| Automation | Trigger | Action |
| --- | --- | --- |
| Auto-acknowledge | New lead, any channel | Consent-first greeting; starts `response_time` clock. Quiet hours → single auto-ack only |
| SLA timer | Lead in `New` past threshold | Escalate / notify owner; flag breach in proof loop |
| Follow-up sequence | No reply in `Engaged`/`Qualified` | Spaced, consent-checked nudges; stop on reply or STOP |
| Stage-stall alert | `days_in_stage` over threshold | Notify owner the lead is going cold |
| Lost-lead re-engagement | Stage = `Lost`, consent granted | Re-engage template; reopen to `Engaged` on reply |
| No-show recovery | `Appointment` no-show | Consent-aware rebook offer |

Every automation checks `consent_state` before any outbound message, respects
quiet hours, and is rate-aware. If consent is `withdrawn` or `none`, the lead is
held quiet — tracked internally, never messaged. No purchased lists, no blasts
(guardrail 6).

## Designing around an existing system (`current_crm`)

We do not rip and replace. The pipeline above is the logical model; how it is
hosted depends on what the dealership already runs.

| `current_crm` | Approach |
| --- | --- |
| `none` | We provide CRM-lite as the system of record |
| `spreadsheet` | Keep the sheet as a view; CRM-lite adds stages, timers, attribution around it |
| `generic_crm` | Integrate around it — map our stages/fields to theirs; no duplicate entry |
| `dealer_crm` | Integrate around it — CRM-lite supplies intake, SLA, attribution the dealer CRM lacks; their CRM stays the deal system of record |

In every case the goal is one source of attribution and one response-time clock,
without making staff enter a lead twice.

## Tool options (to evaluate, not provisioned)

| Option | Fit |
| --- | --- |
| Airtable | Fast to stand up; good for `none` / `spreadsheet` starts |
| Notion | Lightweight; works when the team already lives in Notion |
| Supabase | More control / structure if a custom front end is wanted later |
| Existing dealer CRM | Preferred when `dealer_crm` is in place and capable |

These are **options to evaluate during scoping**, not integrations we provision
here. No live wiring of any CRM, automation platform, or vendor (see
`../internal/guardrails.md`).

## Scope note

This is a specification and static model for the Client Zero prototype lane. It
does not modify core Cognitia / Hermes architecture, and it provisions nothing
live.
