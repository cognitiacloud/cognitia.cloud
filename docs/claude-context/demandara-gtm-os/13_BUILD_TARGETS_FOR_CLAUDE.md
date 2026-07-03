# 13 — Build Targets for Claude

## Primary build target

Build a local/mock-only Demandara GTM OS chassis:

`lead intake -> qualification -> consent/source-rights gate -> human approval -> mock connector writeback -> Cognitia proof receipt -> Command Center summary`

## Suggested package structure

Claude may adjust to existing repo conventions, but should prefer a clear module map such as:

```text
packages/demandara-gtm-os/
  src/
    leadIntake.ts
    qualification.ts
    consentGate.ts
    approvalGate.ts
    workflowEngine.ts
    verticalAdapters.ts
    connectorRegistry.ts
    modelRouter.ts
    proofReceipt.ts
    commandCenterSummary.ts
  fixtures/
    budgetWheels.demo.json
  tests/
    workflowEngine.test.ts
    consentGate.test.ts
    approvalGate.test.ts
    connectorRegistry.test.ts
    proofReceipt.test.ts
```

## Acceptance criteria

- Runs fully locally.
- Uses fake/reserved Budget Wheels fixture data only.
- No live provider/CRM/API/outreach/deploy path.
- Missing consent blocks.
- Missing human approval blocks.
- Mock writeback records intent only.
- Proof receipt generated every run.
- Command Center summary shows state, blocker, and next action.
- Tests cover allowed and blocked paths.
- Docs explain claim-safe status.

## Out of scope

UI polish beyond minimal Command Center data shape, real CRM connectors, real model calls, deployment, and public launch copy.
