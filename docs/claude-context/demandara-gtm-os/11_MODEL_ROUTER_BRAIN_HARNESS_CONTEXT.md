# 11 — Model Router / Brain Harness Context

The model-router brain harness lets Demandara select, mock, or replay AI tasks while preserving fail-closed governance.

## Required behavior

- No live provider call in default/demo/test mode.
- Every route declares provider mode: `mock`, `replay`, `disabled`, or future `live_approved`.
- Provider/model selection is auditable.
- Failed route produces a proof event and blocked reason.
- No route can bypass consent or human approval.
- Output is stored as evidence with source and risk label.

## Suggested interfaces

- `ModelRouteRequest`
- `ModelRouteDecision`
- `BrainHarnessRun`
- `ReplayFixture`
- `ProviderExecutionGate`
- `RouteProofReceipt`

## Tests to require

- live provider blocked by default;
- missing provider config fails closed;
- replay fixture returns deterministic output;
- route decision is logged;
- provider output cannot mark human approval true;
- secret-looking inputs are rejected or redacted.
