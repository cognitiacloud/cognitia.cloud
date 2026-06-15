# Conflict Risk Ledger — Overnight Sprint

Date: 2026-06-15. Collision hotspots across the parallel lanes, ranked with
mitigations. The orchestrator's job is to keep these from turning into merge
conflicts or silent overwrites. Evidence tags per `OVERNIGHT_PLAN.md`.

## Migration slot rules (owner-confirmed — binding)

The orchestrator **owns migration-number serialization** (`verified_fact`, owner
decision). Migrations on main are `0001`–`0019` with **`0015` absent** (parked
COG-016, never fill). The single sanctioned new slot is **`0020`**:

- **V6-RLS** — must **NOT** create a migration.
- **PILOT-001, SDK-001, VIDEO-SKILL-001, STITCH-001** — must **NOT** create a
  migration.
- **SEC-MAIN-001** — should avoid migrations; if absolutely needed, **stop and
  report** to the orchestrator before creating one.
- **BOND-001** — the **only** lane currently allowed to create **`0020`**, if
  schema is truly necessary.
- **FABRIC-002** — should avoid migrations and reuse existing `fabric_nodes`
  policy/capability fields; if a migration is absolutely needed, **stop and
  report** first (resolved only after orchestrator migration-conflict review).
- **No lane** may create **`0021+`** without explicit orchestrator approval.

## Highest risk: DB migration numbering

- `verified_fact` — next free number = **`0020`**, reserved for **BOND-001** per
  the slot rules above.
- **Risk (HIGH):** more than one lane attempts `0020`, or a lane creates an
  unsanctioned migration, or two lanes edit the same RLS policy file.
- **Mitigation:** Only BOND-001 lands `0020`. SEC-MAIN-001 and FABRIC-002 must
  stop-and-report before any migration; the orchestrator then assigns the next
  slot (`0021+`), the lane rebases, re-runs `pnpm check`, and lands. No two
  lanes may submit the same number. `0015` stays reserved/absent.

## High risk: shared RLS / policy surface

- **Risk (HIGH):** V6-RLS hardening and SEC-MAIN-001 may both touch row-level
  security definitions or shared policy/setup SQL, producing semantic conflicts
  even without textual overlap.
- **Mitigation:** Land SEC-MAIN-001 (security floor) before V6-RLS where
  possible; require each to state exactly which policy objects it changes; keep
  all RLS work **dev/simulation only** (no production migrations or DB).

## Medium risk: economy-layer code surface

- **Risk (MED):** BOND-001 and FABRIC-002 both extend the agent-economy /
  fabric surface (the `0016`–`0019` lineage: agent economy, dispute, marketplace,
  fabric nodes) and the repository contract tests in
  `packages/db/src/kysely.pglite.test.ts`.
- **Mitigation:** Serialize per `MERGE_ORDER.md` (BOND before FABRIC); each adds
  its own tests rather than editing a sibling's; keep both **simulation-locked**.

## Medium risk: shared docs (booklet / roadmap / audit)

- **Risk (MED):** Any lane editing `docs/cognitia/audits/*`, roadmap, or the
  master booklet collides with **STITCH-001**, which owns final reconciliation.
- **Mitigation:** Only STITCH-001 edits shared roadmap/booklet/audit files. All
  other lanes (including this orchestrator) write **only** their own new files.
  This orchestrator confines itself to
  `docs/cognitia/execution/OVERNIGHT_BUILD_ORCHESTRATOR/`.

## Low risk: docs-only / SDK / video lanes

- **Risk (LOW):** SDK-001 (SDK + repro docs), VIDEO-SKILL-001, and pure-docs
  lanes have small blast radius if they stay in their own paths.
- **Mitigation:** Merge early (steps 1–2 of `MERGE_ORDER.md`) to keep main green
  and shrink the later conflict surface.

## Files NOT to be co-edited

- `packages/db/migrations/*` — one lane per new number; serialize.
- Shared RLS/policy SQL — single owner per object per night.
- `docs/cognitia/audits/*`, roadmap, master booklet — **STITCH-001 only**.
- This orchestrator directory — **Session 0 only**.

## Ledger discipline

Each lane, on report, states: files changed, any migration number, any RLS
object touched. Orchestrator updates the relevant risk row and confirms no two
lanes hold the same migration number before marking either mergeable in
`LANE_STATUS.md`.
