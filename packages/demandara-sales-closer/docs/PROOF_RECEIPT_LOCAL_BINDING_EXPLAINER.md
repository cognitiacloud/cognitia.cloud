# 65P-3 — Proof Receipt Local Binding Explainer

## Plain English

The local proof receipt is a deterministic proof trail for the demo. It ties together:

- the demo tenant;
- the demo lead;
- the local approval receipt hash;
- the local receipt version;
- the fact that this is local-only mode.

If someone types a random proof-looking value, the fake CRM adapter and mock booking intent reject it. The receipt has to match the demo lead and approval context.

## What it is

- local deterministic proof;
- tamper-evident for fixture/demo flow;
- useful for explaining the intended proof spine.

## What it is not

- not a real signature;
- not production proof;
- not reviewer credential validation;
- not controlled-live readiness;
- not a legal/audit ledger.

Controlled-live requires reviewer credentials/signatures, auth, revocation, replay controls, and a durable audit ledger.
