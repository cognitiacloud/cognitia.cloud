# Cognitia / Demandara — Real Progress & Score Audit

- **Run timestamp:** 2026-06-23 01:11 UTC
- **Auditor role:** progress controller / verification auditor / honest scorekeeper
- **Session type:** audit / test / report only (no merges, no PR state changes, no live actions)
- **Canonical branch:** `overnight/gtm-implementation` @ `da48e8f`

---

## 1. Repo truth

| Field | Value |
|-------|-------|
| Current repo path | `/home/user/cognitia.cloud` |
| Current checked-out branch | `claude/cognitia-progress-audit-f56uem` (audit scaffold — contains only `hermes/`) |
| Remote URL | `http://local_proxy@127.0.0.1:42751/git/cognitiacloud/cognitia.cloud` (proxy to `cognitiacloud/cognitia.cloud`) |
| Real monorepo? | **YES** — on `origin/overnight/gtm-implementation` and `origin/main` (apps/, packages/, docs/, hermes/, pnpm workspace) |
| `origin/overnight/gtm-implementation` HEAD | `da48e8f1beeb2709591e7951d49fa3a893cb4d47` ("Merge PR #179") |
| `origin/main` HEAD | `d3d198e75fe5b7b0b7cff61590e267fed200d3d7` |
| Wrong-repo / hermes-only risk | **NO** — the *audit branch checkout* is hermes-only, but the canonical branch is the full monorepo. The hard "stop if only hermes" rule does not trigger because the real repo + canonical branch are present and were tested via worktree. |

