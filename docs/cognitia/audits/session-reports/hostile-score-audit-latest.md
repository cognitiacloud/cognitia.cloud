# Hostile Investor-Diligence Score Audit — Cognitia / Demandara

**Auditor stance:** Hostile investor diligence reviewer. Read-only. No code changes, no PR
state changes, no score inflation.
**Date:** 2026-06-23
**Repo:** `cognitiacloud/cognitia.cloud`
**Canonical trunk audited:** `overnight/gtm-implementation`
**Canonical head SHA (fetched this session, verified current):**
`da48e8f1beeb2709591e7951d49fa3a893cb4d47`
(`da48e8f` — "Merge PR #179: pure automation release-gate engine (Sales Closer, mock-safe)",
2026-06-22 16:53 -0700)

> This report was written from a checkout of `claude/cognitia-hostile-audit-c3ry85` **recreated
> from `origin/overnight/gtm-implementation@da48e8f`**, so the only diff this branch introduces
> over canonical is this report file. The codebase audited is the real canonical tree, not a
> near-empty mirror.

---

## 1. Audit method & evidence legend

Every score below is tagged with the strength of evidence behind it. A hostile reviewer counts
only what is verifiable; PR-body assertions are treated as marketing until reproduced.

| Tag | Meaning |
|---|---|
| `[LOCAL]` | **Independently reproduced this session** on canonical `da48e8f`: I ran the command and observed the result. |
| `[READ]` | I read the actual file contents / PR metadata / diff directly (GitHub API or working tree). |
| `[PR-CLAIM]` | Asserted only in a PR body or commit message; **not** independently reproduced. Discounted. |
| `[DOC-CLAIM]` | Asserted in an in-repo audit doc authored by the build session (self-audit). Discounted. |
| `[CAP]` | A hard ceiling imposed by audit rules regardless of code quality. |

### What I ran locally on `da48e8f` (correction 4)

| Command | Result | Tag |
|---|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (244 pkgs resolved, lockfile honored) | `[LOCAL]` |
| `pnpm run check` (format:check + typecheck + test) | **exit 0 — 805 tests passed, 106 files** (48.5s) | `[LOCAL]` |
| `pnpm --filter @cognitia/web run build` (`next build`) | **exit 0 — 21 routes prerendered** | `[LOCAL]` |

Toolchain: Node v22.22.2, pnpm 10.33.0 (matches `packageManager` pin). npm registry reachable.

### Scope inspected
- Canonical `overnight/gtm-implementation@da48e8f` (working tree + tests + build).
- PRs **#177, #178, #180** (diffs, file contents, `it()` counts, CI check-runs, mergeability).
- The "real-output Command Center" line: **#186, #189, #190** (metadata, bodies, mergeability).
- Agent Economy branches `agent-economy-001…005`, `-2week-spec`, `-action-passport-docs`,
  `-sandbox` (file contents, code-vs-docs).
- Canonical self-audit docs `docs/cognitia/audits/{alta-80-readiness-evidence,V1_1_FINAL_AUDIT}.md`.

---

## 2. Canonical vs branch-only vs dirty/superseded — the provenance map

This is the single most important hostile finding: **almost nothing claimed is on the trunk most
of the narrative cites, and the trunk itself is a draft branch, not a protected `main`.**

### On canonical `overnight/gtm-implementation@da48e8f` `[LOCAL]`/`[READ]`
- Full pnpm monorepo: `apps/{api,web,worker}`, `packages/{agents,core,db,evals,integrations,workflows}`.
- Route `/gtm-os-integrated-demo` **EXISTS** and is **real-wired** to `@cognitia/agents` via
  server-only adapter `apps/web/src/lib/server/gtmIntegratedDemoData.ts` (no structural mirror). `[READ]`
- `next build` lists 21 routes; `/gtm-os-integrated-demo` present. `[LOCAL]`
- Mock-safe primitives present: `packages/agents/src/closer/{ports,mockPorts}.ts`,
  `packages/agents/src/channels/dryRunChannels.ts` (`sendLive()` throws, `assertNoLiveSend`),
  `packages/agents/src/security/releaseGate.ts` (`controlled_live` fails closed, 7 conditions). `[READ]`
