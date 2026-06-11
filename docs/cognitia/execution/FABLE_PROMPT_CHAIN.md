# Cognitia — Fable Prompt Chain (v1.1)

Date: 2026-06-11
Purpose: copy-paste execution prompts for the sessions that follow Step 1 (COG-001).
Authority: every prompt is subordinate to `docs/cognitia/ARCHITECTURE_LOCK_V1_1.md` and `docs/cognitia/IMPLEMENTATION_COMMAND_BOOK.md`. Read both before writing code.

**Base branch for ALL implementation prompts: `claude/soc-1-readiness-package`** (the 59-commit platform lineage — see Discovery Report §18). The near-empty default branch is NOT the base. If the doctrine docs (`docs/cognitia/`) are not present on the base branch yet, cherry-pick or copy them from `claude/cognitia-v1-1-discovery-g6ryrg` as the first commit.

Standing rules for EVERY prompt below (paste-implicit, do not skip):
- Branch from the base branch; work on the named ticket branch only; draft PR when pushed.
- Follow existing platform conventions: tenant-scoped tables + RLS, Kysely interfaces in `packages/db/src/schema.ts`, zod schemas in `packages/core/src/schemas/`, colocated Vitest `*.test.ts`, immutable `events` emission, `audit_events` for mutations.
- Tag all report claims `verified_fact` / `likely_inference` / `unknown`.
- No destructive git commands, no secrets printed or committed, never edit merged migrations (add `0009_+`).
- Never add: public token pages, `did:cognitia`, public "Agent Passport" naming, public skill registry, real SMS sending.
- Do not modify `hermes/` (reference only).
- If a file exists, read it before editing. If unsure, record the uncertainty instead of guessing.

---

## Prompt 2 — Build schema foundation (COG-002)

**Goal:** On a branch from the base, add the Cognitia v1.1 Sprint-1 schema (Command Book §B) as new migrations + Kysely interfaces + zod schemas, plus seed data and doctrine guard tests. This is schema only — no API routes, no UI.

**First actions (in order):**
1. Confirm with the founder via one AskUserQuestion: (a) base branch = `claude/soc-1-readiness-package`? (b) is there a live Postgres/Supabase instance, or develop against PGlite/local only?
2. `pnpm install && pnpm test` on the base — record pass/fail as `verified_fact` (Discovery U3).
3. Read `packages/db/migrations/0001–0008`, `packages/db/src/schema.ts`, `apps/api/src/handlers.ts` to absorb conventions (Discovery U4).

