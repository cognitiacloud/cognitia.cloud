# VERIFIED_FACTS — AUDIT-BOOKLET-001 (repo-checkable)

- main `313a82d`; `pnpm check` 515 passed; 78 test files; Node 22 / pnpm 10.
- 17 migrations (0001–0018, 0015 absent); fabric 0019 only in open PR #69.
- 2 unauth reads (`/health`, `/public/trust-feed`); 96 authed routes; 3 webhook routes.
- No token/coin/buy/sell/swap/stake/checkout/DEX/liquidity/real-payment route exists.
- Proof Registry append-only; public_safe requires passed redaction (0009 CHECK).
- Reputation positive delta requires verified_fact (0010 trigger).
- Escrow releases only on verified_fact (0016); disputes conserved (0017);
  marketplace internal-only (0018).
- Repository contract runs on InMemory AND PGlite; live economy smoke passes.
- No `did:cognitia` / "agent passport" in code (doctrine-guarded).
- All TOKEN_GATES NOT PASSED; no public token; no production deploy.
