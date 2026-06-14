# DSAR — data-subject access + erasure (retention/deletion path)

Closes the audit's "retention/deletion (DSAR) path absent" gap. Pairs with the
SEC-2 minimum-retention status (`SEC-2-audit-export-retention.md`): SEC-2 proves
audit history is retained + exportable; this adds the **subject-level access and
deletion** controls. Code: `apps/api/src/dsar.ts`, repo `anonymizeContact`,
routes under `/dsar/*`.

## Right to access — `POST /dsar/contacts/:id/export` (owner-only, audited)

A self-contained bundle of everything held about a contact: the personal-data
record, the **processing record** (governed actions that targeted them), and the
**audit trail** (events on the contact + its actions, oldest first). The export
access is itself logged as `dsar_exported`.

## Right to erasure — `POST /dsar/contacts/:id/erase` (owner-only, audited)

Anonymizes the contact's PII in place (`full_name`/`title`/`persona`/`email_hash`/
`phone_hash` → null), marks it `is_suppressed` + `attributes.erased`, and records
`contact_data_erased` on the audit trail. **Idempotent** (a second call reports
`already_erased`).

### Why anonymize, not hard-delete

The append-only, hash-chained audit trail (SEC-1) only ever stored **refs and
hashes, never raw PII**. Anonymizing the contact row removes the personal data
while:

- the **audit chain stays intact and verifiable** (proven in `dsar.test.ts`:
  `verifyAuditChain` is `ok` before and after erasure — the erasure appends an
  event, it does not rewrite history);
- the **processing record keeps referential meaning** (action/event `*_ref`
  strings still resolve) — so "what was done, by whom, under what approval"
  remains accountable, which is the accountability obligation that survives an
  erasure request.

## Guardrails preserved

Owner-only (least privilege); both operations audited; tenant-scoped (the repo
method and RLS both enforce it — see `kysely.rls.pglite.test.ts`); no migration,
no change to approval gates. Tests: `dsar.test.ts` (export scoping + access log +
owner-gating + 404; erasure + chain-preservation + idempotency + post-erasure
export) and the both-engines `anonymizeContact` contract case.
