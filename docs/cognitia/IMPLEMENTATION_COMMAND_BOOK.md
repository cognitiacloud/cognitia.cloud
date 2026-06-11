# Cognitia — Implementation Command Book (v1.1)

Date: 2026-06-11
Audience: future Fable / Opus / Codex / Hermes coding sessions.
Authority: subordinate to `ARCHITECTURE_LOCK_V1_1.md`. If they conflict, the Lock wins.
Companion: `execution/FABLE_PROMPT_CHAIN.md` contains the copy-paste prompts that execute this book.

Ground truth from Discovery (`execution/DISCOVERY_REPORT.md`):
- The repo is greenfield except `hermes/skills/vision-skill/` (`verified_fact`).
- There is **no existing framework, DB, API, or auth** (`verified_fact`). Everything in sections C/D below is therefore a *proposed* structure under the recommended stack (Architecture Lock §9: Next.js App Router + TypeScript + Prisma + Postgres/SQLite, pnpm, Vitest), to be ratified at the start of COG-002.

---

## §0. Repo layout to create (COG-002)

```
apps/web/                  # Next.js App Router app (UI + API routes)
  app/                     # routes (see §D)
  app/api/                 # API route handlers (see §C)
  prisma/schema.prisma     # data model (see §B)
  prisma/migrations/
  src/lib/                 # domain logic (proofs, reputation, credits, redaction)
  src/lib/redaction/       # PII scanner (port patterns from hermes vision skill)
  tests/                   # Vitest suites (see §E)
docs/cognitia/             # doctrine (this book, the Lock, discovery)
docs/cognitia/internal/    # INTERNAL — LEGAL-GATED crypto/token notes only
hermes/                    # existing; do not modify
```

Conventions for all future sessions:
- One branch per ticket: `claude/cog-NNN-<slug>`; draft PR per branch.
- Never edit a migration that has been merged; add a new one.
- Append-only tables (`proofs`, `credits_ledger_entries`, `audit_log`, `reputation_events`): no UPDATE/DELETE in application code; enforce via service-layer guard + tests (and DB triggers when on Postgres).
- Every report/PR description tags claims `verified_fact` / `likely_inference` / `unknown`.

## §A. Build lanes

| Lane | Name | Contents | Ships value when |
|---|---|---|---|
| **A** | MoverOS AI Front Desk + Lead Rescue | lead_intakes, agent_actions, lead_outcomes, SMS simulation, Lead Rescue dashboard | A pilot mover sees rescued leads with response-time evidence |
| **B** | Agent Trust Control Plane | agents, ATC, permissions, skills/SkillProof, proofs, reputation | Lane A's work is provable: every action has a credentialed agent + evidence-tagged proof |
| **C** | Crypto-ready, legal-gated protocol layer | credits accounts/ledger, wallet binding placeholder, payment rail enums, internal docs | Internal accounting works; zero public crypto surface |
| **D** | Ops, docs, testing, handoff | test suites, audit checks, demo scripts, prompt chain maintenance | Every other lane is verifiable by a fresh session |

Dependency rule: Lane B schema (proofs, agents) lands **before** Lane A actions, because Lane A actions must emit proofs from day one. Lane C is strictly behind A and B and freezes per kill gates (§I).

## §B. Proposed data model

All tables get: `id` (ULID/UUID pk), `created_at`, `updated_at` (except append-only tables, which have no `updated_at`). All Prisma model names in PascalCase; table names below in snake_case.

