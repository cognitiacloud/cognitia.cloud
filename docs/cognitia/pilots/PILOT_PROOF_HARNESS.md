# PILOT-001 — Mainline Proof Harness

A test harness that rehearses the human and AI-agent operation paths through
Cognitia using the **real mainline primitives** — not a parallel scaffold. It
prepares the Tenant Zero / Demandara pilots without touching production.

> **Simulation only.** No production DB, no real SMS, no real payments, no token,
> no external API credentials, no deploy, no remote execution. Every assertion
> below is enforced by the existing stack and checked by the harness test.

---

## Where it lives

- **Test:** [`apps/api/src/pilotProofHarness.test.ts`](../../../apps/api/src/pilotProofHarness.test.ts)
- It drives the production-shaped services through `ApiHandlers` and the
  `InMemoryRepository`, exactly as the existing mainline economy/fabric tests do.

## Mainline systems exercised (no fakes)

| System                          | Module                                            | Used for                                          |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| ATC (Agent Trust Credentials)   | `apps/api/src/atc.ts`                             | worker trust gate on accept/propose               |
| Proof Registry                  | `apps/api/src/proofs.ts`                          | verified_fact / likely_inference / unknown proofs |
| SkillProof                      | `apps/api/src/skillproof.ts`                      | skill versions, yank gate                         |
| Reputation                      | `agentEconomy.ts` reputation events               | earned only on verified_fact release              |
| Credits ledger                  | `apps/api/src/credits.ts`                         | the only escrow rail (internal credits)           |
| Work Orders + Escrow Simulation | `apps/api/src/agentEconomy.ts`                    | lifecycle + reserve/release/refund                |
| Dispute Resolution              | `agentEconomy.resolveWorkOrderDispute`            | owner-arbitrated refund / split                   |
| Agent Action Ledger             | `apps/api/src/agentEconomyActions.ts`             | agent proposes; human approves                    |
| Internal Marketplace            | `apps/api/src/marketplace.ts`                     | listing → order                                   |
| Agent Fabric Lab v0             | `apps/api/src/agentFabric.ts`                     | route → simulated receipt → deliver               |
| Public trust feed               | `handlers.publicTrustFeed` (`/public/trust-feed`) | safe-empty unless configured                      |

---

## Scenarios (six paths) and what each proves

1. **Human operator path.** Marketplace listing → `orderFromListing` → accept
   (credits reserved into escrow) → deliver (simulated skill execution emits a
   `verified_fact` proof) → **owner** verify → escrow released to the worker +
   `work_order:verified` reputation. Asserts requester debited, worker credited.
2. **AI agent path.** Agent proposes accept/deliver on the **existing Action
   Ledger** (`risk_level: high`, `requires_human_approval: true`). A human
   approves; an operator executes the safe service path. Asserted negatives:
   viewer cannot propose (403); `verify`/`resolve` are never agent-proposable
   (403); execution before approval is refused (409); an operator cannot verify
   (403) — release stays an **owner** decision.
3. **Weak proof path.** A `likely_inference` proof and an `unknown` proof are
   delivered; **owner** verify is refused (409) for both; escrow stays reserved;
   no positive reputation is booked.
4. **Dispute path.** Delivered work is disputed → escrow **held**. An operator
   cannot arbitrate (403). The **owner** resolves: `refund` returns everything to
   the requester and books a negative reputation event; `split` conserves escrow
   (40/60) and moves **no** reputation.
5. **Agent Fabric path.** Register a node → deterministic route decision →
   `simulateExecute` records a `verified_fact` **receipt** proof
   (`evidence_ref` = `fabric-node:…`, `details_private.simulated = true`) and
   delivers via the economy path. No network, no process spawn — the fabric view
   states it "executes nothing for real". Quarantine is the per-node kill switch
   (a quarantined node refuses execution, 409). Human verify still releases.
6. **Public trust feed path.** Unconfigured → `configured: false`, empty proofs,
   aggregate reputation `{0,0,0}`. Configured server-side (env only, never the
   request) → proofs are the **public projection only** (no `details_private`,
   `evidence_ref`, `verifier_ref`, `subject_id`, `tenant_id`); reputation is
   aggregate counts only.

Plus a cross-cutting guard test: `escrow.rail === 'internal_credits'`,
`token_public_status === 'disabled'`, `legal_gate === 'not_passed'`,
`marketplace.visibility === 'internal'`, and no production env required.

---

## How to run

```bash
pnpm install
pnpm check          # format:check + typecheck + full vitest suite

# just this harness:
pnpm exec vitest run apps/api/src/pilotProofHarness.test.ts
```

The harness adds **7 tests** to the mainline suite. Baseline before this work:
**532 passing**; after: **539 passing**.

---

## What this proves — and what it does not

**Proves:** the real Cognitia stack enforces the pilot's safety invariants —
human-gated approval and release, escrow-on-verified-fact, weak-proof refusal,
owner-only dispute arbitration with honest reputation, simulation-only fabric,
and a safe-empty public feed.

**Does not prove:** production readiness; managed Postgres **row-level security
under a restricted role** (explicitly caveated in the public feed); real payment
settlement, real messaging, or real distributed agent execution. Those remain
deliberately gated future steps.

---

## Related

- [`TENANT_ZERO_PILOT_SCRIPT.md`](./TENANT_ZERO_PILOT_SCRIPT.md)
- [`DEMANDARA_PILOT_SCRIPT.md`](./DEMANDARA_PILOT_SCRIPT.md)
- [`HUMAN_OPERATOR_VS_AI_AGENT_RUNBOOK.md`](./HUMAN_OPERATOR_VS_AI_AGENT_RUNBOOK.md)
- [`../execution/PILOT_001_MAINLINE_HANDOFF.md`](../execution/PILOT_001_MAINLINE_HANDOFF.md)
