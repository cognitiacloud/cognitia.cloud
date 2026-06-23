# PR & Branch Status Rollup

- **Run timestamp:** 2026-06-23 01:11 UTC
- **Canonical:** `overnight/gtm-implementation` @ `da48e8f`
- **CI note:** no commit statuses registered on any PR (legacy Status API `total_count: 0`).

## PR rollup

| PR | Title | State | Base | Head SHA | Files (+/−) | Mergeable | Classification | Affects |
|----|-------|-------|------|----------|-------------|-----------|----------------|---------|
| 158 | B1–B6 mock-safe GTM lanes | open/draft | `claude/w1-sales-closer-core` | `da48e8f`* | 47 / +6557 | clean | superseded (content already in trunk @ `39a101b`) | mock/dry-run |
| 159 | Integration hardening — unified run packet | open/draft | `overnight` | `6746cc3` | 5 / +850 | clean | ready (review) | mock/dry-run |
| 160 | `/gtm-command-center` route over B1–B6 | open/draft | `overnight` | `28d3b1e` | 6 / +2122 −1 | clean | consolidate first (mirror vs real-output divergence) | demo |
| 177 | Automation approval-queue read-model | open/draft | `overnight` | `ddc867c` | 3 / +448 | **dirty** | rebase then recheck | controlled-live |
| 178 | Automation readiness panel on CC | open/draft | `claude/alta-90-readiness-audit` | `5013bcf` | 4 / +496 −2 | clean | consolidate first (rebuild over real outputs) | demo/controlled-live |
| 179 | Pure automation release-gate engine | **MERGED** | `overnight` | `e55a280` | 3 / +503 | merged | **merged/canonical** (`da48e8f`) | controlled-live |
| 180 | Automation-readiness e2e test matrix | open/draft | `overnight` | `96fe2e7` | 1 / +642 | clean | ready (review) | test-only |
| 181 | Live-automation 80 readiness audit | open/draft | `claude/alta-90-readiness-audit` | `c66bab1` | 1 / +210 | clean | docs-only later | docs |
| 182 | Automation monitoring readiness | open/draft | `overnight` | `5764ad5` | 3 / +740 | **dirty** | rebase then recheck | controlled-live |
| 183 | Reviewer fixes: make demo build | **MERGED** | `overnight` | `05f7133` | 5 / +33 −5 | merged | **merged/canonical** (`45d0022`) | demo/fix |

\* #158 PR object shows head `da48e8f`; its B1–B6 payload is already merged in trunk.

## Merge facts

- **#179 merged** 2026-06-22T23:53:29Z → merge commit **`da48e8f`** (current overnight HEAD). Kill switch + fail-closed automation release-gate now canonical.
- **#183 merged** 2026-06-22T19:07:46Z → merge commit **`45d0022`**. `/gtm-os-integrated-demo` now builds under `next build`.

## Branch landscape (Command Center)

| Branch | HEAD | `/gtm-command-center` | CC source | Includes #179? | Tested this session |
|--------|------|----------------------|-----------|----------------|---------------------|
| `overnight/gtm-implementation` (canonical) | `da48e8f` | ❌ absent | — | ✅ merged | ✅ 805 tests, build 21 routes |
| `claude/alta-90-readiness-audit-lp6jr7` | `1556d5b` | ✅ | **MIRROR** (no `@cognitia/agents`) | ❌ | ✅ 829 tests, build 22 routes |
| `claude/gtm-implementation-consolidate-r21oqk` | `9e0ef21` | ✅ | **REAL outputs** (`@cognitia/agents`) | ❌ (base `45d0022`) | ✅ 815 tests, build 22 routes |
| `claude/gtm-command-center-investor-xztes9` | `bc44eef` | ✅ | (investor panel on post-#183) | ❌ | not full-tested |
| `claude/alta-80-command-center-83if82` | `28d3b1e` | ✅ | original (#160) | ❌ | not full-tested |

## Classifications

- **merge now / ready:** #159, #180 (clean, target overnight, additive).
- **rebase then recheck:** #177, #182 (dirty / conflicted vs overnight).
- **consolidate first:** #160, #178 — fold into one real-output Command Center line (use consolidate-r21oqk wiring, drop alta-90 mirror).
- **docs-only later:** #181.
- **superseded:** #158 (content already in trunk).
- **merged/canonical:** #179, #183.
- **wrong-repo ignore:** none triggered (hermes-only sessions / `vision-skill` excluded from GTM scoring; current audit-branch checkout is hermes-only but the real monorepo is on overnight).
