# Overnight GTM Integration Plan (B1–B6)

Date: 2026-06-22
Branch: `overnight/gtm-implementation` (base: `claude/w1-sales-closer-core-co3yll`)
PR: #158 (draft — kept draft, no state change)

> **Status legend:** `REAL` (running, tested, wired) · `SANDBOX` (runs against
> synthetic fixtures) · `MOCK` (in-memory stand-in, no external system) ·
> `PLANNED` (documented, not built).
>
> **Honesty notice.** Nothing here is production-ready and nothing performs live
> automation. Every new module is offline and mock-safe. This document records
> what was integrated, how it was verified, an honest parity estimate, and the
> concrete blockers that remain before an honest 80+ could be claimed.

---

## 1. What was integrated

Six builder lanes were composed onto the W1 Sales Closer base in a single
consolidated branch. The new modules are additive (new directories under
`packages/agents/src/`) and reuse the existing closer workflow, action ledger,
and policy-gate primitives rather than replacing them.

| Lane | Module(s)                                                           | Capability                                                                                                                                                                                     | Status                |
| ---- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| B1   | `gtm-os/assembly/**` + `apps/web/src/lib/gtmOsAssemblyViewModel.ts` | Composes one closer run into a single packet (workspace attribution, compliance/approval/appointment/CRM states, proof trace, operator timeline, no-egress attestation) + pure web view-model  | `MOCK`/`SANDBOX`      |
| B2   | `channels/{channelPolicy,dryRunChannels}.ts`                        | Dry-run channel engine for email/sms/whatsapp/call/linkedin/ad/crm; `planDryRunAction` always `{mode:'dry_run',sent:false}`; `sendLive` always throws; release gate impossible by construction | `MOCK` (dry-run only) |
| B3   | `crm-lite/{mockCrmLite,timeline}.ts`                                | In-memory CRM-lite (Contact/Company/Opportunity), idempotent upserts, ordered operator timeline, `assertNoRawPii` guard on every write                                                         | `MOCK`                |
| B4   | `audience/{audienceBuilder,signalScoring}.ts`                       | Lawful fixture/manual audience + transparent signal scoring; rejects disallowed (scraped) source types; drops off-list contact values                                                          | `SANDBOX`             |
| B5   | `trustops/{metrics,report}.ts`                                      | Funnel/safety/trust metrics + human-readable report over workflow events; transparent 0–100 trust score; no-live-egress attestation                                                            | `SANDBOX`             |
| B6   | `security/{permissionModel,releaseGate}.ts`                         | Local least-privilege permission model + `dry_run`/`private_pilot`/`controlled_live` release gates that fail closed (`controlled_live` needs 7 signoffs)                                       | `MOCK`                |

### Provenance note

The canonical overnight lane commits referenced by the integration brief
(B1 `d96a590`, B2 `eba53fa`, B3 `d81f303`, B4 `59ce649`, B5 `bfaca33`,
B6 `4c4b9bf`) were produced in separate local worktrees and were **not pushed
to this repository** — they are not present in the object store here. This
branch is the consolidated, independently-verified equivalent of that work
(same module boundaries, same owned-file layout, same guardrails). If the
original lane commits are later pushed, this branch can serve as the
reconciliation target; the module surfaces are designed to match.

---

## 2. Integration conflicts resolved

The only true integration conflict was the package barrel
`packages/agents/src/index.ts`. Two names are exported by more than one lane:

- `assertNoRawPii` — defined in both `gtm-os/assembly` (via `guards.ts`) and `crm-lite/timeline.ts`.
- `TimelineOutcome` — defined in both `gtm-os/assembly` and `crm-lite/timeline.ts`.

`export *` across both produced `TS2308` ambiguity errors. Resolution: the
gtm-os assembly barrel keeps the two shared names at the package root, and
`crm-lite/timeline.ts` is re-exported **explicitly** (named re-export) for all
of its _other_ members, omitting the two duplicates. Consumers that need the
crm-lite-specific `assertNoRawPii`/`TimelineOutcome` import them from the
submodule path. No module logic was rewritten.

