# Demandara — Pilot Script

A rehearsal emphasising the **AI-agent + Agent Fabric** paths on the real
mainline stack, via the [mainline proof harness](./PILOT_PROOF_HARNESS.md).

> **Simulation only.** No production DB, real SMS, real payments, token, external
> credentials, deploy, or remote execution. The fabric executes nothing for real.

---

## Goal

Show that an AI agent can drive accept/deliver through the **existing Action
Ledger** (human approval required, agent cannot self-approve/verify/release), and
that the Agent Fabric routes and produces a simulated, proof-backed delivery.

## Pre-flight

```bash
pnpm install
pnpm check
```

## Cast (mainline fixtures)

| Actor           | Kind              | Trust                                                    |
| --------------- | ----------------- | -------------------------------------------------------- |
| Requester agent | `internal_ops`    | funded 500 credits                                       |
| Worker agent    | `internal_ops`    | active ATC + economy permissions (allow, approval-gated) |
| Operator        | human             | proposes-on-behalf / approves / executes                 |
| Owner           | human             | verifies / arbitrates                                    |
| Fabric node     | registry metadata | macOS node, `code.test.run` tier 2                       |

## Script A — agent-driven loop (scenario 2)

1. **Create** a work order (operator).
2. **Propose accept** via `proposeEconomyAction(..., 'accept')` → ledger row,
   `risk_level: high`, `requires_human_approval: true`, `simulation: true`,
   `approval_status: proposed`.
3. **Gates rehearsed:** viewer cannot propose (403); `verify`/`resolve` are never
   agent-proposable (403); execution before approval is refused (409).
4. **Approve** (human, on the existing approve/reject ledger) → **execute**
   (operator) → `accepted`, escrow reserved (requester `500 → 400`).
5. **Propose deliver → approve → execute** → `delivered`, delivery proof linked.
6. **Owner verify** releases escrow + books `work_order:verified`. An operator
   attempting to verify is refused (403) — release is an owner decision.
7. **Audit:** `economy.agent_action.proposed.v1` and `…executed.v1` present.

## Script B — Agent Fabric (scenario 5)

1. **Accept** a fresh work order with the worker.
2. **Register node** (`registerFabricNode`, macOS, `code.test.run` tier 2).
3. **Route** (`routeFabricWorkOrder`, `min_tier: 2`) → deterministic `chosen`
   node.
4. **Simulate execute** (`simulateFabricExecute`) → a `verified_fact` **receipt**
   proof (`evidence_ref: fabric-node:…`, `details_private.simulated: true`) and a
   `delivered` work order. No network/process — `getFabric().note` states it
   "executes nothing for real".
5. **Owner verify** releases escrow + reputation.
6. **Quarantine** the node (`setFabricNodeStatus … 'quarantined'`) → a later
   `simulateFabricExecute` on it is refused (409). Per-node kill switch.

## Acceptance criteria

- [ ] `pnpm check` green (539 tests).
- [ ] Agents propose; humans approve; agents cannot self-approve/verify/release.
- [ ] Fabric receipts are simulated and proof-backed; quarantine blocks execution.
- [ ] No real remote execution, payments, token, or external calls.

## What this does **not** claim

No production readiness, no real distributed execution, no real settlement.
Distributed agent execution is a deliberately gated future step.
