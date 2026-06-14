# V-5 Public Trust Feed Hardening — Execution Log

Branch `claude/v5-public-trust-feed-hardening` from `main` @ `bb2aec9`.

## Changes

### Repository layer (no schema, no migration)

- `packages/db/src/repository.ts`
  - `ListProofsFilter.limit?: number` (bounds the proof read).
  - new `PublicReputationCounts` type + `Repository.countReputation(tenantId)`.
- `packages/db/src/kysely.ts`
  - `listProofs` applies `.limit()` after `orderBy('created_at','desc')`.
  - `countReputation` via `COUNT(*)`, `COUNT(DISTINCT agent_id)`, and
    `COUNT(*) FILTER (WHERE delta > 0)`.
- `packages/db/src/memory.ts`
  - `listProofs` slices to `limit`; `countReputation` computes the same counts.

### API layer

- `apps/api/src/handlers.ts`
  - `ApiResponse.headers?` added (so handlers can set `Cache-Control`).
  - `publicTrustFeed`: bounded proof read (`limit + 1` to know `truncated`),
    reputation via `countReputation`, full freshness/cache metadata, and
    `Cache-Control: public, max-age=60`. Safe-empty path also carries metadata.
- `apps/api/src/rateLimit.ts` (new)
  - `FixedWindowRateLimiter` + `publicFeedRateLimiterFromEnv` (secondary,
    dependency-free, fail-open, bounded memory).
- `apps/api/src/server.ts`
  - `finish` now applies `ApiResponse.headers`.
  - `/public/trust-feed` consults the limiter → `429` + `Retry-After` +
    `X-RateLimit-*` past the limit; fail-open on limiter faults.

### Web

- `apps/web/src/app/trust/live/page.tsx`: surfaces freshness metadata
  (generated_at, cache TTL, feed version, truncated). Still GET-only, read-only.

### Tests

- `packages/db/src/repository.contract.ts`: `countReputation` + `listProofs`
  limit/order, tenant-scoped — runs on in-memory AND PGlite.
- `apps/api/src/publicTrustFeed.test.ts`: metadata + Cache-Control (configured
  and empty), proof-limit/truncated, reputation via countReputation, still no
  agent ids.
- `apps/api/src/rateLimit.test.ts` (new): limiter window/keys/memory + env parse.
- `apps/api/src/publicTrustFeedServer.test.ts` (new): Cache-Control on the route,
  429 + Retry-After with no internals, disabled-by-env, read-only verbs.

### Docs

- New: PUBLIC_TRUST_FEED_HARDENING.md, PUBLIC_TRUST_FEED_RATE_LIMIT_PLAN.md,
  PUBLIC_EVIDENCE_MANIFEST_SPEC.md, this log, BASELINE, HANDOFF.
- Updated: TRUST_PROOF_EXPLORER_SPEC.md, PUBLIC_DILIGENCE_OVERVIEW.md,
  NEXT_BUILD_PILOT_QUEUE.md, NEXT_PROMPTS_FOR_AGENTS.md.

## Commands run

- `pnpm install`, `pnpm typecheck`, targeted `vitest run`, `pnpm check`.

## Result

- Baseline: 473/473. Final: see HANDOFF / report (all green).
