# Token Launch Gates — INTERNAL (legal-gated; never public)

Date: 2026-06-12. Classification: INTERNAL. These gates are conjunctive — ALL
must pass, in evidence, before ANY public token step (including naming one).
A failed or unevaluated gate means the answer is no. Today every gate is
**NOT PASSED**.

| #   | Gate                    | What "passed" requires (evidence-tagged, not asserted)                                                                                       | Status                                                      |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | **Product gate**        | the agent economy loop (work → escrow → proof → settlement → reputation) running in production with real internal users, not lab simulations | not passed — lab is simulation-only                         |
| 2   | **Usage gate**          | sustained organic volume of credit-settled work orders across months; metrics from the ledger, `verified_fact` only                          | not passed — zero production volume                         |
| 3   | **Multi-tenant gate**   | the economy demonstrably serving MULTIPLE tenants/verticals (Lock A1: token attaches to the platform economy, never one tenant)              | not passed — Tenant Zero pilot not yet live                 |
| 4   | **Legal gate**          | written counsel opinion covering token classification in target jurisdictions; founder sign-off                                              | not passed — not engaged                                    |
| 5   | **Compliance gate**     | KYC/AML posture, sanctions screening design, regulatory registrations as advised by counsel                                                  | not passed — not started                                    |
| 6   | **Utility gate**        | at least one TOKEN_UTILITY_MAP.md candidate proven necessary — i.e. the credits version demonstrably insufficient, not merely replaceable    | not passed — credits suffice for everything built           |
| 7   | **Security/audit gate** | external audit of any contract code + the platform trust surfaces; no contract code exists yet to audit                                      | not passed — nothing to audit (correct state)               |
| 8   | **Communications gate** | founder-approved public language reviewed by counsel; zero forward-looking value statements; doctrine guards extended to the public surface  | not passed — no public language exists (enforced by guards) |

## Standing rules while gates are open

- Internal credits remain the only settlement unit (0012 check).
- Wallet bindings stay placeholder/deactivated (0012/0014 checks).
- The web app contains no token/coin/staking/presale/airdrop route — the
  doctrine guard test fails the build otherwise.
- Every lab surface that mentions the token states: **public status disabled,
  legal gate not passed** (API summary + console page do this today).
- This directory is the ONLY home for token thinking. Nothing graduates out
  of it without the gates above.
