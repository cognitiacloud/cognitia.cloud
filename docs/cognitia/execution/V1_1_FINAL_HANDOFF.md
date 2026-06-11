# Cognitia v1.1 — Final Handoff

Date: 2026-06-11. Written so a fresh Fable/Opus/Codex/Hermes session can
continue with zero prior context. Read order: this file →
`../ARCHITECTURE_LOCK_V1_1.md` → `../IMPLEMENTATION_COMMAND_BOOK.md` →
`../proof-pack/README.md`.

## System overview

Multi-tenant agent-trust platform: Fastify API (`apps/api`) + Next.js
operator console (`apps/web`) + worker, over Kysely/Postgres with tenant RLS
(`packages/db`, migrations 0001–0014) and zod schemas (`packages/core`).
Twin repository implementations (in-memory mirror + Kysely) verified by one
shared contract suite on memory AND PGlite. v1.1 adds the trust layer:
Proof Registry → ATC → SkillProof → MoverOS Front Desk → Reputation →
Credits/Wallet → Command Dashboard.

## Architecture rules that bite

- Handlers are framework-agnostic (`ApiHandlers`); Fastify binding in
  `server.ts`; session principal carries tenant+role — never trust headers.
- Every doctrine invariant lives in THREE places: DB
  (check/trigger), in-memory mirror, service — plus a test. Keep all three
  in sync when changing one.
- Append-only tables (proofs, reputation_events, credits_ledger_entries,
  events, audit_events): never add update/delete paths.
- The core `actionType` enum is closed (CRM adapters); front-desk action
  types stay out of it deliberately.

## Routes (v1.1) / Pages

See `../proof-pack/README.md` for the inventory and
`CREDITS_AND_WALLET_PLACEHOLDERS.md` for the credits mapping table.
Pages: `/cognitia` (command dashboard), `/proofs`, `/agents{,/[id]}`,
`/skills`, `/moveros/front-desk`, `/credits`, `/cognitia/crypto-readiness`,
plus inherited `/approvals`.

## Migrations

0001–0008 platform; 0009 trust core; 0010 SkillProof/reputation; 0011 lead
rescue; 0012 credits/wallet; 0013 provenance/status/outcomes ext; 0014 wallet
deactivate. Apply via `packages/db/scripts/apply-migrations.mjs`
(needs DATABASE_URL + `pnpm add -w pg`). NEVER edit a merged migration.

## Test commands

`pnpm check` (format+typecheck+all tests) · targeted:
`pnpm vitest run apps/api/src/missionLoop.e2e.test.ts` (whole loop),
`commandSummary.test.ts`, `credits.ledger.test.ts`, `skillproof.test.ts`,
`frontdesk*.test.ts`, `atc.test.ts`, `proofs.test.ts`, `reputation.test.ts`,
`packages/db/src/cognitia.trust.pglite.test.ts` (DB invariants),
`packages/core/src/doctrine.guard.test.ts`.

## Doctrine / guardrails / privacy / token rules

- Evidence tags `verified_fact | likely_inference | unknown` on every claim;
  ONLY verified_fact adds reputation.
- Public names: Agent Trust Credential / ATC, SkillProof, Proof Registry,
  MoverOS AI Front Desk. Never "Agent Passport" publicly; never a custom DID
  method; never a public skill marketplace.
- PII: raw customer data only in `lead_intakes` `*_enc` (AES-256-GCM, key
  `COGNITIA_PII_KEY_BASE64`); masked lists; purge endpoint; redaction scan
  gates `public_safe`.
- SMS: simulation-only; `sms.send_real` deny-by-default, owner-gated; no
  provider exists.
- Crypto: internal credits only; wallet placeholders inert; everything else
  legal-gated (`../internal/CRYPTO_READINESS.md`). No token marketing —
  guard tests enforce.

## Known blockers

Live DB unknown (PGlite + in-memory-server verified only); RLS-under-role
needs live Postgres; 19/20 Core skills are seeds (Hermes path inaccessible);
lead-detail page deferred; ephemeral dev PII key; pilot commitments unknown.

## Next 10 tickets

1. ~~Merge the stack in order~~ **DONE 2026-06-11** (see
   POST_MERGE_VERIFICATION.md; merged base green, `main` created). Remaining
   sliver: founder flips repo default branch to `main` in settings.
2. Provision dev/staging Postgres; apply migrations 0001–0014; verify RLS
   under a non-superuser role.
3. Seed a demo tenant/agent/skills/leads on the live dev DB (the in-memory
   HTTP seed sequence in POST_MERGE_VERIFICATION.md is the template).
4. Verify the Command Dashboard + consoles against the live dev environment.
5. Twilio SANDBOX integration only — behind the existing approval +
   `sms.send_real` owner gate; no real customer traffic.
6. Build the lead-detail console page (API already exists).
7. Customer consent + approval workflow for real SMS (CASL review first).
8. Stripe sandbox billing spike (later; widens the rail check deliberately).
9. USDC/Base sandbox RESEARCH spike (internal doc only; legal gate intact).
10. External narrative website — product story only, zero token marketing
    (doctrine guards must keep passing).

## Recommended next phase

Lane A revenue proof: a warm-network MoverOS pilot using simulation + human
send, building the verified vertical track record that everything else
monetizes. Kill gates in IMPLEMENTATION_COMMAND_BOOK.md §I still apply.
