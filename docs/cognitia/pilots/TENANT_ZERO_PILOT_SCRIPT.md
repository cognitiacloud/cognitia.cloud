# Tenant Zero — Pilot Script

A step‑by‑step rehearsal of the first tenant ("Tenant Zero") onboarding and first
verified job, run entirely against the [pilot proof harness](./PILOT_PROOF_HARNESS.md).

> **Simulation only.** No production DB, no real SMS, no real payments, no token,
> no external API credentials, no deploy. Amounts are abstract units, not currency.

---

## Goal

Demonstrate that a brand‑new tenant can:

1. Stand up a human operator.
2. List work, open a work order, and reserve escrow.
3. Receive a verified delivery and release escrow with reputation.
4. Refuse a weak proof.

All on a tamper‑evident Action Ledger.

---

## Pre‑flight

```bash
pnpm install
pnpm check     # must be green before running the pilot script
```

No environment variables are required. If `NODE_ENV=production` or a real‑looking
credential is present, the harness refuses to start — that is expected.

---

## Cast

| Actor | Kind | Role |
| --- | --- | --- |
| `op_zero` | human | Tenant Zero operator (owner) |
| `wk_pilot` | human | Pilot worker |
| `ag_atlas` | ai_agent | Assisting AI agent (propose/deliver only) |

---

## Script

### Act 1 — Operator stands up and lists work

1. Construct a harness: `new CognitiaHarness()` (trust feed off by default).
2. `op_zero = harness.humanOperator("op_zero", "Tenant Zero Operator")`.
3. `listing = harness.createListing(op_zero, { title: "Label 500 records", priceUnits: 100 })`.
   - **Expect:** a `create_listing` ledger entry with status `executed`.

### Act 2 — Work order + escrow reserve

4. `wk_pilot = harness.humanOperator("wk_pilot", "Pilot Worker")`.
5. `{ workOrder, escrow } = harness.openWorkOrder({ listing, worker: wk_pilot })`.
   - **Expect:** `workOrder.status === "reserved"`, `escrow.status === "reserved"`,
     `escrow.amountUnits === 100`.

### Act 3 — Verified delivery → release + reputation (happy path)

6. Build a **strong** proof: a non‑empty `artifactRef` plus ≥2 independent signals.
7. `harness.deliverWork(wk_pilot, workOrder, proof)`.
8. `result = harness.verifyAndRelease(op_zero, workOrder, proof)`.
   - **Expect:** `result.released === true`, `result.settlement.toPayee === 100`,
     `reputation.score("wk_pilot") === 10`, work order status `released`.
   - A simulated SMS lands in the notifier outbox (marked `simulated`).

### Act 4 — Weak proof refused (negative path)

9. Open a second work order and deliver a **weak** proof (e.g. `artifactRef: null`).
10. `harness.verifyAndRelease(op_zero, workOrder2, weakProof)`.
    - **Expect:** `released === false`, escrow stays `reserved`, no reputation,
      a `refused` ledger entry whose reasons mention the missing artifact.

### Act 5 — Audit

11. `harness.ledger.verifyChain()` → **`true`** (chain intact).

---

## Acceptance criteria

- [ ] `pnpm check` is green.
- [ ] Escrow releases **only** on a strong, verified proof.
- [ ] Weak proof leaves escrow reserved and awards no reputation.
- [ ] Reputation is awarded only on verified release.
- [ ] The Action Ledger hash chain verifies.
- [ ] The public trust feed is empty (it was never configured on).

---

## What this rehearsal does **not** claim

It does not claim production readiness, real settlement, or real messaging. It is a
deterministic rehearsal of the Tenant Zero flow. See the
[harness guardrails](./PILOT_PROOF_HARNESS.md#guardrails).
