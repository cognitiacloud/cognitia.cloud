# SOC 2 Control Matrix (V1)

> Maps Trust Services Criteria → our implementation → status → evidence. Phased:
> **D1** = day-1 (before customer data), **PB** = pre-beta, **GA** = pre-GA.
> Status: ✅ implemented · 🟫 partial/wiring · ⛔ not yet. Anchored to HEAD `ea7677e`.

## Security / Common Criteria (CC)

| Ctrl | TSC       | Requirement                       | Our implementation                                                                               | Phase | Status                             | Evidence                                |
| ---- | --------- | --------------------------------- | ------------------------------------------------------------------------------------------------ | ----- | ---------------------------------- | --------------------------------------- |
| AC-1 | CC6.1     | Logical access — tenant isolation | RLS forced + `withTenant` `SET LOCAL`; non-superuser role; proven in `kysely.rls.pglite.test.ts` | D1    | ✅ (needs prod role)               | RLS test CI run; DB role config         |
| AC-2 | CC6.1     | No client-trusted authz           | **API-1**: tenant from authenticated principal, not header                                       | D1    | ⛔ (header-trust today)            | API-1 PR + auth test                    |
| AC-3 | CC6.3     | RBAC / least privilege (app)      | roles owner/operator/viewer; viewers can't approve/execute                                       | D1    | ⛔ (RBAC pending)                  | RBAC matrix test                        |
| AC-4 | CC6.2     | Authentication                    | OIDC/magic-link (V1) + MFA; SAML/SCIM                                                            | D1/GA | ⛔                                 | auth config                             |
| AC-5 | CC6.6     | DB least privilege                | app runs as `app_user` (non-superuser)                                                           | D1    | 🟫 (documented, enforce in deploy) | access-review export                    |
| CM-1 | CC8.1     | Change management                 | PR review + CI gates (format/typecheck/test)                                                     | D1    | ✅                                 | branch protection; CI history           |
| CM-2 | CC8.1     | Release gates                     | isolation + idempotency tests block merge/release                                                | D1    | 🟫 (tests exist; promote to gate)  | CI required-checks config               |
| CR-1 | CC6.7     | Encryption in transit             | TLS everywhere                                                                                   | D1    | 🟫 (deploy)                        | TLS/LB config                           |
| CR-2 | CC6.7     | Encryption at rest                | AES-256-GCM secrets (`AesGcmSecretStore`); DB/storage encryption                                 | D1    | ✅ secrets / 🟫 infra              | KMS config; storage attestation         |
| SC-1 | CC6.1     | Secrets management                | KMS-sourced AES key; per-tenant `credential_ref`; rotation <90d; never logged                    | D1    | ✅ design / 🟫 prod key            | KMS rotation log; no-token-in-log test  |
| AU-1 | CC7.2     | Audit logging                     | immutable `events`/`audit_events`; every action+approval; PII-safe logs                          | D1    | ✅                                 | audit export sample; log-redaction test |
| AU-2 | CC7.2     | Audit export + retention          | per-contact action/approval chain export; retention policy                                       | GA    | ⛔ (**SEC-2**)                     | export feature; retention policy        |
| MO-1 | CC7.2     | Monitoring/alerting               | `*.failed.v1` + sync_run dashboards; worker heartbeat; `/health`                                 | PB    | ⛔ (**OBS-1**)                     | dashboards; alert config                |
| IR-1 | CC7.3/7.4 | Incident response                 | runbook + kill switch + drill                                                                    | PB/GA | 🟫 (runbook done)                  | incident-response.md; drill record      |
| VM-1 | CC7.1     | Vuln mgmt / pen test              | dep scanning; annual pen test                                                                    | GA    | ⛔                                 | scan config; pen-test report            |
| BC-1 | A1.2      | Availability / backups            | backups + PITR + tested restore                                                                  | D1    | ⛔ (deploy)                        | restore test record                     |
| VN-1 | CC9.2     | Vendor / sub-processor mgmt       | register + DPAs; sub-processor list                                                              | PB    | ⛔                                 | register; signed DPAs                   |
| RA-1 | CC3.x     | Risk assessment                   | annual risk assessment                                                                           | GA    | ⛔                                 | risk register                           |
| HR-1 | CC1.4     | Security training / onboarding    | training records; offboarding (access-review triggers)                                           | PB    | ⛔                                 | training log                            |

## Confidentiality (C) / Privacy (P) — applicable subset

