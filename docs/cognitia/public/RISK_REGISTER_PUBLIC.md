# Public Risk Register

A public-safe register of Cognitia's known, material risks/gaps — disclosed
deliberately rather than hidden. Each row: risk · status · mitigation · blocker ·
next step. This is honest self-disclosure, not a guarantee.

| Risk                                                    | Status               | Mitigation                                                                      | Blocker                                                                         | Next step                                                |
| ------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Managed-Postgres RLS under a restricted role unverified | OPEN                 | RLS via per-tx GUC + redundant `tenant_id` predicates; tested in code on PGlite | needs a safe dev `DATABASE_URL` (local engine runs as superuser, bypassing RLS) | run the managed-RLS verification plan (V-6)              |
| No production deployment                                | OPEN (by design)     | runtime-verified locally/dev; not deployed                                      | founder decision                                                                | deploy only when gated steps pass                        |
| No SOC 2 certification                                  | OPEN                 | internal controls (RLS, audit events, least privilege)                          | audit budget/timeline                                                           | scope an audit; never claim certified until true         |
| No external security audit                              | OPEN                 | doctrine guards + tests + this threat model; `SECURITY.md` disclosure intake    | audit budget                                                                    | engage an auditor; publish summary when done             |
| No public token                                         | INTENTIONAL          | token fully gated; "no public token exists" stated everywhere                   | all `TOKEN_GATES` NOT PASSED                                                    | none — keep gated; may never launch                      |
| No legal/counsel token clearance                        | OPEN (gated)         | token kept internal/legal-gated; no marketing                                   | counsel engagement (founder)                                                    | obtain opinion before any token modeling goes public     |
| No real payment rails                                   | INTENTIONAL          | internal, non-transferable credits only                                         | legal/AML gate                                                                  | none today; sandbox-only design if ever                  |
| No pilot traction yet (public)                          | OPEN                 | product runtime-verified; pilots planned                                        | a referenceable pilot                                                           | land + (gated) publish one pilot's public-safe proofs    |
| Public feed empty by default                            | INTENTIONAL          | deny-by-default; `COGNITIA_PUBLIC_TENANT_ID` unset                              | founder config + V-6 + edge limits                                              | configure a redaction-checked demo tenant when ready     |
| No edge WAF / CDN rate limiting                         | OPEN                 | secondary in-process rate limiter shipped                                       | infra/deploy                                                                    | apply edge controls per the rate-limit plan              |
| No bug bounty                                           | OPEN                 | `SECURITY.md` discloses no funded bounty; private disclosure intake exists      | funding decision                                                                | stand up a program only if funded                        |
| External standards (ERC-8004/EAS/x402)                  | COMPATIBILITY TARGET | mapped "designed for compatibility"; not integrated                             | design + gates                                                                  | spike only as sandbox/design; never claim live/compliant |

## How to read this

- **INTENTIONAL** = a deliberate restraint (e.g. no token, no real payments), not
  a defect.
- **OPEN** = a real gap we acknowledge and track.
- None of these is mitigated by an unsafe claim. Where a gap exists, the
  corresponding public docs state it plainly (`THREAT_MODEL.md`,
  `CLAIMS_WE_DO_NOT_MAKE.md`).
