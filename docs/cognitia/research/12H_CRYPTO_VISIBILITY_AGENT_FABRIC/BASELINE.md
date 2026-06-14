# BASELINE — 12H Sprint (LOOP 0)

Date: 2026-06-14T19:25Z.

## Repo state

- **Main commit**: `16c83f5` — _Merge pull request #63 from
  cognitiacloud/claude/v5-public-trust-feed-hardening_.
- **#63 status**: **already merged** before this sprint began (V-5 public trust
  feed operational hardening). No merge action needed in LOOP 0.
- **Sprint branch**: `claude/12h-crypto-visibility-agent-fabric` (from `main`).
- **`pnpm check`**: **490 passed (74 files), green** (verified post-#63 merge).
- **Working tree**: clean at branch creation.

## Active public / unauthenticated routes (apps/api/src/server.ts)

| Route                                                   | Auth           | Notes                                                 |
| ------------------------------------------------------- | -------------- | ----------------------------------------------------- |
| `GET /health`                                           | none           | DB connectivity report                                |
| `GET /public/trust-feed`                                | none           | V-4b/V-5 read-only public feed; deny-by-default empty |
| HubSpot webhook                                         | HMAC signature | not a public read surface                             |
| operator routes (`/accounts`, `/agent-economy/…`, etc.) | session bearer | tenant from principal                                 |

## Trust feed status

- Deny-by-default: empty unless `COGNITIA_PUBLIC_TENANT_ID` is set to a valid UUID
  (currently **unset**, by founder instruction).
- V-5 hardening live on main: ≤50-proof bound, DB-aggregate reputation
  (`countReputation`), freshness/cache metadata + `Cache-Control: public,
max-age=60`, secondary in-process rate limiter (env-tunable, fail-open).
- Public projection only (6 fields); no private bodies, PII, tenant/customer ids.

## Token / public-marketplace guard status (packages/core/src/doctrine.guard.test.ts)

- No public token/coin/staking/presale/airdrop **route** under `apps/web/src/app` — enforced.
- No token/investment **marketing language** in `apps/web` (`get in early`,
  `presale`, `airdrop`, `staking rewards`, `to the moon`) — enforced.
- `did:cognitia` custom DID method banned everywhere outside `docs/cognitia/` — enforced.
- Legacy "agent passport" product name banned in code/apps/packages — enforced.
- Internal marketplace is authed `/agent-economy/` only; no public marketplace surface.

## Sprint guardrails (recorded)

No production deploys/migrations/DB; no secrets printed; no real payments / token
transfers; no TOKEN-LAB-003; no mainnet contracts; no DEX/liquidity/staking/yield;
no public token launch page / purchase CTA / price-return / "get in early" /
exchange-listing / presale / APY / "next Ethereum/Solana"; no `did:cognitia`; no
public "Agent Passport" naming; no GTM PR work; no COG-016; no "impossible to
shut down" / production-ready / SOC2-certified / token-launch-ready claims.
