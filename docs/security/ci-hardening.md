# CI hardening — SAST, dependency scan, coverage floor

Paid-GA queue items #2 (SAST/dep-scan) and #3 (coverage floor) from
`GTM_SELF_AUDIT_2026-06.md`. Item #1 (branch protection) is a GitHub **settings**
action and must be toggled by an admin — see the bottom of this doc.

## Gates added (every push + PR)

1. **Coverage floor** — `pnpm run test:coverage` (`.github/workflows/ci.yml`).
   v8 provider over `packages/*/src` + `apps/*/src` (tests, barrels, type-only,
   the Next.js UI, and the worker entry excluded). Thresholds in
   `vitest.config.ts`, set a few points below measured reality at adoption
   (stmts **88** / branches **80** / functions **90** / lines **88**; actuals
   91.9 / 84.0 / 93.7 / 91.9). **Ratchet up over time; never lower to pass a PR.**

2. **Dependency scan** — `pnpm run audit:prod` = `pnpm audit --prod
--audit-level=high`. **Fails the build on a high+ advisory in a PRODUCTION
   dependency** (what actually ships). A second, non-blocking full-tree audit
   step reports dev-toolchain advisories for visibility without failing the
   build — so the gate is meaningful, not noisy.

3. **SAST** — CodeQL (`.github/workflows/codeql.yml`), `security-extended`
   query set over JS/TS, on push + PR + weekly. Findings land in the repo
   Security tab and can be promoted to a required check.

## Dependency remediation done as part of this change

- **kysely 0.27.5 → 0.28.17** (`packages/db`, prod): clears 3 HIGH advisories
  (GHSA-wmrf-hv6w-mr66, GHSA-8cpq-38p9-67gx, GHSA-pv5w-4p9q-p3v2). Verified:
  typecheck + the full DB/PGlite/lifecycle suites stay green on 0.28.17.

## Known, triaged, below the gate (not blocking)

- **Next.js → postcss** (web, `apps/web`): 1 MODERATE (GHSA-qx2v-qp2m-jg93).
  Below the `high` prod gate; clears on the next Next.js minor/major bump
  (tracked separately — a framework upgrade is out of scope for this change).
- **Dev toolchain** (esbuild/vite/vitest, incl. the esbuild
  `NPM_CONFIG_REGISTRY` advisory): build-time only, never shipped; surfaced by
  the non-blocking full-tree audit step. Not a runtime exposure.

## Operator action still required (cannot be done from CI)

**Branch protection (queue item #1)** — enable on the release branch in GitHub
settings: require PRs, require the `build-test` **and** `CodeQL` checks to pass,
require linear history, and dismiss stale approvals. Without this, the new gates
exist but a direct push could still bypass them.
