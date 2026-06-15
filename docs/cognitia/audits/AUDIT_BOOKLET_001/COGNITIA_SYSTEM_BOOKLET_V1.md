# Cognitia System Booklet v1

Repo-truth as of mainline `313a82d` (`pnpm check` 515/515, 78 test files).
Public-safe and honest: verified facts are separated from inference; no
investment claims; no token-launch implication.

> **Reconciliation update (AUDIT-BOOKLET-001B, 2026-06-15):** PR #69 has since
> merged. The Agent Fabric Lab v0 is now **built on main** (migration
> `0019_agent_fabric_nodes.sql`), **internal/operator-only and simulation-only**.
> Current main is past `313a82d` with `pnpm check` **525/525, 80 test files**
> (515/78 was the original audit snapshot; +10 tests / +2 files came from #69).
> `0015` remains absent/reserved. No real remote execution, no Tailscale/WireGuard
> integration, no cloud routing, no production deployment, no token/payment route
> exists. Fabric references below are updated accordingly.

## 1. Executive summary

Cognitia is a proof-backed trust and agent-economy platform, **runtime-verified
on a local/dev Postgres engine** (not production-deployed). Agents get a
verifiable identity (ATC), provable skills (SkillProof), an append-only Proof
Registry, escrowed internal-credit work orders that release **only** against a
`verified_fact` proof, owner-arbitrated disputes, and an internal marketplace.
A full public diligence pack (researcher pack, threat model, governance, trust
boundaries, risk register, "claims we do not make") makes the evidence legible.
There is **no public token**, no real payments, no production deployment; the
notable open technical gap is managed-Postgres RLS verification under a restricted
role.

## 2. What Cognitia is

A trust + execution + internal-economy layer for AI agents, evidence-disciplined
at its core (only `verified_fact` moves value/reputation), with vertical
deployments (GTM/MoverOS — Mira CRM action lifecycle) as proof environments.

## 3. What Cognitia is NOT

Not production-deployed · not SOC 2 certified · not externally audited · not
decentralized in production · not "unstoppable/uncensorable" · **no public
token**, no sale, no liquidity/DEX/staking/yield, no real payments, no mainnet.
(All stated verbatim in `public/CLAIMS_WE_DO_NOT_MAKE.md`.)

## 4. Current mainline status

`main` = `313a82d`; 515 tests green; 17 migrations (0015 reserved/absent);
2 unauth reads + 3 webhook routes + 96 authed routes; full public diligence pack
present. `verified_fact` here = checked in the repo this audit ran against.

## 5. Product architecture

Monorepo (pnpm + TS): `apps/{api,web,worker}`, `packages/{core,db,agents,
integrations,workflows,evals}`. `packages/db` runs ONE contract against both an
in-memory repo and a real Postgres (PGlite), so production behavior can't drift
from the test reference. Tenant isolation = Postgres RLS (per-tx GUC) + redundant
`tenant_id` predicates.

## 6. Cognitia core trust layer — **runtime_verified (local/dev)**

ATC (mig 0009; revocation terminal), Proof Registry (append-only, evidence-tagged,
public_safe requires a passed redaction check), evidence tags (`verified_fact |
likely_inference | unknown`).

## 7. Agent economy layer — **runtime_verified (local/dev)**

Work orders + escrow (0016, simulation-locked), credits double-entry ledger (0012),
dispute resolution (0017), agent-driven propose/approve/execute via the Action
Ledger (verify + dispute stay human), internal marketplace + tier-aware matching
(0018).

## 8. Proof / reputation / skill layer

Proof Registry + SkillProof tiers (0010/0013; tier ≥2 requires verified_fact) +
append-only reputation (positive only against verified_fact; aggregate-only in
public). All `runtime_verified`.

## 9. Credits / escrow / disputes

Internal, non-transferable credits (not money, not a token). Escrow reserves once
and releases ONLY on a verified_fact proof (trigger + service + in-memory mirror).
Disputes: owner release/refund/split + resolution proof. `runtime_verified`.

## 10. Internal marketplace

Listings check-locked to `internal` visibility; matching ranks by SkillProof tier

- reputation; ordering files the worker's approval-required ledger ask. **No public
  marketplace / transaction surface.** `runtime_verified`.

## 11. Public trust & diligence surfaces

`/trust` (static explorer), `/trust/live` + `GET /public/trust-feed`
(deny-by-default, public projection + aggregate reputation, bounded/cached/
rate-limited), plus the docs pack (researcher pack, verify-it-yourself, API &
surfaces, threat model, governance, trust boundaries, risk register, entrypoints,
diligence overview) + repo-root `SECURITY.md`. Pages `built`/`runtime_verified`;
docs `docs_only` but guard-enforced.

## 12. Token architecture status — **design_only, gated**

Internal token docs (`crypto/TOKEN_LAB_00{1,2}`, TOKEN_UTILITY_MAP, TOKEN_GATES).
**No public token exists.** All gates NOT PASSED; the only honest future utility
is assurance collateral (bond/slash), legal- and usage-gated; may never launch.

## 13. Cross-tenant settlement design — **design_only**

`agent-economy/CROSS_TENANT_SETTLEMENT_DESIGN.md`: two-ledger clearing +
attestation-based reputation portability, preserving tenant isolation. Not built.

## 14. Security / governance / risk posture

RLS isolation, append-only audit events, deny-by-default permissions, secrets
never hardcoded, doctrine guards. Governance = founder/operator + docs + guards +
PR review + tests; **no DAO, no token governance**. Honest gap list in
`public/{THREAT_MODEL,RISK_REGISTER_PUBLIC}.md`.

## 15. Runtime verification

`economySmoke.live.test.ts` runs the full economy loop on live PGlite; the
repository contract runs on memory + PGlite. **Does not** prove production
readiness or managed-RLS under a restricted role (engine = superuser, bypasses RLS).

## 16. Tests and guardrails

515 tests / 78 files. Guards: doctrine (no token routes/marketing in web), plus
researcher-pack / api-surfaces / discoverability / threat-governance doc guards.

## 17. Route & surface inventory

2 unauth reads (`/health`, `/public/trust-feed`); 3 webhook/own-auth; 96 authed
operator routes; web pages incl. `/trust`, `/agent-economy`, `/credits`,
`/proofs`, `/skills`, `/cognitia/crypto-readiness`. **Confirmed absent**: any
token/coin/buy/sell/swap/stake/checkout/DEX/liquidity/real-payment/public-market
route, and any public PII/private-proof route. (See ROUTE_SURFACE_INVENTORY.)

## 18. What is built (runtime-verified)

Core trust, proof/skill/reputation, credits/escrow, work orders, disputes,
agent-driven economy actions, internal marketplace, public trust feed + `/trust`,
Mira CRM action lifecycle. (See COMPLETE_FEATURE_INVENTORY for anchors.)

## 19. What is design-only

Cross-tenant settlement; standards anchoring (ERC-8004/EAS/x402 = compatibility
targets); the **networked** distributed agent fabric (Tailscale/WireGuard mesh,
local/cloud model routing, real remote execution — all still design-only and
gated; the simulation-only Agent Fabric Lab v0 itself is now **built** on main,
see §17a); all token architecture.

## 17a. Agent Fabric Lab v0 — **built (simulation-only), runtime_verified (local/dev)**

Merged via PR #69 (migration `0019_agent_fabric_nodes.sql`). It is
internal/operator-only and simulation-only: a `fabric_nodes` registry, a
deterministic route-decision service, capability matching, a quarantine kill
switch, and proof-backed **simulated** execution receipts (a `verified_fact`
`skill_demo` proof, `simulated:true`, evidence_ref `fabric-node:<id>:sim:<hash>`).
Routes are operator-authed `/agent-fabric/*` only — no public fabric route. A
containment guard (`packages/core/src/agentFabric.guard.test.ts`) fails the build
if the service imports any process/network primitive. It **does not execute remote
commands**, **does not integrate Tailscale yet**, **does not connect to cloud
compute yet**, is **not production-deployed**, is **not decentralized in
production**, does **not** make Cognitia unstoppable, and involves **no token
payments** (escrow is still released only by the human owner `verify`).

## 20. What is blocked

Managed-RLS verification (dev DB); production deployment; external audit; public
feed data (founder config); pilot traction; token (legal/usage/audit gates);
COG-016 + migration 0015 (parked); TOKEN-LAB-003 (founder+counsel).

## 21. What must not be claimed

See PROMISE_VS_REALITY_LEDGER §"must not say yet": production-ready / SOC2 /
audited / decentralized / unstoppable / any token launch-sale-price-return-yield /
ERC-8004-compliant / managed-RLS-verified — until each is actually true.

## 22. Roadmap — next 48 hours (safe, mostly no gate)

Fabric sim lab (#69) is merged; keep guards green; founder decisions:
dev `DATABASE_URL` (V-6), default branch → `main`, `security@` forwarding.

## 23. Roadmap — next 30 days

V-6 managed-RLS verification; one pilot's public-safe proof pack; external audit
scoping; team page; standards compatibility spike (design); fabric Stage-2 (still
simulation/gated).

## 24. Founder decisions needed

Dev DB (V-6) · default branch flip · `security@` mailbox · publish-feed config ·
team identity · video transcript · counsel/token. (See WHAT_IS_LEFT_TO_BUILD.)

## 25. Final recommendation

Cognitia's credibility rests on reproducible engineering + disciplined restraint,
both of which are real and now publicly legible. Convert the **top OPEN technical
risk** (managed-RLS) into a verified fact via V-6 (needs a dev DB); the fabric
simulation lab (#69) is now landed; and keep every claim gated. Do not deploy,
launch a token, or relax any guard without the corresponding gate passing.
