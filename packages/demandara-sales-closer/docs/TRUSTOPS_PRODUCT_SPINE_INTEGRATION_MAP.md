# H6 TrustOps Integration Map

| TrustOps concern | Product spine consumer | Current status | Next action |
|---|---|---|---|
| deny-default consent | `compliance_gate()` | wired | expand policy wording review later |
| approval gate | `require_human_approval()` | hardened local demo | add real reviewer auth before live |
| no-egress/forbidden actions | `FORBIDDEN_ACTIONS` + scan pack | wired | migrate shared forbidden-action registry later |
| proof ledger | `proof_receipt()` event hashes | wired | connect to ledger surface after acceptance |
| fake fixture validation | `validate_fixture_email()` + fixtures | wired | add more reserved personas |
| claim safety | reports/demo script | wired | keep investor-safe language |

Rule: do not create new utilities unless consumed by one of the functions above.
