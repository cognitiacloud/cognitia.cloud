# V-4b — Live Public Proof Feed (execution record + handoff)

Date: 2026-06-14. Branch `claude/v4b-public-proof-feed` (from `main` @
`79a2df7`). Status: built, guarded, full gate green.

## What was built

A live, **unauthenticated, read-only** public feed that turns the static
`/trust` snapshot into independently-checkable evidence — without weakening
any guarantee.

- **`apps/api/src/handlers.ts` → `publicTrustFeed`** + route
  `GET /public/trust-feed` (server.ts, via the unauthenticated `send` wrapper,
  alongside `/health`). Safety properties (all tested):
  - tenant from server config `COGNITIA_PUBLIC_TENANT_ID` ONLY — never the
    request → no tenant enumeration;
  - deny-by-default empty feed (`configured: false`) when unset — never errors;
  - proofs = public projection only (no `details_private` / `evidence_ref` /
    `verifier_ref` / `subject_id` / `tenant_id`), and only public_safe +
    redaction-passed rows;
  - reputation = aggregate counts only (no agent ids, no per-agent scores).
- **`apps/web/src/app/trust/live/page.tsx`** — client page that GETs the feed
  (no auth, no token, no writes), renders the aggregate reputation + public-safe
  proof table, links to `/trust`, empty state when unconfigured.
- **Tests**: `apps/api/src/publicTrustFeed.test.ts` (4) +
  `apps/web/src/app/trust/live/trust-live.test.ts` (5).

## Why this is safe

`public_safe` is a DB-enforced state that REQUIRES a passed redaction check
(`proofs_public_requires_redaction`), so the feed can only ever serve
already-redacted projections. The endpoint never accepts a caller tenant, so
it is not an enumeration oracle. With no public tenant configured (the
default everywhere today), the feed is empty.

## Results

- `publicTrustFeed.test.ts`: 4/4. `trust-live.test.ts`: 5/5.
- Web typecheck + doctrine guard: green.
- Full gate: **`pnpm check` 463/463, 71 files, green** (454 + 9).

## Invariants future changes must keep

1. The public feed never takes a tenant from the request.
2. It returns only the public projection + aggregate reputation — never
   private fields, PII, agent ids, or tenant ids.
3. It stays read-only and unauthenticated; no write route is ever added under
   `/public/`.
4. `/trust` stays static (its V-4 guards forbid fetch/apiClient there); live
   data lives only under `/trust/live`.

## Follow-ups (gated)

- Set `COGNITIA_PUBLIC_TENANT_ID` to a redaction-checked demo tenant to make
  the feed non-empty (founder decision on what to publish).
- V-5 external security audit; V-6 managed-Postgres RLS run; V-8 ERC-8004/EAS
  external anchoring — all unchanged, founder-gated.

## Guardrails respected

Read-only; unauthenticated GET only; no public token launch; no purchase CTA;
no DEX/liquidity/staking/yield; no price/return; no pre-sale; no mainnet; no
real payments; no token transfers; no production migrations; no deploys; no
GTM PR work; no COG-016; no TOKEN-LAB-003.
