# 06 — Vertical Adapters Context

Vertical adapters let the same Demandara/Cognitia spine operate across different industries without rewriting the platform.

## Core verticals

| Vertical               | Role                                                            | Status                               |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------ |
| Budget Wheels DealerOS | Dealership vertical SaaS lane and first internal demo wedge     | Internal demo/design only            |
| MoverOS                | Moving-company vertical OS and PR #30 reference adapter pattern | Reference only, no source copied     |
| Skillocate             | BC education/grants/assessment-help vertical                    | Future vertical adapter              |
| Alpha Investo          | Finance/media/subscription/analytics vertical                   | Parked/claim-sensitive               |
| Cognitia Republic      | Content/demand/founder acquisition engine                       | Demand engine, not core SaaS runtime |

## Adapter interface target

Each adapter should define vertical id, allowed data modes, required fake fixture schema, qualification fields, consent/source-rights fields, mock writeback target, proof receipt template, blocked live actions, connector registry entries, and monthly report metrics.

## Adapter invariant

Vertical adapters may specialize fields and copy, but they must not bypass Cognitia gates. Consent, source rights, human approval, and proof receipt generation remain mandatory.
