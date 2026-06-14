# VERIFIED_FACTS — 12H Sprint

Claims that are directly verifiable from the Cognitia repo or from
well-established public knowledge. Each is something a researcher could check.

## Cognitia platform (verifiable in-repo)

- VF-1 — The repo implements an append-only Proof Registry with evidence tags
  `verified_fact | likely_inference | unknown`; a `verified_fact` requires an
  evidence reference and a verifier (zod + DB CHECK in migration 0009).
- VF-2 — Reputation is append-only; a positive delta is admissible only against a
  `verified_fact` proof (DB trigger in 0010, mirrored in the in-memory repo and
  tested on both backends).
- VF-3 — Work-order escrow (internal credits) releases ONLY on a `verified_fact`
  proof, enforced by a DB trigger + service + in-memory mirror (0016).
- VF-4 — Internal credits are a double-entry, append-only ledger; not a currency,
  not transferable outside the tenant ledger (0012).
- VF-5 — The public trust feed (`GET /public/trust-feed`) is unauthenticated,
  read-only, deny-by-default, takes its tenant only from server config (validated
  as UUID), serves a 6-field public projection + aggregate reputation counts, and
  never leaks private fields or tenant ids (V-4b + V-5 tests).
- VF-6 — The full test suite is **490 passing across 74 files** at main `16c83f5`;
  the repository contract runs against both an in-memory repo and a real Postgres
  engine (PGlite/WASM).
- VF-7 — Tenant isolation is enforced by Postgres RLS via a per-transaction GUC
  (`app.current_tenant_id`) plus redundant `tenant_id =` predicates (contract test
  "tenant A rows invisible to tenant B").
- VF-8 — There is no public token, no token sale, no purchase path, no DEX/
  liquidity/staking/yield surface, and no mainnet contract in the repo
  (doctrine guard tests + TOKEN_GATES doc; all gates NOT PASSED).

## Public standards (well-established)

- VF-9 — MCP is an open standard for connecting models to tools/context.
- VF-10 — ERC-8004 ("Trustless Agents") proposes on-chain registries for agent
  identity, reputation, and validation; it is a draft, not a finalized standard.
- VF-11 — W3C VC Data Model defines issuer/subject/claims/status credentials.
- VF-12 — WireGuard is a VPN protocol; Tailscale is a mesh overlay built on it.
- VF-13 — x402 uses HTTP 402 semantics for programmatic/agent payments.

## Caveats that are themselves verified facts (honesty anchors)

- VF-14 — Engine-level RLS under a restricted (non-superuser) role on a managed
  Postgres has NOT been verified; the local smoke runs as a superuser that
  bypasses RLS (documented; a ready-to-run plan exists).
- VF-15 — Cognitia is NOT production-deployed, NOT SOC 2 certified, and makes no
  token-launch-readiness claim.