**Note:** `origin/main` is behind `overnight/gtm-implementation` (main lacks the merged B1–B6 lanes, #179, #183). The GTM line lives on `overnight/gtm-implementation`, which is the canonical trunk for this work.

---

## 2. PR truth

CI note: GitHub legacy Status API returns `total_count: 0` for every head SHA — **no commit statuses / CI checks are registered** on any of these PRs.

| PR | Title (short) | State | Draft | Base | Head SHA | Files | mergeable | Lane |
|----|---------------|-------|-------|------|----------|-------|-----------|------|
| 158 | B1–B6 mock-safe GTM lanes (+131 tests) | open | draft | `claude/w1-sales-closer-core` | `da48e8f`* | 47 | clean | mock/dry-run |
| 159 | Integration hardening — unified mock run packet | open | draft | `overnight/gtm-implementation` | `6746cc3` | 5 | clean | mock/dry-run |
| 160 | `/gtm-command-center` route over B1–B6 | open | draft | `overnight/gtm-implementation` | `28d3b1e` | 6 | clean | demo |
| 177 | Automation approval-queue read-model | open | draft | `overnight/gtm-implementation` | `ddc867c` | 3 | **dirty (conflict)** | controlled-live |
| 178 | Automation readiness panel on CC | open | draft | `claude/alta-90-readiness-audit` | `5013bcf` | 4 | clean | demo/controlled-live |
| **179** | **Pure automation release-gate engine** | **closed/MERGED** | no | `overnight/gtm-implementation` | `e55a280` | 3 | merged | controlled-live |
| 180 | Automation-readiness e2e test matrix | open | draft | `overnight/gtm-implementation` | `96fe2e7` | 1 | clean | test-only |
| 181 | Live-automation 80 readiness audit (docs) | open | draft | `claude/alta-90-readiness-audit` | `c66bab1` | 1 | clean | docs |
| 182 | Automation monitoring readiness | open | draft | `overnight/gtm-implementation` | `5764ad5` | 3 | **dirty (conflict)** | controlled-live |
| **183** | **Reviewer fixes: make `/gtm-os-integrated-demo` build** | **closed/MERGED** | no | `overnight/gtm-implementation` | `05f7133` | 5 | merged | demo/fix |

\* PR #158's content (B1–B6) is already present in `overnight` via commit `39a101b`; the PR object itself still shows open/draft.

**Merge truth:**
- **#179 is MERGED** — `merged_at` 2026-06-22T23:53:29Z. Merge commit = **`da48e8f`** = current `overnight` HEAD. (Per the hard rule, it was NOT merged by this session; it was already merged.)
- **#183 is MERGED** — `merged_at` 2026-06-22T19:07:46Z. Merge commit = **`45d0022`**. It fixed `next build` for `/gtm-os-integrated-demo`.
- #177 approval-queue and #182 monitoring are both **conflicted (dirty)** against `overnight` and must be rebased before they can land.
- #178 + #181 stack on `claude/alta-90-readiness-audit-lp6jr7`, **not** on `overnight`.

**Status classification:**
- **Merged/canonical:** #179, #183 (and #158 content).
- **Ready (clean, target overnight), needs review:** #159, #160, #180.
- **Rebase then recheck:** #177, #182 (conflicts).
- **Restacked onto candidate, not trunk:** #178, #181.
- **Docs-only:** #181.

---

## 3. Real test results

All commands run in throwaway detached worktrees from the fetched origin refs. Tooling: Node v22.22.2, pnpm 10.33.0. **Network/registry available — installs succeeded** (frozen lockfile).

### 3a. Canonical `overnight/gtm-implementation` (`da48e8f`)

| Command | Exit | Result |
|---------|------|--------|
| `pnpm install --frozen-lockfile` | 0 | 244 packages resolved, done |
| `pnpm check` (format:check + typecheck + test) | 0 | **106 test files, 805 tests passed** (40.7s) |
| `pnpm --filter @cognitia/web run typecheck` | 0 | clean (`tsc --noEmit`) |
| `pnpm --filter @cognitia/web run build` | 0 | **21 routes built** |

- `/gtm-os-integrated-demo` → **builds** (static) ✅
- `/gtm-command-center` → **does NOT exist / does not build on canonical** ❌ (only 21 routes; no command-center)

### 3b. Strongest assembled candidate — `claude/alta-90-readiness-audit-lp6jr7` (`1556d5b`)

Reconciles #158 + #159 + #160 + readiness audit; base for #178/#181.

| Command | Exit | Result |
|---------|------|--------|
| `pnpm install --frozen-lockfile` | 0 | ok |
| `pnpm check` | 0 | **108 test files, 829 tests passed** |
| web typecheck | 0 | clean |
| web build | 0 | **22 routes**, includes **`/gtm-command-center`** and `/gtm-os-integrated-demo` ✅ |

⚠️ **Command Center on alta-90 is a hand-authored MIRROR.** `apps/web/src/lib/gtmCommandCenterViewModel.ts` (1197 lines) explicitly states it *"does NOT import `@cognitia/agents`"* and re-implements B2/B3/B4/B5/B6 as a *"faithful mirror"*. This violates the founder directive ("use real `@cognitia/agents` outputs, not mirrors"). Builds and tests, but the parity scorecard it renders is computed from mirror code, not authoritative outputs.

### 3c. Architecturally-correct candidate — `claude/gtm-implementation-consolidate-r21oqk` (`9e0ef21`)

"Wire `/gtm-command-center` to real `@cognitia/agents` outputs (consolidate #159 + #160)". Based on post-#183 overnight (`45d0022`), **pre-#179**.

| Command | Exit | Result |
|---------|------|--------|
| `pnpm install --frozen-lockfile` | 0 | ok |
| `pnpm check` | 0 | **109 test files, 815 tests passed** |
| web build | 0 | **22 routes**, includes real-output **`/gtm-command-center`** ✅ |

✅ `apps/web/src/lib/gtmCommandCenterViewModel.ts` here imports from `@cognitia/agents` and states the numbers are *"the REAL computed outputs of `@cognitia/agents` ... DERIVATION over the already-assembled, real-output view (not a mirror)"*. This is the correct architecture, but it lacks #179's merged release-gate engine integration on the same line and the alta-90 readiness panels.

### Candidate vs overnight comparison

| Dimension | overnight (`da48e8f`) | alta-90 (`1556d5b`) | consolidate (`9e0ef21`) |
|-----------|----------------------|---------------------|-------------------------|
| Builds green | ✅ 21 routes | ✅ 22 routes | ✅ 22 routes |
| Tests | 805 | 829 | 815 |
| `/gtm-os-integrated-demo` | ✅ | ✅ | ✅ |
| `/gtm-command-center` | ❌ none | ✅ (MIRROR) | ✅ (REAL outputs) |
| #179 release-gate (merged) | ✅ | ❌ (pre-#179) | ❌ (pre-#179) |
| Real `@cognitia/agents` wiring for CC | n/a | ❌ mirror | ✅ real |
| Merge-safe to trunk now | n/a (is trunk) | no (mirror, draft) | no (draft, needs #179 + review) |

**No single branch yet has: real-output Command Center + #179 release gate + readiness panels, all on one canonical line.** That is the central gap.

---

## 4. Safety results

Scans run over `apps/` and `packages/` production source on canonical overnight (and spot-checked on candidates).

| Check | Finding | Verdict |
|-------|---------|---------|
| Vendor SDKs in deps (`@sendgrid`/`twilio`/`nodemailer`/`whatsapp`/`@hubspot`/`axios`) | none in any `package.json` | ✅ clean |
| `sent: true` in non-test source | none | ✅ clean |
| `sendLive` behavior | returns `never`; **always throws `LiveSendBlockedError`**, fail-closed even on the unreachable open-gate branch (`dryRunChannels.ts:144`) | ✅ clean |
| controlled_live gate | `evaluateReleaseGate` requires 7 conditions (`signedCustomerScope`, `counselSignoff`, `founderSignoff`, `monitoringEnabled`, `rollbackReady`, `secretsConfigured`, `connectorApproval`), all default `false` → **fails closed** | ✅ clean |
| Kill switch | `automationReleaseGate.ts` (#179): *"kill switch overrides everything"* → `blocked` | ✅ clean |
| `fetch(` in web pages | client→own-API calls (`apiClient`, internal `/public/trust-feed`); no third-party egress in GTM/demo paths | ✅ expected |
| HubSpot httpClient/tokenProvider | pre-existing connector infra (`packages/integrations/hubspot`), **not wired into GTM lanes / Command Center / demo** (those use mock `crm-lite`); gated by connection status (ENF-1 kill-switch tests) | ⚠️ pre-existing, dormant connector port — not invoked by demo |
| `process.env` in GTM/demo paths | none | ✅ clean |
| Emails in GTM/agents source | only `.example` (e.g. `sales@northshore-auto.example`, `gm@budgetwheels.example`) | ✅ test/demo fixtures |
| Phone numbers | only synthetic repeated-digit fixtures in `mira`/`closer` PII-redaction tests; no real numbers | ✅ test fixtures |
| Budget Wheels references | all `budget_wheels_demo` / "Budget Wheels Demo" workspace / Tenant Zero sandbox | ✅ compliant |
| Raw PII in serialized demo data | `gtmIntegratedDemoData.ts:295` — *"Defensive: never serve raw PII, even from real module output"*; uses `.example` only | ✅ clean |
| Command Center / demo UI | server components, read-only; "Would send (preview, **BLOCKED**)"; persistent MOCK/DRY-RUN banner; **no send/call/SMS/WhatsApp/ad buttons** | ✅ clean |

**No blockers found.** One pre-existing dormant HubSpot connector exists in the integrations package but is not reachable from any GTM/demo/Command Center path.

---

## 5. Updated scorecard

See `current-scorecard-2026-06-22.md` for the canonical numbers. Summary below.

| Axis | Score | Basis |
|------|-------|-------|
| Mock/dry-run capability | **90/100** | 805 tests green on trunk; dry-run engine, fail-closed `sendLive`, gate, no-egress attestation, demo route builds |
| Alta parity — canonical overnight | **70/100** | B1–B6 + integrated demo + #179 gate on trunk, but **no Command Center route on trunk** |
| Alta parity — strongest candidate | **84/100** | alta-90 has full CC + panels but **mirror-based**; consolidate has **real-output** CC; neither unifies CC + #179 + panels |
| Investor/demo readiness | **68/100** | `/gtm-os-integrated-demo` ships on trunk, PII-safe, read-only; flagship Command Center only on draft branches |
| Controlled-live readiness | **55/100** | gate + kill switch + approval≠send + monitoring(#182) + rollback exist, but **scattered across draft/conflicted branches**, not one canonical line; capped well under 80 |
| Actual-live readiness | **12/100** | no legal/customer/deployment/connector approvals; hard cap 30 |
| Enterprise readiness | **45/100** | RLS + tenant isolation + permission model + 20 PGlite contract tests + threat governance; no SOC2/live deploy |
| SalesCloser superiority | **55/100** | proof-governed workflow core, tested, mock-safe; no live competitive proof |
| First paid pilot readiness | **35/100** | demo-ready, mock-only; no live connectors / signed customer |
| Trust/proof moat | **70/100** | fail-closed gates, no-egress attestations, PII redaction, proofs/trust feed, audit evidence — the genuine differentiator |
| Repo/trunk hygiene | **58/100** | trunk green + #179/#183 merged cleanly, but 8 open drafts, 2 conflicted (#177/#182), Command Center fragmented across 4 branches with mirror-vs-real divergence |

**Scoring guardrails honored:** no 100s (Command Center not canonical); actual-live ≤ 30; controlled-live ≤ 80 (in fact 55, since not integrated on one canonical line); branch-only code scored separately from canonical; docs-only (#181) not scored as behavior.

---

## 6. Top blockers

1. **No real-output Command Center on canonical trunk.** Best real version is on `consolidate-r21oqk` (draft); the most-assembled branch (alta-90) uses a 1197-line mirror that violates the "real `@cognitia/agents` outputs" directive.
2. **No single canonical line unifies** real-output Command Center + #179 release gate + readiness/monitoring panels.
3. **#177 and #182 are conflicted (dirty)** against overnight — controlled-live evidence can't land until rebased.
4. **No CI registered** on any PR (status API empty) — merges would be unverified-by-automation; only local audit runs prove green.
5. **Controlled-live pieces are scattered** (approval queue #177, monitoring #182, gate merged #179, panels #178) across four branches rather than integrated and tested together.

---

## 7. Next 5 actions

1. **Rebase `consolidate-r21oqk` (real-output CC) onto current `overnight` HEAD `da48e8f`** so it picks up #179's merged release-gate engine; re-run `pnpm check` + web build; confirm `/gtm-command-center` still builds with real outputs.
2. **Rebase #177 (approval queue) and #182 (monitoring)** onto `da48e8f` to clear the dirty/conflict state; re-run their tests.
3. **Rebuild #178's readiness panel over the real-output Command Center** (consolidate line), not the alta-90 mirror, then restack onto overnight instead of `alta-90-readiness-audit`.
4. **Add a CI workflow** (`pnpm install --frozen-lockfile && pnpm check && pnpm --filter @cognitia/web build`) so PR merges are automation-verified, not just locally audited.
5. **After the above, open one consolidation PR** that lands real-output Command Center + #177 + #182 + #178 panel on a single line targeting overnight — then re-score Alta parity and controlled-live on the unified trunk.

---

## 8. Anything unverified

- **CI status** — could not be verified; the legacy Status API returns zero checks for all PRs. GitHub Actions check-runs (if any) were not separately enumerated.
- **`merge_commit_sha` via PR API** — not exposed by `pull_request_read get`; the merge SHAs (`da48e8f` for #179, `45d0022` for #183) were derived from the `overnight` commit log instead.
- **Runtime behavior** — routes were verified to **build** (`next build`) and unit/integration tests pass; they were not exercised in a running browser/server this session.
- **`origin/main` GTM state** — confirmed behind overnight, not deeply audited (canonical GTM work is on `overnight/gtm-implementation`).
- Candidate branches `gtm-command-center-investor-xztes9` was inspected (single investor-panel commit on post-#183 overnight) but **not full-tested** — only `alta-90` and `consolidate` were build/test verified as representative strongest candidates.
