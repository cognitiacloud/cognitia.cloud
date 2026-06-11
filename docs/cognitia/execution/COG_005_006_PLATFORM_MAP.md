# COG-005/006 — Platform Map (inspection before coding)

Date: 2026-06-11. Evidence tags: `verified_fact` unless noted. All files below
were read in this session (most during Mission Pack A, re-confirmed here).

## Files inspected

- `packages/db/migrations/0001,0003,0004,0008–0012` — conventions + trust schema
- `packages/db/src/{schema,repository,memory,kysely,repository.contract}.ts`
- `apps/api/src/{handlers,server,auth,governance,proofs,atc,frontdesk}.ts`
- `packages/agents/src/ledger/actionLedger.ts`, `packages/agents/src/mira/draftStore.ts`
- `packages/core/src/schemas/{common,agent,trust}.ts`
- `apps/web/src/app/{approvals,proofs,agents}/…`, `apps/web/src/lib/apiClient.ts`
- `hermes/skills/vision-skill/{skill.yaml,README.md,requirements.txt}`
- `docs/cognitia/IMPLEMENTATION_COMMAND_BOOK.md`, `docs/cognitia/execution/MISSION_PACK_A_HANDOFF.md`

## Conventions found (verified_fact)

- Raw-SQL migrations, tenant RLS via `app_current_tenant_id()` GUC; append-only
  via select+insert-only policies plus `forbid_update/forbid_delete` triggers.
- `Repository` interface with twin implementations (in-memory mirror of every
  DB invariant + Kysely/RLS), verified by ONE shared contract suite run
  against both (memory + PGlite).
- Framework-agnostic `ApiHandlers` class + thin Fastify bindings; session-auth
  principal carries tenant + role; RBAC helpers (`requireTenant`,
  `requireMutatingRole`, `requireOwner`).
- Approval lifecycle is the `ActionLedger` (structured decision reasons →
  feedback labels); drafts out-of-band in `DraftStore`, referenced by
  `payload_ref`.
- Console pages: client components, paste-token auth, typed `ApiClient`.

## Reuse, don't rebuild (verified_fact)

| Need (Mission Pack B) | Already exists — reuse |
| --- | --- |
| Skill tables | 0010 `skills`/`skill_versions`/`skill_proofs` (+ tier guard trigger: T2+ ⇒ verified_fact proof) |
| Lead intake + PII | COG-006 WIP: `lead_intakes` (0011), AES-GCM PII module, masked views, purge |
| Approval queue | `ActionLedger.approve/reject` + `/agent-actions/:id/approve` + approvals console |
| Proof emission | `proofs` table + insertProof repo method (append-only, publish-state gate) |
| Reputation gating | 0010 trigger: positive delta requires verified_fact proof; `canApplyReputationDelta` in core |
| Doctrine guards | `doctrine.guard.test.ts` (no token routes, no custom DID, no legacy passport naming) |

## Gaps this pack must fill

- Migration 0013: skill namespace/source/hash/tier/yank columns; lead_intakes
  `status`; lead_outcomes extended outcome vocabulary + `estimated_value_cents`
  + `evidence_source`.
- Repo methods: skills/versions/skill-proofs, lead status updates, outcomes,
  reputation events.
- Services: `skillproof.ts` (import/certify/yank/tier-upgrade validation),
  front-desk `proposeLeadAction`/`createLeadOutcome`/`getLeadRescueSummary`.
- Routes + console pages (`/skills`, `/moveros/front-desk`).

## Blockers

- `/home/smrai/.hermes/skills` not accessible (`verified_fact`) → 1 real
  import from repo `hermes/skills/vision-skill` + 19 seeded skills
  (`likely_inference`, no backing files). Documented in DEPENDENCY_STATUS.
- `actionType` core enum is closed (CRM adapter registry) — front-desk action
  types stay out of it deliberately; the ledger cannot execute them (no
  adapter), which is the desired failsafe (`verified_fact`, tested).
