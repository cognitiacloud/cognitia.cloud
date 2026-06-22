# GTM-OS Integrated Operator Demo

Route: `/gtm-os-integrated-demo` (`apps/web/src/app/gtm-os-integrated-demo/page.tsx`)
View-model: `apps/web/src/lib/gtmIntegratedDemoViewModel.ts` (+ `.test.ts`)
Branch: `overnight/gtm-implementation` · PR #158 (draft)

> **Status:** `MOCK ONLY / DRY-RUN ONLY / NO LIVE SEND / NO REAL CRM`.
> Everything on the route is a deterministic, PII-safe mock for the
> `budget_wheels_demo` / Tenant Zero sandbox. Nothing here performs live
> outreach, vendor calls, or real CRM writes.

## What it proves

One screen renders the integrated mock GTM system end-to-end:

```
audience/signal → compliance/approval → dry-run channel plan →
CRM-lite timeline → TrustOps metrics → release gates → proof/trace
```

The six integrated surfaces, mapped to the B1–B6 lanes:

| #   | Surface                                            | Lane    | What the demo shows                                                                                                          |
| --- | -------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Audience & signal ranking                          | B4      | Lawful ranked prospects + rejected unlawful (scraped) sources                                                                |
| 2   | Assembly packet + dry-run channel plan             | B1 + B2 | Per-lead compliance/approval/timeline/proofs, then a dry-run channel plan where every action is `mode:'dry_run', sent:false` |
| 3   | CRM-lite records                                   | B3      | Mock, idempotent upserts (the proceeding lead writes exactly one record even when upserted twice)                            |
| 4   | TrustOps metrics & report                          | B5      | Funnel counts, approval coverage, a bounded 0–100 trust score, no-live-egress attestation                                    |
| 5   | Release gates                                      | B6      | `dry_run` passes; `private_pilot` and `controlled_live` fail closed with their missing conditions listed                     |
| 6   | Why live is blocked + controlled-live requirements | —       | The single live-blocked reason and the 7 organizational/legal conditions required before any live send                       |

A persistent banner is shown at the top of the route at all times.

## Two-lead scenario

- **Northshore Auto Group (`p-001`)** — consent verified, human-approved → proceeds:
  dry-run email/SMS/CRM plan, one CRM-lite record, full proof trace.
- **Do-Not-Contact Motors (`p-009`)** — do-not-contact compliance block → halts:
  no approval, no channel plan, no CRM write. Proves blocked leads cannot proceed.

## Why the web layer reproduces (does not import) the agents modules

`apps/web` depends only on `@cognitia/core` (see `apps/web/tsconfig.json` and
`apps/web/package.json`); it does not depend on `@cognitia/agents`. Adding that
dependency would require a package/tsconfig change, which is out of scope for
this lane. So — exactly like the existing `gtmOsAssemblyViewModel.ts` — the demo
view-model reproduces the **tested** lane semantics structurally:

- dry-run channel action is always `{ mode:'dry_run', sent:false }` (B2);
- CRM-lite upserts are idempotent on `(workspace, prospect, appointment)` (B3);
- release gates fail closed; `controlled_live` needs 7 sign-offs (B6);
- TrustOps metrics are computed from mock run outcomes (B5).

The authoritative implementations and their unit tests live in
`packages/agents/src/{channels,crm-lite,security,trustops,gtm-os}` and run as
part of `pnpm check`. This route is the **visible** surface over that logic, not
a second source of truth.

## Tests (`gtmIntegratedDemoViewModel.test.ts`)

Proves: blocked leads cannot proceed · dry-run channels never send (incl. a
forged `sent:true` is rejected) · live release gates fail closed · CRM-lite is
mock/idempotent · TrustOps metrics render · no raw PII in the serialized view.

## Run

```
pnpm --filter @cognitia/web exec vitest run src/lib/gtmIntegratedDemoViewModel.test.ts
pnpm check
```
