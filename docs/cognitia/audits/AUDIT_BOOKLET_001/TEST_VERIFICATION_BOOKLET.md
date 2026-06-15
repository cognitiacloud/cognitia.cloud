# TEST / VERIFICATION BOOKLET — AUDIT-BOOKLET-001

`pnpm check` on main `313a82d` = **515 tests passed** across **78 test files**
(`git ls-files '*.test.ts'`). `pnpm check` = prettier + tsc + vitest.

## Test-file distribution (by area)

- `apps/api/src` 44 (+1 redaction) — handlers, economy, disputes, marketplace,
  proofs, ATC, credits, reputation, skillproof, public trust feed (+server),
  rate limit, live economy smoke, etc.
- `packages/core/src` 6 (+events/policies/schemas) — incl. 5 guard tests
  (doctrine, researcherPack, apiSurfaces, visibilityDiscoverability, threatGovernance).
- `packages/db/src` 5 — incl. the shared repository contract run on memory AND
  PGlite, plus the Cognitia trust PGlite test.
- `packages/agents`, `packages/integrations` (HubSpot 7, email 1), `packages/evals`,
  `apps/web/src/app/trust` (+live) source-scan guards.

## What is verified by **unit / service** tests

Economy invariants (verified_fact-gated release/reputation; weak-proof refusal;
dispute refund/split), ATC lifecycle (revoked-terminal), SkillProof tiers, credits
double-entry + idempotency, redaction/public_safe, the public feed (deny-by-default,
projection-only, no enumeration, aggregate reputation, rate limit, cache headers).

## What is verified by **PGlite / runtime smoke**

- `repository.contract.ts` runs on **both** InMemoryRepository and KyselyRepository
  (PGlite) — production data-access behavior can't drift from the reference.
- `economySmoke.live.test.ts` applies real migrations to a live PGlite engine and
  runs the full loop: listing → work order → ledger accept → escrow reserve →
  deliver (simulated execution + proof) → verify → release + reputation; plus
  weak-proof refusal and dispute refund.

## What is verified by **guard / docs** tests

Doctrine guard (no token/coin/staking routes or marketing literals in `apps/web`;
no `did:cognitia`/"agent passport" in code); researcher-pack, api-surfaces,
discoverability, and threat/governance doc guards (docs exist, keep caveats, carry
no purchase CTA / price-return / DEX-yield marketing).

## What remains **unverified** (honest gaps)

| Gap                                          | Severity | Why                                      |
| -------------------------------------------- | -------- | ---------------------------------------- |
| Managed-Postgres RLS under a restricted role | P1       | local engine = superuser, bypasses RLS   |
| Production deployment / uptime / scale       | P1       | not deployed; smoke ≠ production         |
| External security audit                      | P1       | none performed                           |
| Real-payment / token paths                   | n/a      | intentionally absent (nothing to verify) |
| Edge WAF / rate limiting                     | P2       | in-process secondary only                |

The test suite proves **logic + isolation-in-code + the economy loop on a real
engine** — it does not prove production readiness, managed-RLS enforcement, or
third-party-audited security.
