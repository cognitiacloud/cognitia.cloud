# Decisions

- 2026-06-14T10:45:51Z DSAR erasure = ANONYMIZE contact PII (not hard delete): preserves the
  append-only audit chain + action/event referential meaning, while removing the
  data subject's personal data. Audit chain never stored raw PII, so it stays
  intact and verifiable. Erasure is itself recorded as an audit event.
- 2026-06-14T10:45:51Z Anchoring sink default = NO-OP/in-memory; external sink is a documented
  seam wired by the operator. Will NOT claim external anchoring is provisioned.

## 2026-06-14T19:27:05Z Item 1 — security regression suite + a real rate-limit fix

**Before/after (required):**

- RISK BEFORE: (1) rate limiting was _registered but functionally inert_ — routes
  were added synchronously before @fastify/rate-limit's onRoute hook loaded, so
  NO route was actually limited (DoS exposure despite the control "existing").
  Discovered by the new behavioral test (429 never fired). (2) Core guarantees
  (authz matrix, cross-tenant isolation, audit tamper-evidence, rate-limit
  firing) had no dedicated regression tests — they could weaken silently.
- CHANGED: (1) wrapped route registration in a deferred `app.register(async () =>
{...})` so routes load AFTER the rate-limit hook → limiter now applies (429
  proven). buildServer stays sync; no call-site changes. (2) added
  securityInvariants.guard.test.ts (structural: authz allowlist, rate-limit
  present, single /health opt-out, x-tenant-id ban, fail-closed guards) +
  security.regression.test.ts (behavioral: 429 fires + /health exempt,
  owner-only & mutating authz matrix, cross-tenant 404, audit hash_mismatch +
  broken_link).
- EVIDENCE NOW: 444 tests green incl. the 429-fires test; coverage 92.27/84.03/
  94.21/92.27 (>= floor); audit:prod clean. CodeQL re-verified on CI push.
