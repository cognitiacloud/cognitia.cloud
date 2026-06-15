# Demandara — Pilot Script

A rehearsal of the Demandara pilot, emphasising the **AI‑agent + Agent Fabric**
path and dispute handling, run against the
[pilot proof harness](./PILOT_PROOF_HARNESS.md).

> **Simulation only.** No production DB, no real SMS, no real payments, no token,
> no external API credentials, no deploy. The Agent Fabric route is simulated and
> every receipt is marked `simulated: true`.

---

## Goal

Demonstrate that Demandara can:

1. Let an AI agent propose accept/deliver, gated by a human approval.
2. Route a task through a **simulated** Agent Fabric and deliver against a
   simulated proof receipt.
3. Verify and release on a strong proof, awarding the agent reputation.
4. Handle a dispute via refund or split.

---

## Pre‑flight

```bash
pnpm install
pnpm check     # must be green before running the pilot script
```

---

## Cast

| Actor | Kind | Role |
| --- | --- | --- |
| `op_dmd` | human | Demandara operator (owner / approver) |
| `ag_atlas` | ai_agent | Delivery agent (propose/deliver only) |

---

## Script

### Act 1 — Agent proposes, human approves (ledger‑gated)

1. `harness = new CognitiaHarness()`.
2. `op_dmd = harness.humanOperator(...)`, `ag_atlas = harness.aiAgent(...)`.
3. `proposal = harness.proposeAction(ag_atlas, { verb: "accept_and_deliver", target: workOrderId })`.
   - **Expect:** status `proposed`, actor kind `ai_agent`.
4. `harness.approveProposal(op_dmd, proposal)`.
   - **Expect:** status `executed`, metadata references the proposal id + hash.
5. Attempt `harness.approveProposal(ag_atlas, proposal)`.
   - **Expect:** throws `AuthorizationError` — the agent cannot self‑approve.

### Act 2 — Marketplace + escrow

6. `listing = harness.createListing(op_dmd, { title: "Routed enrichment", priceUnits: 120 })`.
7. `{ workOrder } = harness.openWorkOrder({ listing, worker: ag_atlas })`.
   - **Expect:** escrow reserved at 120 units.

### Act 3 — Agent Fabric simulated route → receipt → deliver → release

8. `result = harness.fabricDeliver({ agent: ag_atlas, owner: op_dmd, workOrder, claim: "routed and completed via fabric", hops: ["router-a", "worker-pool-3"] })`.
   - **Expect:** `result.receipt.simulated === true`, `artifactRef` begins with
     `sim://fabric/`, the route is `["origin", "router-a", "worker-pool-3", "proof-sink"]`.
   - **Expect:** `result.verify.released === true`, verdict `strong`,
     `reputation.score("ag_atlas") === 10`.

### Act 4 — Dispute (refund or split)

Run on a *separate* work order so the happy‑path numbers stay clean.

9. Open a new work order at 200 units.
10. **Refund:** `harness.resolveDispute(op_dmd, workOrder, { outcome: "refund", workerShare: 0 })`.
    - **Expect:** `toPayer === 200`, `toPayee === 0`, escrow `refunded`, no reputation.
11. **Split (alternate):** `{ outcome: "split", workerShare: 0.25 }` on another order.
    - **Expect:** `toPayee === 50`, `toPayer === 150`, status `split`.

### Act 5 — Audit + trust feed

12. `harness.ledger.verifyChain()` → **`true`**.
13. `harness.trustFeed.feed()` → `[]` (feed was never configured on).

---

## Acceptance criteria

- [ ] `pnpm check` is green.
- [ ] Agent proposals require a human approval to execute.
- [ ] Agent cannot verify proofs or release escrow (`AuthorizationError`).
- [ ] Fabric receipts are always `simulated: true`.
- [ ] Disputes refund/split correctly and award no reputation.
- [ ] The Action Ledger hash chain verifies.

---

## What this rehearsal does **not** claim

No production readiness, no real agent routing, no real settlement. The Agent
Fabric here is a deterministic simulator. See the
[harness guardrails](./PILOT_PROOF_HARNESS.md#guardrails).
