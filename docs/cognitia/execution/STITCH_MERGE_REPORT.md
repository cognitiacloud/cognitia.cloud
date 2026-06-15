# Stitch & Merge Report — Parallel Build Convergence

**Role:** final stitch-and-merge lead
**Date:** 2026-06-15
**Stitched branch:** `claude/parallel-build-merge-ob37sg`
**Baseline:** `main` @ `313a82d`
**Result:** `main` + LEGEND-001 → `ca5e6cc` · `pnpm check` **525/525 tests, 80 files** green

---

## 0. Executive summary

The brief assumed a fan-out of unmerged lanes to rebase and stitch. The repository
state contradicts that premise: **the parallel build had already converged into `main`**
(~68 merged PRs), and the assigned working branch was a strict _ancestor_ of `main` with
no unique work. After auditing every branch and all 11 open PRs, exactly **one** lane was a
clean, current, net-new, trust-preserving merge: **PR #69 — LEGEND-001 (Agent Fabric Lab)**.

Per the non-negotiables, the remaining unmerged branches were **refused** for this pass:
they are stacked on unmerged/superseded bases, target a stale `main`, or — critically —
their merge would **delete trust controls** (guard tests) and landed work (the −28k-line
revert surface). Reviving their genuinely-new commits is a separate, curated cherry-pick task.

**Decision taken (owner-confirmed):** safe one-lane stitch. `main` stays green; no trust
control weakened; no fake completeness; no hidden dropped work.

---

## 1. Merged branches

| Lane                                            | Branch                               | PR  | Relation to main   | Merge result            |
| ----------------------------------------------- | ------------------------------------ | --- | ------------------ | ----------------------- |
| LEGEND-001 — Agent Fabric Lab (simulation-only) | `claude/legend-001-agent-fabric-lab` | #69 | ahead 1 / behind 0 | **Fast-forward, clean** |

LEGEND-001 adds: `apps/api/src/agentFabric.ts` (+ test), `agentFabric.guard.test.ts`
(containment guard — no `child_process`/`net`/`http`/`spawn`/`exec`/`fetch`), DB migration
`0019_agent_fabric_nodes.sql`, repository twin (memory + PGlite) + contract case, and 4 new
operator-authed internal routes. **Purely additive: +1114 / −14** (the 14 are doc-line edits;
**zero** guard/test/migration deletions).

**Already converged into `main` before this pass (factual record):** ~68 PRs including the
full Cognitia v1.1 platform (Fastify API, Next.js console, Kysely + RLS migrations 0001–0018),
agent economy 001–003 + marketplace 004, visibility 001–005, trust/governance guard tests,
and the hardening lanes. Most lane branches now show **0 commits ahead of main**.

---

## 2. Conflict map

For the safe stitch (`main` + LEGEND-001) there is **no conflict** — LEGEND-001 is `main + 1`.
The conflict surface below is why the _other_ lanes were refused, mapped by category:

- **Shared files:** `packages/db/src/{kysely,memory,repository.ts,repository.contract.ts,schema.ts}`,
  `apps/api/src/{handlers,server}.ts`. Every active lane touches these. On current main they
  already carry 0001–0019 migrations + economy/visibility logic; the stale lanes carry a much
  earlier version and would overwrite it.
