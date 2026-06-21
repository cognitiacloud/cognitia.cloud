# PR #99 Review — Sales Closer Phase 2: Governed Apify Ingestion Scaffold

- **PR:** [#99](https://github.com/cognitiacloud/cognitia.cloud/pull/99) — `feat(integrations): Sales Closer Phase 2 — governed Apify ingestion scaffold`
- **Head:** `claude/sales-closer-phase2-apify` @ `b5aad7e`
- **Base:** `main` @ `d3d198e` (retargeted from the Phase-1 branch)
- **Status:** draft · `mergeable_state: clean` · 18 files · +2295 / −8
- **Reviewer scope:** read-only verification. No merge/undraft/close. No live Apify/vendor/network calls. No schema/architecture changes.

## Verdict: ✅ READY

Phase 2 is safe, fixture-first, and green after retargeting to `main`. No blocker found. The scaffold is simulation-first by default, the network boundary is contained to one gated file and enforced by a test, no schema drift exists against the #93 canonical data layer, and no secrets or real PII are introduced.

> Note: the PR **body** still describes the base as the Phase-1 branch (`claude/sales-closer-engine-plan-c3quih`). The **actual** base on GitHub is `main` (verified via API). This is a stale description only — non-blocking. Recommend updating the body for accuracy before review hand-off.

---

## Verification matrix

| Check                  | Result | Evidence                                                                                                                                                                              |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base branch is `main`  | ✅     | PR API `base.ref = "main"`, `base.sha = d3d198e`.                                                                                                                                     |
| CI is green            | ✅     | Check run `build-test` → `conclusion: success` (run 27887870655, completed 2026-06-21).                                                                                               |
| Network off by default | ✅     | `loadApifyConfig` defaults `allowNetwork=false`; adapter defaults to `fixture` mode; live path hard-gated. Guard test passes.                                                         |
| Fixtures / mocks used  | ✅     | `FakeApifyClient` is the default client; `fixtures.ts` is pure (no env/I/O).                                                                                                          |
| No schema drift vs #93 | ✅     | `git diff origin/main...HEAD` shows **zero** changes under `packages/db/migrations` or `packages/db/src`. Types reuse `CloserSourceRisk` / `CloserRawRecordRow` from `@cognitia/db`.  |
| No secrets / PII       | ✅     | `.env.example` adds only non-secret flags; `APIFY_TOKEN=` is an empty placeholder. Fixtures use fake `.example` domains and reserved `555-01xx` numbers. No hardcoded token literals. |

## Test / CI evidence (run locally against `b5aad7e` in an isolated worktree)

```
pnpm install --frozen-lockfile      → Done (lockfile unchanged, no new deps)
pnpm run typecheck                   → clean (root + @cognitia/web, tsc --noEmit)

# Targeted (PR subject)
pnpm exec vitest run packages/integrations/src/apify packages/core/src/closer.guard.test.ts
  Test Files  5 passed (5)
  Tests      39 passed (39)
    - policy.test.ts ............ 11
    - normalizers.test.ts ........ 8
    - adapter.test.ts ............ 9
    - httpClient.test.ts ......... 4
    - closer.guard.test.ts ....... 7

# Full repository suite (regression sweep)
pnpm exec vitest run
  Test Files  94 passed (94)
  Tests      654 passed (654)   in 47.6s
```

No network was reached during any test run (default fixture path; the suite's no-network proof injects a throwing `fetch`).

## Safety analysis (how the guarantees hold)

**Single env boundary.** `config.ts` is the only module that reads `process.env`. `policy`, `normalizers`, `redaction`, and `fixtures` are pure and receive resolved config by injection. `HARD_MAX_APIFY_ITEMS = 500` clamps `maxItems` even from env.

**Network containment (enforced, not just asserted).** `closer.guard.test.ts` walks all production files under `packages/integrations/src/apify` (and `packages/agents/src/closer`) and fails if any file other than `apify/httpClient.ts` references `fetch`, or imports `child_process`/`node:net|dgram|http|https`/`ssh2`/`new Anthropic`, or calls outreach/brief/action sinks. `httpClient.ts` is the only live transport and is constructed only on the gated live path.

**Live-path gating (defense in depth).** A live run requires _all_ of: `request.fixtureMode === false`, `config.allowNetwork === true`, a non-empty `config.token`, an injected `liveClient`, an **active** source whose `source_risk !== 'disallowed'`, an allowlisted actor, and `humanReviewApproved` for legal-review/high-risk. Any missing gate marks the run `failed` with a sanitized reason and makes **no** network call.

**Disallowed-source lifecycle matches Phase-1 schema.** A `disallowed` source creates no `closer_scrape_run` (Phase-1's `source_risk` CHECK excludes `disallowed`); the parent `agent_run` is created and marked `failed` (`blocked_by_policy:disallowed`). All other blocks create a `closer_scrape_run` marked `failed`. Code, tests, and docs agree.

**PII & secret hygiene.** `redactContactFields` deep-strips direct-PII keys at any depth; `ensureNoDirectPiiPersisted` throws (naming only the offending _key_, never the value) before staging. The Apify token is never logged, persisted, placed in `ApifyHttpError`, or written to run metadata (`safeDetail` truncates bodies and excludes URL/token). Fixtures carry only clearly-fake demo PII to exercise redaction.

## Risks (all low / non-blocking)

1. **Stale PR description** — body says base is the Phase-1 branch; actual base is `main`. Cosmetic; update before hand-off.
2. **Phase-1 dependency** — Phase 2 reuses `closer_*` tables and `CloserSourceRisk` from the #93 data layer. Now that the base is `main`, those objects must already exist on `main` (migrations `0020`/`0021`). Typecheck + full suite passing against `main` confirm the symbols resolve; keep this ordering in mind if Phase 1 is ever reverted.
3. **`HttpApifyClient` is unexercised in production** — it has unit coverage (capped pagination, token-not-leaked, failed run) but no integration/live test by design. Acceptable for a fixture-first scaffold; flag for a gated live smoke test in a later phase.

## Recommended next action

- **Keep as draft.** No code change required to land the review.
- Update the PR body's "Base" line to `main` for accuracy.
- When Phase 1 (#93) is merged to `main` and live ingestion is in scope, add a separately-gated live smoke test for `HttpApifyClient` behind `CLOSER_APIFY_LIVE_TESTS=true`.

---

_Review-only artifact. No product code, schema, or architecture was modified. No live Apify/vendor/network calls were made._
