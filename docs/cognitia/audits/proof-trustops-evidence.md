# Proof & TrustOps Evidence (B1–B6)

Date: 2026-06-22
Branch: `claude/proof-trustops-evidence-08x8t3` (base: `overnight/gtm-implementation`, PR #158)

> **Status legend:** `REAL` (running, tested, wired) · `SANDBOX` (runs against
> synthetic fixtures) · `MOCK` (in-memory stand-in, no external system) ·
> `PLANNED` (documented, not built) · `BLOCKED` (cannot proceed without
> external/organizational sign-off).
>
> **Honesty notice.** Nothing here is production-ready and nothing performs live
> automation. There are **no fake customer results and no fake proof receipts**:
> every proof event, trace step, and TrustOps figure is derived at runtime from
> the real `@cognitia/agents` modules over invented sandbox leads on the
> `budget_wheels_demo` / Tenant Zero tenant. This document records what is real,
> what is mock, what is planned, and what is blocked, and how each claim is
> verified.

---

## 1. What this lane added

This lane strengthens the **proof / action trace** and the **TrustOps evidence**
on top of the existing B1–B6 integration. It is additive and reuses the real
lane modules rather than mirroring them.

| Artifact                                | File(s)                                                                                                   | What it is                                                                                                                                                                                                                                                                         | Status                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Proof / action trace**                | `packages/agents/src/gtm-os/proof-trace/index.ts`                                                         | Folds one lead's real assembly packet, dry-run plan, CRM-lite records, and TrustOps summary into a single ordered, PII-safe chain: lead → compliance → approval → dry-run plan → CRM-lite → TrustOps. Each step carries its outcome and the append-only proof events that back it. | `REAL` (over `MOCK`/`SANDBOX` data) |
| **Canonical packet → TrustOps mapping** | `packetToRunSummary()` in the same module                                                                 | Single source of truth that projects a real `GtmRunPacket` onto a B5 `WorkflowRunSummary`. The integrated route and the per-lead trace both use it, so TrustOps metrics are provably computed over **real packet outputs**, not a hand-rolled mirror.                              | `REAL`                              |
| **Command Center trace surface**        | `apps/web/src/app/gtm-os-integrated-demo/page.tsx` (section 3)                                            | Renders the proof/action trace per lead — stages, outcomes, and proof refs — alongside the existing audience / packet / CRM / TrustOps / gates panels.                                                                                                                             | `REAL`                              |
| **Adapter wiring**                      | `apps/web/src/lib/server/gtmIntegratedDemoData.ts`                                                        | Builds a trace per lead from real packet + real dry-run plan + real CRM records; switches B5 summaries to the canonical `packetToRunSummary`.                                                                                                                                      | `REAL`                              |
| **PII / mapping tests**                 | `packages/agents/src/gtm-os/proof-trace/proofTrace.test.ts`, additions to `gtmIntegratedDemoData.test.ts` | Prove chain mapping, blocked-path honesty, canonical summary, no-network imports, and **no raw PII in proof/report outputs** (including a poisoned-input negative test).                                                                                                           | `REAL`                              |

---

## 2. The proof / action trace (what is real)

`buildProofTrace({ packet, dryRunActions, crmRecords })` returns a
`GtmProofTrace` with six ordered steps. The data on every step is derived from
**real module output** — there is no synthetic receipt:

1. **lead** — lead received (company + lawful source from the packet prospect).
2. **compliance** — `passed` / `blocked` straight from the packet compliance
   state; the reason string is the real boundary reason.
3. **approval** — `passed` (approved) / `blocked` (rejected) / `halted`
   (pending) / `not_reached` (compliance blocked first).
4. **dry_run_plan** — the real B2 `planDryRunAction` outputs. Every action is
   `sent:false` by type; the builder additionally throws if any action is not
   `sent:false`. `not_reached` when the lead halted before outreach.
5. **crm_lite** — the real B3 `Opportunity` records written for this prospect
   (`passed` / `blocked` / `not_reached`). The appointment + proposal proof
   events are attached here.
6. **trustops** — records the canonical `WorkflowRunSummary` this lead
   contributes, binding the per-lead chain to the aggregate B5 metrics.

**Proof events** are real `GtmProofEvent`s recorded during the closer run
(`gtm.discovery.booked.v1`, `gtm.proposal.generated.v1`). The trace projects
only the PII-safe fields (`id`, `kind`, `evidenceTag`, `summaryPublic`); the raw
`detailsPrivate` is never put on the trace.

**Visible in Command Center:** the `/gtm-os-integrated-demo` route renders the
trace as section 3, per lead, with stages, outcomes, and proof refs.

---

## 3. TrustOps over real packet outputs (what is real)

The integrated route computes B5 metrics like this:

```
packets = [happy, compliance-blocked, approval-rejected]   // real assembleGtmRunPacket runs
summaries = packets.map(packetToRunSummary)                // canonical real mapping
metrics  = computeTrustOpsMetrics(summaries)               // real B5
report   = buildTrustOpsReport(summaries)                  // real B5 markdown
```

Because the per-lead trace records the _same_ `packetToRunSummary(packet)` it
contributes, the TrustOps funnel/score is provably an aggregation of the real
integrated packets. The report is clearly stamped `MOCK / SANDBOX` and carries
no production claims.

---

## 4. What is mock / sandbox

- **Leads** are invented sandbox businesses (`.example` domains, `555-01xx`
  phones). No real prospect, no real customer.
- **Channels** are dry-run only: `planDryRunAction` yields `{mode:'dry_run',
sent:false}` and `sendLive` throws by construction. No email/SMS/WhatsApp/
  call/ad/vendor API is ever invoked.
- **CRM** is the in-memory `createMockCrmLite` — no real CRM write, no
  credentials, idempotent upserts only.
- **Tenant** is `budget_wheels_demo` / Tenant Zero sandbox only.
- **No-egress attestation** is recorded on every packet and surfaced on the
  trace and the TrustOps report.

---

## 5. What is planned (not built here)

- Driving the dry-run plan and CRM-lite writeback **from inside** the closer
  workflow's own ports (today the route composes them around the packet).
- Persisting traces/summaries to a real `WorkflowRun` store so TrustOps can run
  over historical runs, not just the three demo runs.
- A standalone TrustOps dashboard route (the metrics currently render within the
  integrated demo page).

---

## 6. What is blocked (requires external/founder sign-off)

These are organizational/legal gates, not code toggles. The real B6
`controlled_live` release gate enumerates them and **fails closed** until each
is satisfied and recorded:

1. Legal/counsel sign-off for any live channel.
2. Signed customer scope + consent records.
3. Live deployment controls, monitoring, and rollback.
4. Connector / vendor approvals and CRM credentials.
5. Founder approval.

No live outreach, no live send, no real CRM write, and no raw PII are present in
this lane, and none can be enabled without the gates above.

---

## 7. Verification

| Criterion                                  | How to run                                                                                                              | Result                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Full check (format → typecheck → test)     | `pnpm check`                                                                                                            | ✅ green (see PR run)                           |
| Web route typecheck                        | `pnpm --filter @cognitia/web run typecheck`                                                                             | ✅ clean                                        |
| Proof-trace + adapter tests                | `pnpm exec vitest run packages/agents/src/gtm-os/proof-trace apps/web/src/lib/server/gtmIntegratedDemoData.test.ts`     | ✅ 24 passed                                    |
| No raw PII in proof/report outputs         | `proofTrace.test.ts` ("no raw PII in proof/report outputs"), `gtmIntegratedDemoData.test.ts` ("proof / action trace …") | ✅ asserted, incl. poisoned-input negative test |
| No live egress / no vendor SDK in new code | source-scan test in `proofTrace.test.ts`                                                                                | ✅ no network/DB/vendor imports                 |

### Acceptance check

- **Proof trace visible in Command Center** — ✅ section 3 of `/gtm-os-integrated-demo`.
- **TrustOps metrics generated from real integrated packet** — ✅ via
  `packetToRunSummary` over real `assembleGtmRunPacket` outputs.
- **No fake proof receipts or fake customer results** — ✅ every proof/figure is
  runtime-derived from real modules over sandbox leads; nothing hand-authored.
