# Cognitia — Researcher FAQ (public-safe)

Date: 2026-06-14. Conservative answers for technical evaluators. Mirrors the
FAQ rendered at `/trust`. No token marketing, no price/return language.

**Is there a public token?**
No. No public token exists.

**Can I acquire a token?**
No. There is no token sale and no purchase path of any kind.

**Is there liquidity?**
No liquidity, no DEX, no market.

**Is Cognitia production-ready?**
Not production-deployed. The Agent Economy loop is runtime-verified on a
local/dev Postgres engine only.

**Is Cognitia SOC 2 certified?**
No. Cognitia is not SOC 2 certified and makes no certification claim.

**What is actually verified?**
The full Agent Economy loop — listing → work order → Action-Ledger accept →
escrow reserved once → delivery with a `verified_fact` proof → verify
(release and reputation) — plus weak-proof refusal and dispute refund, was run
live against a real Postgres engine in local/dev, through the production
handlers and repository. Latest full test result: 443/443 green. Migration
chain 0001–0014 + 0016–0018 verified locally (0015 reserved/absent).

**What is still blocked?**
Engine-level row-level security under a restricted (non-superuser) role on a
managed database is not yet verified — a ready-to-run plan exists, pending a
dedicated dev database. Production usage, an external security audit, and any
token step remain founder-gated.

**Why does the token not launch now?**
Because it should not. The token is optional and sits behind a full set of
gates — product, usage, multi-tenant, legal, compliance, utility,
security/audit, communications — none of which are passed. Utility is earned
by the platform economy working first, then mapped — never the reverse.

**What makes the token potentially useful later?**
A possible future role is **assurance collateral** (bonding) for verifiers,
publishers, workers, and disputes — collateral that must be at risk to mean
something, which platform-issued internal credits cannot honestly provide.
This is internal design only and earns no yield.

**What evidence exists?**
Append-only, evidence-tagged proofs; a full automated test suite; a live
runtime smoke; and merged status documents in-repo. Externally-published,
independently-checkable surfaces are on the roadmap.
