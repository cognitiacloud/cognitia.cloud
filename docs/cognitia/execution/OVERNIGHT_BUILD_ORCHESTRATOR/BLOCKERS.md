# Blockers — Overnight Sprint

Date: 2026-06-15. Live blocker log for the sprint. Each entry: ID, lane,
severity, status, description, and the unblock condition. Resolved blockers are
kept (struck as `RESOLVED`) for the record. Evidence tags per `OVERNIGHT_PLAN.md`.

## Open

| ID    | Lane           | Severity | Status | Description                                                                                                                         | Unblock condition                                                               |
| ----- | -------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| BLK-2 | all            | low      | open   | Sibling lane branches are not visible from the orchestrator session; status is report-driven (`likely_inference`).                  | Each lane reports its branch + `pnpm check` result.                             |
| BLK-3 | V6/BOND/FABRIC | med      | open   | Migration-number collision risk on `0020` if multiple DB lanes land unserialized (`design_only`).                                   | Orchestrator serializes numbers per `CONFLICT_RISK_LEDGER.md`.                  |
| BLK-4 | PILOT-001      | med      | open   | Pilot proof harness built + merged (#83, `verified_fact`); **real pilot traction is founder-gated** — no live tenant/pilot engaged. | Founder engages a Tenant Zero / Demandara pilot; no lane code action available. |

## Resolved

| ID    | Lane      | Severity | Status   | Description                                                                                          | Resolution                                                                                         |
| ----- | --------- | -------- | -------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| BLK-1 | Session 0 | low      | RESOLVED | Baseline test count was unverified-in-session (working tree had been on a stale ancestor `0dfb0ad`). | Reset branch to `e0de0e5`, ran `pnpm install` + `pnpm check`: **532/532 green** (`verified_fact`). |

## Escalation notes

- No guardrail breaches observed in the orchestrator lane. If any lane reports
  an action that would breach a global hard guardrail (token launch, real
  payment, production deploy/migration, SOC2/production-ready/unstoppable
  claims, secret handling), the orchestrator records it here as
  `unsafe_overclaim` / blocked and routes it to **Recommended Owner Decisions**
  rather than letting it merge.
