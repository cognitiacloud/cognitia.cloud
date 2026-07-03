# 02 — Cognitia Trust / Proof / Control Context

Cognitia is the proof, trust, control, and governance spine for AI work. Demandara must run on Cognitia controls, not around them.

## Required trust primitives

| Primitive             | Purpose                                                 | Build mode              |
| --------------------- | ------------------------------------------------------- | ----------------------- |
| Policy gate           | Deny unsafe or unapproved action                        | Local/mock first        |
| Consent gate          | Verify source-rights and consent state before next step | Local/mock first        |
| Human approval event  | Approval/deny/hold before external action               | Local/mock first        |
| Action ledger         | Record workflow events and blocked attempts             | Local append-only first |
| Proof receipt         | Human-readable explanation of what happened and why     | Markdown/JSON first     |
| Replay pack           | Re-run a fake fixture through same path                 | Local fixture first     |
| Claim-safety register | Prevent public overclaims                               | Docs/tests first        |

## Invariant

No caller-supplied field may satisfy a required human approval gate. Approval must come from a trusted local workflow event.

## Done criteria

- Missing consent blocks with clear reason.
- Missing human approval blocks with clear reason.
- Mock writeback cannot execute until approval exists.
- Receipt captures lead id, policy decision, consent state, approval event, adapter event, and exact blocked/allowed reason.
- Tests cover denial, forged approval, missing consent, no-live connector, and happy-path mock-only flow.
