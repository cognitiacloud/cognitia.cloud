# Overnight plan — GTM lane only

Approved codeable queue (one item at a time; small reversible commits; gate
green before every push; preserve approval/audit/tenant-isolation/CI guardrails).

1. **Retention / DSAR path** (item 1)
   - DSAR data-subject EXPORT: per-contact personal data + processing record
     (actions) + audit trail. Owner-gated, tenant-scoped, audited.
   - DSAR ERASURE: anonymize a contact's PII (name/title/email_hash/phone_hash),
     mark erased + suppressed, tenant-scoped, owner-gated, AUDITED. Must PRESERVE
     the append-only audit chain (it stores refs/hashes, never raw PII).
   - Repo method to anonymize a contact (memory + kysely + contract test).
   - Service `dsar.ts` + handlers + 2 routes + tests + doc.

2. **Audit-chain anchoring mechanism** (item 2)
   - Export per-tenant chain TIP (latest hash) + a pluggable AnchorSink
     (no-op default; real external sink wired by operator — NOT claimed as
     provisioned). Verify current chain against a previously anchored tip.
   - Service + handler + route + tests + doc.

Out of scope tonight (NOT codeable here): branch protection (GitHub settings),
KMS custody (infra), live HubSpot round-trip (creds), AUTH-3 (pilot IdP),
pgBouncer validation (infra), DPAs (legal), pricing (business), SOC 2 (audit).
