# AGENT-ECONOMY-003 — Execution Log

Date: 2026-06-12. Branch `claude/agent-economy-003-agent-actions` (stacked on
002). Evidence: `verified_fact` unless noted.

## Build sequence

1. **Baseline** — branch/stack confirmed; 422/422 green on the 002 tip
   (AGENT_ECONOMY_003_BASELINE.md).
2. **Service `apps/api/src/agentEconomyActions.ts`** — NO new tables, NO new
   migration: the existing `agent_actions` ledger is the storage and the
   existing ActionLedger is the approval machinery.
   - `ECONOMY_PERMISSION_KEYS` (accept/deliver/dispute/verify/resolve);
     accept/deliver/dispute agent-proposable with an explicit allow
     (deny-by-default, deny wins); verify/resolve hard-refused (403) — human
     owner decisions.
   - `proposeWorkOrderAgentAction`: active-ATC gate + permission gate +
     state preconditions (accept⇐proposed + no self-accept; deliver⇐
     accepted/in_progress + assigned-worker match; dispute⇐delivered) →
     `agent_run` + high-risk proposed `agent_action` with
     `proposed_payload` / `requested_transition` /
     `requires_human_approval:true` / `evidence_tag` on `result`, proposal
     proof (verified_fact), audit `economy.agent_action.proposed.v1`.
     Content-fingerprinted idempotency (front-desk precedent): identical ask
     replays; revised payload = new ask.
   - `executeWorkOrderAgentAction`: approved-only (409 otherwise), never
     twice (409), dispatches to acceptWorkOrder/deliverWorkOrder/
     disputeWorkOrder — escrow moves only along the safe path, every
     0016/0017 guard re-applies. Delivery proof is linked back onto the
     ledger action. Audit `economy.agent_action.executed.v1`.
   - `listEconomyAgentActions`: ledger rows + decision feedback labels
     (who approved, which reason) for the console.
3. **Routes** — `propose-accept` / `propose-deliver` / `propose-dispute`,
   `GET /agent-economy/actions`, `POST /agent-economy/actions/:id/execute`.
   Approval deliberately rides the EXISTING `/agent-actions/:id/approve|reject`
   (mapping documented in AGENT_DRIVEN_WORKFLOW.md).
4. **Console** — `/agent-economy` gains the "Agent proposals (Action Ledger)"
   section: file accept/deliver asks for an agent, approval-required badge,
   ledger + execution status, linked proof, who decided (approver ref +
   taxonomy reason), execute button for approved asks, and the standing note
   that verify/arbitration stay owner-only.
5. **Docs** — AGENT_DRIVEN_WORKFLOW.md + lab-doc updates + this trio.

## Test results

- `agentEconomyAgentActions.test.ts`: **8 tests green** — full agent-driven
  loop (propose→approve→execute accept with single escrow reserve +
  replay-409; propose→approve→execute deliver with proof linked to the
  ledger action; human verify still releasing + reputation; both audit
  events; console list decisions); ATC gate 403; deny-by-default 403;
  explicit-deny-wins 403; verify/resolve not proposable 403; rejected asks
  cannot execute (order untouched, balance untouched); yanked version
  refused at execution even when approved; worker-mismatch 403; proofless
  delivery refused at execution; revised ask with likely_inference proof
  delivers but can NOT release escrow; viewer 403; missing order/agent 404.
- One mid-build correction (recorded honestly): first run used decision
  reasons outside the CLOSED ledger taxonomy ('looks_good'/'not_a_fit') and
  the 400 was silently swallowed by the test helper — fixed by using
  `meets_playbook`/`policy_or_risk` and asserting the decision response
  status. The closed taxonomy doing its job.
- Full gate: **`pnpm check` 430/430 tests, 66 files, green** (was 422/422).

## Decisions worth recording

- **No `.proposed` action-type suffix**: `approval_status` IS the lifecycle;
  encoding it into `action_type` would duplicate state. Documented mapping.
- **Execution is operator-gated, not automatic-on-approval**: approve answers
  "may this happen?", execute answers "do it now" — same separation the rest
  of the platform uses (and a future AGENT-ECONOMY ticket can wire an
  auto-execute worker behind its own gate).
- **Proposal-time gates keep the queue clean; execution-time gates keep the
  system safe** — both run; only the second is load-bearing (e.g. the yank
  test passes because executeWorkOrderAgentAction re-runs the skill gate).
