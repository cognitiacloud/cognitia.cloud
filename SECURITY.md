# Security Policy

This document describes Cognitia's intended security-disclosure posture. It is a
policy statement, **not legal advice**, and may evolve.

## Reporting a vulnerability

If you believe you have found a security vulnerability in Cognitia, please report
it privately by email to **security@cognitia.cloud** with:

- a description of the issue and its potential impact,
- the steps or proof-of-concept needed to reproduce it,
- any relevant logs or references (please do **not** include third-party
  personal data).

Please do **not** open a public issue, pull request, or social post for a
suspected vulnerability before it has been resolved. Responsible, private
disclosure protects users.

## Scope

In scope:

- This repository's application code (`apps/`, `packages/`).
- The public, unauthenticated surfaces: the `/trust` pages and the
  `GET /public/trust-feed` endpoint.
- Tenant-isolation, authentication/authorization, and the trust/proof/economy
  invariants.

Out of scope:

- Anything requiring physical access, social engineering of staff, or
  denial-of-service / volumetric testing.
- Third-party services and dependencies (report those to their maintainers).
- Findings that require a non-default, intentionally unsafe configuration.
- Automated scanner output without a demonstrated, reproducible impact.

## Bug bounty

**No paid bug bounty is offered at this time.** We will acknowledge good-faith
reports and, where appropriate, credit reporters who wish to be named. If a
funded bounty is ever established, this section will say so explicitly — until
then, please do not expect payment.

## Expected response process

This is the intended process (best-effort for an early-stage project, not an SLA):

1. Acknowledge receipt of a report, typically within a few business days.
2. Triage and confirm/reproduce; ask for clarification if needed.
3. Work on a fix; keep the reporter informed of progress.
4. Coordinate a disclosure timeline with the reporter once resolved.

## Safe harbor (intended policy, not legal advice)

We intend to treat good-faith security research conducted in accordance with this
policy as authorized, and we do not intend to pursue action against researchers
who: act in good faith, avoid privacy violations and data destruction, avoid
degrading service, and give us a reasonable opportunity to remediate before any
public disclosure. This statement is an expression of intent, not a contract or
legal guarantee, and does not bind any third party.

## Secrets policy

- Secrets (API keys, tokens, credentials) are never committed to the repository
  and are never hardcoded in source.
- Secrets are not printed in logs, error messages, proofs, receipts, or any
  public surface.
- The public trust feed exposes only a redaction-checked public projection — no
  private proof bodies, no PII, no tenant/customer identifiers.

## Production status caveat

Cognitia is **not production-deployed** and makes **no claim of production
readiness**. It is **not SOC 2 certified** and has **not** completed an external
security audit. Engine-level row-level-security under a restricted (non-superuser)
database role on a managed Postgres has **not yet been verified**; a ready-to-run
verification plan exists. These are tracked gaps, disclosed deliberately rather
than hidden.
