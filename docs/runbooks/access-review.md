# Runbook — Access review

> Quarterly (and on role change/offboarding). Supports SOC 2 logical-access controls
> (CC6.x). Produces evidence for the Type 2 window.

## Scope — review every privileged surface

| System                           | What to review                                                                                                               | Principle                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Database (Postgres/Supabase)** | App runs as **`app_user` (non-superuser, RLS)**; who holds superuser/`service_role`; no human uses superuser for app traffic | least privilege; RLS never bypassed in app path |
| **App RBAC**                     | `owner`/`operator`/`viewer` assignments per tenant; viewers cannot approve/execute                                           | separation of duties on side-effects            |
| **HubSpot apps**                 | Per-tenant scopes are minimal (read + tasks/notes write only); no marketing/admin scopes                                     | least privilege                                 |
| **Secret manager / KMS**         | Who can read the AES data key; rotation <90d; access logged                                                                  | need-to-know                                    |
| **Cloud / infra**                | IAM principals, prod access, break-glass accounts                                                                            | least privilege + logged                        |
| **GitHub**                       | Repo collaborators, branch protection on the release branch, CI secrets                                                      | code-integrity                                  |

## Procedure

1. Export current access for each system above.
2. For each principal: confirm still-employed, still-needs-this, correct role. Remove/downgrade otherwise.
3. Verify no shared accounts; MFA on all human access.
4. Confirm break-glass/superuser usage since last review was justified + logged.
5. Record results + remediations.

## Evidence to capture (SOC 2)

- Dated access export per system + reviewer sign-off.
- List of removals/downgrades with tickets.
- Confirmation `app_user` (not superuser) services prod traffic.
- Rotation log for the KMS key.

## Triggers (out-of-cycle review required)

- Employee/contractor offboarding (revoke within 24h).
- Role change. · Security incident (SEV-1/2). · New sub-processor.
