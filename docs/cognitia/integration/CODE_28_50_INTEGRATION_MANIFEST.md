# CODE 28→50 — Integration Manifest & Merge Plan

> Role: lead integrator for the parallel build wave.
> Date: 2026-06-15. Base audited: `origin/main` = `313a82d` (merged through PR #68,
> VISIBILITY-005). Confidence tags: **[git]** verified by repo inspection in this
> session, **[doc]** from `docs/strategy/next-phase-2026-06.md` roadmap,
> **[pr]** from the GitHub PR list, **[open]** unresolved / needs founder decision.

This manifest is **track-first**: every lane is classified by what is _actually_
in `main` today, not by branch name or by a PR's completion claims. Nothing here
asserts a merge that has not been verified. Two execution-blocking decisions are
listed in §F and must be answered before any merge runs.

---

## 0. Audit findings (verified before classifying)

1. **The assigned integration branch is stale.** `claude/code-28-50-integrator-qo4x4b`
   points at `0dfb0ad` ("Add hermes vision skill") — a **root-ancestor of `main`,
   126 commits behind**, containing only `hermes/skills/vision-skill/`. It does
   **not** contain the platform. The stitched branch must be re-cut from `main`.
   **[git]**
2. **`main` is the real base** — a pnpm monorepo (`apps/{api,web,worker}`,
   `packages/{core,db,agents,integrations,evals,workflows}`, `docs/`, `hermes/`).
   `apps/api/src/server.ts` registers **99 routes**. The COG-002→010, agent-economy
   001→005, token-lab, v4/v5 trust, and visibility-002→005 stacks are already
   merged. **[git]**
3. **The moat base is already in `main`.** `fdfa189` (FLY-1/PROV-1/UX-2/MET-1/EVAL-1)
   is an ancestor of `main`; `trustMetrics.ts`, `decisionReasons.test.ts`,
   `writePlan.ts`, `trustPacket.ts`, `approvalQueue.test.ts` are all present. So
   several same-named lane branches are **stale ghosts of already-merged work**,
   not pending lanes. **[git]**
4. **73 remote branches, 10 open PRs.** Most unmerged topic branches have **no open
   PR**. Branch existence ≠ pending work. **[git][pr]**

### 0a. Lane classification vs live `main` (non-doc/non-hermes files) **[git]**

