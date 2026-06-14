# Handoff — 12h hardening session

Items 1–3 of the 8-item queue COMPLETE, tested, documented, committed, pushed.
Paused before Item 4 due to context budget (no half-done work). All invariants
upheld (none weakened).

## Completed (this arc)

- **Item 1** (7a2976d): security regression suite + **found & fixed an inert rate
  limiter** (was attached to no routes; 429 now fires). Structural guards +
  behavioral tests.
- **Item 2** (1d729c7): untrusted-input flow review; **closed a 500 err.message
  leak**; security-invariants.md trace — no unsanitized flow remains.
- **Item 3** (1090023): exhaustive authz surface audit — manifest of all 20
  privileged handlers, negative tests for each, **drift-proof guard** (new
  privileged route w/o a negative test fails CI). run/authz-surface.md.

## Verification

Gate green: **458 tests / 70 files**; coverage 92.27/84.03/94.21/92.27 (floor
88/80/90/88); audit:prod clean; CI build-test + CodeQL green on PR #3.

## Invariants — all upheld (per the supervisor list)

tenant isolation/RLS (strengthened), audit append-only (tamper tests added),
no unauthenticated privileged path (guard enforces), no unsanitized input
(500 leak closed), no SAST regression (CodeQL green), rate-limit + fail-closed
intact (rate-limit FIXED to actually enforce), no findings silenced (2 real
bugs surfaced+fixed), no infra over-claimed.

## Pending — resume points (code-complete = NO; these are codeable next)

- **Item 4 Shadow-mode self-improvement scaffolding:** proposal/eval/approval/
  rollback artifacts under e.g. `apps/api/src/selfImprove/` or `run/proposals/`;
  proposals are DATA only, never auto-applied; explicit human-approval step. NOT STARTED.
- **Item 5 Operational evidence pack:** machine-readable controls/tests/risks
  (extend docs/truth-report.json) with code-complete vs infra-complete vs
  policy-complete columns. NOT STARTED.
- **Item 6 Anchor-sink hardening:** FileAnchorSink (same-host, labelled
  non-independent) + replay/tamper tests + explicit publish-failure semantics. NOT STARTED.
- **Item 7 Deploy-readiness preflight:** apps/api/src/preflightReadiness.ts pure
  checker over secrets/role/env + thin CLI + tests; fail-closed; NO deploy. NOT STARTED.

## Residuals (infra/ops/policy — NOT code, NOT claimed done)

Rate-limit shared store (Redis), audit external anchoring custody, KMS custody,
branch protection, app_user-at-deploy, live HubSpot round-trip, AUTH-3 IdP,
pgBouncer, DPAs, pricing, SOC 2. Tracked in docs/security/GTM_SELF_AUDIT_2026-06.md.

## Recommended next operator actions

1. Enable branch protection (require build-test + CodeQL) so gates block.
2. Provision app_user + KMS; set DEPLOY_ENV=production (boot guard activates).
3. Resume Items 4–7 (all GTM-lane, codeable, self-contained).
