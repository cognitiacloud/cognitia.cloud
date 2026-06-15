# Threat Model (public-safe)

A conservative, public-safe threat model for Cognitia's agent economy and its
public diligence surfaces. It states what we protect, who might attack, where the
trust boundaries are, what mitigations exist today, and — honestly — what gaps
remain. It makes no production-readiness, certification, or decentralization
claim. This is an engineering artifact, not a guarantee.

## Assets to protect

| Asset                            | Why it matters                                                              |
| -------------------------------- | --------------------------------------------------------------------------- |
| Tenant data                      | Per-customer records; must stay isolated per tenant.                        |
| Proof bodies (`details_private`) | Full proof contents; never public.                                          |
| PII                              | Personal data; redaction-gated; never on public surfaces.                   |
| Credits ledger                   | Internal double-entry accounting; must stay balanced + append-only.         |
| Work orders / escrow             | Governed lifecycle + escrowed credits; release only on `verified_fact`.     |
| Reputation events                | Append-only; only `verified_fact` moves them.                               |
| Public trust feed                | The one unauthenticated read; must expose only public-safe projections.     |
| Token architecture docs          | Internal/legal-gated; must not become launch/marketing material.            |
| Secrets / credentials            | API keys, session secrets; never in code, logs, proofs, or public surfaces. |

## Adversaries (and the relevant control)

| Adversary                  | Goal                             | Primary control                                                                                                                                                                                                   |
| -------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious agent            | act beyond its authority         | deny-by-default permissions; high-risk actions approval-required; verify/dispute stay human                                                                                                                       |
| Malicious tenant           | read another tenant's data       | Postgres RLS + tenant-from-principal + redundant `tenant_id` predicates                                                                                                                                           |
| Malicious requester        | extract value without real work  | escrow releases only on `verified_fact`; weak evidence moves nothing                                                                                                                                              |
| Malicious worker           | get paid/reputation for bad work | verify gate + disputes + reputation only on `verified_fact`                                                                                                                                                       |
| Scraping / bot caller      | hammer the public feed           | secondary in-process rate limit + (planned) edge WAF/CDN; aggregate-only data                                                                                                                                     |
| Compromised fabric node    | run unsafe remote work           | Agent Fabric Lab is **simulation-only** (no remote execution); a containment guard fails the build if the service imports a process/network primitive; real remote execution remains design-only + security-gated |
| Overclaiming founder/team  | publish unsafe claims            | doctrine guards + "Claims We Do Not Make" + this model                                                                                                                                                            |
| Speculative token promoter | imply a token/return             | token-language guards; no token routes; Token Status & Gates                                                                                                                                                      |
| External attacker          | breach / exfiltrate              | RLS, secrets hygiene, append-only audit; external audit still pending                                                                                                                                             |

## Trust boundaries (summary; full detail in `TRUST_BOUNDARIES.md`)

- **Public website / `/trust` pages** — static, read-only, no secrets, no writes.
- **`/public/trust-feed`** — unauthenticated read; deny-by-default; public
  projection + aggregate reputation only; tenant only from server config.
- **Authenticated operator surfaces** — session bearer; tenant/role from the
  verified principal; `x-tenant-id` never trusted.
- **Tenant-scoped API → DB/RLS layer** — Postgres RLS via per-transaction GUC +
  redundant predicates.
- **Local/dev smoke vs hosted/managed Postgres** — the PGlite smoke runs as a
  superuser (bypasses RLS); restricted-role RLS is **verified on a real local
  PostgreSQL 16** (V-6A, `nosuperuser app_user`); RLS on a **hosted/managed
  provider** is a separate, pending step.
- **Internal token docs** — internal/legal-gated; not a public surface.
- **Future external attestations (EAS/ERC-8004)** — design-only; not built.

## Current mitigations (runtime-verified locally/dev unless noted)

- `verified_fact`-gated value + reputation movement (DB trigger + service +
  in-memory mirror; tested on two backends).
- `public_safe` requires a passed redaction check (DB CHECK); private proof
  bodies never served publicly.
- Public feed: deny-by-default, allowlist projection, aggregate-only reputation,
  tenant-from-config (no enumeration), bounded + cached + rate-limited.
- Token-language doctrine guards (build fails on banned marketing / token routes).
- No token launch routes; no real-payment routes; internal credits only.
- Agent Fabric Lab containment guard (`agentFabric.guard.test.ts`): the fabric is
  simulation-only and the build fails if it ever imports a process/network
  primitive — no remote command execution, no Tailscale/cloud integration today.

## Known gaps (honest)

| Gap                                               | Status                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Restricted-role RLS on a real local PostgreSQL 16 | **verified** (V-6A, `nosuperuser app_user`; economy/proofs/marketplace/`fabric_nodes`) — stronger than PGlite |
| Managed-Postgres RLS on a hosted/managed provider | **not yet verified** (e.g. Supabase via PgBouncer; hosted V-6 plan ready; needs a hosted dev DB)              |
| External security audit                           | not done                                                                                                      |
| Production deployment                             | not done                                                                                                      |
| Live public feed (configured tenant)              | not configured (empty by default)                                                                             |
| Edge WAF / CDN rate limiting                      | not configured (in-process secondary only)                                                                    |
| Bug bounty                                        | none (no funded program)                                                                                      |
| Counsel-cleared token                             | none (token fully gated)                                                                                      |

## Claims we refuse to make

Not production-ready; not SOC 2 certified; not decentralized in production; not
uncensorable; not "impossible to shut down" / "unstoppable". No public token, no
sale, no price/return. See `CLAIMS_WE_DO_NOT_MAKE.md`.
