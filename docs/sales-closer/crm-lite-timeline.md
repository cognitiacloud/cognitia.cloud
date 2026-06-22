# CRM-lite + Timeline (Sales Closer, lane B3)

A **MOCK / SANDBOX** in-memory "CRM-lite" plus an operator-console **timeline**
that give Alta-style CRM visibility — _what happened to a prospect, and when_ —
**without any real CRM, vendor SDK, network, or database**. Everything is
in-memory, idempotent, and built from synthetic fixtures.

- Code: `packages/agents/src/crm-lite/mockCrmLite.ts`, `.../timeline.ts`
- Tests: `packages/agents/src/crm-lite/mockCrmLite.test.ts`, `.../timeline.test.ts`
- Run: `pnpm vitest run packages/agents/src/crm-lite`

## Capability labelling

Every capability is explicitly labelled. Nothing here is a production claim.

| Capability                                              | Label       |
| ------------------------------------------------------- | ----------- |
| In-memory entity store (Company / Contact / Opportunity)| **MOCK**    |
| Idempotent `upsert*` (composite-key dedupe)             | **MOCK**    |
| Append-only timeline + ordered read model               | **MOCK**    |
| PII guard (`assertNoRawPii`) on every write             | **REAL**    |
| Sandbox/mock labelling on every record                  | **SANDBOX** |
| Real CRM connector (Salesforce/HubSpot/Alta sync)       | **PLANNED** |
| Persistence / DB / multi-process durability             | **PLANNED** |
| Live outreach / scheduler / proof-ledger writes         | **PLANNED** |

The PII guard is the one component labelled REAL: it is a genuine runtime
invariant that throws on real-looking email/phone, not a mock.

## Entities

All fields are non-PII. There are no raw `email`/`phone` fields anywhere.

### Company

`id`, `workspaceId`, `companyName`, `attributes` (non-PII business signals:
region, businessType, website host, …), `createdAt`, `updatedAt`.

### Contact

`id`, `workspaceId`, `prospectId` (the GTM prospect id — the idempotency
anchor), `companyId`, `role` (non-PII label, e.g. "General Manager" — never a
person's raw name), `emailExample` (OPTIONAL synthetic address that **must** use
a reserved `.example` / `.test` / `.invalid` TLD), `createdAt`, `updatedAt`.

### Opportunity

`id`, `workspaceId`, `prospectId`, `companyId`, `stage`
(`lead` → `qualified` → `appointment_set` → `proposal` → `won` / `lost`),
`appointmentRef` (opaque id), `crmRecordRef` (opaque id), `createdAt`,
`updatedAt`.

### TimelineEvent

`id`, `workspaceId`, `prospectId`, `kind`, `outcome`, `summary` (PII-safe
one-liner), `at` (ISO sort key), `seq` (monotonic insertion tiebreaker),
`refs` (optional opaque references), `environment` (`MOCK` | `SANDBOX`).

## Idempotency key

Writes are idempotent — re-upserting the same key updates the record **in
place** and returns the **same `id`**; it never duplicates. `createdAt` is
preserved; `updatedAt` is bumped.

| Entity      | Idempotency key                                    |
| ----------- | -------------------------------------------------- |
| Company     | `workspaceId + companyName`                        |
| Contact     | `workspaceId + prospectId`                         |
| Opportunity | `workspaceId + prospectId + appointmentRef`        |

`crmIdempotencyKey(workspaceId, prospectId, appointmentRef?)` builds the
canonical `ws::prospect[::appt]` string. A different `appointmentRef` yields a
distinct opportunity (a prospect can have more than one booking).

## Timeline event taxonomy

`kind` mirrors the Sales Closer workflow phases
(`packages/agents/src/closer/salesCloserWorkflow.ts`), plus a catch-all:

| kind            | maps to workflow `via` | typical outcomes              |
| --------------- | ---------------------- | ----------------------------- |
| `compliance`    | `compliance`           | `pass`, `blocked`             |
| `approval`      | `approval`             | `approved`, `rejected`, `pending` |
| `appointment`   | `appointment`          | `ok`, `blocked`               |
| `crm_writeback` | `crm`                  | `ok`, `blocked`               |
| `proof`         | `proof`                | `ok`, `blocked`               |
| `note`          | — (operator annotation)| `info`                        |

**Read model.** `read({ workspaceId?, prospectId? })` returns a fresh array
sorted by `at` ascending, with insertion `seq` as a stable tiebreaker (equal
timestamps keep record order). Callers cannot mutate internal state.

## PII / data doctrine

- **No raw PII, ever.** No `email`/`phone` fields. Synthetic contacts use
  reserved TLDs (`.example` / `.test` / `.invalid`); fictional phones use the
  reserved `555-01xx` exchange. Timeline events store ids/refs and redacted
  (`*`-masked) forms only.
- **`assertNoRawPii(value)`** runs on every `summary`, `ref`, `role`,
  `companyName`, and `emailExample` write. It allows reserved-TLD emails,
  `555-01xx` phones, and `*`-masked strings; it ignores ISO-8601 timestamps and
  bare opaque-id digit runs; it **throws** on a real-looking email or phone, so
  raw PII can never enter the store or timeline.
- **Tenant scope.** The Budget Wheels demo runs only as `budget_wheels_demo`
  (Tenant Zero). No tokens / chains / payments / crypto.

## How this maps to Alta CRM visibility

Alta surfaces a per-account activity feed and pipeline stage. CRM-lite provides
the same _shape_ offline: the **timeline** is the activity feed (ordered,
phase-tagged events with outcomes), and the **Opportunity `stage`** is the
pipeline position. When a real Alta/CRM connector is built (**PLANNED**), the
`upsert*` methods become the writeback target and `crmRecordRef` carries the
real CRM id — the timeline taxonomy and idempotency keys are designed to map
1:1 onto that future sync without schema change.
