# TOKEN LAB 001 — INTERNAL (legal-gated; never public)

Date: 2026-06-12. Classification: INTERNAL. This document and everything in
`docs/cognitia/crypto/` is private architecture work. Nothing here is an
announcement, an offer, a roadmap promise, or marketing of any kind.

## Plain statements of fact

- **There is no token.** Not launched, not deployed, not minted, not testnet.
- **There is no liquidity** and no plan-of-record to create any.
- **There is no public token or coin page**, and doctrine guard tests fail
  the build if one appears.
- **No price, return, or performance language exists anywhere** — and is
  banned by the same guards.
- The current economy runs on **internal credits**: double-entry bookkeeping
  units on the 0012 ledger, rail-locked to `internal_credits`, with no
  transfer surface outside the tenant ledger.
- Wallet bindings remain **inert placeholders** (0012/0014): no keys, no
  custody, no transactions, no activation path in code.

## What the Agent Economy Lab establishes (and why it matters here)

AGENT-ECONOMY-001 is the first end-to-end _economic_ loop on the trust
stack: work ordered → escrowed → delivered with proof → settled only on
`verified_fact` → reputation updated. Every mechanic a future token would
settle is now expressed in credits first, so utility can be evaluated against
REAL internal usage instead of speculation. That is the entire token thesis:
**utility is earned by the platform economy working, then mapped — never the
reverse.**

## Scope rule (Architecture Lock A1)

If a token ever exists, it attaches to the **broader agent economy layer** —
the cross-tenant trust/execution/settlement platform — never to one tenant,
one vertical, or one workflow. MoverOS/Demandara/GTM are proof environments;
their workflows are customers of the economy, not the economy.

## Companion documents

- `TOKEN_UTILITY_MAP.md` — credits-mechanics → candidate token utilities.
- `TOKEN_GATES.md` — the gates that ALL must pass before any public step.
- `docs/cognitia/internal/CRYPTO_READINESS_INTERNAL.md` — rails posture.

Current gate status, repeated for honesty: **token public status: disabled.
Legal gate: not passed.**
