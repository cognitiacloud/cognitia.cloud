# SOURCE_INDEX — AUDIT-BOOKLET-001

All evidence is in-repo (no external fetch). Primary anchors:

- Migrations: `packages/db/migrations/0001..0018` (0015 absent).
- Data access: `packages/db/src/{repository,memory,kysely,schema}.ts`,
  `repository.contract.ts`, `kysely.pglite.test.ts`.
- API: `apps/api/src/{server,handlers,agentEconomy,agentEconomyActions,
marketplace,proofs,atc,credits,rateLimit}.ts` + `*.test.ts`,
  `economySmoke.live.test.ts`.
- Web: `apps/web/src/app/**` (trust, agent-economy, credits, proofs, skills,
  cognitia/crypto-readiness, moveros).
- Guards: `packages/core/src/*guard*.test.ts`.
- Docs: `docs/cognitia/{public,crypto,agent-economy,research,execution}/**`,
  root `SECURITY.md`, `docs/cognitia/PUBLIC_DILIGENCE_OVERVIEW.md`.
- Commands run: `pnpm check`, `git ls-files`, `grep` route/term sweeps,
  `node -v` / `pnpm -v`.
