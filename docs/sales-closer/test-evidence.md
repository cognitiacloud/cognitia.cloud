# Sales Closer — End-to-End Test Evidence

This document records what the client-zero end-to-end harness proves about the
**canonical** Sales Closer workflow, and — just as importantly — what it does
**not** prove. It is evidence, not a readiness claim. Nothing here asserts the
workflow is production-ready; the harness validates the offline, mock-safe spine
only.

## Scope

- **Branch:** worker branch stacked on `claude/w1-sales-closer-core-co3yll`.
- **Under test (unchanged):** the real workflow in
  `packages/agents/src/closer/**` — `salesCloserWorkflow.ts`, `ports.ts`,
  `mockPorts.ts`, `index.ts`, `__fixtures__/lead.fixture.ts`. No runtime or
  source behavior was changed by this work.
- **Added (tests + docs only):**
  - `packages/agents/src/closer/clientZeroEndToEnd.test.ts` — the harness.
  - `packages/agents/src/closer/testUtils.ts` — deterministic, IO-free helpers
    (not exported from `index.ts`, not imported by any runtime code).
  - `docs/sales-closer/test-evidence.md` — this file.

## How to reproduce

```sh
pnpm install --frozen-lockfile
pnpm vitest run packages/agents/src/closer/*.test.ts   # 43 passed (20 existing + 23 new)
pnpm run typecheck                                      # clean
```

## The path proven

`lead in → compliance gate → human approval → mock appointment →
mock CRM writeback → proof events`, driven through the real
`SalesCloserWorkflow.run()` with injected mock ports. The workflow performs no
network, DB, or vendor IO; the harness runs fully offline and deterministically
(frozen clock + seeded id factory).

## Requirement → evidence map

| #   | Required guarantee                               | Test(s) in `clientZeroEndToEnd.test.ts`                                                                                            | Result                                                                                                                                                          |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Happy path completes                             | "completes lead → … → completed"                                                                                                   | ✅ status/state `completed`; ordered transition log equals the 6-state happy path; log is contiguous from `lead_received`.                                      |
| 2   | Blocked path stops before approval/writeback     | "halts at compliance (boundary blocked)…", "halts by compliance doctrine…"                                                         | ✅ state `blocked_compliance`; approval never reached; `crm.calls() === 0`; no proofs recorded. Doctrine block (do-not-contact) halts before any boundary call. |
| 3   | Rejected path stops before appointment/CRM       | "halts at human approval when rejected…"                                                                                           | ✅ state `blocked_approval`; transition log ends at `blocked_approval`; `crm.calls() === 0`; no proofs.                                                         |
| 4   | Pending approval cannot write                    | "pauses at the human gate…"                                                                                                        | ✅ status `awaiting_approval`, state `human_approval_required`; `crm.calls() === 0`, `crm.persisted() === 0`; no proofs.                                        |
| 5   | CRM writeback is idempotent                      | "re-running the same lead converges to a single CRM record…", "a direct repeated writeback…"                                       | ✅ two identically-seeded runs → `calls() === 2`, `persisted() === 1`, identical stable `recordRef`. Direct double-writeback for one key persists once.         |
| 6   | Proof receipt for every transition               | "pins current behavior: 6 transitions but only 2 proof events…"                                                                    | ⚠️ **VERIFIED GAP** — see below.                                                                                                                                |
| 7   | Receipts contain no raw PII                      | "drops raw email/phone… never leaks them into receipts"                                                                            | ✅ raw email/phone present in input, absent from the normalized prospect (hash/mask/domain only) and from serialized transitions + proofs + recorded events.    |
| 8   | Scan closer source for live egress               | "%s contains no network/vendor primitive", "%s uses only .example URLs"                                                            | ✅ runtime sources + fixtures contain no `fetch`/`child_process`/`node:net                                                                                      | http(s)`/vendor SDK/`process.env`/DB-integration imports; every URL host ends in `.example`. |
| 9   | Synthetic fixtures use `.example` and `555-01xx` | "the happy-path fixture lead uses an .example domain", "the synthetic PII lead uses an .example email domain and a 555-01xx phone" | ✅ fixture website host ends `.example`; synthetic PII email domain ends `.example`; phone matches `555-01xx` (NANP fictional range).                           |

## VERIFIED GAP — proof receipt per transition & proof report

**Claim under test:** "a proof receipt exists for every transition" and a proof
**report** is produced.

**Observed current behavior (pinned by test #6):**

- The happy path makes **6 transitions** (`init → compliance → approval →
appointment → crm → proof`), each captured in `WorkflowRun.transitions` with
  `from/to/via/at`. This ordered transition log is the only per-transition
  record that exists today.
- The spine emits exactly **2 proof events** — `gtm.discovery.booked.v1` (after
  appointment) and `gtm.proposal.generated.v1` (after CRM writeback). The
  `init`, `compliance`, `approval`, and `proof` transitions carry **no proof
  event of their own**.
- There is **no persisted proof report artifact**: proof events are built
  in-memory (`createGtmProofEvent`) and handed to `ProofPort.record`, whose mock
  returns a bare `{ status }` acknowledgement. `WorkflowRun` exposes no `report`
  or `receipt` field, and the mock proof port does not persist anything.

**Conclusion:** the "proof receipt for every transition + proof report"
requirement is **NOT met** by the current workflow. The harness does not fake a
pass; it asserts the true counts (6 transitions, 2 proof events, no report) so
the gap is locked in and will surface if the behavior changes.

**Not invented here.** Closing this gap (a per-transition proof receipt and a
persisted/serialized proof report) is a workflow/`ProofPort` change and is
intentionally **out of scope** for this tests-only lane. Suggested follow-up for
a future feature lane:

- emit a proof (or a lighter "transition receipt") for compliance, approval, and
  proof-report transitions, not just the two business milestones; and
- add a persisted proof-report output (e.g. a `report` on `WorkflowRun` and/or a
  real `ProofPort` backend) so receipts are durable and auditable.

## Integrity notes

- No runtime/source behavior changed; the pre-existing
  `salesCloserWorkflow.test.ts` (20 tests) still passes unchanged.
- No package scaffolding, lockfile, or root tooling was modified.
- No live integrations were added; the harness is fully offline.