| Table | Purpose | Required fields (beyond id/timestamps) | Privacy concerns | Evidence tagging | Sprint 1? | Deferrable? |
|---|---|---|---|---|---|---|
| **agents** | Registry of Cognitia-operated AI agents | `name`, `slug`, `kind` (enum: `front_desk`, `internal_ops`, `other`), `status` (`draft/active/suspended/retired`), `description` | None (no PII; agents are ours) | n/a | **Yes** | No |
| **agent_trust_credentials** | ATC per agent: VC-style credential record | `agent_id` FK, `issuer` (string, internal for now), `subject_ref`, `claims` (JSON: scope, vertical, policy refs), `status` (`active/suspended/revoked/expired`), `issued_at`, `expires_at` nullable, `external_ref` nullable (future ERC-8004/EAS/DID), `version` | Claims JSON must not embed customer PII | Credential claims cite proof ids | **Yes** | No |
| **agent_permissions** | Policy: what an agent may do | `agent_id` FK, `action_key` (e.g. `sms.draft`, `sms.send_real`, `lead.read`), `effect` (`allow/deny`), `constraint` (JSON: rate limits, approval-required flags) | None | n/a | **Yes** (needed for "no real SMS" gate) | Granularity can grow later |
| **skills** | Private internal skill inventory (NOT public registry) | `name`, `slug`, `category`, `description`, `visibility` (`internal` only in v1.1) | None | n/a | **Yes** (Core 20 seed) | Extra metadata deferrable |
| **skill_versions** | Versioned skill definitions | `skill_id` FK, `version` (semver), `spec` (JSON), `status` | None | n/a | Partial (single version per skill ok) | Yes — full versioning Sprint 2 |
| **skill_proofs** | SkillProof certification: evidence an agent has a skill at a tier | `skill_id` FK, `agent_id` FK, `proof_id` FK, `tier` (`T0_claimed/T1_demonstrated/T2_verified/T3_economically_proven`), `evidence_tag` | Inherits proof privacy rules | **Yes — core mechanic** | **Yes** | No |
| **proofs** | Append-only Proof Registry | `kind` (enum: `lead_response`, `booking`, `skill_demo`, `revenue_outcome`, `system`), `subject_type` + `subject_id` (polymorphic), `evidence_tag` (**required**, enum), `evidence_ref` (URI/hash/record-id; required if `verified_fact`), `verifier_ref` (required if `verified_fact`), `summary_public` (redacted text), `details_private` (JSON), `public_safe` (bool, default **false**), `redaction_check_passed_at` nullable, `supersedes_proof_id` nullable, `external_attestation_ref` nullable (future EAS) | **Highest-risk table.** `summary_public` must pass redaction scan before `public_safe=true`; `details_private` never exposed via public API | This IS the evidence-tag system | **Yes — first thing after schema** | No |
| **reputation_events** | Append-only inputs to reputation | `agent_id` FK, `proof_id` FK, `delta` (signed numeric), `reason_code` | None directly (references proofs) | **Only `verified_fact` proofs may yield positive delta — enforced in service layer + tests** | **Yes** | Scoring sophistication deferrable |
| **reputation_snapshots** | Periodic computed reputation per agent | `agent_id` FK, `score`, `computed_at`, `inputs_hash` | None | Derived from events only | No | **Yes — defer to COG-008** |
| **lead_intakes** | Inbound mover leads (SMS/web/form) | `source` (`sms_sim/sms_real/web/manual`), `channel_ref` nullable, `contact_name_enc`, `contact_phone_enc` (encrypted-at-rest fields), `message_body_enc`, `received_at`, `tenant_ref` (single-tenant string for now), `consent_captured` (bool), `pii_status` (`raw/redacted/purged`) | **Raw PII lives here and ONLY here.** Encrypt at rest; deletion capability required (PIPEDA/BC PIPA) | Lead facts feed proofs only in redacted form | **Yes (COG-006)** | No |
| **agent_actions** | Every agent action on a lead/task | `agent_id` FK, `lead_intake_id` FK nullable, `action_key`, `input_summary`, `output_summary`, `approval_status` (`not_required/pending/approved/rejected`), `approved_by` nullable, `executed_at` nullable, `simulation` (bool, default **true**), `proof_id` nullable | Summaries must be PII-light; raw payloads stay on lead_intakes | Each completed action MUST create a proof + audit_log row (tested) | **Yes** | No |
| **lead_outcomes** | What happened: booked, lost, rescued, revenue | `lead_intake_id` FK, `outcome` (`rescued/booked/lost/no_response/in_progress`), `response_time_ms` nullable, `booking_value_cents` nullable, `currency`, `evidence_tag`, `proof_id` | Booking values are business-sensitive: private by default | Revenue outcomes are the moat — must be `verified_fact` to count anywhere public | **Yes (COG-009 fills it out)** | Partial |
| **credits_accounts** | Internal credit account per entity | `owner_type` + `owner_id`, `status` | None | n/a | No | **Yes — COG-009/Lane C** |
| **credits_ledger_entries** | Append-only double-entry ledger | `account_id` FK, `counter_account_id` FK, `amount` (positive int), `direction` (`debit/credit`), `reason_code`, `idempotency_key` (unique) | None | Ledger integrity tested: no updates/deletes, balanced entries | No | **Yes — Lane C** |
| **wallet_bindings** | Inert placeholder for future wallet links | `owner_type` + `owner_id`, `chain` (enum `none/base/evm_other`, default `none`), `address` nullable, `status` (`placeholder` only in v1.1) | Wallet addresses are pseudonymous PII — internal only | n/a | No | **Yes — Lane C placeholder only** |
| **audit_log** | Append-only system-wide audit trail | `actor_type` (`human/agent/system`), `actor_ref`, `event_key`, `subject_type` + `subject_id`, `payload_summary` (PII-free), `at` | Payloads must be pre-redacted | Audit rows are evidence refs for proofs | **Yes** | No |

