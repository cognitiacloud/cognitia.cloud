# Cognitia — Fable Prompt Chain (v1.1)

Date: 2026-06-11
Purpose: copy-paste execution prompts for the sessions that follow Step 1 (COG-001).
Authority: every prompt is subordinate to `docs/cognitia/ARCHITECTURE_LOCK_V1_1.md` and `docs/cognitia/IMPLEMENTATION_COMMAND_BOOK.md`. Read both before writing code.

Standing rules for EVERY prompt below (paste-implicit, do not skip):
- Work on the named branch only; draft PR when pushed.
- Tag all report claims `verified_fact` / `likely_inference` / `unknown`.
- No destructive git commands, no secrets printed or committed.
- Never add: public token pages, `did:cognitia`, public "Agent Passport" naming, public skill registry, real SMS sending.
- Do not modify `hermes/` (reference only).
- If a file exists, read it before editing. If unsure, record the uncertainty instead of guessing.

---

## Prompt 2 — Build schema foundation (COG-002)

**Goal:** Scaffold `apps/web` (Next.js App Router + TypeScript + Prisma + Vitest + pnpm per Architecture Lock §9) and implement the full Sprint-1 schema from Command Book §B with migrations, seed, and doctrine guard tests.

**Files to inspect first:** `docs/cognitia/ARCHITECTURE_LOCK_V1_1.md`, `docs/cognitia/IMPLEMENTATION_COMMAND_BOOK.md` (§0, §B, §E #12–14), `docs/cognitia/execution/DISCOVERY_REPORT.md` (U2, U4).

**Files to create/change:** `apps/web/` scaffold; `apps/web/prisma/schema.prisma` (all Sprint-1 models: agents, agent_trust_credentials, agent_permissions, skills, skill_proofs, proofs, reputation_events, lead_intakes, agent_actions, lead_outcomes, audit_log + all enums; defer reputation_snapshots, credits_*, wallet_bindings as commented stubs); `apps/web/prisma/migrations/`; `apps/web/prisma/seed.ts`; `apps/web/tests/doctrine.guard.test.ts`; root `README.md` pointer.

**First action:** confirm stack + DB choice (Supabase Postgres vs local SQLite for now) with the founder via one AskUserQuestion; default to SQLite-local if no answer is possible, with Prisma provider swap noted as trivial.

**Acceptance criteria:**
- `pnpm install && pnpm prisma migrate dev && pnpm test` succeeds from `apps/web/`.
- All enums from Command Book §B exist; `proofs.public_safe` defaults to `false`; `agent_actions.simulation` defaults to `true`.
- Doctrine guard tests (#12–14) pass: no token routes, no `did:cognitia`, no public "Agent Passport".
- Seed creates 1 demo agent + 1 ATC + 3 proofs (one per evidence_tag).

**Tests to run:** `pnpm test`, `pnpm prisma validate`, `pnpm build`.

**What NOT to do:** no UI pages beyond the scaffold default; no API handlers yet; no credits/wallet tables yet; do not deploy; do not touch `hermes/`.

---

## Prompt 3 — Build Proof Registry integrity (COG-003)

**Goal:** Implement the proof service (append-only, evidence-tag rules, supersede chain), the PII redaction scanner, proofs API routes, and the `/proofs` page.

**Files to inspect:** Command Book §B (proofs row), §C (Proofs routes), §E (#1, 5, 6, 7, 11); `hermes/skills/vision-skill/vision_skill.py` — port its PII regex patterns (emails, phones, API keys, file paths, financial digits) into `apps/web/src/lib/redaction/`.

**Files to change:** `apps/web/src/lib/proofs.ts`, `apps/web/src/lib/redaction/scanner.ts`, `apps/web/app/api/proofs/**`, `apps/web/app/proofs/page.tsx`, tests `proofs.integrity.test.ts`, `redaction.test.ts`.

**Acceptance criteria:**
- Creating a proof without `evidence_tag` fails; `verified_fact` without `evidence_ref` + `verifier_ref` fails.
- No update/delete path exists for proofs; supersede creates a new linked row.
- A `summary_public` containing an email or phone cannot become `public_safe=true`; `/api/proofs/public` returns only redacted public-safe fields.
- All §E tests #1, 5, 6, 7, 11 green.

**Tests to run:** `pnpm test`, `pnpm build`.

**What NOT to do:** no reputation logic yet; no direct mutation endpoints for reputation_events; don't expose `details_private` anywhere.

---

## Prompt 4 — Build Agent Trust Credential / ATC (COG-004)

**Goal:** Agent CRUD, ATC lifecycle (issue → active → suspend/revoke/expire), agent_permissions with the `sms.send_real` deny-by-default policy, `/agents` and `/agents/[id]` pages.

**Files to inspect:** Command Book §B (agents, agent_trust_credentials, agent_permissions), §C (Agents/ATCs/Permissions routes), Architecture Lock §4 (VC-style shape, no did:cognitia).

**Files to change:** `apps/web/src/lib/atc.ts`, `apps/web/app/api/agents/**`, `apps/web/app/api/atc/**`, `apps/web/app/agents/**`, test `atc.lifecycle.test.ts`.

**Acceptance criteria:**
- ATC status transitions are explicit (no delete); revoked ATC cannot return to active.
- ATC `claims` JSON contains scope/vertical/policy refs and zero customer PII.
- Every agent starts with `sms.send_real → deny`; only explicit allow + approval can change execution behavior later.
- Audit_log row written for every ATC status change.

**Tests to run:** `pnpm test`, `pnpm build`.

**What NOT to do:** no DID method strings; no public-facing credential verification endpoint yet; no cryptographic signing (placeholder `proof` section only).

---

## Prompt 5 — Build MoverOS AI Front Desk + Lead Intake (COG-006)

**Goal:** Lead intake (simulated SMS + manual entry), AI-drafted response, human approval queue, simulated send, full proof + audit emission. `/moveros/front-desk` page.

**Files to inspect:** Command Book §B (lead_intakes, agent_actions), §C (Leads, Agent actions routes), §E (#8, 9); Architecture Lock §6 (privacy) and §8 (revenue wedge).

**Files to change:** `apps/web/src/lib/frontdesk.ts`, `apps/web/app/api/leads/**`, `apps/web/app/api/agent-actions/**`, `apps/web/app/moveros/front-desk/page.tsx`, tests `actions.audit.test.ts`, `actions.policy.test.ts`.

**Acceptance criteria (these are the MoverOS AI Front Desk workflow acceptance criteria):**
- A lead can be ingested with `source=sms_sim`, consent flag captured, PII stored encrypted/encoded in `lead_intakes` only.
- The front-desk agent drafts a reply; the draft enters `approval_status=pending`; nothing sends without approval.
- Execute with approval → `simulation=true` send recorded; exactly one proof (kind `lead_response`) + one audit_log row created; response_time captured.
- Attempting real SMS fails: permission `sms.send_real` is deny + no provider configured (test #9 green).
- `POST /api/leads/[id]/purge-pii` blanks PII fields and sets `pii_status=purged`.

**Tests to run:** `pnpm test`, `pnpm build`.

**What NOT to do:** no Twilio/real SMS integration, no real customer data in seeds, no lead PII in proofs or logs.

---

## Prompt 6 — Build SkillProof Core 20 (COG-005)

**Goal:** Seed the private Core 20 skill inventory, implement tiers T0_claimed → T3_economically_proven, link skill_proofs to Proof Registry rows, `/skills` page.

**Files to inspect:** Command Book §B (skills, skill_versions, skill_proofs), Architecture Lock §1 + §3 (SkillProof ≠ public registry).

**Files to change:** `apps/web/prisma/seed.ts` (Core 20 list — front-desk vertical skills: lead intake, SMS drafting, scheduling, follow-up, quote prep, escalation, etc.), `apps/web/src/lib/skillproof.ts`, `apps/web/app/api/skills/**`, `apps/web/app/api/skill-proofs/**`, `apps/web/app/skills/page.tsx`, test `skillproof.test.ts`.

**Acceptance criteria:**
- 20 seeded skills, all `visibility=internal`.
- A skill_proof cannot reach `T2_verified`+ unless its linked proof is `verified_fact`.
- `/skills` page renders inventory with tier badges and is clearly marked internal.

**Tests to run:** `pnpm test`, `pnpm build`.

**What NOT to do:** no public skill browsing/registration API; no third-party skill submission.

---

## Prompt 7 — Build Reputation v0 (COG-008)

**Goal:** reputation_events generated only from `verified_fact` proofs, reputation_snapshots computation, reputation display on agent detail.

**Files to inspect:** Command Book §B (reputation rows), §E (#2–4); Architecture Lock §7.

**Files to change:** `apps/web/prisma/schema.prisma` (+migration: reputation_snapshots), `apps/web/src/lib/reputation.ts`, `apps/web/app/api/agents/[id]/reputation/**`, `apps/web/app/agents/[id]/` (reputation panel), test `reputation.rules.test.ts`.

**Acceptance criteria:**
- Positive delta from `likely_inference` or `unknown` proof → rejected at service layer (tests #2–4 green).
- No public POST endpoint for reputation_events.
- Snapshot is reproducible from events (inputs_hash recorded).

**Tests to run:** `pnpm test`, `pnpm build`.

**What NOT to do:** no cross-agent leaderboards, no public reputation API yet, no decay/staking mechanics.

---

## Prompt 8 — Build Credits + Wallet Placeholder (COG-009)

**Goal:** Internal credits (accounts + append-only double-entry ledger), wallet_bindings placeholder (chain default `none`), and `docs/cognitia/internal/CRYPTO_READINESS.md`.

**Files to inspect:** Command Book §B (credits/wallet rows), §E (#10, 13); Architecture Lock §5 (crypto posture) — re-read it fully before this prompt.

**Files to change:** `apps/web/prisma/schema.prisma` (+migration), `apps/web/src/lib/credits.ts`, `apps/web/app/api/credits/**`, `apps/web/app/api/wallet-bindings/**`, `docs/cognitia/internal/CRYPTO_READINESS.md` (header: `INTERNAL — LEGAL-GATED`), test `credits.ledger.test.ts`.

**Acceptance criteria:**
- Transfer creates a balanced debit+credit pair atomically; duplicate `idempotency_key` is a no-op; no update/delete methods on ledger entries (test #10 green).
- Wallet binding rows accept only `status=placeholder`; activating `chain != none` is rejected in v1.1.
- CRYPTO_READINESS.md covers: payment rail progression, Base/EVM optionality notes, ERC-8004/EAS/x402 integration sketches, token legal gates. Internal only (test #13 green).

**Tests to run:** `pnpm test`, `pnpm build`.

**What NOT to do:** NO token page, NO on-chain code, NO wallet SDKs, NO pricing/investment language anywhere, NO public crypto docs.

---

## Prompt 9 — Build dashboard (COG-007 + COG-011 surface)

**Goal:** `/dashboard` (KPIs: agents, proofs by tag, leads, rescues, response times), `/moveros/lead-rescue` (funnel + outcome evidence), lead_outcomes completion with revenue tracking discipline.

**Files to inspect:** Command Book §D, §B (lead_outcomes); Architecture Lock §8 ($997/mo is an assumption — never render projections as realized revenue).

**Files to change:** `apps/web/app/dashboard/page.tsx`, `apps/web/app/moveros/lead-rescue/page.tsx`, `apps/web/src/lib/metrics.ts`, `apps/web/app/api/lead-outcomes/**`, demo seed expansion (privacy-filtered synthetic data only).

**Acceptance criteria:**
- Dashboard distinguishes evidence tags visually; only `verified_fact` counts appear under "proven".
- Lead Rescue shows response-time improvement and rescued/booked funnel from outcomes.
- All demo data is synthetic; no real names/numbers.

**Tests to run:** `pnpm test`, `pnpm build`.

**What NOT to do:** no investor-facing revenue projections presented as fact; no public deployment without founder approval.

---

## Prompt 10 — Test, audit, harden, handoff (COG-010)

**Goal:** Full §E test matrix green, security/privacy audit pass, demo script, proof pack, handoff doc.

**Files to inspect:** entire `docs/cognitia/`, all of `apps/web/tests/`, Command Book §E + §I.

**Files to change:** missing tests; `docs/cognitia/execution/DEMO_SCRIPT.md`; `docs/cognitia/execution/HANDOFF.md`; `docs/cognitia/execution/PROOF_PACK_V1.md` (evidence-tagged inventory of what verifiably works, with commands to reproduce each claim); CI workflow if not yet present.

**Acceptance criteria:**
- All 14 §E tests green in one `pnpm test` run; output pasted into PROOF_PACK_V1.md.
- Audit checklist: no secrets in repo, no PII in seeds/logs, append-only invariants hold, doctrine guards pass, kill-gate status reviewed.
- HANDOFF.md lets a fresh session run the demo end-to-end in <15 minutes.

**Tests to run:** `pnpm test`, `pnpm build`, `pnpm prisma validate`, doctrine grep sweep.

**What NOT to do:** no new features; no claim in the proof pack without a reproduction command; nothing tagged `verified_fact` that wasn't executed in that session.
