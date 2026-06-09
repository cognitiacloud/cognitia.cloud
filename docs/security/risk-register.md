# Risk Register (V1)

> Supports SOC 2 risk assessment (CC3.x). Likelihood/Impact: L/M/H. Owner + mitigation +
> residual. Review quarterly and after any SEV-1/2. Anchored to branch HEAD; status reflects
> what is enforced in code vs deploy-time.

| ID   | Risk                                                               | L   | I   | Owner            | Mitigation (state)                                                                                           | Residual                                  | Blocks                |
| ---- | ------------------------------------------------------------------ | --- | --- | ---------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------- |
| R-1  | **Cross-tenant data leak** (RLS misconfig / superuser in app path) | L   | H   | ENG-platform     | RLS forced + `withTenant SET LOCAL` proven under non-superuser (CI); app must run as `app_user` at deploy    | L (code) / M (until deploy role verified) | Gate 0                |
| R-2  | **Tenant-context leak under pgBouncer** (session-mode pooling)     | M   | H   | ENG-platform     | `SET LOCAL` is transaction-scoped (proven in PGlite); **unverified on real pooled infra (B-2)**              | M                                         | Gate 3                |
| R-3  | **AES data-key compromise** → all tenant credentials exposed       | L   | H   | Security         | Key in KMS, never committed; rotation ≤90d (`secret-rotation.md`); per-tenant ciphertext                     | M (until KMS provisioned)                 | Gate 0                |
| R-4  | **Operator auth bypass**                                           | L   | H   | ENG-platform     | Session-derived tenant; `x-tenant-id` not trusted; fail-closed without `SESSION_SECRET` (tested)             | L                                         | — (resolved by API-1) |
| R-5  | **Unauthorized side-effect** (viewer/role escalation)              | L   | M   | ENG-platform     | RBAC on run/approve/execute (tested); human-approval mandatory; ledger is the only execution path            | L                                         | —                     |
| R-6  | **Duplicate CRM writes** (idempotency property missing in portal)  | M   | M   | Operator         | `cognitia_idempotency_key` property required (`hubspot-onboarding.md`); dedupe + ledger idempotency (tested) | M (operator-dependent)                    | Gate 1                |
| R-7  | **CRM stage/field mapping breakage** (custom pipelines)            | M   | M   | ENG-integrations | V1 scope is tasks/notes only; stage-update (CRM-2) fails safe on unknown stage — **not in V1**               | L (V1)                                    | post-V1               |
| R-8  | **Scope-fence drift toward email**                                 | L   | H   | Governance       | Fence enforced in code (`v1Mode`, FEN-1..3 tests); review loop on every commit                               | L                                         | —                     |
| R-9  | **Secret/token leakage in logs**                                   | L   | H   | ENG-platform     | Structured logs redact; token provider logs refs only (tested)                                               | L                                         | —                     |
| R-10 | **Backup loss / unrecoverable**                                    | L   | H   | ENG-platform     | PITR + tested restore (`backup-restore-drill.md`) — **deploy-time, not yet exercised**                       | M                                         | Gate 0                |
| R-11 | **Sub-processor data exposure** (Supabase/HubSpot/KMS/host)        | L   | M   | Compliance       | DPAs + sub-processor register (`vendor-access-register.md`); least-priv scopes                               | M (until DPAs signed)                     | Gate 3                |
| R-12 | **Incident without response**                                      | L   | M   | Security         | IR runbook + kill switch + drill (`incident-response.md`)                                                    | M (until drill run)                       | Gate 3                |
| R-13 | **No live email/voice risk in V1** (CAN-SPAM/TCPA)                 | —   | —   | Governance       | Out of scope; fence enforced. Re-open only when email/voice ships                                            | N/A in V1                                 | post-V1               |

## Top residual to burn down before paid customers

1. **R-2** (pgBouncer transaction-mode validation on real infra).
2. **R-3 / R-10** (KMS key + tested restore — deploy-time evidence).
3. **R-11 / R-12** (DPAs signed; IR drill run).

## Acceptance link

Coding-enforced mitigations (R-1, R-4, R-5, R-8, R-9, R-6 idempotency) map to tests in
`docs/testing/v1-acceptance.md`. Deploy-time mitigations (R-3, R-10) produce evidence per
`docs/security/evidence-checklist.md` §B.