Enums to define once in Prisma (COG-002): `evidence_tag`, `payment_rail`, `chain`, `atc_status`, `proof_kind`, `skill_tier`, `lead_source`, `lead_outcome_kind`, `approval_status`.

## §C. API plan (Next.js App Router route handlers under `apps/web/app/api/`)

All routes JSON; all mutating routes write `audit_log`. No public/unauthenticated mutating routes. Auth in v1.1: single-operator session (simple credential or Vercel/Supabase auth) — multi-tenant later.

| Resource | Routes |
|---|---|
| Agents | `GET/POST /api/agents` · `GET/PATCH /api/agents/[id]` |
| ATCs | `GET/POST /api/agents/[id]/atc` · `POST /api/atc/[id]/revoke` · `POST /api/atc/[id]/suspend` (status transitions only; no destructive delete) |
| Permissions | `GET/PUT /api/agents/[id]/permissions` |
| Skills / SkillProof | `GET/POST /api/skills` · `GET /api/skills/[id]` · `GET/POST /api/skill-proofs` (POST requires `proof_id`) |
| Proofs | `GET/POST /api/proofs` (POST validates evidence_tag rules; no PATCH/DELETE — append-only) · `POST /api/proofs/[id]/supersede` · `POST /api/proofs/[id]/redaction-check` (runs PII scan, may set `public_safe`) · `GET /api/proofs/public` (returns ONLY `public_safe=true`, `summary_public` fields) |
| Reputation | `GET /api/agents/[id]/reputation` · `POST /api/reputation/recompute` (admin) — events are created only by the proof service, **no direct POST endpoint** |
| Leads | `GET/POST /api/leads` (POST = intake; captures consent flag) · `GET /api/leads/[id]` · `POST /api/leads/[id]/purge-pii` (PIPEDA deletion) |
| Agent actions | `GET/POST /api/agent-actions` · `POST /api/agent-actions/[id]/approve` · `POST /api/agent-actions/[id]/reject` · `POST /api/agent-actions/[id]/execute` (refuses real SMS unless permission `sms.send_real` allowed AND approval granted; default simulation) |
| Lead outcomes | `GET/POST /api/lead-outcomes` |
| Credits | `GET /api/credits/accounts/[id]` · `POST /api/credits/transfer` (creates balanced ledger pair; idempotency_key required) — Lane C, COG-009 |
| Wallet bindings | `GET/POST /api/wallet-bindings` (placeholder rows only; rejects any `chain != none` activation in v1.1) — Lane C |

## §D. UI plan (Next.js App Router pages under `apps/web/app/`)

| Page | Route | Contents | Ticket |
|---|---|---|---|
| Cognitia dashboard | `/dashboard` | KPIs: active agents, proofs by evidence_tag, leads in flight, rescued count | COG-007/011 |
| Agents | `/agents` | Agent list with ATC status badges | COG-004 |
| Agent detail | `/agents/[id]` | ATC, permissions, skill proofs, reputation, recent actions | COG-004/008 |
| SkillProof | `/skills` | Core 20 inventory, tiers (T0–T3), linked proofs. Marked INTERNAL | COG-005 |
| Proof Registry | `/proofs` | Filterable proof list; private view shows tags + refs; public toggle previews only redacted `public_safe` rows | COG-003 |
| MoverOS AI Front Desk | `/moveros/front-desk` | Lead inbox, AI draft + approval queue, simulation badge, lead timeline | COG-006 |
| Lead Rescue dashboard | `/moveros/lead-rescue` | Response-time stats, rescued/booked funnel, outcome evidence | COG-007 |
| Crypto-readiness | **No page.** Internal doc only: `docs/cognitia/internal/CRYPTO_READINESS.md` | Lane C design notes, legal gates | COG-009 |

