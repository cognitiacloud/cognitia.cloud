# Human Operator vs. AI Agent — Runbook

How the two operation paths differ on the **real** Cognitia stack, and why the
difference is a safety boundary. Backed by the
[mainline proof harness](./PILOT_PROOF_HARNESS.md) and the existing
`agentEconomyActions` service.

> **Simulation only.** No production DB, real SMS, real payments, token, external
> credentials, deploy, or remote execution.

---

## The principle

> **Humans approve and release. AI agents propose and deliver.**

Economic-consequence actions move through the **existing Action Ledger** with
`risk_level: high` and `requires_human_approval: true`. There is no
auto-approved economy action.

## Capability / approval matrix (mainline-enforced)

| Action                      | Operator | Owner | AI agent (proposal)  | Enforcement                                       |
| --------------------------- | :------: | :---: | :------------------: | ------------------------------------------------- |
| create work order           |    ✅    |  ✅   |          —           | `requireMutatingRole`                             |
| accept work order           |    ✅    |  ✅   |   **propose only**   | `economy.work_order.accept` allow + ATC           |
| deliver work order          |    ✅    |  ✅   |   **propose only**   | `economy.work_order.deliver` allow + worker match |
| dispute                     |    ✅    |  ✅   |   **propose only**   | `economy.work_order.dispute` allow                |
| **verify** (release escrow) |    ❌    |  ✅   | **never proposable** | `requireOwner` + `NotAgentProposableError`        |
| **resolve** (arbitrate)     |    ❌    |  ✅   | **never proposable** | `requireOwner` + `NotAgentProposableError`        |
| approve / reject a proposal |    ✅    |  ✅   |          ❌          | approve/reject ledger (human)                     |
| execute an approved action  |    ✅    |  ✅   |          ❌          | `executeEconomyAction` (operator-gated)           |

Deny-by-default: an agent needs an **explicit allow** permission row; an explicit
deny always wins; absence of an allow is a deny. The trust gate additionally
requires an **active ATC**.

## Ledger semantics

| Path     | Action                         | Resulting ledger state                                                   |
| -------- | ------------------------------ | ------------------------------------------------------------------------ |
| AI agent | propose accept/deliver/dispute | `approval_status: proposed`, `risk_level: high`, proposal proof attached |
| Human    | approve / reject               | decision recorded on the same ledger every risky action uses             |
| Operator | execute approved action        | runs the safe service path; escrow can only move there                   |
| Owner    | verify / resolve               | release / arbitration — never delegated to an agent                      |

## Side-by-side: the same job

### Human-driven (scenario 1)

list → order → accept (reserve) → deliver (verified_fact) → **owner verify**
(release + reputation).

### Agent-driven (scenario 2)

create → **agent proposes** accept → human approve → operator execute (reserve) →
**agent proposes** deliver → human approve → operator execute (proof linked) →
**owner verify** (release + reputation).

The agent never performs verify or resolve; an operator cannot verify either.

## Operator checklist (supervising an agent run)

- [ ] Every agent proposal has a human approval before execution.
- [ ] No `verify` / `resolve` was performed by a non-owner.
- [ ] Escrow released only against a `verified_fact` proof.
- [ ] Fabric deliveries are simulation receipts; quarantine blocks execution.
- [ ] Public trust feed is empty unless a tenant is configured server-side.

## Failure modes rehearsed (harness)

| Attempt                                                    | Result                                |
| ---------------------------------------------------------- | ------------------------------------- |
| Viewer proposes an economy action                          | 403                                   |
| Agent proposes `verify` / `resolve`                        | 403 (`NotAgentProposableError`)       |
| Execute before approval                                    | 409 (`EconomyActionNotApprovedError`) |
| Operator verifies / resolves                               | 403 (`requireOwner`)                  |
| Owner verifies a weak (`likely_inference`/`unknown`) proof | 409 (`EscrowReleaseRefusedError`)     |
| Simulate execution on a quarantined node                   | 409 (`FabricNodeQuarantinedError`)    |

## What this does **not** claim

This is the simulated authorization boundary on the real stack. It is not a claim
about production IAM, managed-Postgres RLS under a restricted role, or real
settlement.
