# Handoff — GTM-lane hardening session (Items 1–7 complete)

All 7 hardening items COMPLETE: tested, documented, committed, pushed, CI-green
on PR #3 (branch `claude/gtm-platform-mvp-setup-vYLBG`). Item 8 is this handoff.
No half-done work. **All security invariants upheld; none weakened.**

**Re-verified 2026-06-15 (fresh container, HEAD `50502f8`):** working tree clean;
item-specific suites 43/43 green (evidence pack, anchoring + hardening, preflight);
typecheck clean; evidence pack regenerates **identically (no drift)**; preflight
CLI fail-closed (dev exit 0, prod-with-missing-secrets exit 1); CI green on PR #3.

Single source of truth for control status: **`docs/security/evidence-pack.json`**
(generated from `apps/api/src/evidencePack.ts`; a CI guard fails on drift or if
any cited file/test is missing). The buckets below mirror its `status` +
`residual.kind` fields.

## Completed this arc (commit — one-line summary)

- **Item 1** (7a2976d): behavioral + structural security regression suite;
  **found & fixed an INERT rate limiter** (was attached to no routes — 429 now
  fires). Drift-proof source guards.
- **Item 2** (1d729c7): untrusted-input flow review; **closed a 500 `err.message`
  leak**; documented untrusted→sink trace — no unsanitized flow remains.
- **Item 3** (1090023): exhaustive authz surface — manifest of all 20 privileged
  handlers + a negative test each + a **drift guard** (a new privileged route
  without a 403 test fails CI).
- **Item 4** (9af654c): inert shadow-mode self-improvement proposal ledger — no
  executor, no auto-promote, human-gated, audited transitions. Changes nothing.
- **Item 5** (e823870): machine-readable evidence pack + **drift guard** + a
  **no-fabrication guard** (every cited file/test must exist on disk).
- **Item 6** (a8f34c1, fix 86f8791): hardened the audit-anchor seam — durable
  `FileAnchorSink` (honestly labelled NOT independent), **fail-closed publish**
  (`AnchorPublishError`, no false anchored-audit), replay/truncation + co-located
  -anchor-limitation tests. CodeQL flagged event-derived data → file write; fixed
  with a **real whitelist sanitizer**, not a suppression.
- **Item 7** (f440299): pure, **fail-closed deploy-readiness preflight** +
  `pnpm preflight` CLI — reuses the boot validators, never deploys/connects/mutates,
  marks the live-only DB-role check `skip`.

## Verification (latest, commit f440299)

Gate green: **501 tests / 74 files**; coverage **92.64 / 84.74 / 94.48 / 92.64**
(floor 88/80/90/88); `audit:prod` clean (1 moderate < high threshold); CI
**build-test + CodeQL (Analyze)** green on PR #3.

## CODE-COMPLETE (done + tested in this repo)

The 13 controls in the evidence pack with `status: code-complete` — tenant
isolation/RLS guard, approval-gating, audit-chain integrity + anchoring seam,
RBAC authz matrix, input sanitization, rate limiting, fail-closed startup,
DSAR export/erase, secret seam validation, CI gates, SSO (AUTH-2),
self-improve sandbox, deploy-readiness preflight.

## INFRA-PENDING (residual.kind = infra — NOT code, NOT claimed done)

These need infrastructure provisioning; the code seams fail closed until then.

1. **`app_user` at deploy** — run app/worker pools under the non-superuser,
   non-BYPASSRLS role; the prod boot guard (`assertEnforcedRlsRole`) enforces it.
2. **Independent anchor custodian** — `FileAnchorSink` is durable but co-located;
   real tamper-proofing needs an EXTERNAL append-only sink (WORM/object-lock,
   notary/timestamp, or off-host log) injected via `ApiHandlersConfig.anchorSink`.
3. **KMS/Vault secret custody** — `CREDENTIAL_SECRET_KEY_BASE64` / `SESSION_SECRET`
   default to env; swap in a KMS/Vault `SecretSource` for production custody.
4. **Shared rate-limit store** — the limiter is in-memory per instance; a
   multi-instance deploy needs a shared (Redis) store.
5. **Production secrets + `DEPLOY_ENV=production`** — supply real secrets so the
   fail-closed boot guards activate. Verify first with `pnpm preflight`.

## POLICY-PENDING (residual.kind = policy — an ops/settings action)

1. **Branch protection** — require `build-test` + `CodeQL` on the release branch
   (a GitHub settings toggle the CI gates cannot self-enforce).
2. **Wire `pnpm preflight`** into the deploy pipeline as a required, blocking step.

## DECISION-PENDING (residual.kind = decision — needs a product call)

1. **AUTH-3** — live IdP wire bindings (JWKS / XML-DSig); gated on the pilot IdP
   choice. SSO config/seam is in place (AUTH-2).
2. **Self-improvement productionization** — persistence + an owner-gated API +
   any applier are deliberately absent; inert by design until decided.

## Invariants — all upheld (supervisor list)

Tenant isolation/RLS (strengthened), audit append-only (tamper + anchor tests
added), no unauthenticated privileged path (drift guard enforces), no
unsanitized untrusted input (500 leak closed; anchor-file sanitizer added), no
new SAST regression (CodeQL finding fixed with a real validator, **not
silenced**; CodeQL green), rate-limit + fail-closed startup intact (rate-limit
FIXED to actually enforce), no findings silenced (3 real issues surfaced+fixed),
no infra/anchor/KMS/branch-protection over-claimed.

## Recommended next operator actions (ordered)

1. Enable **branch protection** (require build-test + CodeQL) so the gates block.
2. Provision **`app_user`** + a **KMS/Vault** secret source; set
   `DEPLOY_ENV=production`; run **`pnpm preflight`** until READY before shipping.
3. Provision an **independent anchor sink** + a **shared rate-limit store** for
   multi-instance.
4. Decide **AUTH-3** pilot IdP and **self-improvement** productionization scope.
