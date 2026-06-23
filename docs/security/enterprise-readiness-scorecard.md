# Enterprise Readiness Scorecard

> **STATUS: MOCK / SANDBOX — posture document, not a go-live claim.**
> This scorecard measures _evidence and control completeness_ of the mock-safe
> platform primitives. It does **not** assert that the system is live-approved.
> A score of 100 means "live-approved"; reaching it remains **BLOCKED** until
> legal + customer + founder sign-off land out-of-band (see
> `docs/launch/approval-signoff-checklist.md`). Nothing here authorizes live
> outreach, reads a production secret, executes a vendor, or processes raw PII.
>
> **Base anchor:** `overnight/gtm-implementation` @ `da48e8f` (Merge PR #179 —
> pure automation release-gate engine). PR #179 is the canonical release-gate
> evidence referenced below.

## How to read this

- Scores are 0–10 per area, scoring _mock-safe evidence/control completeness_.
- Status legend (matches `docs/security/control-matrix.md`): ✅ implemented ·
  🟫 partial/wiring · ⛔ not yet.
- **Before** = state at base `da48e8f`. **After** = state once the artifacts in
  this change set land. The delta is documentation/control _consolidation_; it
  raises evidence completeness, **not** the go-live gate.
- Residual points (the gap to 100) are deliberately reserved for things that
  require production infrastructure or out-of-band human sign-off and therefore
  **cannot** be closed by a code/doc change in this repo.

## Scorecard

| #   | Control area                          | Primary evidence (source of truth)                                                                                                              | Status | Before |  After |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -----: | -----: |
| 1   | Auth / RBAC                           | `packages/agents/src/security/permissionModel.ts`; `HmacSessionVerifier` (`apps/api/src/auth.ts`); `docs/security/auth-rbac-plan.md` (new)      | 🟫     |      7 |      9 |
| 2   | Tenant isolation                      | forced RLS + `withTenant SET LOCAL`; `packages/db/src/kysely.rls.pglite.test.ts`; `docs/security/tenant-isolation-checklist.md` (new)           | ✅     |      8 |      9 |
| 3   | Audit / event ledger                  | immutable `events`/`audit_events` (`packages/db/migrations/0004_*`); `packages/core/src/schemas/event.ts`; `docs/event-taxonomy.md`             | ✅     |      7 |      8 |
| 4   | Release-gate evidence                 | `docs/security/live-release-gates.md`; `docs/security/evidence-checklist.md`; **PR #179** `packages/agents/src/closer/automationReleaseGate.ts` | 🟫     |      8 |      9 |
| 5   | Monitoring rules                      | `docs/security/monitoring-rules.md` (new); control-matrix **OBS-1**; `automationReleaseGate.ts` `monitoringStatus` input                        | ⛔→🟫  |      3 |      7 |
| 6   | Rollback runbook                      | `docs/runbooks/rollback.md` (new); `apps/api/src/rollback.test.ts`; `killSwitch.ts`; `packages/integrations/src/hubspot/rollback.ts`            | 🟫     |      5 |      8 |
| 7   | Incident response                     | `docs/runbooks/incident-response.md`                                                                                                            | 🟫     |      8 |      8 |
| 8   | Secrets policy                        | `docs/security/secrets-policy.md` (new); `docs/runbooks/secret-rotation.md`; AES-256-GCM store (`credentialStore.ts`, migration 0008)           | 🟫     |      6 |      8 |
| 9   | Deployment checklist                  | `docs/launch/go-live-checklist.md`; `docs/runbooks/deploy-verification.md`; `.github/workflows/enterprise-gate.yml` (new)                       | 🟫     |      7 |      8 |
| 10  | Founder / legal / client approval     | `docs/launch/approval-signoff-checklist.md` (new); `automationReleaseGate.ts` `founderSignoff`/legal/customer inputs; `apps/web/.../approvals`  | 🟫     |      5 |      8 |
| 11  | CI gate (install / check / web build) | `.github/workflows/enterprise-gate.yml` (new); existing `.github/workflows/ci.yml`                                                              | 🟫     |      6 |      8 |
|     | **Total (of 110)**                    |                                                                                                                                                 |        | **70** | **90** |

**Normalized enterprise readiness score:**

- **Before: 64 / 100** (70/110)
- **After: 82 / 100** (90/110)

## Residual gap to 100 (cannot be closed in-repo)

These remain open by design and are gated behind production infrastructure or
out-of-band human sign-off:

- **Go-live authorization** — legal + customer + founder sign-off (out-of-band).
- **OBS-1** — live dashboards + alert wiring in the real monitoring backend.
- **SEC-2 / AU-2** — audit export + retention enforcement feature.
- **AC-4** — real auth provider: OIDC/magic-link + MFA, SAML/SCIM.
- Production DB least-privilege role, KMS-held production key, backups/PITR with
  a tested restore, dependency scanning + annual pen test, signed DPAs.

See `docs/security/control-matrix.md` and
`docs/security/hardening-package-2026-06.md` for the controlled, CC-by-CC view;
this scorecard is the consolidated index over them and does not restate them.

## Verification for this change set

- `pnpm install --frozen-lockfile`
- `pnpm check` (format:check + typecheck + test)
- `pnpm --filter @cognitia/web run build`
- See `.github/workflows/enterprise-gate.yml` for the enforced sequence.
