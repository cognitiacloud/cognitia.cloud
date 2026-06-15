# Merge Order — Overnight Sprint

Date: 2026-06-15. **Owner-confirmed** sequence for landing the parallel lanes on
`main` (base **e0de0e5**). The order below is locked by owner decision
(`verified_fact`); each lane owner remains responsible for its own green check
and guardrail compliance.

## Gate that applies to every merge

A lane may merge only when **all** hold:

1. `pnpm check` is green on the lane branch rebased on the current main
   (baseline to beat: **532/532**; new lanes should add tests, never reduce
   coverage or weaken guard tests).
2. No global hard guardrail is breached (see `OVERNIGHT_PLAN.md`).
3. Any DB migration follows the **migration slot rules** in
   `CONFLICT_RISK_LEDGER.md` (currently only **BOND-001** may create `0020`).
4. No edits to shared roadmap/booklet/audit files except by **STITCH-001**.

## Confirmed order (owner-locked)

1. **#81 orchestrator docs** — this PR; lands first as the tracking surface.
2. **Docs-only / no-migration lanes** — near-zero collision risk; keep main
   green while code lanes stabilize.
3. **SDK-001** — SDK + reproducibility docs. Low blast radius. Must NOT create a
   migration.
4. **VIDEO-SKILL-001** — video skill lane. Must NOT create a migration.
5. **PILOT-001** — pilot harness / readiness, **only if no migration**. No
   production deploy.
6. **SEC-MAIN-001** — mainline security hardening, **only if no migration** and
   code-safe (green check, no guardrail breach). If it absolutely needs a
   migration, it must **stop and report** first.
7. **BOND-001** — bonding/escrow-adjacent **simulation**, **only if `0020` is
   clean and green**. The only lane currently allowed to create `0020` (if
   schema is truly necessary). Simulation-locked; no real payments / transfers.
8. **FABRIC-002** — Agent Fabric Lab hardening, **only after migration conflict
   review**. Should reuse existing `fabric_nodes` policy/capability fields and
   avoid a migration; if one is absolutely needed, **stop and report** first.
   Simulation-only.
9. **STITCH-001** — final audit + booklet reconciliation. **Always last**: it
   reconciles audit + public docs against whatever actually merged and owns the
   shared booklet/roadmap files. Must NOT create a migration.

## Rationale

- Order goes **tracking surface → low-risk/no-migration → migration-gated
  feature lanes → reconciliation**, so each merge rebases onto a known-green
  base and the conflict surface only ever shrinks.
- The migration-gated lanes (BOND, FABRIC) come late and serialized so the
  single `0020` slot is never contended; see `CONFLICT_RISK_LEDGER.md`.
- V6-RLS is **not** in the merge sequence above because it must NOT create a
  migration; it slots among the no-migration lanes by its realized diff once it
  reports.

## Notes

- Prefer small, coherent merges; rebase-then-check before each landing.
- Only **one** new migration (`0020`, BOND-001) is currently sanctioned. No lane
  may create `0021+` without orchestrator approval.
