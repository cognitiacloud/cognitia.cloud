# Vendor / Sub-processor & Access Register (V1)

> Supports SOC 2 CC9.2 (vendor management) + the sub-processor list customers/auditors
> request. Keep current; review quarterly and on any new vendor. Fill the bracketed
> deployment-specific values at provisioning time.

## Sub-processors (process customer data)

| Vendor                                              | Role / data                                    | Data class                                 | Region   | DPA                              | Status                                                          |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ | -------- | -------------------------------- | --------------------------------------------------------------- |
| **Postgres host** (Supabase / RDS)                  | Primary datastore (source of truth)            | tenant CRM refs/hashes; no raw PII         | [region] | [DPA link]                       | ⬜ to confirm                                                   |
| **HubSpot**                                         | Customer's CRM (read sync + tasks/notes write) | customer's CRM data (their controller)     | [region] | per customer's HubSpot agreement | ⬜                                                              |
| **KMS / secret manager** (AWS KMS / GCP SM / Vault) | Holds the AES data key                         | encryption key material                    | [region] | [DPA link]                       | ⬜                                                              |
| **App hosting** (container platform)                | Runs API + worker                              | in-memory request data                     | [region] | [DPA link]                       | ⬜                                                              |
| **Compliance tool** (Vanta/Drata)                   | Evidence automation                            | control evidence/config                    | [region] | [DPA link]                       | ⬜                                                              |
| LLM provider (if used for generation)               | Message/score generation                       | grounded context (refs/hashes; no raw PII) | [region] | [DPA link]                       | ⬜ — V1 generator is deterministic; confirm before enabling LLM |

> V1 has **no** email ESP, telephony/voice, LinkedIn, ad platforms, Salesforce, or
> enrichment vendors — per the scope fence. Do not add them to this register in V1.

## Internal access register (human access to privileged surfaces)

| Surface                               | Who has access                     | Access type              | MFA      | Review cadence                 |
| ------------------------------------- | ---------------------------------- | ------------------------ | -------- | ------------------------------ |
| Production DB (superuser/break-glass) | [names]                            | break-glass only, logged | required | quarterly (`access-review.md`) |
| Production DB (app traffic)           | service `app_user` (non-superuser) | least-priv, RLS          | n/a      | per deploy                     |
| KMS data key (read)                   | [names]                            | need-to-know             | required | quarterly                      |
| HubSpot app config                    | [names]                            | least-priv scopes        | required | quarterly                      |
| Cloud / hosting console               | [names]                            | least-priv IAM           | required | quarterly                      |
| GitHub (release branch)               | [names]                            | branch-protected         | required | quarterly                      |
| Secret manager (env secrets)          | [names]                            | need-to-know             | required | quarterly                      |

## Evidence to capture (SOC 2)

- Signed DPAs per sub-processor.
- Published sub-processor list (customer-facing).
- Access register export + quarterly review sign-off.
- Confirmation app traffic uses `app_user`, not superuser/service_role.