- **Shared routes:** `apps/api/src/server.ts` route table — agent-economy, marketplace,
  agent-fabric, leads, tenants. The stale lanes (e.g. PR #54) regress this surface.
- **Shared types:** `packages/core/src/schemas/*` and DB `schema.ts`. Stale lanes drop
  later-added schema (economy, threat-governance).
- **Shared config:** `pnpm-lock.yaml`, `tsconfig*`, `vitest.config.ts` — stable on main; stale
  lanes predate later devDeps.
- **Trust-control collision (the −28k surface):** stale lanes delete guard tests
  (`threatGovernance.guard.test.ts`, `apiSurfaces.guard.test.ts`,
  `visibilityDiscoverability.guard.test.ts`, `researcherPack.guard.test.ts`) that landed in
  main after they forked.

---

## 3. Conflicts resolved

**None required.** The stitch was a fast-forward. No semantic conflict resolution occurred,
so there is no silent semantics change to disclose.

---

## 4. Verification run

```
pnpm install --frozen-lockfile   # ok
pnpm check                       # format:check && typecheck && vitest run
  → Test Files  80 passed (80)
  → Tests      525 passed (525)
  → Duration   ~43s
```

Structural trust-control check (no dropped controls):

```
git diff --shortstat origin/main HEAD      → 20 files, +1114 / −14
git diff origin/main HEAD --diff-filter=D --name-only | grep -E 'guard|test|migration'
                                            → NONE deleted
```

Includes the new `LEGEND-001` fabric-nodes contract case and the `agentFabric` containment
guard — trust controls were **strengthened**, not weakened.

---

## 5. Remaining seams (refused / superseded — with dispositions)

### Open PRs

| PR  | Branch                                      | Base                       | Disposition                                                                                               | Recommended action                            |
| --- | ------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| #69 | legend-001-agent-fabric-lab                 | main                       | ✅ **merged into stitch**                                                                                 | merge PR to main                              |
| #54 | agent-economy-004-marketplace-matching      | agent-economy-003 (merged) | ❌ **refused — reverts trust controls** (−9,983 lines incl. guard tests); 004-marketplace already in main | close as superseded                           |
| #46 | cog-014-demandara-onboarding                | cog-011-012 (unmerged)     | ⏸ stacked on unmerged base                                                                                | rebase onto main after #45 decision           |
| #45 | cog-011-012-lead-detail-tenant-provisioning | stale main `99e2627`       | ⏸ behind 43; targets stale main                                                                           | rebase onto current main, re-review           |
| #44 | cog-011-lead-detail                         | stale main `99e2627`       | ⏸ redundant (subset of #45)                                                                               | close in favor of #45                         |
| #31 | cognitia-v1-1-discovery (docs)              | ep002 (unmerged)           | ⏸ docs superseded by landed v1.1                                                                          | close as superseded                           |
| #3  | gtm-platform-mvp / Mira                     | ep002 (unmerged)           | ⏸ foundation superseded by main platform                                                                  | close as superseded                           |
| #61 | fix-hermes-bridge-stdio-loop                | episode-002 (unmerged)     | ⏸ Hermes-only; stacked on unmerged base                                                                   | rebase onto main if Hermes bridge is in scope |
| #2  | windows-hermes-mesh-bridge                  | ep002 (unmerged)           | ⏸ Hermes/Windows tooling, out-of-tree                                                                     | owner decision; not platform                  |
| #1  | cognitia-episode-002-rebuild                | ep002 (unmerged)           | ⏸ video blueprint, out-of-tree                                                                            | owner decision; not platform                  |

### Orphaned ahead-branches (no open PR) — refused as-is

`a11y-1`, `a11y-2`, `pass-1-agent-passports`, `sec-1-hardening-audit`, `run-3-run-lineage`,
`cog-016-field-provenance`. Each diffs vs current main as **+~1.5–3.6k / −~28–29k lines**
(forked from an early main; merge would delete ~28k lines of landed work including guard tests
and migrations). `run-3` is explicitly `wip/incomplete`; `cog-016` is `DEFERRED (db layer only)`.
**Their net-new commits (4–8 each) are salvageable** via per-commit cherry-pick onto current
main with conflict resolution — a separate, explicitly-scoped task, not a "keep main green" pass.

---

## 6. Delta toward 50/100

I was not given the 50/100 scoring rubric, so I report delta honestly rather than fabricate a
number:

- **Baseline (already converged in main):** full v1.1 platform + agent economy 001–004 +
  visibility 001–005 + trust/governance + hardening — the bulk of the program.
- **This pass adds:** LEGEND-001 (Agent Fabric Lab, simulation-only, +10 tests → 525), verified
  green and trust-preserving.
- **Remaining to reach a higher score (gated/out of scope here):** curated revival of the stale
  lanes' net-new commits (a11y smokes, agent passports, security hardening audit, field
  provenance), and the lead-detail/demandara lane (#45/#46) rebased onto current main.

If a numeric 50/100 is required, please share the rubric and I will score against it.

---

## 7. Non-negotiables honored

- ✅ **main/base stayed green** — stitch verified 525/525; `main` itself untouched (work lives
  on `claude/parallel-build-merge-ob37sg` for a draft PR).
- ✅ **No simultaneous merge chaos** — one lane, fast-forward.
- ✅ **No hidden dropped work** — every branch's disposition is recorded above.
- ✅ **No silent conflict resolution** — there were no conflicts; nothing was silently changed.
- ✅ **Refused merges that weakened trust controls / faked completeness** — PR #54 and the
  orphaned −28k lanes, with reasons.
