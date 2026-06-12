# AGENT-ECONOMY-003 — Baseline

Date: 2026-06-12. Evidence: `verified_fact` unless noted.

## Pre-coding confirmations (per mission brief)

| Check                            | Result                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Current branch                   | `claude/agent-economy-003-agent-actions`                                                          |
| PR #48 merged?                   | NO — open draft, CI green (`b8499a6`)                                                             |
| PR #49 merged?                   | NO — open draft, CI green (`8c4d1ba`)                                                             |
| Base decision                    | #49 green-but-unmerged ⇒ stacked from `claude/agent-economy-002-dispute-resolution` per the brief |
| `pnpm install --frozen-lockfile` | clean                                                                                             |
| `pnpm check` on the 002 tip      | **422/422 tests, 65 files, green**                                                                |

## Machinery confirmed present (reused, not rebuilt)

- **Action Ledger** (`packages/agents` ActionLedger): generic
  approve/reject over `agent_actions` with the CLOSED decision-reason
  taxonomy (`approveReasonCode`/`rejectReasonCode` in core), feedback labels
  carrying `approver_ref`, ledger audit + event emission. Routes
  `/agent-actions/:id/approve|reject` already exist and are agent-action-type
  agnostic.
- **Front-desk proposal precedent** (COG-006/COG-014): operator-driven
  propose → `agent_run` + `agent_action` (high risk ⇒ proposed) + proposal
  proof (verified_fact: the row is the evidence) + audit; separate
  domain-specific execute endpoint because the generic ledger execute
  dispatches through the integration adapter registry (closed set — no
  economy adapter, by design).
- **agent_permissions** deny-by-default posture + `PUT /agents/:id/permissions`.
- Economy lab services (001/002): acceptWorkOrder / deliverWorkOrder /
  disputeWorkOrder / verifyWorkOrder / resolveWorkOrderDispute — the ONLY
  paths that move escrow.

## Stack note

`main` → PR #48 (001) → PR #49 (002) → this branch (003). GTM PRs #44/#45/#46
remain open and untouched; COG-016 stays parked.
