---
title: Compliance System Spec — Cognitia Sales Closer Intelligence Engine
policy_version: 0.1.0
date: 2026-06-19
status: Draft
---

# Compliance System Spec — Cognitia Sales Closer Intelligence Engine

> **Disclaimer:** This spec encodes a reasonable, conservative reading of CASL,
> CRTC rules, PIPEDA, and the Apify Acceptable Use Policy for implementation
> planning. It is **not legal advice**. Have Canadian counsel review before
> go-live, especially the phone calling-hour tables, implied-consent windows,
> and any AI-voice use.

## Context

Cognitia is building a "Sales Closer Intelligence Engine" that collects **B2B
dealership prospect data** and prepares **human-approved outreach** (email and
phone) in Canada. The compliance layer is designed _before_ implementation so
that the data model, consent logic, logging, and approval gates are baked in
from day one rather than retrofitted.

The system must comply with:

- **CASL** (Canada's Anti-Spam Legislation) — governs Commercial Electronic
  Messages (CEMs): email, SMS, and some social/IM. Requires consent, sender
  identification, and a functioning unsubscribe mechanism.
- **CRTC Telemarketing / Unsolicited Telecommunications Rules** — National DNCL
  registration, calling-hours limits, internal DNC lists, and ADAD (automated
  dialing-announcing device) rules that apply to AI voice.
- **PIPEDA** and the **business-contact-information (BCI) exemption** — personal
  information collected/used/disclosed solely to contact someone in their
  professional capacity is exempt from consent, but **only for that purpose**.
- **Apify Acceptable Use Policy** — no scraping behind logins/auth walls, no
  bypassing anti-bot measures, respect site ToS and `robots.txt`, no collecting
  sensitive personal data.

This document is the authoritative spec that downstream implementation (data
collectors, consent engine, outreach orchestrator) must conform to.

---

## 1. Allowed vs. Disallowed Data Collection

### Allowed (B2B, professional capacity only)

- Publicly listed **business contact information**: company name, business
  address, general business phone, role-based/business email
  (e.g. `sales@dealer.com`), business website, public business social handles.
- **Named individual** business contacts **only** where the person is acting in
  a professional capacity and the info is conspicuously published with no
  statement against such use: name, job title, business phone/extension,
  business email, LinkedIn/role-page URL.
- Firmographic/contextual data: dealership brand(s) carried, location count,
  approximate size, public reviews, public inventory feeds.
- Source provenance for every field (see [§7 Required Evidence](#7-required-evidence)).

### Disallowed

- Any data behind a **login, paywall, or auth wall**; anything requiring
  defeating CAPTCHAs / anti-bot measures, or that violates a site's ToS or
  `robots.txt` (Apify AUP).
- **Personal/consumer** contact info, or business-contact info used for any
  purpose other than contacting the person in their professional role (the
  PIPEDA BCI exemption is purpose-limited).
- Sensitive personal data: financial account details, government IDs, health,
  ethnicity, personal (non-business) cell numbers, personal email/home address.
- Scraped data where the publication carried an **explicit statement against
  unsolicited commercial contact** (this kills implied-consent-by-publication).
- Bulk harvesting of email addresses via address-generation/dictionary attacks
  (independently prohibited under CASL).
- Any data field with no recordable source URL + timestamp.

**Collection guardrails (Apify-aligned):** respect `robots.txt`, throttle and
rate-limit politely, identify a contactable scraper user-agent, store raw
evidence, and tag every record with the collection method and the target ToS
check result.

---

## 2. `consent_basis` Values

Single-select enum stamped on every contactable record (default
`manual_review_required` until adjudicated).

| value                                    | Meaning                                                                                             | Legal hook                                                                   | Outreach effect                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `express_consent`                        | Recipient explicitly opted in (form, checkbox, verbal-on-record).                                   | CASL express consent (no expiry until withdrawn).                            | All permitted channels allowed (subject to channel gates + DNC).                                               |
| `implied_existing_business_relationship` | Existing/recent business relationship (e.g. inquiry within 6 mo, contract/purchase within 24 mo).   | CASL implied consent — **time-limited**; record the triggering event + date. | Email/CEM allowed within the validity window; must track expiry.                                               |
| `implied_conspicuous_publication`        | Business email conspicuously published, relevant to recipient's role, no statement against contact. | CASL implied consent via publication.                                        | Email allowed **only** if message topic is relevant to the published role; no expiry but fragile — revalidate. |
| `business_to_business_relationship`      | Org-to-org B2B, professional contact info, business purpose.                                        | PIPEDA BCI exemption + CASL B2B context.                                     | Treated as a lawful basis for professional outreach; still honours DNC/unsubscribe.                            |
| `manual_review_required`                 | Insufficient/ambiguous evidence; conflicting signals.                                               | — (hold state).                                                              | **No outreach.** Routed to a human reviewer (Gate A). Default state.                                           |
| `do_not_contact`                         | Unsubscribed, complained, bounced-as-spam, or manually suppressed.                                  | CASL/CRTC suppression + internal DNC.                                        | **Hard block on all channels, all bases.** Terminal / overriding.                                              |

**Precedence rules:**

- `do_not_contact` overrides everything.
- Expiry of a time-limited implied basis **demotes** the record to
  `manual_review_required` (the system never silently upgrades a basis).
- Channel gates ([§5](#5-channel-rules)) apply **on top of** `consent_basis`.

---

## 3. `compliance_log` Schema

Append-only, immutable audit log. One row per compliance-relevant event
(collection, consent determination, approval, send, unsubscribe, suppression,
basis expiry). Rows are **never updated or deleted** — corrections are new rows.

| field                  | type                   | notes                                                                                                                                                                                                                                          |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `log_id`               | UUID (PK)              |                                                                                                                                                                                                                                                |
| `event_timestamp`      | timestamptz (UTC)      | When the event occurred.                                                                                                                                                                                                                       |
| `event_type`           | enum                   | `data_collected`, `consent_determined`, `consent_expired`, `approval_requested`, `approval_granted`, `approval_rejected`, `message_sent`, `unsubscribe_received`, `dnc_added`, `complaint_received`, `bounce_recorded`, `suppression_applied`. |
| `prospect_id`          | UUID (FK)              | Subject record.                                                                                                                                                                                                                                |
| `contact_id`           | UUID (FK, nullable)    | Specific person / channel endpoint.                                                                                                                                                                                                            |
| `channel`              | enum (nullable)        | `email`, `phone`, `sms`, `whatsapp`, `ai_voice`, `none`.                                                                                                                                                                                       |
| `consent_basis`        | enum (nullable)        | Value at time of event ([§2](#2-consent_basis-values)).                                                                                                                                                                                        |
| `consent_basis_expiry` | timestamptz (nullable) | For time-limited implied bases.                                                                                                                                                                                                                |
| `actor`                | string                 | `system:<component>` or `user:<email>` who caused the event.                                                                                                                                                                                   |
| `decision`             | enum (nullable)        | `allow`, `block`, `hold`, `approve`, `reject`.                                                                                                                                                                                                 |
| `reason`               | text                   | Human-readable justification / rule that fired.                                                                                                                                                                                                |
| `evidence_ref`         | UUID (FK, nullable)    | Points to evidence record ([§7](#7-required-evidence)).                                                                                                                                                                                        |
| `source_url`           | text (nullable)        | Origin of data/consent if applicable.                                                                                                                                                                                                          |
| `message_ref`          | UUID (nullable)        | Outreach artifact (draft / sent message id).                                                                                                                                                                                                   |
| `dnc_check_result`     | jsonb (nullable)       | See example below.                                                                                                                                                                                                                             |
| `policy_version`       | string                 | Version of this spec/ruleset in force.                                                                                                                                                                                                         |
| `payload_hash`         | string (nullable)      | Hash of associated content for tamper-evidence.                                                                                                                                                                                                |

Example `dnc_check_result`:

```json
{
  "internal_dnc": false,
  "dncl_checked_at": "2026-06-19T14:03:22Z",
  "dncl_registered": false
}
```

Example log row (`message_sent`):

```json
{
  "log_id": "8f1c2e90-3b1a-4f7e-9c2d-6a0b1e4d5c33",
  "event_timestamp": "2026-06-19T15:12:00Z",
  "event_type": "message_sent",
  "prospect_id": "b2d1...",
  "contact_id": "c7a9...",
  "channel": "email",
  "consent_basis": "business_to_business_relationship",
  "consent_basis_expiry": null,
  "actor": "user:rep@cognitia.cloud",
  "decision": "allow",
  "reason": "Gate B approved; not in DNC; B2B basis valid.",
  "evidence_ref": "e44b...",
  "source_url": "https://dealer.example.com/about/team",
  "message_ref": "m091...",
  "dnc_check_result": {
    "internal_dnc": false,
    "dncl_checked_at": "2026-06-19T15:11:50Z",
    "dncl_registered": false
  },
  "policy_version": "0.1.0",
  "payload_hash": "sha256:1a2b3c..."
}
```

**Retention:** keep **≥ 3 years** (aligned to the CASL records-of-consent and
enforcement window; use the longest applicable). Logs are exportable for
regulator / audit requests.

---

## 4. Unsubscribe & Internal DNC Handling

### Unsubscribe (CASL: functional, no-cost, honoured within 10 business days)

- Every CEM carries a **working unsubscribe mechanism** + sender identification
  - valid postal/contact info.
- An unsubscribe request (link, reply, or verbal) →
  1. write `unsubscribe_received` to `compliance_log`,
  2. set the contact/prospect `consent_basis = do_not_contact`,
  3. add the endpoint to the **internal DNC** immediately.
- **Target: honour within 24h** — well inside the 10-business-day legal max.
- Unsubscribe scope is per-endpoint (email address / phone number) and also
  flags the parent prospect for review if all of its endpoints are suppressed.

### Internal DNC list

- Authoritative suppression table keyed by normalized endpoint (email
  lowercased; phone in E.164) plus optional **domain-level** and **org-level**
  suppression.
- **Checked before every send**, in addition to `consent_basis`. A DNC hit is a
  hard block and is logged (`decision = block`).
- Sources feeding DNC: unsubscribes, spam complaints, hard bounces, manual
  suppression, regulator/customer requests.
- DNC entries are **permanent** unless the contact later gives fresh
  `express_consent` (which is itself logged with evidence).

### National DNCL (phone)

- For **phone** outreach, check the CRTC **National Do Not Call List** status
  and record `dncl_checked_at` / registration in the log. Re-check per CRTC
  freshness rules.
- B2B-to-business-line calls have specific DNCL treatment — flag and route
  uncertain cases to Gate A.

---

## 5. Channel Rules

> **Launch scope:** `email` and `phone` are **ENABLED** behind approval gates.
> `sms`, `whatsapp`, and `ai_voice` are **DISALLOWED at launch** (config flag
> off) and may only be enabled after the listed pre-conditions are met **and** a
> compliance owner signs off (Gate C). The orchestrator must **hard-refuse** a
> send on any disabled channel regardless of `consent_basis`.

### Email (ENABLED) — CASL CEM

- Requires a valid `consent_basis` (express, valid implied, conspicuous-pub
  relevant to role, or B2B) **AND** not in DNC.
- Every message: sender identity, real contact info, working unsubscribe.
- Content must be relevant to the recipient's professional role.
- Implied-consent records must be within their validity window at send time.

### Phone (ENABLED) — CRTC telemarketing

- DNC + National DNCL check required before dialing.
- Honour **calling hours** (CRTC: weekdays 09:00–21:30, weekends 10:00–18:00,
  recipient local time) — enforce via the timezone of the area code/address.
- **Live human calls only** at launch (no automated dialing); maintain
  do-not-call on request, and identify caller + purpose.

### SMS (DISALLOWED at launch) — CASL CEM

- **Pre-conditions to enable:** SMS is a CEM → requires express or valid implied
  consent specific to SMS, a working STOP-style unsubscribe, sender ID, and
  number provisioning compliant with carrier / CTIA-equivalent rules.
- Gate C sign-off + channel flag required.

### WhatsApp (DISALLOWED at launch) — CASL CEM + platform ToS

- **Pre-conditions to enable:** CASL CEM rules **plus** WhatsApp Business Policy
  (opt-in capture, approved message templates, no cold messaging). Both must be
  satisfied; document opt-in evidence per contact.
- Gate C sign-off + channel flag required.

### AI Voice (DISALLOWED at launch) — CRTC ADAD + emerging AI-voice rules

- Highest-risk channel. **Pre-conditions to enable:** treat as an **ADAD** under
  CRTC (express consent generally required; strict identification; calling-hour
  and DNCL rules apply), **plus** clear **AI/synthetic-voice disclosure** to the
  recipient, **plus** legal review of current CRTC guidance on AI-generated
  calls.
- Gate C sign-off + explicit legal approval required; **never auto-enabled.**

---

## 6. Human Approval Gates

No outreach is ever fully autonomous. Three gates:

- **Gate A — Consent adjudication (pre-queue).** Any record entering
  `manual_review_required`, or with conflicting/expired signals, is held for a
  human reviewer who confirms/sets `consent_basis` with reference to stored
  evidence. Logged as `approval_granted` / `approval_rejected`.
- **Gate B — Message approval (pre-send).** Every individual outreach message
  (or templated batch) requires human review/approval of recipient eligibility,
  channel, and content before it can be sent. The system only ever produces
  **drafts**; a human promotes a draft to "approved to send". Logged with
  `message_ref`.
- **Gate C — Channel enablement (org-level).** Enabling any disabled channel
  (SMS / WhatsApp / AI voice) requires a documented compliance-owner sign-off
  that the channel's pre-conditions ([§5](#5-channel-rules)) are met, recorded
  with `policy_version`.

Each gate writes to `compliance_log` with the deciding `actor` (`user:<email>`).

**A send is blocked unless ALL of:** channel enabled (Gate C) **AND**
`consent_basis` valid **AND** not in DNC/DNCL **AND** message approved (Gate B).

---

## 7. Required Evidence

For every collected contact and every consent determination, store an evidence
record (referenced by `compliance_log.evidence_ref`):

| field                        | type              | notes                                                                                                                          |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `evidence_id`                | UUID (PK)         |                                                                                                                                |
| `prospect_id` / `contact_id` | UUID (FK)         | What it supports.                                                                                                              |
| `source_url`                 | text              | Exact page the data/consent was observed on.                                                                                   |
| `collected_at`               | timestamptz (UTC) | Collection timestamp.                                                                                                          |
| `screenshot_ref`             | text (nullable)   | Stored screenshot of the source page **if available**.                                                                         |
| `content_hash`               | string (nullable) | Hash of the captured page/section for tamper-evidence when no screenshot.                                                      |
| `role_relevance_note`        | text              | Why this contact/topic is relevant to the person's professional role (critical for `implied_conspicuous_publication` and BCI). |
| `collection_method`          | enum              | e.g. `apify_actor:<name>`, `manual`, `import`.                                                                                 |
| `tos_robots_check`           | jsonb             | See example below.                                                                                                             |
| `consent_basis_assigned`     | enum              | Basis derived from this evidence.                                                                                              |

Example `tos_robots_check`:

```json
{
  "robots_allowed": true,
  "tos_reviewed": true,
  "statement_against_contact": false
}
```

**Minimum required for any contactable record:** `source_url`, `collected_at`,
`role_relevance_note`, **and** either `screenshot_ref` **or** `content_hash`.
Records lacking these cannot leave `manual_review_required`.

---

## 8. Operating Principles (summary)

- **Default deny:** new records start `manual_review_required`; nothing sends
  without passing all applicable gates + checks.
- **Human-in-the-loop always:** the system drafts; humans approve and send.
- **Immutable audit:** append-only `compliance_log`, ≥ 3-year retention.
- **Purpose limitation:** business contact info used only for professional
  outreach (PIPEDA BCI).
- **Suppression supremacy:** `do_not_contact` / DNC / DNCL override every other
  signal.
- **Channel gating:** disabled channels hard-refuse regardless of consent.