Explicitly absent: any token, coin, staking, or investment page. A test asserts this (§E).

## §E. Test plan (Vitest; suites under `apps/web/tests/`)

| # | Test | Suite |
|---|---|---|
| 1 | `evidence_tag` must be one of the three values; proof creation without a tag fails | `proofs.integrity.test.ts` |
| 2 | Only `verified_fact` proofs can produce positive `reputation_events.delta` | `reputation.rules.test.ts` |
| 3 | `likely_inference` proof → reputation delta ≤ 0 attempt rejected | `reputation.rules.test.ts` |
| 4 | `unknown` proof → positive delta rejected | `reputation.rules.test.ts` |
| 5 | `verified_fact` requires `evidence_ref` AND `verifier_ref`; missing either → rejected | `proofs.integrity.test.ts` |
| 6 | A record containing detectable PII (email/phone patterns) cannot be set `public_safe=true`; redaction-check endpoint blocks it | `redaction.test.ts` |
| 7 | `public_safe` defaults to false; public proofs endpoint never returns `details_private` | `redaction.test.ts` |
| 8 | Executing an agent action creates exactly one proof and one audit_log row | `actions.audit.test.ts` |
| 9 | Real-SMS execution path refuses without `sms.send_real` allow + human approval; simulation default is true | `actions.policy.test.ts` |
| 10 | Credits ledger: no update/delete service methods exist; transfer creates balanced debit+credit; duplicate `idempotency_key` is a no-op | `credits.ledger.test.ts` |
| 11 | Proofs are append-only: update/delete attempts rejected; supersede creates a new row | `proofs.integrity.test.ts` |
| 12 | **No public token page exists**: assert no route under `app/` matches /token|coin|staking|presale|airdrop/i and repo grep finds no public token marketing strings outside `docs/cognitia/internal/` | `doctrine.guard.test.ts` |
| 13 | Token/crypto docs exist only under `docs/cognitia/internal/` and contain the `INTERNAL — LEGAL-GATED` header | `doctrine.guard.test.ts` |
| 14 | Forbidden names guard: `did:cognitia` appears nowhere; `Agent Passport` appears nowhere outside internal docs | `doctrine.guard.test.ts` |

Run: `pnpm test` from `apps/web/` (established in COG-002). CI via GitHub Actions added in COG-002 if time allows, else COG-010.

## §F. Branch/ticket plan

