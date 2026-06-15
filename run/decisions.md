# Decisions

## 2026-06-14T20:05:00Z Item 3 — authorization surface audit

- RISK BEFORE: only 8 of 20 privileged handlers had explicit negative (403)
  tests; a newly-added privileged handler could ship with NO authz coverage.
- CHANGE: authzMatrix.ts = authoritative manifest (9 requireOwner + 11
  requireMutatingRole handlers). security.regression.test.ts now tests EVERY
  entry (owner-only: operator+viewer 403; mutating: viewer 403).
  securityInvariants.guard.test.ts adds 2 guards: every directly requireOwner/
  requireMutatingRole handler in handlers.ts MUST be in the manifest — a new
  privileged route without a negative test fails CI (Item 3 stop-rule, permanent).
  run/authz-surface.md enumerates the full route→gate→test map.
- EVIDENCE: 458 tests green; no privileged path lacks authz coverage; drift-proof.

## 2026-06-14T20:49:51Z Item 4 — shadow-mode self-improvement scaffolding

- RISK BEFORE: no governed structure for internal improvement changes; a future
  self-improvement loop could auto-apply changes without review/evidence/rollback.
- CHANGE: apps/api/src/selfImprove.ts — an INERT proposal ledger (proposed→
  evaluated→approved|rejected; approved→rolled_back; illegal transitions throw;
  auto_applied structurally false; NO executor; tenant-scoped store seam).
- EVIDENCE: 6 tests incl. illegal-transition refusal, auto_applied-always-false,
  tenant scoping. Applies nothing → cannot weaken any control. Residual (real
  persistence + owner-gated API + an applier) documented as product-decision work.