A second, non-conflict adjustment: several lane test files used array indexing
that trips the repo's strict `noUncheckedIndexedAccess`. These were made
type-safe with non-null assertions consistent with the existing test style.
Prettier was then run **only on the new lane files** (no broad formatting).

---

## 3. Verification (acceptance criteria)

All run on `overnight/gtm-implementation` @ current HEAD.

| Criterion                                      | Result                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (format:check → typecheck → test) | ✅ **771 tests passed (103 files)**; format + typecheck (root + web) clean                                              |
| B1–B6 lane tests                               | ✅ **125** in `packages/agents` (11 files) + **6** web view-model = **131** new tests pass                              |
| Live-egress scan (new code)                    | ✅ no real network/vendor imports; no `fetch(` calls (only the literal pattern inside B2's own source-scan guard)       |
| Raw-PII scan (new code)                        | ✅ no off-list emails; only invented (non-real) values inside negative tests that assert the PII guard **rejects** them |
| Live automation                                | ✅ none introduced — all channels dry-run, `sendLive` throws, `controlled_live` fails closed                            |

---

## 4. Honest parity estimate

> Estimate, not a measurement. Modules are real and tested but **self-contained**:
> they are not yet composed into an end-to-end operator route, the dry-run
> channels are not yet invoked by the closer workflow, and there is no analytics
> dashboard surface or CRM writeback wired into a live UI.

| Dimension                      | Pre-integration |   After this branch | Rationale                                                                                                                                                                                                                                                                         |
| ------------------------------ | --------------: | ------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta **implementation** parity |             ~38 |          **~50–55** | Six real mock-safe capability modules (assembly, dry-run channels, CRM-lite, audience/signal, TrustOps, gates) broaden breadth on top of the existing closer/ledger/policy/DB base. Held below the aggressive 60–72 target because nothing is wired end-to-end or surfaced in UI. |
| Enterprise readiness           |             ~38 |          **~42–46** | Local permission model + fail-closed release gates added as testable primitives; not bound to real identity, persistence, or monitoring.                                                                                                                                          |
| Live automation readiness      |             ~22 | **~22 (unchanged)** | Intentionally unchanged — no live controls, consent records, deployment, or legal sign-off were added (and must not be in a mock-safe lane).                                                                                                                                      |

Docs are **not** counted as implementation in these numbers.

---

## 5. Remaining blockers to an honest 80+

Mock-safe, buildable next (no live egress, raises implementation parity):

1. **End-to-end composition** — drive B2 dry-run channel plans from the B1
   assembly packet and record them on the B3 CRM-lite timeline in one flow.
2. **Operator console route** — render the B1 view-model + B3 timeline +
   B5 report in an actual `apps/web` route (currently only a pure view-model).
3. **TrustOps adapter** — map real `WorkflowRun` records into B5's
   `WorkflowRunSummary` input so metrics reflect actual runs.
4. **CRM writeback port** — implement the closer `CrmPort` against B3
   (`upsertOpportunity` + `timeline.record`) so writeback is exercised by tests.
5. **Permission/gate enforcement** — bind B6 permissions to the policy-gate /
   approval path so they actually gate actions rather than being a standalone model.

Cannot be built without external sign-off (do **not** attempt overnight):

6. Legal/counsel sign-off owner for any live channel.
7. Signed customer scope + consent records (Tenant Zero / `budget_wheels_demo`
   remains the only sandbox tenant).
8. Live deployment controls, monitoring, rollback, and connector approvals
   (the `controlled_live` release gate enumerates these and must stay closed).
9. CRM credentials and channel/vendor approvals.

---

## 6. Merge / hold recommendation

**Hold as draft.** The branch is green and self-contained, so it is safe to
keep open. Recommend merging only after item (1) or (2) above gives the lanes
an end-to-end path, so the parity gain is demonstrable rather than latent.
No PR state change has been made by this lane (draft only, per scope).
