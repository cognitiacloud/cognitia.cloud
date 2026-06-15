# PILOT-001 — Handoff

Status handoff for the Tenant Zero / Demandara pilot proof harness.

> **Simulation only.** No production DB, no real SMS, no real payments, no token,
> no external API credentials, no deploy.

---

## Summary

PILOT-001 delivers a deterministic, offline pilot proof harness that rehearses
human and AI‑agent operation paths through Cognitia. It implements eight
scenarios end‑to‑end (marketplace → escrow → `verified_fact` proof → release +
reputation, plus weak‑proof refusal, dispute refund/split, Agent Fabric
simulation, and a safe‑empty trust feed) on a hash‑chained Action Ledger. All
guardrails (no production / no real money / no real SMS / no external calls) are
enforced in code.

---

## What shipped

### Code (`apps/api/`)

| Path | Purpose |
| --- | --- |
| `src/harness/types.ts` | Shared domain types |
| `src/harness/environment.ts` | Production + real‑channel guards, sealed config |
| `src/harness/clock.ts` | Deterministic clock + id sequence |
| `src/harness/actionLedger.ts` | Hash‑chained append‑only ledger |
| `src/harness/marketplace.ts` | Listings + work‑order lifecycle |
| `src/harness/escrow.ts` | Simulated escrow (units only) |
| `src/harness/proof.ts` | `verified_fact` strength evaluation |
| `src/harness/reputation.ts` | Earned‑only reputation ledger |
| `src/harness/agentFabric.ts` | Simulated routing → simulated proof receipt |
| `src/harness/trustFeed.ts` | Safe‑empty public trust feed |
| `src/harness/notifier.ts` | Simulated SMS outbox |
| `src/harness/cognitiaHarness.ts` | Orchestrator wiring all scenarios |
| `src/harness/index.ts` | Public barrel export |
| `src/pilotProofHarness.test.ts` | 13 tests across all 8 scenarios + guards |

### Docs (`docs/cognitia/`)

- `pilots/PILOT_PROOF_HARNESS.md`
- `pilots/TENANT_ZERO_PILOT_SCRIPT.md`
- `pilots/DEMANDARA_PILOT_SCRIPT.md`
- `pilots/HUMAN_OPERATOR_VS_AI_AGENT_RUNBOOK.md`
- `execution/PILOT_001_HANDOFF.md` (this file)

### Build/tooling

- Root pnpm workspace (`package.json`, `pnpm-workspace.yaml`).
- `@cognitia/api` package: `pnpm check` = `tsc --noEmit` + `node --test`.
- Dev dependencies limited to `typescript` and `@types/node`; tests use Node 22's
  native TypeScript type‑stripping and built‑in test runner (no vitest/jest).

---

## How to verify

```bash
pnpm install
pnpm check
```

Expected: typecheck clean, **13/13 tests pass**.

---

## Test coverage map

| Required test | Covered by |
| --- | --- |
| Human path | `human path: operator creates a listing and approves work on the ledger` |
| AI‑agent path | `AI-agent path: agent proposes accept/deliver, human approves via the ledger` |
| Weak proof refused | `weak proof refused: escrow stays reserved, no reputation, refusal logged` |
| Dispute path | `dispute refund: ...` + `dispute split: ...` |
| Fabric simulation path | `fabric simulation path: simulated route yields a simulated receipt then delivers` |
| No production creds needed | `guards: harness constructs with no env, and refuses production` |
| No real external calls | `guards: every external touchpoint is simulation-only` |

Additional coverage: marketplace reserve, verified release, trust‑feed safe‑empty,
proof‑evaluation unit rules, and run‑to‑run determinism.

---

## Risks / caveats

- **Not production.** This proves flow shape and safety invariants, not production
  readiness, real settlement, real messaging, or managed‑RLS behaviour.
- **No persistence.** State is in‑memory; nothing is durable across runs by design.
- **Strength thresholds are illustrative.** `STRENGTH_THRESHOLD = 0.60` and
  `MIN_INDEPENDENT_SIGNALS = 2` are pilot defaults, not tuned production policy.
- **Fresh repo.** `apps/api/` was introduced by this pilot; when the real API
  lands, the harness should be reconciled with the production domain model.

---

## Next steps

1. Review the pilot scripts with the Tenant Zero and Demandara owners.
2. Map the simulated services to real (managed) services one at a time, keeping
   the guard pattern so dev/simulation stays the default.
3. Wire `pnpm check` into CI as the pilot's regression gate.
4. Reconcile harness types with the production schema when it exists.

---

## Final report

See the PILOT-001 Report in the session summary. Branch:
`claude/pilot-001-proof-harness-a7aofs`.
