# Omni-Channel Vehicle Intake — WhatsApp / Telegram + One Inbox

Deliverable #6. The intake layer that turns a message on any channel into a
tracked lead in one inbox, with a consistent, consent-first conversation. Every
template below is a draft to wire later; nothing here is live.

> Guardrails: every template is opt-in, consent-first, rate-aware, and carries an
> opt-out path and quiet-hours handling. Finance and trade-in are collect-only by
> default; any customer-facing number is `[REQUIRES HUMAN APPROVAL]`. See
> `../internal/guardrails.md`.

---

## What this module does

Buyers message you on whatever channel is open in front of them. Today those
threads scatter across phones, apps, and accounts, and the slow ones go cold.
This module gives every channel one front door and one inbox, so the first reply
is fast and consistent and nothing is lost to "I'll check that account later."

It is **intake**, not the closer. It captures, confirms consent, structures the
lead, and routes it. The conversation that qualifies and books is the AI Sales
Closer (`08-ai-sales-closer-script.md`); the place the lead lands and is worked
is the CRM-lite pipeline (`07-crm-lite-pipeline.md`).

## Channels covered (`lead_channels[]`)

| Channel                | Intake role                                                |
| ---------------------- | ---------------------------------------------------------- |
| `whatsapp`             | Primary conversational intake; consent + opt-out native    |
| `telegram`             | Secondary conversational intake; same flow as WhatsApp     |
| `web_form`             | Structured capture; consent checkbox at submit             |
| `facebook_marketplace` | Inbound message → greeting + capture                       |
| `instagram`            | DM inbound → greeting + capture                            |
| `phone`                | Logged as a lead; SMS/WhatsApp follow-up only with consent |
| `walk_in`              | Logged by staff; opt-in capture for follow-up              |
| `referral`             | Logged with source; standard consent on first message      |
| `paid_ads`             | Click-to-message lands in the same greeting + capture      |

All conversational channels run the **same five templates** below so the buyer
gets one voice regardless of where they started.

---

## The flow

```
New message (any channel)
        │
        ▼
[1] Greeting + consent  ── declines / no reply ──► opt-out logged, no further
        │                                          outreach; lead held quiet
   consent given
        │
        ▼
[2] Capture: name, vehicle-of-interest, timeline, language
        │
        ▼
Route to ONE INBOX  ──►  CRM-lite: create lead, set source = channel,
        │                start response-time + days-in-stage clocks
        ▼
Decision: AI Sales Closer  ── or ──  human (per hours / complexity / request)
        │
        ▼
Branch templates as needed:
   [3] vehicle-of-interest detail
   [4] trade-in intake (collect-only, approval-gated)
   [5] test-drive booking
   [6] follow-up / re-engagement (consent-aware)
```

Quiet hours: if a message arrives inside the dealership's configured quiet-hours
window, the system may send **one** consent-first auto-acknowledge (buyer-
initiated reply), then holds any further outbound until the window opens.
Outbound-initiated messages are never sent during quiet hours.

---

## Consent, opt-out, and quiet-hours — the standard lines

Reuse these verbatim across templates. They are the guardrail surface.

- **Consent line:** "Is it OK if we message you here about this? Reply YES to
  continue, or STOP anytime to opt out."
- **Opt-out line:** "Reply STOP to opt out — we won't message you again."
- **Quiet-hours line (auto-ack only):** "Thanks for reaching out! Our team is
  offline right now (after [quiet_hours]). We'll reply first thing when we're
  back. Reply STOP to opt out."

Bilingual handling per `markets_languages[]`:

- `english` / `spanish`: send templates in that language only.
- `bilingual_en_es`: detect the buyer's language from their first message;
  default to a short EN + ES greeting, then continue in whichever language they
  reply in.
- `other`: flag for human handoff; do not auto-translate sensitive content.

---

## Templates

Placeholders in `[brackets]` are filled from config or the live thread. Keep them
short; these are messages, not emails.

### [1] New-lead capture / greeting

> Hi, thanks for reaching out to [dealership_name]! I'm the [dealership_name]
> assistant — happy to help you find the right vehicle.
>
> Is it OK if we message you here about this? Reply YES to continue, or STOP
> anytime to opt out.

ES (bilingual):

> Hola, gracias por escribir a [dealership_name]. Soy el asistente de
> [dealership_name] y con gusto te ayudo. ¿Está bien si te escribimos por aquí?
> Responde SÍ para continuar o STOP para darte de baja.