**Files to inspect first:** `docs/cognitia/ARCHITECTURE_LOCK_V1_1.md`, `docs/cognitia/IMPLEMENTATION_COMMAND_BOOK.md` (§0, §B, §E #12–14), `docs/cognitia/execution/DISCOVERY_REPORT.md`, `docs/data-model.md`, `docs/architecture.md`.

**Files to create/change:** `packages/db/migrations/0009_proofs_atc.sql`, `0010_skills_reputation.sql`, `0011_moveros_lead_intake.sql` (split as sensible); `packages/db/src/schema.ts` (new interfaces); `packages/core/src/schemas/{proof,atc,skill,reputation,leadIntake}.ts`; seed script following existing fixture patterns; `doctrine.guard.test.ts`; update `docs/data-model.md` with the new tables.

**Acceptance criteria:**
- `pnpm test` and `pnpm typecheck` green from repo root, including existing platform tests (no regressions).
- Migrations apply cleanly via `packages/db/scripts/apply-migrations.mjs` against the test DB; new tables are tenant-scoped + RLS-protected like existing ones.
- `proofs.public_safe` defaults to `false`; simulation flag for front-desk actions defaults to `true`; `evidence_tag` constrained to the three values.
- Doctrine guard tests (#12–14) pass: no token routes, no `did:cognitia`, no public "Agent Passport".
- Seed creates 1 demo agent + 1 ATC + 3 proofs (one per evidence_tag).

**Tests to run:** `pnpm test`, `pnpm typecheck`, migration apply script.

**What NOT to do:** no API routes; no UI; no credits/wallet tables yet (stub note only); do not edit migrations 0001–0008; do not deploy; do not touch `hermes/`.

---

## Prompt 3 — Build Proof Registry integrity (COG-003)

**Goal:** Proof service (append-only, evidence-tag rules, supersede chain), PII redaction scanner, proofs API routes in the Fastify app, `/proofs` page in the console.

**Files to inspect:** Command Book §B (proofs), §C (Proofs routes), §E (#1, 5, 6, 7, 11); `apps/api/src/handlers.ts` + `server.ts` (route registration conventions); `apps/api/src/governance.ts` (guard patterns); `hermes/skills/vision-skill/vision_skill.py` — port its PII regex patterns (emails, phones, API keys, file paths, financial digits) into `apps/api/src/redaction/scanner.ts`.

**Files to change:** `apps/api/src/proofs.ts` + `proofs.test.ts`, `apps/api/src/redaction/scanner.ts` + `redaction.test.ts`, route registration, `apps/web/src/app/proofs/page.tsx`, `packages/core/src/schemas/proof.ts` refinements.

**Acceptance criteria:**
- Creating a proof without `evidence_tag` fails; `verified_fact` without `evidence_ref` + `verifier_ref` fails.
- No update/delete path for proofs; supersede creates a new linked row; proof creation emits an `events` row.
- A `summary_public` containing an email or phone cannot become `public_safe=true`; the public listing endpoint returns only redacted public-safe fields, never `details_private`.
- §E tests #1, 5, 6, 7, 11 green; no platform-test regressions.

**Tests to run:** `pnpm test`, `pnpm typecheck`.

**What NOT to do:** no reputation logic yet; no direct mutation endpoints for reputation; don't expose `details_private` anywhere.

---

## Prompt 4 — Build Agent Trust Credential / ATC (COG-004)

**Goal:** Agent registry + ATC lifecycle (issue → active → suspend/revoke/expire) + agent_permissions with `sms.send_real` deny-by-default, `/agents` and `/agents/[id]` console pages.

**Files to inspect:** Command Book §B (agents, agent_trust_credentials, agent_permissions), §C, Architecture Lock §4 (VC-style shape, no did:cognitia); existing `packages/core/src/schemas/agent.ts` and how `agent_runs.agent` identifies agents today — reconcile rather than duplicate.

**Files to change:** `apps/api/src/atc.ts` + `atc.test.ts`, route registration, `apps/web/src/app/agents/page.tsx`, `apps/web/src/app/agents/[id]/page.tsx`, `packages/core/src/schemas/atc.ts`.

**Acceptance criteria:**
- ATC status transitions explicit (no delete); revoked ATC cannot return to active; every transition writes `audit_events`.
- ATC `claims` JSON: scope/vertical/policy refs, zero customer PII.
- Every agent starts with `sms.send_real → deny`.
- Pages render agents with ATC status badges from real API data.

**Tests to run:** `pnpm test`, `pnpm typecheck`.

**What NOT to do:** no DID strings; no public credential-verification endpoint yet; no cryptographic signing (placeholder `proof` section only).

---

## Prompt 5 — Build MoverOS AI Front Desk + Lead Intake (COG-006)

**Goal:** SMS-simulated lead intake → AI-drafted reply → human approval (reusing the platform's existing approval lifecycle) → simulated send → proof + audit emission. `/moveros/front-desk` page.

**Files to inspect:** Command Book §B (lead_intakes, agent_actions mapping), §C, §E (#8, 9); Architecture Lock §6 + §8; existing approval queue (`apps/web/src/lib/approvalQueue.ts`, `apps/api` approval handlers) — **reuse it, do not build a parallel queue**; `contacts.email_hash`/`phone_hash` hashing pattern for PII fields.

**Files to change:** `apps/api/src/frontdesk.ts` + tests, lead-intake routes, `apps/web/src/app/moveros/front-desk/page.tsx`, worker job if simulation needs async, `packages/core/src/schemas/leadIntake.ts`.

**Acceptance criteria (= MoverOS AI Front Desk workflow acceptance criteria):**
- Lead ingestable with `source=sms_sim`, consent flag captured; raw PII confined to `lead_intakes` (encrypted/encoded fields), hashes elsewhere.
- Draft reply enters the existing approval lifecycle as `pending`; nothing executes without approval.
- Approved execute → `simulation=true` send recorded; exactly one proof (kind `lead_response`) + one `audit_events` row; response time captured.
- Real-SMS attempt fails: `sms.send_real` deny + no provider configured (test #9 green).
- PII purge endpoint blanks PII fields and sets `pii_status=purged`.

**Tests to run:** `pnpm test`, `pnpm typecheck`.

**What NOT to do:** no Twilio/real SMS integration; no real customer data in seeds; no lead PII in proofs, logs, or `events` payloads.

---

## Prompt 6 — Build SkillProof Core 20 (COG-005)

**Goal:** Private Core 20 skill inventory, tiers T0_claimed → T3_economically_proven, skill_proofs linked to Proof Registry rows, `/skills` page.

**Files to inspect:** Command Book §B (skills rows), Architecture Lock §1 + §3 (SkillProof ≠ public registry).

**Files to change:** seed (Core 20 — front-desk vertical skills: lead intake, SMS drafting, scheduling, follow-up, quote prep, escalation, etc.), `apps/api/src/skillproof.ts` + tests, routes, `apps/web/src/app/skills/page.tsx`.

**Acceptance criteria:**
- 20 seeded skills, all `visibility=internal`.
- A skill_proof cannot reach `T2_verified`+ unless its linked proof is `verified_fact`.
- `/skills` renders inventory with tier badges, clearly marked internal.

**Tests to run:** `pnpm test`, `pnpm typecheck`.

**What NOT to do:** no public skill browsing/registration API; no third-party skill submission.

---

## Prompt 7 — Build Reputation v0 (COG-008)

**Goal:** reputation_events generated only from `verified_fact` proofs, reputation_snapshots, reputation panel on agent detail.

**Files to inspect:** Command Book §B, §E (#2–4); Architecture Lock §7; existing `trustMetrics.ts`/`scorecards.ts` — decide reuse vs. parallel and record the rationale (`likely_inference` allowed, but document it).

**Files to change:** migration for reputation_snapshots if deferred earlier, `apps/api/src/reputation.ts` + `reputation.rules.test.ts`, routes, agent detail page panel.

**Acceptance criteria:**
- Positive delta from `likely_inference` or `unknown` proof rejected at service layer (tests #2–4 green).
- No public POST endpoint for reputation events; only the proof service creates them.
- Snapshot reproducible from events (`inputs_hash` recorded).

**Tests to run:** `pnpm test`, `pnpm typecheck`.

**What NOT to do:** no leaderboards, no public reputation API, no decay/staking mechanics.

---

## Prompt 8 — Build Credits + Wallet Placeholder (COG-009)

**Goal:** Internal credits (accounts + append-only double-entry ledger), wallet_bindings placeholder (chain default `none`), `docs/cognitia/internal/CRYPTO_READINESS.md`.

**Files to inspect:** Command Book §B (credits/wallet), §E (#10, 13); Architecture Lock §5 — re-read fully before this prompt.

**Files to change:** migration `00XX_credits_wallet.sql`, `apps/api/src/credits.ts` + `credits.ledger.test.ts`, routes, `docs/cognitia/internal/CRYPTO_READINESS.md` (header: `INTERNAL — LEGAL-GATED`).

**Acceptance criteria:**
- Transfer creates a balanced debit+credit pair atomically; duplicate `idempotency_key` is a no-op; no update/delete methods on ledger entries (test #10 green).
- Wallet bindings accept only `status=placeholder`; activating `chain != none` rejected in v1.1.
- CRYPTO_READINESS.md covers payment-rail progression, Base/EVM optionality, ERC-8004/EAS/x402 sketches, token legal gates — internal only (test #13 green).

**Tests to run:** `pnpm test`, `pnpm typecheck`.

**What NOT to do:** NO token page, NO on-chain code, NO wallet SDKs, NO pricing/investment language, NO public crypto docs.

---

## Prompt 9 — Build dashboard (COG-007 + investor/admin surface)

**Goal:** `/dashboard` (KPIs: agents, proofs by evidence tag, leads, rescues, response times), `/moveros/lead-rescue` (funnel + outcome evidence), lead_outcomes with revenue-tracking discipline.

**Files to inspect:** Command Book §D, §B (lead_outcomes); Architecture Lock §8 ($997/mo is an assumption — never render projections as realized revenue); existing console pages for layout conventions.

**Files to change:** `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/moveros/lead-rescue/page.tsx`, `apps/api/src/metrics or extension of trustMetrics`, lead-outcome routes, demo seed expansion (synthetic, privacy-filtered only).

**Acceptance criteria:**
- Dashboard distinguishes evidence tags visually; only `verified_fact` counts appear under "proven".
- Lead Rescue shows response-time improvement and rescued/booked funnel from outcomes.
- All demo data synthetic; no real names/numbers.

**Tests to run:** `pnpm test`, `pnpm typecheck`.

**What NOT to do:** no revenue projections presented as fact; no public deployment without founder approval.

---

## Prompt 10 — Test, audit, harden, handoff (COG-010)

**Goal:** Full §E test matrix green, security/privacy audit pass, demo script, proof pack, handoff doc.

**Files to inspect:** entire `docs/cognitia/`, all v1.1 test files, Command Book §E + §I; existing `docs/launch/` checklists (align, don't duplicate).

**Files to change:** missing tests; `docs/cognitia/execution/DEMO_SCRIPT.md`; `docs/cognitia/execution/HANDOFF.md`; `docs/cognitia/execution/PROOF_PACK_V1.md` (evidence-tagged inventory of what verifiably works, with a reproduction command per claim); CI extension if needed.

**Acceptance criteria:**
- All 14 §E tests green in one root `pnpm test` run; output pasted into PROOF_PACK_V1.md.
- Audit checklist: no secrets in repo, no PII in seeds/logs/events, append-only invariants hold, doctrine guards pass, kill-gate status reviewed.
- HANDOFF.md lets a fresh session run the demo end-to-end in <15 minutes.

**Tests to run:** `pnpm test`, `pnpm typecheck`, migration apply, doctrine grep sweep.

**What NOT to do:** no new features; no claim in the proof pack without a reproduction command; nothing tagged `verified_fact` that wasn't executed in that session.
