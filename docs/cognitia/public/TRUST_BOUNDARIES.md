# Trust Boundaries (public-safe)

What is trusted, what is not, and what is allowed to cross each boundary. The
governing rule: **data only ever flows toward less privilege through an explicit,
checked projection** — never the reverse.

## Surfaces, by privilege

| Surface                                  | Auth            | Trust level            | May read                                                              |
| ---------------------------------------- | --------------- | ---------------------- | --------------------------------------------------------------------- |
| Public website / `/trust`, `/trust/live` | none            | untrusted public       | static content + the public feed                                      |
| `GET /public/trust-feed`                 | none            | untrusted public       | public-safe proof projection + aggregate reputation (deny-by-default) |
| Webhooks                                 | HMAC / own-auth | signature-gated        | their own signed payload                                              |
| Operator API                             | session bearer  | authenticated operator | only their tenant's data (tenant from principal)                      |
| Tenant-scoped DB access                  | via API         | RLS-enforced           | rows for the active tenant only                                       |
| Internal token architecture docs         | internal        | internal/legal-gated   | not a public surface                                                  |

## What crosses a boundary (allowed)

- **Public-safe proof projection**: 6 fields only (`id`, `kind`, `evidence_tag`,
  `summary_public`, `supersedes_proof_id`, `created_at`) — and only for rows that
  passed a redaction check (`public_safe`). This is the only proof data that
  crosses from tenant-private to public.
- **Aggregate reputation**: counts only (agents-with-reputation, total events,
  positive events). No agent ids, no per-agent scores.
- **Operator reads**: a session principal reads only its own tenant's rows.

## What NEVER crosses a boundary

- **PII** — never on any public surface.
- **`details_private` / private proof bodies** — never served publicly.
- **Tenant / customer data** — never crosses tenant isolation; never public.
- **Secrets** (API keys, session secrets) — never in code, logs, proofs, or any
  surface.
- **Wallet private keys** — none are held by agents; never anywhere public.
- **Production credentials** — never in the repo, logs, or public surfaces.
- **The configured public tenant id** — never echoed in the feed response.

## Environment boundary: local/dev vs hosted/managed provider

- The contract + economy smoke run against an **in-process Postgres (PGlite)** in
  local/dev. That engine runs as a **superuser, which bypasses RLS**.
- A **separate V-6A run** verified engine-level RLS on a **real, local PostgreSQL
  16** cluster under a **restricted, separate-login `app_user`** (`NOSUPERUSER`,
  `NOBYPASSRLS`): cross-tenant denial held for the economy, proofs, marketplace,
  and `fabric_nodes`. The production database was not touched.
- Verification under a restricted role on a **hosted/managed provider** (e.g.
  Supabase through PgBouncer / the Supabase role family) is a **separate, pending
  verification** — **not yet verified** (see `RISK_REGISTER_PUBLIC.md` and the
  managed-Postgres RLS plan). This is not a production-readiness or SOC 2 claim.

## Execution boundary: Agent Fabric Lab (simulation-only)

The Agent Fabric Lab (migration 0019) is **internal/operator-only and
simulation-only**. A fabric "node" is a registry record; "execution" is a pure
in-process simulation that writes a `verified_fact` receipt proof — it crosses
**no** boundary into a host, network, or remote process. The lab **does not
execute remote commands**, holds **no node credentials**, has **no Tailscale/
WireGuard or cloud-compute integration**, and moves **no token payments** (escrow
release stays the human owner `verify`). A containment guard fails the build if
the service ever imports a process/network primitive; real remote execution would
be a separate, deliberately-gated step (migration + security sign-off), not a
silent change.

## Future boundary: external attestations

EAS / ERC-8004 anchoring of public-safe proofs is **design-only** (not built). If
ever added, it would publish only the already-public-safe projection — never
private fields — and would be clearly labelled as an external, gated step.
