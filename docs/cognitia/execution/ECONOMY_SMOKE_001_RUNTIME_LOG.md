# ECONOMY-SMOKE-001 — Runtime Log

Date: 2026-06-13. Repo `main` @ `c2caf97`. Engine: PGlite (in-process real
Postgres, WASM) — local/dev only; no production DB, no Supabase project
touched. Harness: `apps/api/src/economySmoke.live.test.ts`, run via
`pnpm vitest run apps/api/src/economySmoke.live.test.ts`.

Raw `SMOKE>` output, in order:

```
SMOKE> applied migration 0001_tenants_users.sql
SMOKE> applied migration 0002_integrations_external_maps.sql
SMOKE> applied migration 0003_gtm_entities.sql
SMOKE> applied migration 0004_events_agent_runs_actions.sql
SMOKE> applied migration 0007_evals_experiments.sql
SMOKE> applied migration 0009_cognitia_trust_core.sql
SMOKE> applied migration 0010_skillproof_reputation.sql
SMOKE> applied migration 0011_moveros_lead_rescue.sql
SMOKE> applied migration 0012_credits_wallet.sql
SMOKE> applied migration 0013_skillproof_frontdesk_ext.sql
SMOKE> applied migration 0014_wallet_binding_deactivate.sql
SMOKE> applied migration 0016_agent_economy.sql
SMOKE> applied migration 0017_dispute_resolution.sql
SMOKE> applied migration 0018_marketplace_listings.sql
SMOKE> table present: work_orders
SMOKE> table present: skill_execution_orders
SMOKE> table present: dispute_resolutions
SMOKE> table present: marketplace_listings
SMOKE> 0015 field_provenance ABSENT (reserved for parked COG-016) ✓
SMOKE> credits_accounts accepts owner_type=escrow (0016 widening live) ✓
SMOKE> requester agent caa6dd9d registered (sms.send_real deny seeded)
SMOKE> worker agent 1bcad41e has active ATC + accept/deliver/dispute allows
SMOKE> requester funded with 500 internal credits (rail=internal_credits)
SMOKE> skill version upgraded to tier 2 (0013 DB trigger accepted verified_fact)
SMOKE> listing 1ee123ff created, visibility=internal ✓
SMOKE> work order c5c128f1 @100cr created from listing; accept ask c4262472 filed (approval required)
SMOKE> execute-before-approval refused (409) ✓
SMOKE> accept executed: status=accepted, escrow=reserved, requester balance 500→400
SMOKE> re-execute refused (409); escrow reserved EXACTLY once ✓
SMOKE> delivered via agent ask; execution proof c5ea343c tag=verified_fact
SMOKE> verified: escrow released → worker balance 100; reputation +3 (work_order:verified)
SMOKE> marketplace match_score=2031 (tier 2 + rep 3 + 1 verified order); eligible_for_verified_work=true
SMOKE> audit events present: proposed.v1, executed.v1, verified.v1 ✓
SMOKE> verify refused with likely_inference delivery proof (409) — escrow NOT released ✓
SMOKE> verify refused with unknown delivery proof (409) — escrow NOT released ✓
SMOKE> weak-proof path: escrow stays reserved, zero reputation ✓
SMOKE> dispute filed: escrow HELD (status=disputed, escrow=disputed)
SMOKE> owner refund: balance restored to 300; resolution proof 01217ebf; worker reputation -2
SMOKE> dispute audit event present: resolved.v1 ✓
SMOKE> tenant isolation: A has 3 work orders, B has 0 ✓
```

Result: **5 test cases, 5 passed** (`apps/api/src/economySmoke.live.test.ts`,
~2.0s). UUIDs above are per-run (`randomUUID`); they will differ on re-run —
the assertions, not the ids, are the verification.

## How the local DB was started (repo convention)

No external DB process. The repo's live-Postgres convention is PGlite
(`@electric-sql/pglite` + `kysely-pglite`), already used by
`packages/db/src/kysely.pglite.test.ts` and `cognitia.trust.pglite.test.ts`.
The smoke harness builds the same engine, applies the real migration files
from `packages/db/migrations/`, and binds the production `KyselyRepository`
and `ApiHandlers` to it. Scope note (inherited from the existing PGlite
harnesses): PGlite's default role is a superuser that BYPASSES RLS, so this
run verifies the repository-layer tenant predicates + `withTenant` GUC and
all DB CHECK/trigger invariants — not RLS-engine enforcement under a
non-superuser role (that remains the documented founder-gated live-Postgres
step).
