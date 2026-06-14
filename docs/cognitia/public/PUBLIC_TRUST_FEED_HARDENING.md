# Public Trust Feed — Operational Hardening (V-5)

Public-safe reference for how the unauthenticated `GET /public/trust-feed`
surface is bounded, cached, and rate-limited. This describes posture, not
secrets. The feed remains **empty by default** until a founder configures a
public tenant.

## Endpoint

`GET /public/trust-feed` — unauthenticated, read-only. Powers `/trust/live`.

## Safety properties (carried forward from V-4b / #60)

- Tenant comes ONLY from server config `COGNITIA_PUBLIC_TENANT_ID`, validated as
  a UUID before any DB access. Missing/malformed ⇒ safe empty feed (HTTP 200).
- Deny-by-default: with no public tenant configured, the feed is empty.
- Proofs are the public projection only (`id`, `kind`, `evidence_tag`,
  `summary_public`, `supersedes_proof_id`, `created_at`) and only
  `public_safe` + redaction-passed rows.
- Reputation is aggregate counts only — no agent ids, no per-agent scores.
- No DB-shaped error can escape; any internal error falls back to safe empty.

## V-5 additions

### 1. Proof feed bounds

- Hard cap: **50** proofs, newest first, tenant-scoped, public_safe + redaction
  passed. The cap is pushed into the repository query (`listProofs({ limit })`)
  so the DB read itself is bounded — not a post-hoc slice.
- The handler fetches `limit + 1` to compute `truncated` without a count query.

### 2. Reputation aggregate hardening

- Reputation is computed by a repository aggregate, `countReputation(tenantId)`,
  which uses `COUNT(*)` / `COUNT(DISTINCT agent_id)` / `COUNT(*) FILTER (WHERE
delta > 0)` in Postgres (mirrored in the in-memory repo). The public feed no
  longer loads every event row into memory to count.

### 3. Freshness / cache metadata

The response body includes:

- `configured` (bool), `generated_at` (ISO-8601), `feed_version` (int),
  `cache_ttl_seconds` (int), `source` (string),
- `proof_limit`, `proof_count_returned`, `truncated`,
- `proofs[]`, `reputation { agents_with_reputation, total_events, positive_events }`,
- `caveat` (managed-Postgres RLS not yet verified) on the configured path.

HTTP: `Cache-Control: public, max-age=60` on feed responses; `Cache-Control:
no-store` on a 429.

### 4. Rate-limit posture

- A **secondary**, dependency-free, in-process fixed-window limiter blunts
  single-source bursts. Default 60 requests / 60s per client IP; returns `429`
  with `Retry-After` and `X-RateLimit-*` headers past the limit; fail-open.
- Configurable: `COGNITIA_PUBLIC_FEED_RATE_LIMIT` (0/invalid disables),
  `COGNITIA_PUBLIC_FEED_RATE_WINDOW_SEC`.
- **This is not the primary control.** Primary rate limiting for public traffic
  is edge/CDN/WAF — see `PUBLIC_TRUST_FEED_RATE_LIMIT_PLAN.md`. In-process
  counters do not coordinate across instances, and `request.ip` is only the true
  client when `trustProxy` / an edge forwards it.

## Configuration summary (env)

| Env                                    | Default | Effect                                      |
| -------------------------------------- | ------- | ------------------------------------------- |
| `COGNITIA_PUBLIC_TENANT_ID`            | unset   | Public tenant; unset/malformed ⇒ empty feed |
| `COGNITIA_PUBLIC_FEED_RATE_LIMIT`      | 60      | Max requests/window per IP; 0 disables      |
| `COGNITIA_PUBLIC_FEED_RATE_WINDOW_SEC` | 60      | Window length (seconds)                     |

No secrets are required or printed. The feed exposes no PII, no private proof
bodies, no tenant/customer data, and no token surface.
