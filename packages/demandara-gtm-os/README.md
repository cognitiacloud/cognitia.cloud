# @cognitia/demandara-gtm-os

Local/mock-only **Demandara GTM OS chassis**: the governed Sales Closer spine

```text
lead intake -> qualification -> consent/source-rights gate -> human approval
-> mock connector writeback -> Cognitia proof receipt -> Command Center summary
-> monthly proof report input
```

Built from the context packet in `docs/claude-context/demandara-gtm-os/`.
Demandara runs **on** Cognitia controls, not around them.

## Claim-safe status

| Claim                                                                        | Label                                                    |
| ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| Workflow chassis (intake → receipt → command center)                         | `IMPLEMENTED_LOCAL_MOCK`                                 |
| Deny-by-default gates (consent, source rights, approval, connectors, router) | `TESTED_LOCAL`                                           |
| Budget Wheels DealerOS adapter                                               | `IMPLEMENTED_LOCAL_MOCK` (fake/reserved fixtures only)   |
| MoverOS adapter pattern                                                      | `DOC_ONLY` (external reference; no source copied)        |
| Skillocate / Alpha Investo verticals                                         | `DESIGN_ONLY` (descriptors; engine refuses to run them)  |
| Demand Gen engine (opportunities, briefs, monthly report input)              | `IMPLEMENTED_LOCAL_MOCK` skeleton                        |
| Agent economy (passports, work events)                                       | `DESIGN_ONLY` types; **no payment behavior**             |
| Live providers / CRM / outreach / deploy                                     | `LIVE_DISABLED` — no live path exists; guards are tested |

Forbidden wording anywhere downstream: "production-ready", "better than Alta",
"can contact customers now". This package is an internal demo chassis. It does
not promote Beta 1, certify provider inventory, or move any canon score.

## Hard boundaries (enforced in code and tests)

- **No egress.** Registering a connector with `egressAllowed: true` throws.
  Connector states other than `mock_only` are blocked with a proof event.
- **No live model calls.** The router harness supports `mock`/`replay` only;
  `disabled` and `live_approved` fail closed. Secret-looking inputs are
  rejected before routing.
- **No caller-supplied approval.** Only events issued by the local
  `HumanApprovalRegistry` satisfy the approval gate; anything else is reported
  as `FORGED_APPROVAL_REJECTED`. Approval-looking fields on the lead payload
  are stripped at intake.
- **No real data.** Intake rejects `live_customer` data mode; fixture
  authenticity tests require `RESERVED-FAKE` aliases, `example.com` mailboxes,
  and 555-01xx phone ranges.
- **Proof always.** Every run — allowed or blocked — generates a tamper-evident
  proof receipt and a hash-chained action ledger trail.

## Module map

| Module                            | Purpose                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| `types.ts`                        | Domain vocabulary, lead schema, canonical blocked reasons                 |
| `leadIntake.ts`                   | Fixture intake + data-mode audit (fail closed)                            |
| `consentGate.ts`                  | Source-rights + consent gate (deny by default)                            |
| `approvalGate.ts`                 | Trusted human-approval registry with anti-forgery tokens                  |
| `qualification.ts`                | Deterministic avatar-fit / urgency / trust-gap scoring                    |
| `verticalAdapters.ts`             | Budget Wheels adapter; MoverOS pattern + future verticals as descriptors  |
| `connectorRegistry.ts`            | Mock-only connector registry, deny rule, writeback intents                |
| `modelRouter.ts`                  | Fail-closed mock/replay brain harness                                     |
| `actionLedger.ts`                 | Local append-only, hash-chained event ledger                              |
| `proofReceipt.ts`                 | Per-run receipt (JSON + markdown rendering)                               |
| `workflowEngine.ts`               | The Sales Closer state machine orchestrator                               |
| `commandCenterSummary.ts`         | Operator data surface: state, blockers, next action                       |
| `demandGen.ts`                    | SEO/AEO/AIO opportunities, claim-safety checker, monthly report input     |
| `agentEconomy.ts`                 | ATC-style agent identity / work event types only (no tokens, no payments) |
| `fixtures/budgetWheels.demo.json` | Fake/reserved Budget Wheels demo leads                                    |

## Running

```bash
pnpm vitest run packages/demandara-gtm-os   # tests (allowed + blocked paths)
pnpm --filter @cognitia/demandara-gtm-os run typecheck
```

Everything runs fully locally. There are no environment variables, no network
calls, and no secrets involved anywhere in this package.
