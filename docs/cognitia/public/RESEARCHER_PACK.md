# Cognitia — Researcher Pack

A single starting point for serious crypto / AI-agent researchers to evaluate
Cognitia from evidence. Public-safe: no token marketing, no investment claims, no
price/return language. Where a claim is not yet externally verifiable, it is
labelled as such.

## Project summary

Cognitia is a **proof-backed trust layer for the agent economy**. It gives
software agents a verifiable identity, provable skills, an append-only record of
proven work, escrowed task settlement that releases only against verified
evidence, and earned, portable reputation. It runs today as a runtime-verified
**internal** economy — there is **no token**.

## What is built (runtime-verified, local/dev)

- **Agent Trust Credential (ATC)** — verifiable-credential-style identity
  (issuer/subject/claims/status; revocation terminal). Migration 0009.
- **Proof Registry** — append-only, evidence-tagged proofs
  (`verified_fact | likely_inference | unknown`). 0009.
- **SkillProof** — capability tiers; higher tiers require a `verified_fact` proof.
  0010/0013.
- **Reputation** — append-only; positive change only against a `verified_fact`. 0010.
- **Credits** — double-entry, append-only internal accounting; non-transferable
  outside the tenant ledger; not money, not a token. 0012.
- **Work Orders + Escrow** — governed lifecycle; escrow releases only on a
  `verified_fact`. 0016.
- **Dispute Resolution** — owner arbitration + resolution proof. 0017.
- **Internal Marketplace** — internal-visibility listings + tier-aware matching. 0018.
- **Agent Action Ledger** — agents propose; humans approve; operator executes via
  a safe path. Verify/dispute stay human.
- **Agent Fabric Lab v0** — internal/operator-only, **simulation-only** node
  registry + route-decision service + capability matching + quarantine kill switch
  - proof-backed **simulated** execution receipts. Migration 0019 (`fabric_nodes`).
    It **does not execute remote commands**, does **not** integrate Tailscale, does
    **not** connect to cloud compute, and involves **no token payments** (escrow
    release stays the human owner `verify`). A containment guard fails the build if
    the service ever imports a process/network primitive.

## What is design-only

- The **networked** distributed agent fabric (Tailscale/WireGuard mesh,
  local/cloud model routing, real remote execution, node attestation, node
  reputation, fabric marketplace) — design docs only; not implemented. See
  `docs/cognitia/research/distributed-agent-fabric/`. (The simulation-only Agent
  Fabric Lab v0 above is built; the networked/real-execution stages are not.)
- External standards anchoring (ERC-8004 / EAS / x402) — compatible-by-design,
  see `STANDARDS_ALIGNMENT.md`.
- Cross-tenant settlement — documented design, gated.

## What is verified by a restricted-role Postgres run (V-6A)

- **Engine-level RLS under a restricted role** — verified on a **real, local
  PostgreSQL 16** cluster under a **separate-login `app_user`** that is
  `NOSUPERUSER` and `NOBYPASSRLS`. Cross-tenant denial held for the economy,
  proofs, marketplace, and `fabric_nodes` (even with the app's `tenant_id`
  predicate removed); the public-safe projection stayed redacted. This is
  **stronger than the PGlite smoke**, whose default role is a superuser that
  bypasses RLS. The production database was not touched.

## What is blocked / not yet verified

- **Hosted/managed-provider RLS** (e.g. Supabase through PgBouncer / the Supabase
  role family) — **not yet verified**; the V-6A run used a real **local** PG16.
- **External security audit** — not completed.
- **Production deployment / traction** — not production-deployed; no public
  traction claim. (V-6A is not a production or production-readiness claim.)

## Repo evidence map

| Evidence           | Where                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Trust primitives   | `packages/db/migrations/0009`, `0010`, `0013`                                          |
| Economy            | `0012` (credits), `0016` (work orders/escrow), `0017` (disputes), `0018` (marketplace) |
| Services           | `apps/api/src/{handlers,agentEconomy,marketplace,proofs,rateLimit}.ts`                 |
| Twin-repo contract | `packages/db/src/repository.contract.ts` (in-memory + PGlite)                          |
| Doctrine guards    | `packages/core/src/doctrine.guard.test.ts`                                             |

## Runtime evidence map

- Full suite: **525 tests, 80 files** (run `pnpm check`).
- Live economy smoke on a real Postgres engine (PGlite):
  `apps/api/src/economySmoke.live.test.ts`.
- Restricted-role RLS verified on a real local PostgreSQL 16 under a `nosuperuser`
  `app_user` (V-6A) — see `VERIFY_IT_YOURSELF.md`; hosted/managed-provider
  verification remains pending.
- Agent Fabric Lab: `apps/api/src/agentFabric.{ts,test.ts}`, containment guard
  `packages/core/src/agentFabric.guard.test.ts`, contract case in
  `packages/db/src/repository.contract.ts` (memory + PGlite).
- Reproduce it yourself: see `VERIFY_IT_YOURSELF.md`.

## `/trust` page

A static, read-only Trust / Proof Explorer summarizing what is built,
runtime-verified, design-only, and blocked, plus token gates and an explicit
"what we do not claim" section.

## `/public/trust-feed` status

Unauthenticated, read-only, **deny-by-default**: empty unless a public tenant is
configured (`COGNITIA_PUBLIC_TENANT_ID`). Serves only a redaction-checked public
projection + aggregate reputation counts; bounded, cached, rate-limited (V-5).
See `PUBLIC_EVIDENCE_MANIFEST_SPEC.md` and `PUBLIC_TRUST_FEED_HARDENING.md`.

## Token status

**No public token exists.** Not launched, no liquidity, no DEX, no staking/yield,
no launch date. It may never launch. See `TOKEN_STATUS_AND_GATES.md`.

## What Cognitia refuses to claim

See `CLAIMS_WE_DO_NOT_MAKE.md` (not production-ready, not SOC 2 certified, not
decentralized in production, no token sale, no returns, etc.).

## Security disclosure

See the repository root `SECURITY.md`.

## Threat model & governance

See `THREAT_MODEL.md` (assets, adversaries, mitigations, known gaps),
`GOVERNANCE_POSTURE.md` (founder/operator controlled; no DAO; no token
governance), `TRUST_BOUNDARIES.md` (what crosses vs never crosses), and
`RISK_REGISTER_PUBLIC.md` (open risks, honestly disclosed).

## Recommended review order

See `RESEARCHER_REVIEW_ORDER.md`.
