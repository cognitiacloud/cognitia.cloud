# Client Zero Proof Report — `lead-blocked-compliance`

**Outcome:** ⛔ BLOCKED

| Field | Value |
| --- | --- |
| Harness | `cognitia-client-zero-proof` |
| Proof schema | `1.0.0` |
| Client | `client-zero` |
| Generated at | `2026-06-20T17:45:00.000Z` |
| Lead reference (salted hash) | `a0ff836f3548f007` |
| Blocked at stage | `compliance_gate` |
| Audit chain root | `342d246b0174…` |
| Chain verified | yes |
| Raw PII found | no |

## ⚠️ What this report does and does not claim

> This artifact proves only that the documented process steps executed in the order shown. It makes no claim or guarantee of sales, revenue, ROI, search ranking, finance/credit approval, or lead volume. It records what happened, not any promised outcome.

## Stage timeline (tamper-evident)

| # | Stage | Status | Decision | At | Event hash |
| --- | --- | --- | --- | --- | --- |
| 0 | `lead_intake` | ✅ ok | `lead_received` | `2026-06-20T17:22:00.000Z` | `c7e3aff6ca2e…` |
| 1 | `consent_gate` | ✅ ok | `consent_granted` | `2026-06-20T17:22:06.000Z` | `2d875ced063f…` |
| 2 | `compliance_gate` | ⛔ blocked | `compliance_blocked:on_do_not_contact_list+quiet_hours_violation+tcpa_consent_missing` | `2026-06-20T17:22:00.000Z` | `d905cb34a919…` |
| 3 | `human_approval` | ⏭️ skipped | `skipped_upstream_block` | `2026-06-20T17:22:06.000Z` | `ce5f93e49ff2…` |
| 4 | `appointment_booking` | ⏭️ skipped | `skipped_upstream_block` | `2026-06-20T17:45:00.000Z` | `0a6581e0e4bb…` |
| 5 | `crm_writeback` | ⏭️ skipped | `skipped_upstream_block` | `2026-06-20T17:45:00.000Z` | `342d246b0174…` |

## Referenced gate events

| Gate | Event hash |
| --- | --- |
| Consent | `2d875ced063f…` |
| Compliance | `d905cb34a919…` |
| Human approval | `—` |
| Appointment booking | `—` |
| CRM writeback | `—` |

## Appointment booking (mock-calendar)

_No appointment booked — pipeline blocked before booking._

## CRM writeback (mock-crm)

_No CRM record written — pipeline blocked before writeback._

## PII scan

- **String fields scanned:** 55
- **Raw PII found:** none

## How to verify this proof

```bash
node --experimental-strip-types proof/src/cli.ts verify <path-to-this>.proof.json
```

Verification recomputes every event hash and the chain links, and re-runs the PII scan. Any edit to any recorded event breaks the chain.
