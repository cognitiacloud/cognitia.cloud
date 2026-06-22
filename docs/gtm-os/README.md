# Proof-Governed GTM OS v0 — mock-only substrate

This package (`@cognitia/gtm-os`, at `packages/gtm-os/`) is the **substrate** for a
Proof-Governed GTM OS. It runs the single authorized v0 flow entirely in-process,
with a proof receipt on every step:

```
lead in
  -> consent/compliance gate (allow / blocked + reasons)
  -> mandatory human approval (named operator, no auto-approve)
  -> mock appointment booking + mock CRM writeback (idempotent)
  -> proof receipt / report
```

Everything is **mock-only and inert**. There is no live anything.

## Hard boundaries (what this substrate will never do)

The following are out of scope and structurally prevented or guarded against:

- **No live outreach** of any kind: no email sending, SMS, calls, WhatsApp,
  LinkedIn, ads, scraping, or vendor calls. The `Channel` type only names
  `mock_appointment` and `mock_crm` — a live channel is not even representable.
- **No real prospect data / no raw PII.** Only reserved fictional data is
  admitted: `.example` email addresses (RFC 6761) and `555-01xx` NANP phone
  numbers. A PII-unsafe lead is _blocked_ by the compliance gate, and the ledger
  refuses any payload containing raw-PII-looking values (fail-closed).
- **No real CRM / DMS / calendar / vendor SDK / network writeback.** The adapters
  are in-memory maps. There are no network imports and no outbound calls
  (enforced by a static guard test plus a runtime no-egress test).
- **No token, payment, yield, liquidity, airdrop, investment, or
  price-appreciation language or surface** (enforced by a static guard test).

These boundaries are enforced by tests, not just convention — see
[`proof-governed-gtm-os-v0.md`](./proof-governed-gtm-os-v0.md).

## Prohibited live actions (explicit)

Do **not** extend this substrate to perform, or call out to, any of:
real email/SMS/voice/WhatsApp/LinkedIn delivery, ad platforms, web scraping,
data-broker or enrichment vendors, real CRM/DMS/calendar APIs, or any network
egress. Consequential actions must remain mock adapters behind the human
approval queue.

## Run it

From the repo root:

```bash
pnpm install
pnpm exec vitest run packages/gtm-os      # 53 tests: unit + e2e + guards
pnpm --filter @cognitia/gtm-os demo       # prints the operator proof timeline
```

The demo prints a full operator-facing proof timeline for one approved happy
path and one compliance-blocked path. The operator **web** console route is owned
by other lanes (#138 / #119); this lane ships only the pure timeline renderer, so
no `apps/web` files are touched.

## Layout

| Area                             | Path                                  |
| -------------------------------- | ------------------------------------- |
| State machine                    | `src/stateMachine/runStateMachine.ts` |
| Append-only action ledger        | `src/ledger/actionLedger.ts`          |
| Proof receipts + report/timeline | `src/proof/`                          |
| Compliance gate                  | `src/compliance/complianceGate.ts`    |
| Human approval queue             | `src/approval/approvalQueue.ts`       |
| Mock appointment + CRM adapters  | `src/adapters/`                       |
| Run engine (orchestrator)        | `src/engine/gtmRunEngine.ts`          |
| Tenants + PII-safe fixtures      | `src/tenants/`, `src/fixtures/`       |
| PII safety primitives            | `src/pii/piiSafety.ts`                |
| Ownership manifest (W lanes)     | `src/ownership/manifest.ts`           |
| Guard tests                      | `src/guards/*.guard.test.ts`          |
