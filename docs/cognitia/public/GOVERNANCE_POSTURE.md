# Governance Posture (public-safe)

An honest statement of how Cognitia is governed **today** and what future
governance might involve — with explicit limits on what we will not claim yet.

## How Cognitia is governed today

- **Founder / operator controlled.** Decisions are made by the founder and
  authorized operators.
- **No DAO exists.** There is no on-chain or token-based governance of any kind.
- **No token governance exists.** There is **no public token**, so there are no
  token holders and no token-holder voting or control.
- Governance in practice today = **documentation + guardrails + PR review +
  automated tests**:
  - Architecture and doctrine docs define the invariants.
  - Doctrine guard tests fail the build if banned token/marketing surfaces or
    routes appear.
  - Every change lands via pull request with CI (`pnpm check`) green.
  - Append-only audit events record governed actions.

## What future governance _might_ involve (design-only, gated)

If and only if the platform economy is used and the relevant gates pass, future
governance topics could include:

- Verifier / arbiter roles and their selection.
- Dispute-resolution policies and standards.
- Marketplace parameters (matching, listing rules).
- Evidence standards (what counts as a `verified_fact`).
- Protocol upgrade processes.

**Every** such item is **legal-gated, usage-gated, and security-gated.** None are
in effect today.

## What we will NOT imply

- **No token-holder control** — there is no token; nothing here grants holders
  any rights, now or by promise.
- **No decentralization claim** — Cognitia is not decentralized in production and
  we do not claim it will be.
- **No "community-owned / DAO-governed" framing** — none exists.
- No price, return, sale, or "get in early" framing tied to governance or a token.

## Why publish this

A clear governance posture lets a researcher see exactly who decides what, that
there is no hidden token-control mechanism, and that future governance is honestly
gated rather than promised. See also `THREAT_MODEL.md`, `TRUST_BOUNDARIES.md`,
`RISK_REGISTER_PUBLIC.md`, and `TOKEN_STATUS_AND_GATES.md`.
