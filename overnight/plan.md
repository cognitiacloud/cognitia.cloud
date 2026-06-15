# Overnight plan — 24h security-hardening session (GTM lane only)

Baseline: HEAD f36be24; 425 tests/68 files; CI (build-test+CodeQL) green on PR #3.
Execute the queue IN ORDER; finish each before the next. No invariant may regress.

1. Security regression suite expansion (authz, tenant isolation, sanitization,
   audit append-only, DSAR edge, rate-limit edge, anchoring integrity;
   bug→regression; security-invariant tests).
2. Untrusted-input flow review → findings to overnight/security-invariants.md.
3. Authorization surface audit (enumerate routes/privileged ops; negative tests;
   STOP if any privileged path lacks authz coverage).
4. Shadow-mode self-improvement scaffolding (proposal/eval/approval/rollback;
   sandboxed, evidence-backed, NO auto-promote).
5. Operational evidence pack (machine-readable controls/tests/risks/residuals;
   code-complete vs infra-complete clarity; no fabricated compliance).
6. Anchor sink seam hardening (contracts, negative/replay/tamper tests, failure
   semantics; keep no-op/in-memory honestly non-production).
7. Deploy-readiness preflight tooling (prod-role/env/config/startup checks;
   NO deploy; fail-closed readiness evidence).
8. Morning handoff package.

Honesty boundaries: never claim external anchoring / KMS / branch protection /
IdP rollout complete. No suppression of real findings. No lane change.
