# READINESS SCORECARD — AUDIT-BOOKLET-001

Self-assessment (0–5) from repo evidence. A self-grade, not a third-party rating.

> **Reconciliation update (AUDIT-BOOKLET-001B, 2026-06-15):** PR #69 merged. Test
> evidence is now **525 tests / 80 files**; the Agent Fabric Lab v0 is built
> (simulation-only) — rows 2, 3 and 20 updated below.

> **Reconciliation update (V6A-DOCS-RECONCILE, 2026-06-15):** restricted-role RLS
> is now **verified on a real, local PostgreSQL 16** under a `nosuperuser`
> `app_user` (economy/proofs/marketplace/`fabric_nodes`) — stronger than PGlite.
> Rows 4 and 5 updated. The remaining gap is **hosted/managed-provider** RLS
> (e.g. Supabase via PgBouncer), which is **not yet verified**; this is not a
> production-readiness or SOC 2 claim, and the production DB was not touched.

| #   | Dimension                          | Score         | Evidence                                                                                                         | Blocker                                | Next action                         |
| --- | ---------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------- |
| 1   | Architecture                       | 4             | monorepo; twin-repo contract; layered services                                                                   | —                                      | keep contract discipline            |
| 2   | Tests                              | 4             | 525 tests, 80 files, two backends                                                                                | breadth of edge cases                  | grow as features land               |
| 3   | Local runtime verification         | 4             | live PGlite economy smoke; fabric lab unit + contract tests                                                      | —                                      | add a live fabric smoke later       |
| 4   | Managed-Postgres readiness         | 3             | restricted-role RLS verified on a real local PG16 (`nosuperuser app_user`, V-6A)                                 | hosted/managed provider unverified     | run hosted V-6 (Supabase/PgBouncer) |
| 5   | Tenant isolation                   | 4             | RLS + GUC + redundant predicates; contract test; V-6A engine-level RLS (economy/proofs/marketplace/fabric_nodes) | hosted/managed-provider RLS unverified | hosted V-6                          |
| 6   | Security posture                   | 3             | RLS, audit events, deny-by-default, secrets hygiene, SECURITY.md, threat model                                   | no external audit                      | audit + SECURITY intake live        |
| 7   | Public diligence readiness         | 5             | full researcher/threat/governance/risk pack + guards                                                             | —                                      | optional team page                  |
| 8   | Crypto legitimacy readiness        | 4             | restraint + gates + standards mapping                                                                            | external validation                    | standards spike (design)            |
| 9   | Token safety                       | 5             | no token; all gates NOT PASSED; doctrine guards                                                                  | —                                      | keep gated                          |
| 10  | Token launch readiness             | 0 (by design) | gates NOT PASSED; may never launch                                                                               | legal/usage/audit gates                | none — keep gated                   |
| 11  | Marketplace readiness              | 3             | internal listings + matching                                                                                     | internal-only                          | detail pages (future)               |
| 12  | Agent economy readiness            | 4             | full loop runtime-verified                                                                                       | production                             | pilot proof                         |
| 13  | Pilot readiness                    | 2             | product works; onboarding docs                                                                                   | a real tenant                          | Tenant Zero                         |
| 14  | Enterprise buyer readiness         | 2             | governed lifecycle + audit trail                                                                                 | SOC2/audit/SLA                         | audit; deploy                       |
| 15  | SOC 2 readiness                    | 1             | internal controls only                                                                                           | program/budget                         | scope audit                         |
| 16  | Production deployment readiness    | 2             | runs locally/dev; no deploy                                                                                      | founder + V-6                          | gated deploy                        |
| 17  | Documentation quality              | 5             | extensive evidence-tagged docs                                                                                   | —                                      | keep current                        |
| 18  | Researcher discoverability         | 4             | README + entrypoints + `/trust` metadata                                                                         | default branch not `main`              | flip default branch                 |
| 19  | Standards alignment                | 3             | VC-shaped ATC; mapping doc                                                                                       | no integration                         | design spike                        |
| 20  | Distributed agent fabric readiness | 2             | simulation-only Lab v0 built on main (#69); networked stages design-only                                         | real-exec gated (Stage 2+)             | gated stages w/ security sign-off   |

**Shape**: strong on architecture/tests/docs/diligence/token-safety (the
un-fakeable + restraint axes); restricted-role RLS is now proven on a real local
PG16 (V-6A); weak on **hosted/managed-provider** RLS proof, external audit, pilot
traction, production deployment — all tracked, most founder/infra-gated.