- Agent-economy **DB invariants** are on canonical: `packages/db/src/kysely.pglite.test.ts` passes
  `AGENT-ECONOMY-001` (work orders, verified_fact-only release, simulation-locked executions),
  `-002` (dispute resolution, conserved split), `-004` (marketplace listings, internal-only). `[LOCAL]`
- 805 tests / 106 files green. `[LOCAL]`

### Branch-only (NOT on canonical) `[READ]`
- **`/gtm-command-center` route does not exist on canonical** — directly confirmed (`test -d` =
  ABSENT; absent from `next build` route list). It exists only on PR branches. `[LOCAL]`
- The real-output `/gtm-command-center` lives on **#186** (`reconcile-159-160-canonical`,
  `mergeable: clean`) and **#189** (`gtm-implementation-consolidate`, `mergeable: clean`) — both
  **open drafts, unmerged**. Their test/route/build claims are `[PR-CLAIM]`, not reproduced here.
- The **structural mirror** `apps/web/src/lib/gtmCommandCenterViewModel.ts` (self-admits in its own
  header it "does NOT import `@cognitia/agents`" and "reproduces the tested lane semantics
  structurally") lives on `claude/alta-90-readiness-audit-lp6jr7`. #189 demonstrated concrete mirror
  **drift**: the mirror falsely records a `compliance_check` proof for a blocked lead that the real
  `assembleGtmRunPacket` never emits (`proofs == []`). Mirror-derived parity is therefore rejected. `[READ]`
- The bulk of the **Agent Economy** TypeScript (`apps/api/src/{agentEconomy,agentEconomyActions,
  marketplace}.ts`) lives on unmerged `agent-economy-*` branches; only the DB-contract layer reached
  canonical. `[READ]`

### Dirty / superseded `[READ]`
- **#177** `automationApprovalQueue` read-model: `mergeable_state: DIRTY` — conflicts against base
  (likely `closer/index.ts`). Does not merge.
- **#190** "Investor-ready automation-readiness panel": `mergeable_state: DIRTY` — does not merge —
  and its body admits "Barrel exports were **hand-added (not checked out from the PR branches)**." It
  is a hand-reconstruction of #177/#179/#180, not a real integration of them.
- **#178** is stacked on the non-canonical `alta-90` line, not on trunk (see §4).
- `next build` is **not** part of canonical CI's `build-test` job (`[DOC-CLAIM]`, `alta-80` §3.A); I
  verified the build passes anyway `[LOCAL]`, but canonical CI does not gate on it.

---

## 3. Per-PR findings (#177, #178, #180)

All three: open **draft**, single author `cognitiacloud`, **zero human reviews, zero comments**,
CI `build-test` green. New-test counts were verified by counting `it(` in the actual diffs `[READ]`.

### PR #177 — `automationApprovalQueue.ts` (approval queue read-model)
- Files: `packages/agents/src/closer/automationApprovalQueue.ts` (+228),
  `…/automationApprovalQueue.test.ts` (+219), `closer/index.ts` (+1 barrel). `[READ]`
- **18 tests** (claim 18 ✓). Pure read-model: no `fetch`/network/SDK/clock/randomness;
  `ExecutionDecision.willSend` is the literal type `false`; `assertNoLiveSend()` tripwire throws
  `/live channels disabled/`. Cannot send by construction. `[READ]`
- **RED FLAG:** `mergeable_state: DIRTY` — does not merge. `[READ]`

### PR #178 — automation-readiness panel on `/gtm-command-center`
- Files: `apps/web/src/app/gtm-command-center/page.tsx` (+134),
  `apps/web/src/lib/gtmCommandCenterViewModel.ts` (+257), `…viewModel.test.ts` (+80),
  `…/page.smoke.test.tsx` (+25). **+13 tests** (claim 11+2 ✓). CI green, `mergeable: clean`. `[READ]`
- Read-only: smoke test asserts rendered HTML has no `<button`, and none of
  "send now / place call / send sms / send whatsapp / launch ad"; dry-run rows `sent:false`,
  `liveStatus:'BLOCKED'`. `[READ]`
- **BASE FLAG:** base is `claude/alta-90-readiness-audit-lp6jr7` (the **unmerged alta-90 line**), NOT
  canonical overnight. The diff and its "840-test" baseline are only valid relative to a branch that
  itself has not landed and that carries the rejected structural mirror. Cannot be evaluated against
  trunk as-is. `[READ]`

### PR #180 — `automationReadiness.e2e.test.ts` (e2e test matrix)
- Single **test-only** file (+642), no product code. **35 tests across 15 scenarios** (claim 35 ✓).
  CI green, `mergeable: clean`. `[READ]`
- Strongest anti-live artifact: scenarios 12–15 `readFileSync` the lane sources and assert NO vendor
  SDKs (twilio/sendgrid/hubspot/openai/Anthropic), NO network (`fetch(`/axios/`node:http(s)`/
  `child_process`), NO real DB/CRM (`@cognitia/db`/drizzle/prisma/pg); `sendLive` asserted to throw
  for every channel even with a forged-open gate. `[READ]`
- Rebase-drift noted in body (cut at `407a724`; base advanced); GitHub still reports clean + green.
  A single additive test file is the lowest-conflict change possible, so "clean" is weak evidence of
  integration health. `[READ]`

---

## 4. Agent Economy — architecture findings

**Verdict: real code, NOT docs-only — but unmerged, fragmented, and over-narrated.** `[READ]`

- Genuine, test-covered TypeScript core loop on unmerged stacked branches
  `agent-economy-001…004-marketplace-matching`: `apps/api/src/agentEconomy.ts` (~26 KB) + test;
  `agentEconomyActions.ts` (~15 KB) + test; `marketplace.ts` (~16 KB, deterministic
  `matchWorkOrderToListings`) + test; plus `proofs.ts`, `reputation.ts`, `skillproof.ts`,
  `credits.ts` (`credits.ledger.test.ts` conservation invariants); migrations 0016/0017/0018.
- The DB-contract layer **did** reach canonical (AGENT-ECONOMY-001/002/004 pass in
  `kysely.pglite.test.ts` `[LOCAL]`), so the schema/invariants are real on trunk even though the
  service code is not.
- Coherent multi-phase design (work-order lifecycle → escrow → dispute resolution → marketplace
  matching → settlement). BUT:
  - Flagship `docs/strategy/agent-economy-2week-spec.md` (28 KB) proposes a clean `packages/economy`
    package that was **never built** (code bolted into the `apps/api` monolith) — spec mis-describes
    what shipped.
  - Cross-tenant settlement (`CROSS_TENANT_SETTLEMENT_DESIGN.md`, branch `-005`) is **DOCS-ONLY**
    ("Nothing in this document is implemented").
  - Agent Action Passport (`-action-passport-docs`) is **DOCS-ONLY** ("not a code artifact").
  - A parallel stdlib **Python sandbox** (`sandbox/agent_economy/economy_sandbox.py`) reimplements
    the same concepts — exploration churn, not one converged architecture.
- Simulation-fenced throughout (`token_public_status: disabled`, `legal_gate: not_passed`, internal
  credits only — no real money/token/chain).

---

## 5. Hostile scorecard (0–100, evidence-capped)

No row reaches 100: none is simultaneously canonical + tested + built + evidenced. Surface/
mirror-derived 100s are rejected. Actual-live is hard-capped.

| # | Dimension | Score | Evidence & cap rationale |
|---|---|---:|---|
| 1 | Mock/dry-run capability | **85** | `[LOCAL]` 805 tests pass incl. source-scan guards + AGENT-ECONOMY simulation-lock; `[READ]` literal `false` types, `assertNoLiveSend`, `sendLive()` throws (`dryRunChannels.ts`, #177, #180=35 tests). Capped: #177 & #190 `DIRTY`; readiness panels live off-trunk. |
| 2 | Alta parity — canonical | **70** | `[LOCAL]` canonical builds (21 routes) + 805 tests; `/gtm-os-integrated-demo` real-wired `[READ]`. Self-rated impl parity 68–74 `[DOC-CLAIM]`. Capped: no `/gtm-command-center` on trunk; no deploy/persistence/route-bound enforcement. |
| 3 | Alta parity — best candidate | **78** | #189 real-output rewire, `mergeable: clean` `[READ]`. Parity "100/100" is a **surface** scorecard (#169 self-admits "honest 78 / surface 100") — surface/mirror 100 **REJECTED**. Test/build totals are `[PR-CLAIM]`, unmerged, not reproduced. |
| 4 | Command Center evidence | **74** | `[LOCAL]` canonical `/gtm-os-integrated-demo` real + builds; `[READ]` mirror drift proven & removed on #186/#189. Capped: real `/gtm-command-center` is branch-only `[PR-CLAIM]`; #190 `DIRTY` + hand-reconstructed barrels. |
| 5 | Controlled-live code readiness | **58** | `[READ]` release-gate (#179, on canonical), kill-switch (#174), approval queue (#177), e2e matrix (#180); fail-closed 7 conditions `[LOCAL]` releaseGate tests pass. Capped: mock-only, never exercised live; #177 `DIRTY`. |
| 6 | Actual-live readiness | **5** `[CAP]` | **HARD CAP.** No legal/counsel/client/connector/credential/deployment approvals exist (`V1_1_FINAL_AUDIT.md` §8–11; `alta-80` §3.C). `controlled_live` fails closed behind 7 unmet conditions `[LOCAL]`. Remains BLOCKED (see §8). |
| 7 | Enterprise readiness | **38** | `[READ]` typed permission/governance models (#185/#162); but not route-bound; no persistence (in-memory per request); RLS verified only on PGlite/superuser (`kysely.pglite.test.ts` caveat) — no live-DB non-superuser RLS; not deployed. |
| 8 | Investor/demo readiness | **62** | `[LOCAL]` real-output routes build & render with honest framing; strong. Capped: nothing deployed/reachable (verified as build, not URL); best investor panel #190 `DIRTY`. |
| 9 | Agent Economy architecture | **55** | `[READ]` real coded core loop + tests; `[LOCAL]` DB invariants on canonical. Capped: service code unmerged, spec mis-describes built layout, `packages/economy` never built, settlement docs-only, Python-sandbox churn. |
| 10 | Trust/proof moat | **60** | `[READ]`/`[LOCAL]` real coded primitives + passing tests: proofs/reputation/skillproof, append-only, `verified_fact`-gated escrow, credits conservation. Capped: service layer unmerged to trunk, PGlite-only RLS, passport + cross-tenant settlement docs-only. |
| 11 | Repo/trunk hygiene | **30** | `[READ]` ~30 open drafts, single author, **zero human reviews**, no protected `main` carries the work, canonical IS a draft branch (#158 lineage), evidence docs live only on PR branches, #177/#190 `DIRTY`, base-drift stacking (#178 on alta-90), divergent agent-economy tracks + parallel Python sandbox. |

**Reading:** Engineering discipline on the mock-safe substrate is genuinely high (rows 1, 5) and
independently reproducible (rows 1, 2, 4 carry `[LOCAL]` evidence). The capital-at-risk gap is
**delivery/provenance, not capability**: real work is scattered across unmerged drafts with no
human review and no path to a reachable, approved, live system.

---

## 6. Red-flag register

1. **No protected trunk.** "Canonical" `overnight/gtm-implementation` is itself a draft-PR branch
   (#158 lineage), not a reviewed `main`. The default branch carries none of this. `[READ]`
2. **Zero human review across the entire stack.** All ~30 PRs are single-author drafts with no
   reviews or comments. Every "X tests pass / no live egress" attestation is the author's own. `[READ]`
3. **Two PRs do not merge.** #177 and #190 are `mergeable_state: DIRTY`. `[READ]`
4. **#190 is a hand-reconstruction, not an integration** — barrel exports "hand-added (not checked
   out from the PR branches)"; presented as the investor-ready consolidation. `[READ]`
5. **Off-trunk stacking.** #178 is built on the unmerged `alta-90` line (which carries the rejected
   structural mirror), so its diff and test baseline can't be trusted against canonical. `[READ]`
6. **Structural-mirror anti-pattern with proven drift.** `gtmCommandCenterViewModel.ts` reimplements
   lane logic and mis-states a compliance proof; mirror-derived parity rejected. `[READ]`
7. **Evidence docs not on trunk.** Each consolidation PR cites a `session-reports/*.md` that exists
   only on its own branch; canonical `docs/cognitia/audits/` has no `session-reports/`. `[READ]`
8. **`next build` not gated by canonical CI.** It passes today `[LOCAL]`, but the canonical
   `build-test` job runs only `pnpm check` `[DOC-CLAIM]` — build health is unguarded against regressions.
9. **Surface-vs-honest score gap is self-admitted** (#169 "honest 78 / surface 100"); a careless
   reader could quote the surface 100. `[READ]`
10. **Spec over-narration.** The 28 KB Agent Economy "2-week spec" promises a `packages/economy`
    package that was never built; cross-tenant settlement & passport are docs-only. `[READ]`
11. **Persistence/enterprise gaps.** CRM-lite/timeline/proofs are in-memory per request; RLS proven
    only on PGlite under superuser — no live-DB non-superuser enforcement. `[DOC-CLAIM]`/`[LOCAL]`

---

## 7. Exact actions required to move each score

| # | Dimension | What moves it (and to roughly where) |
|---|---|---|
| 1 | Mock/dry-run | Resolve #177 conflict; land #180's source-scan e2e matrix onto canonical so the guards run in trunk CI. → ~90 |
| 2 | Alta parity — canonical | Merge #189 (real `/gtm-command-center`) into overnight; add `next build` to canonical CI; bind persistence. → ~78 |
| 3 | Alta parity — best candidate | Merge #189; replace surface scorecard with an honest, test-backed parity metric; reproduce its 815-test claim in trunk CI. → ~82 |
| 4 | Command Center evidence | Land the real-output route on canonical; delete the alta-90 mirror branch; close #190 (superseded). → ~85 |
| 5 | Controlled-live code | Exercise the release gate end-to-end against a sandbox connector (still no real send); resolve #177. → ~68 |
| 6 | **Actual-live readiness** | **Counsel sign-off (CASL/consent), signed customer scope, live connector + CRM credential approvals, deployed monitored env with rollback, all 7 `controlled_live` conditions recorded.** Until then, stays ≤ ~10. |
| 7 | Enterprise readiness | Bind permission model to routes/approval path; add persistence; verify RLS on hosted Postgres under a non-superuser role. → ~60 |
| 8 | Investor/demo readiness | Deploy a reachable URL of the real-output Command Center; fix #190 or merge #189. → ~75 |
| 9 | Agent Economy arch | Land the `apps/api` economy service code on canonical; build the promised package or retract the spec; implement settlement. → ~72 |
| 10 | Trust/proof moat | Merge proof/reputation/skillproof service layer to trunk; live-DB RLS; implement passport + cross-tenant settlement. → ~75 |
| 11 | Repo/trunk hygiene | Establish a reviewed default branch; require ≥1 human review; merge or close the draft backlog; stop off-trunk stacking; delete mirror branches. → ~60 |

---

## 8. Actual-live readiness — explicit statement

**Actual-live automation is BLOCKED and remains hard-capped (score 5/100).** No legal/counsel
sign-off, no signed customer scope/consent records, no approved live connectors or CRM credentials,
and no deployed/monitored environment with rollback exist in or referenced by this repository. The
`controlled_live` release gate fails closed behind 7 unmet conditions (verified locally), `sendLive()`
throws on every channel, and all live actions are typed `sent:false` / `BLOCKED`. This cap is
non-negotiable under the audit rules and does **not** rise on the strength of code quality, test
counts, or demo readiness. The system is, by construction, incapable of acting live today — which is
the correct and honest posture, but it means live readiness cannot be scored above the floor.

---

*Read-only audit. No product code was modified. No PR state was changed. Scores reflect
independently reproduced evidence where tagged `[LOCAL]`; PR-body and self-audit assertions are
discounted as `[PR-CLAIM]`/`[DOC-CLAIM]`.*
