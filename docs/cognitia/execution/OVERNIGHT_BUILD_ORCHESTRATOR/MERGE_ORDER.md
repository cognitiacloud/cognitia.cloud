# Merge Order — Overnight Sprint

Date: 2026-06-15. Recommended sequence for landing the parallel lanes on
`main` (base **e0de0e5**). `recommended` orchestration guidance; each lane owner
remains responsible for its own green check and guardrail compliance.

## Gate that applies to every merge

A lane may merge only when **all** hold:

1. `pnpm check` is green on the lane branch rebased on the current main
   (baseline to beat: **532/532**; new lanes should add tests, never reduce
   coverage or weaken guard tests).
2. No global hard guardrail is breached (see `OVERNIGHT_PLAN.md`).
3. Any DB migration claims the **next free number** (currently `0020`) with no
   collision — confirm against `CONFLICT_RISK_LEDGER.md`.
4. No edits to shared roadmap/booklet/audit files except by **STITCH-001**.

## Recommended order

1. **Docs-only low-risk lanes** — merge first; near-zero collision risk, keeps
   main green while code lanes stabilize. (Candidates: any lane whose diff is
   pure markdown, including this orchestrator dir.)
2. **SDK-001** — SDK + reproducibility docs. Low blast radius; unblocks
   downstream reference.
3. **SEC-MAIN-001** — mainline security hardening, **only if code-safe** (no
   guardrail breach, green check). Land before larger feature lanes so security
   changes are the stable floor.
4. **BOND-001** — bonding/escrow-adjacent **simulation**, only if tests green.
   Simulation-locked; no real payments / transfers.
5. **FABRIC-002** — Agent Fabric Lab hardening, only if tests green. Builds on
   `0019` (simulation-only); sequence after BOND to serialize any shared
   economy-layer surface.
6. **PILOT-001** — pilot harness / readiness. No production deploy; lands after
   the feature lanes it exercises.
7. **STITCH-001** — final audit + booklet reconciliation. **Always last**: it
   reconciles audit + public docs against whatever actually merged and owns the
   shared booklet/roadmap files.

## Rationale

- Order goes **low-risk → security floor → simulation features → harness →
  reconciliation**, so each merge rebases onto a known-green base and the
  conflict surface only ever shrinks.
- V6-RLS and VIDEO-SKILL-001 slot by their realized diff: if **docs-only**,
  treat as step 1; if they touch **RLS policies / migrations** (V6-RLS) or
  **runtime code** (VIDEO-SKILL-001), sequence them adjacent to SEC-MAIN /
  FABRIC respectively and serialize migration numbers. Orchestrator will place
  them precisely once each lane reports its actual diff.

## Notes

- Prefer small, coherent merges; rebase-then-check before each landing.
- If two ready lanes both add migrations, land one, renumber the other to the
  next free slot, re-run `pnpm check`, then land. Never merge two `0020`s.
