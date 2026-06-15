# MIGRATION / DATA MODEL BOOKLET — AUDIT-BOOKLET-001

Source: `packages/db/migrations/*.sql` on main `313a82d`. **No production DB apply
is claimed.** Migrations are applied + verified locally/dev (PGlite) by the
contract + smoke tests; production deployment status = **not deployed**.

## Migration list (17 on main; 0015 reserved/absent)

| #        | Adds                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------ |
| 0001     | tenants, users; RLS helpers (`app_current_tenant_id`, `app_bypass_rls`)                                |
| 0002     | integrations, external object maps (idempotent ingest)                                                 |
| 0003     | GTM entities (accounts, contacts, opportunities)                                                       |
| 0004     | events, agent_runs, agent_actions, audit_events                                                        |
| 0005     | campaigns, sequences, touchpoints                                                                      |
| 0006     | signals, playbooks, embeddings (pgvector)                                                              |
| 0007     | evals, experiments                                                                                     |
| 0008     | credential ciphertexts (encrypted secrets store)                                                       |
| 0009     | **Cognitia trust core**: agents, ATC, Proof Registry (+ append-only & publish-state triggers)          |
| 0010     | **SkillProof + reputation_events** (+ positive-delta guard trigger)                                    |
| 0011     | MoverOS lead rescue (lead_intakes/outcomes; encrypted PII home)                                        |
| 0012     | **credits accounts + double-entry ledger + wallet placeholders**                                       |
| 0013     | SkillProof / front-desk extensions; tier gate                                                          |
| 0014     | wallet binding deactivate                                                                              |
| **0015** | **ABSENT — reserved for parked COG-016 (field provenance)**                                            |
| 0016     | **Agent Economy**: work_orders, skill_execution_orders (simulation-locked), escrow owner-type widening |
| 0017     | **dispute_resolutions** (owner-arbitrated; resolved-terminal)                                          |
| 0018     | **marketplace_listings** (internal-visibility check-locked)                                            |

(`0019_agent_fabric_nodes` is in open PR #69, **not on main**.)

## Key constraints / triggers (verified in SQL)

- `proofs`: append-only (update-guard trigger); `proofs_public_requires_redaction`
  CHECK (`not public_safe or redaction_check_passed_at is not null`); kind CHECK
  enum (`lead_response|booking|skill_demo|revenue_outcome|system`).
- `reputation_events`: append-only; trigger refuses a positive delta unless the
  linked proof is `verified_fact`.
- `work_orders` / escrow (0016): release path trigger-gated on a `verified_fact`
  proof; terminal states enforced; `skill_execution_orders.simulation` CHECK-locked
  to `true` (the lab executes nothing for real).
- `dispute_resolutions` (0017): disputed-origin; conserved split; one per order;
  resolved-terminal; verified_fact resolution proof.
- `marketplace_listings` (0018): `visibility` CHECK-locked to `internal`; yanked
  skill versions cannot hold an active listing; unique (tenant, agent, version).
- `credits_ledger`: double-entry balanced-pair + idempotency uniqueness.
- All tenant tables: RLS `enable` + `force` + tenant-isolation policy.

## Unresolved migration risks

- **Managed-Postgres RLS under a restricted (non-superuser) role is unverified**:
  the local PGlite engine runs as a superuser that BYPASSES RLS, so triggers +
  app predicates are exercised but engine-level RLS enforcement under
  `nosuperuser` is not yet proven. (Top P1 gap.)
- Production apply status: **none** (no production DB).
