# Agent-Driven Workflow (AGENT-ECONOMY-003)

Date: 2026-06-12. Source of truth: `apps/api/src/agentEconomyActions.ts`.
Agents never get uncontrolled execution: **agent-driven means agents propose
through the governed Action Ledger** — the same approve/reject machinery,
closed decision taxonomy, and feedback labels as every other risky action on
the platform.

## The loop

```
agent files an ask          POST /agent-economy/work-orders/:id/propose-accept
                                 .../propose-deliver  .../propose-dispute
   gates AT PROPOSAL: active ATC + explicit permission allow (deny-by-default)
                      + work-order state preconditions (queue stays clean)
→ ledger row created        agent_actions: risk_level=high, approval_status=proposed,
                            simulation=true, requires_human_approval=true,
                            proposal proof (verified_fact) linked, audit event
→ HUMAN decides             POST /agent-actions/:id/approve | /reject
                            (EXISTING ledger routes; closed reason taxonomy;
                             decision lands as a feedback label with approver)
→ operator executes         POST /agent-economy/actions/:id/execute
   re-runs EVERY safe-path rule: ATC, yank gate, state machine, escrow
   idempotency, proof requirements — escrow moves only inside
   acceptWorkOrder / deliverWorkOrder / disputeWorkOrder
```

## Permission scopes (agent_permissions action keys; deny-by-default)

| Key                          | Agent-proposable?                | Notes                                     |
| ---------------------------- | -------------------------------- | ----------------------------------------- |
| `economy.work_order.accept`  | yes, with an explicit **allow**  | explicit deny always wins; absence = deny |
| `economy.work_order.deliver` | yes, with an explicit **allow**  | only the ASSIGNED worker may propose      |
| `economy.work_order.dispute` | yes, with an explicit **allow**  | a dispute ask never resolves anything     |
| `economy.work_order.verify`  | **never** — human owner decision | payout posture (403 even if a row exists) |
| `economy.work_order.resolve` | **never** — human owner decision | arbitration posture                       |

Grant scopes through the existing `PUT /agents/:id/permissions` route. Real
payment remains impossible at every layer (0012 rail check; no route).

## Rules that hold no matter what an agent asks

- Every economy ask is `risk_level=high` → approval required. There is no
  auto-approved economy action.
- Proposals are **content-fingerprinted idempotent** (front-desk precedent):
  the same ask replays the same ledger row; a revised payload (e.g. a deliver
  ask that now carries a proof) is a NEW ask for a NEW human decision.
- Execution refuses unapproved/rejected asks (409) and never runs twice
  (409 on replay; escrow keys make even a hypothetical double-run a no-op).
- Delivery still requires proof; weak tags (`likely_inference`/`unknown`)
  still cannot release escrow; yanked skill versions are still refused — the
  execute step calls the same service functions as the human routes, so every
  0016/0017 guard re-applies.
- A dispute ask, once approved+executed, HOLDS escrow; resolution remains
  owner arbitration (AGENT-ECONOMY-002), 403 for anyone else.

## Route mapping (brief → implementation)

| Brief concept                                                                    | Implemented as                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `economy.work_order.accept.proposed` action type                                 | `action_type='economy.work_order.accept'` + `approval_status='proposed'` (the ledger column IS the lifecycle; suffix encoding would duplicate it)                                |
| approve/reject routes                                                            | existing `/agent-actions/:id/approve\|reject` — deliberately not duplicated                                                                                                      |
| execute                                                                          | new `/agent-economy/actions/:id/execute` (the generic ledger execute dispatches via the integration adapter registry, which has no economy adapter — same posture as front-desk) |
| proposed_payload / requested_transition / evidence_tag / requires_human_approval | stored on `agent_actions.result` (jsonb)                                                                                                                                         |

## Audit surface

`economy.agent_action.proposed.v1` and `economy.agent_action.executed.v1`
(plus the ledger's own `agent.action.approved/rejected.v1` events and the
work-order service audits underneath).
