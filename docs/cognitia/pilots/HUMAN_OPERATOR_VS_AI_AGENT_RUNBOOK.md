# Human Operator vs. AI Agent — Runbook

How the two operation paths differ in Cognitia, and why the difference is a
**safety boundary** rather than a convenience. Backed by the
[pilot proof harness](./PILOT_PROOF_HARNESS.md).

> **Simulation only.** Everything described here runs in the dev/simulation
> harness — no production DB, real SMS, real payments, token, external creds, or
> deploy.

---

## The principle

> **Humans approve. AI agents propose.**

Value‑moving and trust‑establishing actions (approve work, verify a proof,
release escrow, resolve a dispute) require a **human** capability. AI agents are
deliberately constrained to **proposing** and **delivering**. Every action — by
either party — is recorded on the hash‑chained Action Ledger.

---

## Capability matrix

| Capability | Human operator | AI agent | Effect if missing |
| --- | :---: | :---: | --- |
| `create_work` | ✅ | ❌ | `AuthorizationError` |
| `approve_work` | ✅ | ❌ | `AuthorizationError` |
| `propose_action` | ✅ | ✅ | `AuthorizationError` |
| `deliver_work` | ✅ | ✅ | `AuthorizationError` |
| `verify_proof` | ✅ | ❌ | `AuthorizationError` |
| `release_escrow` | ✅ | ❌ | `AuthorizationError` |
| `resolve_dispute` | ✅ | ❌ | `AuthorizationError` |

The matrix is enforced in `cognitiaHarness.ts` via `requireCapability`. An agent
literally cannot call `verifyAndRelease` or `approveProposal` — the call throws.

---

## Ledger status semantics

| Path | Action | Resulting status |
| --- | --- | --- |
| Human | create / approve / verify / release | `executed` (or `approved`) |
| AI agent | propose | `proposed` |
| AI agent | deliver | `proposed` (awaits owner verification) |
| Human | approve a proposal | `executed`, links proposal id + hash |
| Owner | weak proof | `refused` |

So an agent‑driven flow always leaves a `proposed → executed` pair on the ledger,
with the human approval cryptographically referencing what it approved.

---

## Side‑by‑side: the same job, two drivers

### Human‑driven

1. Operator `createListing` → `executed`.
2. Worker `openWorkOrder` → escrow reserved.
3. Worker `deliverWork` (strong proof) → `executed`.
4. Operator `verifyAndRelease` → escrow released, reputation +10.

### Agent‑driven

1. Operator `createListing` → `executed`.
2. Agent `proposeAction("accept_and_deliver")` → `proposed`.
3. Operator `approveProposal` → `executed` (references the proposal).
4. Agent `openWorkOrder` → escrow reserved, delivery is `proposed`.
5. Agent `fabricDeliver` (simulated route → receipt) → delivery `proposed`.
6. **Operator** `verifyAndRelease` → escrow released, reputation +10.

The agent never performs steps 1, 3, or 6's verification/release — those stay with
the human.

---

## Operator checklist

When supervising an agent‑driven pilot run:

- [ ] Every agent proposal has a corresponding human approval before execution.
- [ ] No `verify`/`release` entry has an `ai_agent` actor.
- [ ] Fabric receipts are `simulated: true`.
- [ ] Escrow moved only on a `strong` verdict.
- [ ] `ledger.verifyChain()` is `true` at the end of the run.
- [ ] Trust feed is empty unless the pilot explicitly turned it on.

---

## Failure modes and expected behaviour

| Attempt | Expected |
| --- | --- |
| Agent self‑approves a proposal | `AuthorizationError` |
| Agent verifies a proof / releases escrow | `AuthorizationError` |
| Owner verifies a weak proof | `released: false`, escrow stays reserved, `refused` entry |
| Settling an already‑settled escrow | `EscrowError` |
| Owner lists and works their own listing | `MarketplaceError` |
| Running under `NODE_ENV=production` | `ProductionGuardError` |

---

## What this does **not** claim

This runbook describes the *simulated* authorization boundary. It is not a claim
about production IAM, managed RLS, or real settlement. See the
[harness guardrails](./PILOT_PROOF_HARNESS.md#guardrails).
