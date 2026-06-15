# Overnight Build Sprint — Orchestrator Plan

Date: 2026-06-15. **Lane: SESSION 0 — ORCHESTRATOR.** This session writes **no
product code**. It maintains the tracking surface that keeps the parallel
overnight lanes coherent and inside the global guardrails. Evidence:
`verified_fact` unless tagged otherwise.

## Mission

Coordinate seven parallel build lanes overnight so they merge cleanly, do not
collide (especially on DB migrations and RLS), and never breach the global hard
guardrails. The orchestrator owns only the six files in this directory; it does
**not** edit shared roadmap / booklet / audit files (that is STITCH-001's lane).

## Verified baseline

- `verified_fact` — `origin/main` HEAD = **e0de0e5** ("Merge pull request #80
  … audit-booklet-001b-agent-fabric-reconcile"). Matches reported source of truth.
- `verified_fact` — `pnpm check` = `format:check && typecheck && test`
  (`test` = `vitest run`). Re-run on a fresh `e0de0e5` checkout in this session:
  **532 passed (532)** across **81 test files**, green. The reported 532/532 is
  confirmed in-session, not just inherited.
- `verified_fact` — DB migrations on main run `0001`–`0019` with **`0015`
  absent** (consistent with parked COG-016). Latest = `0019_agent_fabric_nodes.sql`.
- `verified_fact` — **0019 Agent Fabric Lab** is on main, **simulation-only**
  (`packages/db/migrations/0019_agent_fabric_nodes.sql`,
  `docs/cognitia/execution/LEGEND_001_AGENT_FABRIC_LAB.md`).
- `verified_fact` — Token is **not public, not launched, not liquid**, and may
  never launch.

## What Cognitia is

- Agent trust infrastructure
- Agent economy
- Proof-backed work
- Escrow / dispute / reputation layer
- Internal marketplace
- Public diligence surface
- Simulation-only Agent Fabric Lab
- Future optional token architecture, legal-gated and usage-gated

## What Cognitia is NOT

- just GTM
- just MoverOS
- a public token launch
- production-ready
- SOC2 certified
- decentralized in production
- unstoppable
- impossible to shut down

## Global hard guardrails (applies to every lane)

No production deploy · no production migrations · no production DB · no secrets
printed · no token launch · no token purchase CTA · no DEX/liquidity/staking/
yield · no price/return language · no "get in early" · no public sale/presale ·
no real payments · no token transfers · no mainnet contracts · no
TOKEN-LAB-003 · no GTM PRs · no COG-016 · no weakening guard tests · no SOC2
certification claims · no production-readiness claims · no decentralized/
unstoppable/cannot-be-shut-down claims · no uncontrolled remote execution · no
Tailscale token handling · no cloud credentials · no private keys.

## Tracked lanes (8)

| Lane            | One-line scope                                                        |
| --------------- | --------------------------------------------------------------------- |
| V6-RLS          | Row-level-security verification / hardening (dev DB, simulation only) |
| SEC-MAIN-001    | Security hardening on mainline, code-safe changes only                |
| FABRIC-002      | Agent Fabric Lab hardening (builds on 0019, simulation-only)          |
| BOND-001        | Bonding / escrow-adjacent simulation, tests must stay green           |
| PILOT-001       | Pilot harness / readiness (no production deploy)                      |
| SDK-001         | SDK + reproducibility docs                                            |
| VIDEO-SKILL-001 | Video skill lane                                                      |
| STITCH-001      | Final audit + booklet reconciliation (owns shared docs)               |

Status detail lives in `LANE_STATUS.md`. Merge sequencing in `MERGE_ORDER.md`.
Collision hotspots in `CONFLICT_RISK_LEDGER.md`. Open blockers in `BLOCKERS.md`.
Sprint close-out in `FINAL_STITCHING_PLAN.md`.

## Evidence-tag legend

- `verified_fact` — checked directly in this session (git, file contents, test run).
- `likely_inference` — reasoned from evidence but not directly executed here.
- `design_only` — intended/described design; not built or proven yet.
- `blocked` — cannot proceed; reason recorded in `BLOCKERS.md`.
- `unsafe_overclaim` — a claim that would breach guardrails; flagged, never asserted.
- `recommended` — an owner decision or action the orchestrator advises.

## Orchestrator discipline

- The orchestrator has **no visibility into sibling lane branches** from inside
  this session. Every lane it does not own is tracked as
  `planned / awaiting report` until that lane reports back. The orchestrator
  **never upgrades a sibling's claim** beyond what that sibling has reported.
- Only files under this directory are created/edited by this lane.