| Ticket | Branch | Scope | Status |
|---|---|---|---|
| COG-001 | `claude/cognitia-v1-1-discovery-g6ryrg` | Discovery + Architecture Lock + this book + prompt chain | **DONE (this session)** |
| COG-002 | `claude/cog-002-schema-foundation` | Ratify stack; scaffold `apps/web`; Prisma schema for all Sprint-1 tables + enums; migrations; seed script; Vitest wiring; doctrine guard tests (#12–14) | next |
| COG-003 | `claude/cog-003-proof-registry` | Proof service (append-only, tag rules, supersede), redaction scanner, proofs API + `/proofs` page; tests #1, 5, 6, 7, 11 | |
| COG-004 | `claude/cog-004-atc` | ATC issue/suspend/revoke lifecycle, permissions, agents API, `/agents` + `/agents/[id]`; policy test #9 groundwork | |
| COG-005 | `claude/cog-005-skillproof-core20` | Seed Core 20 skills, tiers T0–T3, skill_proofs linked to proofs, `/skills` page | |
| COG-006 | `claude/cog-006-front-desk-intake` | lead_intakes + consent + encryption-at-rest, SMS **simulation** pipeline, agent_actions with approval gate, `/moveros/front-desk`; tests #8, 9 | |
| COG-007 | `claude/cog-007-lead-rescue-dashboard` | lead_outcomes, response-time metrics, `/moveros/lead-rescue` + `/dashboard` v1 | |
| COG-008 | `claude/cog-008-reputation-v0` | reputation_events from verified_fact proofs only, snapshots, agent detail reputation; tests #2–4 | |
| COG-009 | `claude/cog-009-credits-wallet-placeholder` | credits accounts + append-only ledger, wallet_bindings placeholder, `docs/cognitia/internal/CRYPTO_READINESS.md`; tests #10, 13 | |
| COG-010 | `claude/cog-010-demo-tests-handoff` | Full test/audit pass, demo seed data (privacy-filtered), demo script, handoff doc, proof pack | |

Rules: tickets land in order (002 → 010); each is one PR; a ticket that grows beyond ~1 session splits into `COG-NNNa/b`.

## §G. Day-by-day 14-day plan

| Day | Work | Ticket(s) |
|---|---|---|
| 1 | Patch doctrine into docs; freeze public token lane; define MoverOS AI Front Desk acceptance criteria | COG-001 ✅ (this session) + AC draft in prompt chain |
| 2 | Repo/asset registry + clean build environment; confirm canonical repo (resolve Discovery U1); ratify stack; create implementation branches | COG-002 start |
| 3 | Lead intake schema (within full schema foundation) | COG-002 finish |
| 4 | ATC schema + agent/permission models live | COG-002/004 |
| 5 | Policy + proof tagging: proof service, evidence-tag enforcement, redaction scanner | COG-003 |
| 6 | SMS-first AI Front Desk simulation: intake → draft → approval → simulated send | COG-006 |
| 7 | Lead Rescue dashboard v1. **Gate check: canonical MoverOS repo clear? If not → build demo here (kill gate §I.3)** | COG-007 |
| 8 | Core SkillProof internal import (Core 20 seed + tiers) | COG-005 |
| 9 | Revenue outcome tracking (lead_outcomes, booking values, verified_fact discipline) | COG-007/009 prep |
| 10 | Inlet/MoverOS demo data flow with privacy filtering end-to-end | COG-006/007 polish |
| 11 | Investor/admin dashboard (`/dashboard` full KPIs) | COG-011 scope inside COG-007/010 |
| 12 | Tests + audit suite complete (all of §E green) | COG-008/010 |
| 13 | Demo script + handoff docs | COG-010 |
| 14 | Hardening + proof pack (evidence-tagged summary of what verifiably works) | COG-010 |

(Reputation v0 — COG-008 — slots Day 11–12 alongside dashboard/tests.)

## §H. First 48-hour plan

| Hours | Work | Status |
|---|---|---|
| 0–2 | Lock doctrine and public names | ✅ done (Architecture Lock v1.1) |
| 2–6 | Identify canonical repo and existing schemas | ✅ done (Discovery: this repo is greenfield; canonical-MoverOS question = U1, gated Day 7) |
| 6–12 | Draft ATC + Proof Registry schema | ✅ drafted (§B); implementation in COG-002/003 |
| 12–18 | Draft MoverOS AI Front Desk workflow acceptance criteria | ✅ drafted (see Prompt 5 acceptance criteria in FABLE_PROMPT_CHAIN.md) |
| 18–24 | Create first implementation tickets | ✅ done (§F) |
| 24–36 | Implement schema/API skeleton — **next prompt (COG-002), not this one** | pending |
| 36–44 | Build dashboard pages — later prompt | pending |
| 44–48 | Run tests/audit — later prompt | pending |

## §I. Kill / freeze gates

1. **Token freeze gate:** if Lane A has no paying pilot by Week 8 → all Lane C token-adjacent work freezes (credits ledger may continue as plain internal accounting).
2. **Offer simplification gate:** if no warm-network mover agrees to test by Week 4 → simplify the offer (smaller scope, free pilot, manual-assist mode) before building more.
3. **Repo gate:** if the canonical MoverOS repo is unclear by Day 7 → build the demo in the cleanest available GTM repo (currently: this repo, `verified_fact` that no other candidate is visible).
4. **Evidence gate:** if a proof cannot be verified → it is tagged `likely_inference` or `unknown`, never `verified_fact`. No exceptions, including founder-facing reports.
5. **Privacy gate:** if privacy filtering (redaction scan) is not implemented and passing tests → **no public proof containing customer data, period.** `public_safe` stays false.
6. **Doctrine gate (standing):** any PR adding a public token page, `did:cognitia`, public "Agent Passport" naming, or a public skill registry is rejected regardless of other merits (enforced by tests #12–14).