| Lane (branch `claude/…`)               |  chg | new files | verdict                 | base posture                                |
| -------------------------------------- | ---: | --------: | ----------------------- | ------------------------------------------- |
| legend-001-agent-fabric-lab (#69)      |   14 |         4 | **PENDING**             | on `main` tip (behind 0) — merge-ready      |
| run-2-run-detail-timeline              |   11 |         2 | **PENDING**             | cut from old main — needs rebase            |
| run-3-run-lineage                      |   52 |        13 | **PENDING** ⚠ large     | needs rebase                                |
| evid-1-sync-and-opportunities          |   10 |         1 | **PENDING**             | needs rebase                                |
| truth-1-machine-readable-report        |   13 |         3 | **PENDING**             | needs rebase                                |
| pass-1-agent-passports                 |   50 |        12 | **PENDING** ⚠ large     | needs rebase                                |
| sec-1-hardening-audit                  |   31 |         7 | **PENDING** ⚠ large     | needs rebase                                |
| a11y-1-route-accessibility             |   17 |         4 | **PENDING**             | needs rebase                                |
| a11y-2-authenticated-queue             |   17 |         4 | **PENDING**             | stacks on a11y-1; needs rebase              |
| gov-1-typed-write-preview              |   13 |         0 | DIVERGED                | edits only — rebase to find net delta       |
| sim-1-preflight                        |    7 |         0 | DIVERGED                | depends on gov-1 write plans **[doc]**      |
| trust-2-packet                         |   11 |         0 | DIVERGED                | rebase to find net delta                    |
| regr-1-rejection-flywheel              |   11 |         0 | DIVERGED                | rebase to find net delta                    |
| undo-1-rollback                        |   17 |         0 | DIVERGED                | touches `actionLedger.ts` (trust core)      |
| learn-1-scorecards                     |    9 |         0 | DIVERGED                | roadmap: after CRM-2 **[doc]**              |
| run-1-run-plans                        |   12 |         0 | DIVERGED                | rebase to find net delta                    |
| why-1-decision-rationale               |    9 |         0 | DIVERGED                | rebase to find net delta                    |
| fly-1 / prov-1 / ux-2 / met-1 / eval-1 | 6–16 |         0 | DIVERGED (likely GHOST) | content present in `main`; verify then drop |
| enf-1-enforced-governance              |   16 |         0 | DIVERGED                | touches `actionLedger.ts` (trust core)      |
| rdy-1-connection-readiness             |   13 |         0 | DIVERGED                | rebase to find net delta                    |
| crm-note-1 / rdm-1                     |  7/2 |         0 | DIVERGED                | small; likely partly in main                |
| hard-1-hardening-package               |    0 |         0 | **GHOST**               | fully in `main` — **exclude**               |
| hard-4-reanchor-security-docs          |    0 |         0 | **GHOST**               | fully in `main` — **exclude**               |

"chg" = non-doc files the branch changed vs its merge-base; "new files" = files it
adds that are absent from `main`. **DIVERGED** = edits files that exist in `main`
with different content — a 2-dot diff cannot tell net-new work from `main`'s own
later evolution, so these are _unclassified until rebased_, not "done" and not
"pending."

---

## A. Lane manifest

Scope per lane (from the roadmap **[doc]**; boundaries assigned to keep lanes
non-overlapping):

| Lane             | Goal (one line)                                                   | Owned files (write boundary)                                                            | Route boundary                          |
| ---------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| GOV-1            | Typed write preview; preview==write CI invariant; audited denials | `packages/integrations/src/hubspot/writePlan.ts`, `actionLedger.ts` (denial-audit only) | `GET /agent-actions/:id/preview`        |
| SIM-1            | Zero-write preflight dry-run + report (reuses GOV-1 plans)        | `apps/api/src/preflight*.ts`, web preflight view                                        | `POST /preflight`, `GET /preflight/:id` |
| TRUST-2          | Exportable tenant trust/audit report                              | `apps/api/src/trustPacket.ts`                                                           | `GET /trust/packet*`                    |
| REGR-1           | Rejection→regression flywheel (rejected→golden)                   | `packages/evals/*`, regression fixtures                                                 | `POST /evals/promote`                   |
| UNDO-1           | Compensators / undo window; `irreversible` tier raise             | `actionLedger.ts` (compensator), rollback svc                                           | `POST /agent-actions/:id/undo`          |
| LEARN-1          | Per-segment scorecards feeding targeting                          | `apps/api/src/scorecards*.ts`                                                           | `GET /metrics/scorecards`               |
| RUN-1/2/3        | Run plans / run detail timeline / run lineage                     | `apps/api/src/run*.ts`, run web pages, repo run methods                                 | `GET /runs*`                            |
| WHY-1            | Decision rationale surface                                        | `apps/api/src/why*.ts`                                                                  | `GET /agent-actions/:id/why`            |
| EVID-1           | Sync & opportunities evidence reads                               | `apps/api/src/evidenceReads.ts`                                                         | `GET /opportunities*`                   |
| TRUTH-1          | Machine-readable report                                           | `apps/api/src/truthReport.ts`                                                           | `GET /report/truth`                     |
| PASS-1 ⚠         | Agent passports                                                   | `packages/db` passport methods, `apps/api/src/passport*.ts`                             | `GET /agents/:id/passport`              |
| RDY-1            | Connection readiness                                              | `apps/api/src/readiness*.ts`                                                            | `GET /readiness`                        |
| SEC-1 ⚠          | Hardening audit                                                   | `apps/api/src/securityHardening.ts`, guards                                             | (guard/CI, few routes)                  |
| ENF-1            | Enforced governance                                               | `actionLedger.ts`, governance guards                                                    | (policy, no new public route)           |
| A11Y-1/2         | Route + authenticated-queue accessibility                         | `apps/web/src/app/approvals/*`, a11y tests                                              | (web only)                              |
| LEGEND-001 (#69) | Agent Fabric Lab (simulation-only)                                | `apps/api/src/agentFabric.ts`, migration 0019, db fabric methods                        | `/agent-fabric/*`                       |
| CRM-NOTE-1       | Grounded context note                                             | `apps/api/src/handlers.ts` (note path)                                                  | `POST /…/note`                          |
| RDM-1            | README coherence                                                  | `README.md`                                                                             | —                                       |

⚠ = **scope-expansion flag**: RUN-3 (52 files), PASS-1 (50), SEC-1 (31) are far
larger than a narrow lane. Per the "no silent scope expansion" rule they require an
explicit boundary confirmation or a split before merge review.

---

## B. Proposed merge order

Sequential only; rebase the rest after each accepted merge; verify green
(`pnpm install && pnpm check`) after _every_ merge. Order respects roadmap
dependencies and "smallest blast radius first."

1. **LEGEND-001 (#69)** — already on `main` tip, self-contained (`/agent-fabric/*`,
   migration 0019), containment-guarded. Lowest risk; merge first to validate the
   pipeline. **[pr]**
2. **GHOST sweep** — confirm FLY-1/PROV-1/UX-2/MET-1/EVAL-1/HARD-1/HARD-4 are fully
   in `main`; **close their branches/PRs, merge nothing**. Removes false lanes.
3. **GOV-1** — foundational; SIM-1 and write-preview UX depend on it. **[doc]**
4. **SIM-1** — rides GOV-1 write plans. **[doc]**
5. **TRUST-2** → **TRUTH-1** → **EVID-1** — read/report surfaces, additive.
6. **WHY-1** → **RDY-1** → **CRM-NOTE-1** — small additive surfaces.
7. **RUN-1 → RUN-2 → RUN-3** — internally ordered (plans→detail→lineage);
   RUN-3 only after its scope is confirmed/split (§A ⚠).
8. **A11Y-1 → A11Y-2** — web-only, stacked.
9. **Trust-core lanes last, one at a time, with extra review:** **ENF-1**,
   **UNDO-1** (both edit `actionLedger.ts`), then **SEC-1** (after scope split).
10. **PASS-1** last (largest; touches DB + API + web) — or split.
11. **LEARN-1**, **REGR-1**, **RDM-1** — finishing/optional; LEARN-1 is roadmap-gated
    behind CRM-2 (not in this wave) **[doc]**, so likely **defer**.

The exact membership of 28→50 is **[open]** (§F-1) — this order is the template,
applied to whichever set is confirmed.

---

## C. Shared-file conflict watchlist **[git]**

These files are edited by many lanes → guaranteed textual conflicts on sequential
merge. The integrator (not the lanes) owns conflict resolution here.

| File                                                                           | # lanes | Conflict class                 | Resolution rule                                                                                                                                                        |
| ------------------------------------------------------------------------------ | ------: | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/server.ts`                                                       |      22 | route registration             | **Union** all route registrations; keep alphabetical/grouped; never drop a lane's route. Re-run route-count + surface-scan tests.                                      |
| `apps/api/src/handlers.ts`                                                     |      22 | handler bodies                 | Union of handler exports; watch for two lanes editing the _same_ handler (GOV-1/UNDO-1/ENF-1 vs execute path).                                                         |
| `apps/web/src/lib/apiClient.ts`                                                |      21 | client methods                 | Union of methods/types.                                                                                                                                                |
| `apps/web/src/app/approvals/page.tsx`                                          |      21 | console page                   | Highest-risk UI merge; A11Y-1/2 + UX-2 + many add UI. Resolve by section, re-run a11y + queue tests.                                                                   |
| `apps/web/src/lib/approvalQueue.test.ts`                                       |      19 | shared test                    | Union test cases; never delete another lane's assertion.                                                                                                               |
| `packages/db/src/{repository,repository.contract,memory,kysely}.ts`            |      12 | repo methods                   | Additive interface methods; both backends + contract must stay in lockstep.                                                                                            |
| `packages/agents/src/ledger/actionLedger.ts`                                   |       8 | **TRUST CORE**                 | GOV-1, UNDO-1, ENF-1, SEC-1, PASS-1, RUN-\*, FLY-1, PROV-1. **Manual review every hunk**: approval gate, execute-refusal, audit emission, idempotency must not weaken. |
| `packages/db/migrations/0009_audit_hash_chain.sql`                             |       3 | **migration number collision** | Two+ lanes claim the same migration number. **Renumber on merge** (next free index); never silently overwrite a migration.                                             |
| `pnpm-lock.yaml`, `apps/web/package.json`, `vitest.config.ts`, `tsconfig.json` |     3–7 | build config                   | Regenerate lockfile after deps settle; merge config by union.                                                                                                          |
| `README.md`                                                                    |       9 | docs                           | Section-merge; RDM-1 reconciles last.                                                                                                                                  |
| `hermes/skills/vision-skill/*`                                                 |       3 | unrelated drift                | Several branches re-touch the hermes skill — confirm intentional or drop (possible accidental rebases of the old base).                                                |

**Trust-guarantee gate:** any hunk in `actionLedger.ts`, governance guards, RLS
migrations, `auth.ts`, or DSAR/purge paths that _weakens_ RLS, RBAC, audit,
approval gating, DSAR, or fail-closed behavior is an **automatic merge refusal**,
regardless of green tests.

---

## D. Branch / worktree instructions

```bash
# 1. Cut the stitched integration branch FRESH from the real base (NOT 0dfb0ad).
#    (Pending §F-2 confirmation, since this re-points the assigned branch.)
git fetch origin main
git switch -c integration/code-28-50 origin/main      # or re-point the assigned branch

# 2. One worktree per lane under review — isolated, never edited in place.
git worktree add ../wt-gov1   origin/claude/gov-1-typed-write-preview
git worktree add ../wt-sim1   origin/claude/sim-1-preflight
# …one per in-scope lane

# 3. Per lane, before merge review: rebase the lane onto current integration tip
#    in its worktree, resolve in isolation, run the gate, THEN fast-forward review.
cd ../wt-gov1 && git rebase integration/code-28-50
pnpm install && pnpm check            # must be green in the worktree first

# 4. Merge sequentially into integration/code-28-50 (no --squash; preserve lineage),
#    re-running `pnpm check` after EACH merge. Rebase remaining lanes after each.

# 5. Never delete lane branches (guardrail). Retarget stacked PRs manually.
```

Rules: merge **one at a time**; `main`/base stays protected and green; rebase all
remaining lanes after each accepted merge; a lane that fails the gate in its
worktree is bounced back with the failure, not merged.

---

## E. Acceptance checklist (gate per lane)

A lane is merge-eligible only when **all** are true:

- [ ] **Handoff file present** (format in §E1) — no handoff, no review.
- [ ] Scope matches its §A boundary; no silent expansion (⚠ lanes need split/confirm).
- [ ] Rebased onto current integration tip; conflicts resolved in its worktree.
- [ ] `pnpm install && pnpm check` green **in the worktree** (record count, e.g. N/N).
- [ ] No trust-guarantee regression: RLS, RBAC, audit, approval gating, DSAR,
      fail-closed all intact (diff-reviewed on `actionLedger.ts`, guards, migrations).
- [ ] New routes are auth-scoped (operator/owner where mutating); surface-scan test passes.
- [ ] Any new migration has a unique, next-free number; RLS enabled+forced.
- [ ] No new public/token/payment surface unless explicitly authorized.
- [ ] After merge: `pnpm check` green on the integration tip; remaining lanes rebased.

### E1. Required handoff format (every lane submits before review)

```
goal:              <one line>
files changed:     <list, must match assigned boundary>
tests run:         <command + result, e.g. pnpm check → 525/525>
blockers:          <none | …>
unresolved risks:  <none | …>
exact next step:   <what the integrator should do to merge>
```

---

## F. Open decisions (execution-blocking — surfaced, not guessed)

1. **[open] Exact 28→50 membership.** "28→50" does not map cleanly to any verified
   artifact (PRs run to #69; lanes are codenamed, not numbered 28–50). Candidate
   set = the PENDING + DIVERGED lanes in §0a (moat wave off `main`), minus GHOSTs.
   The cog-* open PRs (#44 superseded by #45; #45, #46, #54-needs-rebase) are a
   *separate\* track — include or not? **Needs founder confirmation of the lane set.**
2. **[open] Re-cut the stitched branch from `main`.** The assigned branch is 126
   commits behind and platform-empty. Integration must be based on `main`. This
   means re-pointing/replacing `claude/code-28-50-integrator-qo4x4b` (history
   change) — requires explicit go-ahead per the "never push elsewhere without
   permission" rule.
3. **[open] DIVERGED lanes (gov-1, fly-1, prov-1, met-1, eval-1, ux-2, …).** Their
   feature names are already in `main`. Each must be rebased to reveal net-new
   delta; if empty → GHOST (close), if non-empty → real lane. Confirm whether to
   spend the rebase pass or close them as superseded.

Until §F-1 and §F-2 are answered, **no merges run** — this manifest is the plan,
verification-first and honest about every seam.
