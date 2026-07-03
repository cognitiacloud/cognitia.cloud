# 12 — Connector Registry Context

The connector registry describes external system connectors without enabling live actions by default.

## Connector states

- `disabled`
- `mock_only`
- `read_only_future`
- `write_future_requires_approval`
- `live_blocked`

## Initial connector families

| Connector | Use | Default state |
|---|---|---|
| CRM | mock writeback and future customer records | `mock_only` |
| Calendar/appointments | mock appointment intent | `mock_only` |
| Email/SMS | future follow-up channel | `live_blocked` |
| Inventory website | future dealer vehicle context | `mock_only` |
| Analytics | report metrics | `mock_only` |
| Model provider | model route | `disabled` unless replay/mock |
| Proof store | local proof receipt output | `mock_only` |

## Registry entry fields

Connector id, vertical, capability, state, read/write flags, allowed data mode, approval required, egress allowed, mock fixture path, proof event type, and blocked reason.

## Deny rule

If connector state is not explicitly `mock_only` or approved local equivalent, block action and generate a proof event.