| Ctrl | TSC      | Requirement                    | Our implementation                                  | Phase | Status | Evidence                      |
| ---- | -------- | ------------------------------ | --------------------------------------------------- | ----- | ------ | ----------------------------- |
| PR-1 | P / C1.1 | Data minimization / no raw PII | emails/phones hashed; events carry refs/hashes only | D1    | ✅     | redaction test; schema review |
| PR-2 | P5.x     | Deletion / DSAR                | tenant data deletion workflow                       | PB    | ⛔     | tested deletion               |
| PR-3 | P4.x     | Retention                      | retention policy + enforcement                      | GA    | ⛔     | policy + job                  |

## Notes

- Many ✅ are **design/code-complete but not prod-enforced** (role, KMS key, TLS, backups). The deploy step converts them to evidence.
- **API-1 closes the biggest open control (AC-2/AC-3).** Until then, do not connect real customer data.

## Update (2026-06-09 — post API-1/B-1/CRM-1)

- **AC-2 (no client-trusted authz): ✅** — operator tenant is session-derived; `x-tenant-id`
  no longer trusted (server auth test proves forged headers can't escape scope).
- **AC-3 (RBAC): ✅** — owner/operator/viewer enforced on run/approve/reject/execute.
- **AC-4 (authentication): 🟫** — signed-session HMAC seam in place (`SessionVerifier`);
  OIDC issuer + MFA still to wire (pre-beta).
- Scope-fence-in-code (V1): email adapter dropped + Mira CRM-only under `v1Mode`
  (FEN-1..3 tests) — supports the "no email in V1" control.

## Control ownership & verification cadence (2026-06-09)

Every control: owner · evidence type · collection method · cadence. Pair with `evidence-checklist.md`.

| Ctrl                           | Owner                   | Evidence type         | Collection method                                    | Cadence                |
| ------------------------------ | ----------------------- | --------------------- | ---------------------------------------------------- | ---------------------- |
| AC-1 RLS isolation             | ENG-platform            | test result           | CI run (`kysely.rls.pglite.test.ts`)                 | every build            |
| AC-2 no client-trusted authz   | ENG-platform            | test result           | CI run (`serverAuth.test.ts`)                        | every build            |
| AC-3 RBAC                      | ENG-platform            | test result           | CI run (handler RBAC tests)                          | every build            |
| AC-4 authentication (OIDC/MFA) | ENG-platform + Security | config                | IdP config export                                    | on change              |
| AC-5 DB least privilege        | ENG-platform            | config                | `select current_user` + role grant export            | per deploy + quarterly |
| CM-1/CM-2 change mgmt + gates  | ENG-platform            | config + logs         | GitHub branch protection + CI history                | on change              |
| CR-1/CR-2 encryption           | ENG-platform            | config/attestation    | TLS/LB config + storage attestation                  | per deploy             |
| SC-1 secrets/KMS               | Security                | config + log          | KMS key policy + rotation log (`secret-rotation.md`) | ≤90d                   |
| AU-1 audit logging             | ENG-platform            | product output + test | audit export sample + redaction test                 | every build + sample   |
| AU-2 audit export + retention  | ENG-platform            | product feature       | per-contact export (SEC-2) + retention job           | on change              |
| MO-1 monitoring/alerting       | ENG-platform            | config                | dashboards + alert config (OBS-1)                    | on change              |
| IR-1 incident response         | Security                | doc + drill           | `incident-response.md` + drill record                | quarterly              |
| VM-1 vuln/pen test             | Security                | report                | scanner + annual pen test                            | quarterly/annual       |
| BC-1 backups/PITR              | ENG-platform            | config + drill        | `backup-restore-drill.md` record                     | per deploy + quarterly |
| VN-1 vendor mgmt               | Compliance              | register + DPAs       | `vendor-access-register.md`                          | quarterly              |
| RA-1 risk assessment           | Security                | register              | `risk-register.md`                                   | quarterly + annual     |
| HR-1 training/onboarding       | Compliance              | records               | training log + offboarding tickets                   | on event + annual      |
| PR-1 data minimization         | ENG-platform            | test                  | redaction/schema test                                | every build            |
| PR-2 deletion/DSAR             | ENG-platform            | tested workflow       | deletion job + DSAR record                           | on request             |
| PR-3 retention                 | ENG-platform            | policy + job          | retention policy + enforcement                       | on change              |
