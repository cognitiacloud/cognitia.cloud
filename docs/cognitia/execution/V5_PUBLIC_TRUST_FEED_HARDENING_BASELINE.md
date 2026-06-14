# V-5 Public Trust Feed Hardening — Baseline

Captured before any V-5 code change.

- Date: 2026-06-14.
- Branch created: `claude/v5-public-trust-feed-hardening` (from `main`).
- `main` HEAD at baseline: **`bb2aec9`** (merge of #60, V-4b + hardening A).
- `pnpm install`: clean (only the standard ignored build-scripts notice for
  esbuild/sharp).
- `pnpm check`: **473 passed (72 files)**, green.

## Starting state of the public feed (post-#60)

- `/trust` exists (static); `/trust/live` exists (client, GET-only).
- `GET /public/trust-feed` exists, unauthenticated, read-only.
- `COGNITIA_PUBLIC_TENANT_ID` validated as UUID before DB access; missing/invalid
  ⇒ safe empty feed; repo error ⇒ safe empty; no DB-shaped error leaks.
- Deny-by-default; reputation aggregate-only; no private proof bodies.

## Known low-severity findings carried into V-5

1. No rate limiting on the unauthenticated public route.
2. Reputation aggregate loaded all events instead of using count aggregation.
3. The public feed exposed no freshness/cache metadata.
