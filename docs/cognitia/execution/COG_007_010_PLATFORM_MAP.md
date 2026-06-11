# COG-007/010 — Platform Map

All listed files were read/authored in this session (`verified_fact`).

## System map (current stack tip)

- **API** (`apps/api/src`): proofs.ts (+redaction/), atc.ts, skillproof.ts,
  frontdesk.ts (+frontdesk/pii.ts), reputation.ts, credits.ts — all over the
  twin-implementation `Repository` (memory + Kysely/RLS, shared contract).
- **Routes** (server.ts, all session-authed): /proofs*, /agents* (+atc,
  permissions, reputation), /skills* + /skill-versions*, /leads* +
  /front-desk/*, /credits* + /wallet-bindings* + /crypto-readiness, plus the
  inherited platform routes (approvals, governance, audit, metrics, trust).
- **Console** (`apps/web/src/app`): /approvals, /proofs, /agents(+detail),
  /skills, /moveros/front-desk, /credits, /cognitia/crypto-readiness.
- **Migrations**: 0001–0008 (platform) + 0009–0014 (v1.1).
- **Tests**: 397 across 62 files incl. doctrine guards and the
  missionLoop.e2e end-to-end trust loop.

## Reusable for COG-007

Every summary the dashboard needs already has repo accessors:
listAgents/listAtcsByAgent, listProofs(filter), listSkills/listSkillVersions,
getLeadRescueSummary + listLeadIntakes/listAgentActions,
listReputationEvents/Snapshots, listCreditsAccounts/LedgerEntries/
WalletBindings, cryptoReadiness handler. COG-007 composes; it does not
duplicate business logic.

## Blockers carried into this pack

- Live DB state `unknown` (PGlite-verified only).
- Hermes external skills path inaccessible (19/20 skills are honest seeds).
- Lead-detail console page deferred (API exists).
