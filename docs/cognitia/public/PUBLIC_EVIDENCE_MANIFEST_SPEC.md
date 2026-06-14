# Public Evidence Manifest — Spec

Defines the exact, public-safe shape served by `GET /public/trust-feed` (and
rendered at `/trust/live`). This is the contract a researcher or external
verifier can rely on. It exposes only already-public-safe data.

## Response shape

```jsonc
{
  "configured": true, // false when no public tenant is set
  "note": "…", // present only on the safe-empty path
  "generated_at": "2026-06-14T07:00:00.000Z",
  "feed_version": 1,
  "cache_ttl_seconds": 60,
  "source": "public-safe redaction-checked proof projections only",
  "caveat": "Managed Postgres row-level security … not yet verified.", // configured path
  "proof_limit": 50,
  "proof_count_returned": 12,
  "truncated": false,
  "proofs": [
    {
      "id": "…",
      "kind": "…",
      "evidence_tag": "verified_fact | likely_inference | unknown",
      "summary_public": "… | null",
      "supersedes_proof_id": "… | null",
      "created_at": "2026-…",
    },
  ],
  "reputation": {
    "agents_with_reputation": 0,
    "total_events": 0,
    "positive_events": 0,
  },
}
```

## Field rules

- **Proof projection is an allowlist** of exactly six fields. Private fields
  (`details_private`, `evidence_ref`, `verifier_ref`, `subject_id`, `tenant_id`)
  are never serialized — adding a column to the proof row cannot leak it.
- **`proofs` is bounded** to `proof_limit` (50), newest-first, tenant-scoped,
  `public_safe` + redaction-passed only. `truncated` is true when more than the
  limit exist.
- **`reputation` is aggregate counts only** — no agent ids, no per-agent scores,
  computed by a DB aggregate.
- **Tenant** is taken only from server config (never the request); no
  enumeration. The tenant id never appears in the response.

## Caching / freshness

- `Cache-Control: public, max-age=60`; `cache_ttl_seconds` mirrors it.
- `generated_at` is the server time the response was assembled.
- `feed_version` increments only on a breaking shape change.

## Error / empty behavior

- Missing or malformed `COGNITIA_PUBLIC_TENANT_ID` ⇒ `configured: false`, empty
  proofs, zeroed reputation, HTTP 200.
- Any internal/DB error ⇒ same safe-empty body, HTTP 200, no internals leaked.
- A 429 (rate limited) carries `{ "error": "rate limited", "retry_after_seconds": N }`
  and `Cache-Control: no-store`.

## Out of scope (by design)

No private proof bodies, no PII, no tenant/customer data, no token surface, no
write operations, no price/return/marketing language.
