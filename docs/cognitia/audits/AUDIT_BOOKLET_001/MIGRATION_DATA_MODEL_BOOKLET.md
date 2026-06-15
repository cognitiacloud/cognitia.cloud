# MIGRATION / DATA MODEL BOOKLET — AUDIT-BOOKLET-001

Source: `packages/db/migrations/*.sql` on main `313a82d`. **No production DB apply
is claimed.** Migrations are applied + verified locally/dev (PGlite) by the
contract + smoke tests; production deployment status = **not deployed**.

> **Reconciliation update (AUDIT-BOOKLET-001B, 2026-06-15):** PR #69 merged after
> this booklet was written. There are now **18 migrations on main** (0001–0019);
> **`0015` remains absent/reserved** (parked COG-016). `0019_agent_fabric_nodes.sql`
> is **additive** (no existing migration was edited) and backs the simulation-only
> Agent Fabric Lab. Its detail is added to the list + constraints below. Still **no
> production DB apply** (PGlite/dev only).

## Migration list (18 on main; 0015 reserved/absent)

| #        | Adds                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| 0001     | tenants, users; RLS helpers (`app_current_tenant_id`, `app_bypass_rls`)                                       |
| 0002     | integrations, external object maps (idempotent ingest)                                                        |
| 0003     | GTM entities (accounts, contacts, opportunities)                                                              |
| 0004     | events, agent_runs, agent_actions, audit_events                                                               |
| 0005     | campaigns, sequences, touchpoints                                                                             |
| 0006     | signals, playbooks, embeddings (pgvector)                                                                     |
| 0007     | evals, experiments                                                                                            |
| 0008     | credential ciphertexts (encrypted secrets store)                                                              |
| 0009     | **Cognitia trust core**: agents, ATC, Proof Registry (+ append-only & publish-state triggers)                 |
| 0010     | **SkillProof + reputation_events** (+ positive-delta guard trigger)                                           |
| 0011     | MoverOS lead rescue (lead_intakes/outcomes; encrypted PII home)                                               |
| 0012     | **credits accounts + double-entry ledger + wallet placeholders**                                              |
| 0013     | SkillProof / front-desk extensions; tier gate                                                                 |
| 0014     | wallet binding deactivate                                                                                     |
| **0015** | **ABSENT — reserved for parked COG-016 (field provenance)**                                                   |
| 0016     | **Agent Economy**: work_orders, skill_execution_orders (simulation-locked), escrow owner-type widening        |
| 0017     | **dispute_resolutions** (owner-arbitrated; resolved-terminal)                                                 |
| 0018     | **marketplace_listings** (internal-visibility check-locked)                                                   |
| 0019     | **fabric_nodes** (Agent Fabric Lab registry; platform/status check-locked; quarantine; RLS) — simulation-only |

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
- `fabric_nodes` (0019): `platform` CHECK-locked to `macos|windows|linux|cloud`;
  `status` CHECK-locked to `active|quarantined` (default `active`); unique
  (tenant, agent, label); `set_updated_at` trigger; RLS enable + force +
  tenant-isolation policy. Simulation-only registry — stores no credentials and
  drives no real execution; receipts reuse the existing Proof Registry (no new
  proof kind, no schema for remote work).
- `credits_ledger`: double-entry balanced-pair + idempotency uniqueness.
- All tenant tables: RLS `enable` + `force` + tenant-isolation policy.

## Unresolved migration risks

- **Managed-Postgres RLS under a restricted (non-superuser) role is unverified**:
  the local PGlite engine runs as a superuser that BYPASSES RLS, so triggers +
  app predicates are exercised but engine-level RLS enforcement under
  `nosuperuser` is not yet proven. (Top P1 gap.)
- Production apply status: **none** (no production DB).
