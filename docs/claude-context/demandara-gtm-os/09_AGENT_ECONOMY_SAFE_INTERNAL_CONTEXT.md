# 09 — Agent Economy Safe Internal Context

## Boundary

Agent economy is a future internal work/reputation/credit layer only.

No token, crypto, wallet, escrow, stablecoin, live payment, marketplace, or securities-language implementation is authorized.

## Internal-only primitives

| Primitive        | Meaning                                       | Build status target      |
| ---------------- | --------------------------------------------- | ------------------------ |
| Agent passport   | Stable internal identity for an agent/process | Design/local schema only |
| Work event       | A task/action/event performed by an agent     | Local ledger only        |
| Proof event      | Evidence that output passed a gate            | Local proof receipt only |
| Reputation note  | Internal evidence-backed quality marker       | Research only            |
| Cost/usage entry | Internal compute/tool cost accounting         | Local internal only      |

## Agent passport fields

- agent id;
- role;
- allowed scopes;
- denied scopes;
- work events;
- proof events;
- review events;
- blocked attempts;
- model/tool route used;
- evidence hash.

## Forbidden

Public token launch, investment/yield language, payment integration, wallet/escrow/stablecoin, marketplace claims, or public reputation scoring.
