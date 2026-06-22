# Proof-Governed GTM OS v0 — architecture & acceptance

A mock-only substrate that runs one authorized GTM flow and emits verifiable
proof at every step. This document describes the components, the run state
machine, and how each acceptance criterion is met and tested.

## Authorized flow & state machine

```
lead_received
   │  (runCompliance)
   ▼
compliance_evaluated ──[blocked + reasons]──► blocked        (terminal)
   │ [allowed]
   ▼
awaiting_approval ──────[human rejects]──────► rejected      (terminal)
   │ [human approves — named operator]
   ▼
approved
   │  (executeApprovedActions — mock appointment)
   ▼
appointment_booked
   │  (mock CRM writeback)
   ▼
crm_written
   │  (proof report)
   ▼
completed                                                    (terminal)
```

Illegal transitions throw (`IllegalTransitionError`); the consequential states
`appointment_booked` / `crm_written` are unreachable except along this path.

## Components

- **Run state machine** (`stateMachine/runStateMachine.ts`) — the legal
  transition map above.
- **Append-only action ledger** (`ledger/actionLedger.ts`) — immutable,
  SHA-256 hash-chained event log. No update/delete; every payload is PII-scanned
  on append (fail-closed); `verifyLedger()` re-derives the chain to detect
  tampering.
- **Proof receipts** (`proof/proofReceipt.ts`) — one receipt per transition,
  chained (`prevReceiptHash → receiptHash`) and attesting the ledger event
  (`eventHash`). `verifyReceiptChain()` validates the chain.
- **Proof report + timeline** (`proof/proofReport.ts`) — aggregates a run into an
  attestable report and renders an operator-facing Markdown proof log.
- **Compliance gate** (`compliance/complianceGate.ts`) — pure allow/block
  decision with machine-readable reasons: `tenant_inactive`, `pii_unsafe`,
  `consent_missing`, `consent_revoked`, `on_suppression_list`,
  `channel_not_permitted`.
- **Human approval queue** (`approval/approvalQueue.ts`) — a consequential action
  requires a request decided by a **named human** (no auto-approve); a request is
  decided at most once.
- **Mock adapters** (`adapters/`) — in-memory appointment + CRM writeback. Both
  are approval-guarded, idempotent, and PII-scanned. No network.
- **Run engine** (`engine/gtmRunEngine.ts`) — the single chokepoint; the only
  place a run's state changes, and it emits a proof receipt on every change.
- **Tenants & fixtures** — `demandara_internal`, `cognitia_internal`,
  `budget_wheels_demo`; PII-safe fixture leads covering happy and each blocked
  reason.

## Defense-in-depth: no approval-to-send loophole

A consequential action is gated three independent ways:

1. **State machine** — `appointment_booked` is reachable only from `approved`.
2. **Engine guard** — `transition()` into a consequential state refuses unless a
   human approval is on record (ledgers an `action.blocked` event).
3. **Adapter guard** — `book()` / `upsert()` themselves refuse (and ledger a
   blocked action) without approval, even if called directly.

## Acceptance criteria → evidence

| Criterion                                                            | Where it is proven                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| One local mock-safe happy path runs end to end                       | `engine/gtmRunEngine.e2e.test.ts` ("happy path…"), `demo/runHappyPath.test.ts`                    |
| Blocked paths produce proof receipts with blocked reasons            | e2e "compliance-blocked path…"; `compliance/complianceGate.test.ts`                               |
| Approved paths require explicit human approval before mock writeback | e2e "cannot reach writeback without an explicit human approval"; `approval/approvalQueue.test.ts` |
| Repeated mock CRM/appointment writeback is idempotent                | e2e "repeated writeback is idempotent"; `adapters/adapters.test.ts`                               |
| No live egress                                                       | `guards/noEgress.guard.test.ts` (static) + e2e "performs no live egress" (runtime `fetch` spy)    |
| No raw PII in fixtures/logs                                          | `guards/noRawPii.guard.test.ts`, `fixtures/fixtures.test.ts`, e2e "free of raw PII"               |
| No approval-to-send loophole                                         | e2e "no loophole" (engine + direct adapter calls both refused)                                    |
| Proof receipt on every transition                                    | e2e asserts `proof.receipt` count == receipts == transitions + 1; `proof/proofChain.test.ts`      |
| No prohibited financial/token language                               | `guards/noProhibitedLanguage.guard.test.ts`                                                       |

## Test inventory

`pnpm exec vitest run packages/gtm-os` → **53 tests / 15 files**: PII safety,
ledger, compliance, approval, state machine, adapters, proof chain, fixtures,
tenants, ownership manifest, the engine e2e suite, the demo, and the three guard
suites (egress / raw-PII / prohibited-language).