Notes: discloses it is an assistant (guardrail 7). No outbound follow-up until
YES. Sets source attribution = channel in CRM-lite.

### [2] Vehicle-of-interest

> Great — what are you looking for? You can tell me a model, a budget range, or
> just what you need it for (family, work, first car). I'll pull matching options
> from our current stock.
>
> Reply STOP to opt out anytime.

Captures: `vehicle_interest`, `timeline`, optional `budget_band`. No price is
quoted here; the closer/human confirms availability and figures. Any stated
price back to the buyer is `[REQUIRES HUMAN APPROVAL]`.

### [3] Trade-in intake (collect-only, approval-gated)

Applies when `tradein_handling` = `collect_only` (default). The system
**collects** the vehicle details; a human produces the number.

> Happy to factor in your trade-in. Could you share a few details so our team can
> review it?
>
> - Make / model / year
> - Approx. mileage
> - Overall condition (excellent / good / fair)
> - A couple of photos if you have them
>
> A team member will follow up with what it's worth — we don't quote trade-in
> values automatically. Reply STOP to opt out.

`[REQUIRES HUMAN APPROVAL]` — any trade-in value, range, or "we'll beat any
offer" statement. The assistant never states a number. If
`tradein_handling` = `none`, skip this template. If `dealer_approved_ranges`,
only dealer-supplied, pre-approved ranges may appear, still tagged
`[REQUIRES HUMAN APPROVAL]` until the named approver signs off.

### [4] Test-drive booking

> Want to come see it? I can set up a test drive. What day and time work for you?
> We're open [hours]. I'll confirm with the team and lock it in.
>
> Reply STOP to opt out anytime.

Captures: `preferred_datetime`, `vehicle_interest`. Writes an `Appointment`-stage
event to CRM-lite. No finance or payment language here; if the buyer raises
financing, hand off (see below).

### [5] Follow-up / re-engagement (consent-aware)

Only to leads who gave consent and have **not** opted out. Respects quiet hours
and send-rate limits.

> Hi [first_name], following up on the [vehicle_interest] you asked about at
> [dealership_name]. Still interested, or should I keep an eye out for something
> else? Reply STOP to opt out.

Re-engagement of an older lead (e.g. `Lost` → reopen) uses the same consent
state. If consent was never given or was withdrawn, do **not** message — the lead
stays quiet in CRM-lite.

---

## Finance / trade-in handoff rule

The intake layer never states a rate, payment, approval, or trade-in value. When
financing, monthly payment, APR, "approved", or trade-in value comes up, the flow
**collects and hands off to a human** (`finance_handling` = `collect_only`
default). Any customer-facing number is a draft tagged
`[REQUIRES HUMAN APPROVAL]` until the dealership's named approver signs off.

| Field                                         | Default handling                   | Customer-facing number      |
| --------------------------------------------- | ---------------------------------- | --------------------------- |
| `finance_handling` = `collect_only`           | Capture interest, human follows up | `[REQUIRES HUMAN APPROVAL]` |
| `finance_handling` = `dealer_approved_copy`   | Dealer-supplied language only      | `[REQUIRES HUMAN APPROVAL]` |
| `tradein_handling` = `collect_only`           | Capture details, human values it   | `[REQUIRES HUMAN APPROVAL]` |
| `tradein_handling` = `dealer_approved_ranges` | Dealer-supplied ranges only        | `[REQUIRES HUMAN APPROVAL]` |

---

## Routing: who replies

| Condition                               | Handled by                             |
| --------------------------------------- | -------------------------------------- |
| Inside business hours, standard inquiry | AI Sales Closer, human on request      |
| After hours / quiet hours               | One consent-first auto-ack, then queue |
| Finance / trade-in value raised         | Collect, then human handoff            |
| Buyer asks for a person                 | Immediate human handoff (guardrail 7)  |
| `markets_languages` = `other`           | Human handoff                          |

All paths write to the one inbox and to CRM-lite, so attribution and response-
time clocks are consistent no matter who replies.

## Scope note

No live wiring. These are templates and a flow spec for a static prototype.
WhatsApp, Telegram, Marketplace, Instagram, and any messaging vendor are
**options to evaluate**, not provisioned integrations (see
`../internal/guardrails.md`).
