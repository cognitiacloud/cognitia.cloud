# PILOT-001 — Mainline Handoff

Handoff for the Tenant Zero / Demandara pilot proof harness, built against the
**real Cognitia mainline** (not a self-contained scaffold).

> **Simulation only.** No production DB, real SMS, real payments, token, external
> API credentials, deploy, or remote execution.

---

## Summary

PILOT-001 adds a mainline test harness that rehearses the human and AI-agent
operation paths through Cognitia using the existing primitives: ATC, Proof
Registry, SkillProof, Reputation, the Credits ledger, Work Orders, the simulated
Escrow, Dispute Resolution, the Agent Action Ledger, the Internal Marketplace,
the Agent Fabric Lab, and the public `/public/trust-feed`. It builds no parallel
system — every step runs through `ApiHandlers` and the production-shaped
services, so it proves the actual stack.

A first PILOT-001 attempt (PR #82) was built on the wrong base branch
(`claude/ep002-mission-run-pPoba`, which contained only the hermes skill) and
scaffolded a stand-in `apps/api`. That PR was **closed as invalid** and is
superseded by this mainline rerun.

## Correct mainline verification

Confirmed present on `main` before building:

- `docs/cognitia/audits/AUDIT_BOOKLET_001/` and `COGNITIA_SYSTEM_BOOKLET_V1.md`
- `apps/web/src/app/trust/page.tsx`
- `apps/api/src/agentEconomy.ts`, `apps/api/src/agentFabric.ts`
- `packages/db/migrations/0019_agent_fabric_nodes.sql`
- migration `0015` absent/reserved (confirmed)

Baseline `pnpm check`: **81 files, 532 tests passing**, format + typecheck clean.

## What shipped

### Test (real stack)

- `apps/api/src/pilotProofHarness.test.ts` — **7 tests**, six scenario paths plus
  a cross-cutting guard, all through `ApiHandlers` + `InMemoryRepository`.

### Docs

- `docs/cognitia/pilots/PILOT_PROOF_HARNESS.md`
- `docs/cognitia/pilots/TENANT_ZERO_PILOT_SCRIPT.md`
- `docs/cognitia/pilots/DEMANDARA_PILOT_SCRIPT.md`
- `docs/cognitia/pilots/HUMAN_OPERATOR_VS_AI_AGENT_RUNBOOK.md`
- `docs/cognitia/execution/PILOT_001_MAINLINE_HANDOFF.md` (this file)

No source/migration/route changes — the harness is additive (one test + docs).

## How to verify

```bash
pnpm install
pnpm check    # 539 tests (532 baseline + 7), format + typecheck clean
pnpm exec vitest run apps/api/src/pilotProofHarness.test.ts   # just the harness
```

## Scenario → assertion map

| Scenario          | Proves                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Human operator    | listing → order → reserve → verified_fact deliver → owner release + reputation; balances move                                   |
| AI agent          | propose on Action Ledger → human approve → operator execute; viewer/agent cannot verify/resolve; execute-before-approve refused |
| Weak proof        | `likely_inference` and `unknown` cannot release escrow (409); escrow stays reserved; no reputation                              |
| Dispute           | held escrow → owner refund (negative reputation) / conserved split (no reputation); operator cannot arbitrate                   |
| Agent Fabric      | route → simulated `verified_fact` receipt → deliver; no network/process; quarantine kill switch (409)                           |
| Public trust feed | safe-empty unless configured; public projection only; aggregate reputation; no PII                                              |

## Risks / caveats

- **Not production.** Proves invariants on the real stack, not production readiness.
- **Managed RLS unverified.** Postgres row-level security under a restricted
  (non-superuser) role is not yet verified — the public feed already caveats this.
- **Simulation-locked fabric.** No distributed execution; quarantine is the kill
  switch. Real distributed execution is a deliberately gated future step.
- **No token / no payments.** `token_public_status: disabled`,
  `legal_gate: not_passed`, escrow rail `internal_credits` only — asserted.

## Next 48 hours

1. Review the Tenant Zero and Demandara scripts with the pilot owners.
2. Keep `pnpm check` (incl. the harness) as the pilot regression gate.
3. If the booklet tracks pilot readiness, add a PILOT-001 line referencing this
   harness (additive; no contradiction with existing audit claims).

## Next 30 days

1. Stand up the managed-Postgres RLS verification the public feed caveats.
2. Extend the harness as new mainline primitives land (keep it riding real code).
3. Gate any move from simulation toward real execution behind its containment
   model — never silently.
