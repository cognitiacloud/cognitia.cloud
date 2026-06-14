# V-5 Public Trust Feed Hardening — Handoff

Branch `claude/v5-public-trust-feed-hardening` from `main` @ `bb2aec9`.

## Done

- **Proof bounds**: `listProofs({ limit })` pushed into both repos; public feed
  capped at 50, newest-first, `public_safe` + redaction-passed, tenant-scoped.
  Response reports `proof_limit`, `proof_count_returned`, `truncated`.
- **Reputation aggregate**: new `Repository.countReputation(tenantId)` (DB
  `COUNT`/`DISTINCT`/`FILTER`; in-memory mirror). The feed no longer loads all
  events. Still aggregate-only, no ids, no scores.
- **Freshness/cache**: response carries `generated_at`, `feed_version`,
  `cache_ttl_seconds`, `source`, and (configured path) the RLS `caveat`. HTTP
  `Cache-Control: public, max-age=60`; `no-store` on 429. `ApiResponse.headers`
  added and applied by `finish`.
- **Rate-limit posture**: secondary, dependency-free in-process limiter
  (`apps/api/src/rateLimit.ts`), wired on `/public/trust-feed` → 429 +
  `Retry-After` + `X-RateLimit-*`; fail-open; env-configurable; disabled by
  default-safe `0`. Primary control documented as edge/CDN/WAF.
- **Error behavior preserved**: missing/invalid env → safe empty; repo error →
  safe empty; no DB-shaped leak; HTTP 200 for safe-empty.
- **Tests**: +17 (490 total). Contract coverage on in-memory AND PGlite.
- **Docs**: hardening reference, rate-limit plan, evidence-manifest spec,
  baseline, execution log, this handoff; updated explorer spec, diligence
  overview, build queue, agent prompts.

## Verification

- Baseline `pnpm check`: 473/473.
- Final `pnpm check`: **490/490, 74 files, green**.

## NOT done (out of scope / gated)

- No production deploy, no migrations, no schema change.
- Edge rate limiting / WAF / CDN cache: runbook only (infra-gated).
- Fastify `trustProxy` enablement (needed for true client IP behind a proxy):
  documented as a config follow-up, not enabled here.
- Feed remains empty until `COGNITIA_PUBLIC_TENANT_ID` is set to a
  redaction-checked tenant (founder decision).

## Recommended next step

When the feed is ready to publish: set `COGNITIA_PUBLIC_TENANT_ID`, enable
`trustProxy`, and apply the edge controls in
`PUBLIC_TRUST_FEED_RATE_LIMIT_PLAN.md`. Otherwise this can merge as-is — it is
strictly safer than the current `main` and changes no default behavior (limiter
default is conservative and fail-open; feed still empty by default).
