# Client Zero Proof Report — `lead-approved`

**Outcome:** ✅ COMPLETED

| Field | Value |
| --- | --- |
| Harness | `cognitia-client-zero-proof` |
| Proof schema | `1.0.0` |
| Client | `client-zero` |
| Generated at | `2026-06-20T15:30:00.000Z` |
| Lead reference (salted hash) | `d6f7dd93c06484ba` |
| Blocked at stage | `—` |
| Audit chain root | `e8b1a796ca6d…` |
| Chain verified | yes |
| Raw PII found | no |

## ⚠️ What this report does and does not claim

> This artifact proves only that the documented process steps executed in the order shown. It makes no claim or guarantee of sales, revenue, ROI, search ranking, finance/credit approval, or lead volume. It records what happened, not any promised outcome.

## Stage timeline (tamper-evident)

| # | Stage | Status | Decision | At | Event hash |
| --- | --- | --- | --- | --- | --- |
| 0 | `lead_intake` | ✅ ok | `lead_received` | `2026-06-20T15:04:00.000Z` | `f58d5e5ae3f3…` |
| 1 | `consent_gate` | ✅ ok | `consent_granted` | `2026-06-20T15:04:05.000Z` | `b7b0bb322393…` |
| 2 | `compliance_gate` | ✅ ok | `compliance_cleared` | `2026-06-20T15:04:00.000Z` | `ba342fd708be…` |
| 3 | `human_approval` | ✅ ok | `human_approved` | `2026-06-20T15:20:00.000Z` | `d4b79c82252e…` |
| 4 | `appointment_booking` | ✅ ok | `appointment_booked` | `2026-06-24T17:00:00.000Z` | `fb9f6ee29aa9…` |
| 5 | `crm_writeback` | ✅ ok | `crm_record_written` | `2026-06-20T15:30:00.000Z` | `e8b1a796ca6d…` |

## Referenced gate events

| Gate | Event hash |
| --- | --- |
| Consent | `b7b0bb322393…` |
| Compliance | `ba342fd708be…` |
| Human approval | `d4b79c82252e…` |
| Appointment booking | `fb9f6ee29aa9…` |
| CRM writeback | `e8b1a796ca6d…` |

## Appointment booking (mock-calendar)

- **Booked:** yes
- **Appointment ref:** `appt_27199ad940a357b6`
- **Slot:** `2026-06-24T17:00:00.000Z` → `2026-06-24T17:30:00.000Z` (America/Los_Angeles)
- **Provider:** `mock-calendar` (mock — no live API called)

## CRM writeback (mock-crm)

- **Written:** yes
- **Record ref:** `crm_c641532de8886f15`
- **System:** `mock-crm` (mock — no live API called)
- **Fields (redacted refs only):**
  - `leadRef`: `d6f7dd93c06484ba`
  - `appointmentRef`: `appt_27199ad940a357b6`
  - `consentEventHash`: `b7b0bb322393537f224c99c3f53beb171fc0847aab65fdcdddae0437c70ecb45`
  - `stage`: `appointment_booked`
  - `source`: `web-form:landing-a`

## PII scan

- **String fields scanned:** 81
- **Raw PII found:** none

## How to verify this proof

```bash
node --experimental-strip-types proof/src/cli.ts verify <path-to-this>.proof.json
```

Verification recomputes every event hash and the chain links, and re-runs the PII scan. Any edit to any recorded event breaks the chain.
