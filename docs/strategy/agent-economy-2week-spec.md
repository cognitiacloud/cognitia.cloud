# Cognitia Agent Economy — Two-Week Execution Spec (v0)

> Date: 2026-06-10. Author: principal-engineer pass. Status: **spec for review**,
> not yet implemented. This is a **new product line** (Cognitia OS / agent
> economy) layered on the existing trust-first action substrate. It does **not**
> replace the CRM-GTM platform; it reuses its primitives.
>
> Confidence labels: **[verified]** exists in this repo today; **[external]**
> named asset not verifiable in this tree; **[new]** to be built.

---

## 0. Thesis in one paragraph

Cognitia already ships a **typed, governed, audited action substrate**: a tool
registry with risk/side-effect typing, an action ledger with idempotency +
provenance + immutable events + audited denials, a deterministic
metrics layer, a live-derived exportable trust packet with an embedded CI eval
gate, an enforced kill switch, and a repository contract proven on Postgres.
The agent economy is **the same substrate with new nouns**: agents register,
declare skills, produce **proofs** of work, accumulate **reputation** from those
proofs, carry an exportable **passport**, and transact in a **simulated** credit/
escrow system. We are not inventing trust infrastructure; we are renaming and
extending what is already test-enforced.

### Reuse map (this is what makes 2 weeks credible)

| New concept               | Reuses (verified primitive)                                            | File                                                        |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Skill Registry            | `ToolRegistry` (typed, risk, side-effect, propose-only)                | `packages/agents/src/tools/registry.ts` **[verified]**      |
| Proof Registry            | `ActionLedger` (idempotency, provenance, events, audited denials)      | `packages/agents/src/ledger/actionLedger.ts` **[verified]** |
| Agent Passport            | `buildTrustPacket` (live-derived, eval-embedded, CI-evidence pointers) | `apps/api/src/trustPacket.ts` **[verified]**                |
| Reputation v0             | `computeTrustMetrics` (deterministic, ledger-derived)                  | `apps/api/src/trustMetrics.ts` **[verified]**               |
| Proof verification        | golden eval harness (real-runtime gate)                                | `packages/evals/src/harness.ts` **[verified]**              |
| Credits/escrow fence      | `v1Mode` fence + kill switch (status-gated, audited)                   | `services.ts`, `actionLedger.connectionHalt` **[verified]** |
| Postgres + RLS + contract | Kysely repo + PGlite contract                                          | `packages/db/*` **[verified]**                              |
| Migrations convention     | `000N_name.sql`                                                        | `packages/db/migrations/` **[verified]**                    |

---

## 1. Scope — what ships in 14 days

Eight deliverables, one new package `@cognitia/economy`, one new API surface,
three new web pages, one migration set.

1. **Agent Registry** — agents are first-class rows with an owner, a model lane
   (`claude` | `fable`), declared skills, and a lifecycle status.
2. **Agent Passport** — a signed, exportable JSON document: identity + declared
   skills + proof summary + reputation + verification, assembled live (the
   trust-packet pattern) and HMAC-signed.
3. **Skill Registry** — persisted typed skills (extends `ToolDefinition`), seeded
   by importing the Hermes skill manifests.
4. **Proof Registry** — append-only, idempotent records that an agent ran a
   skill and produced an attestable output, with a verification result.
5. **Reputation v0** — a deterministic score derived live from proof history
   (success rate × verification pass rate, dampened by disputes/volume).
6. **Credits / escrow simulation** — a double-entry credit ledger + escrow holds
   for "agent hires agent / human hires agent" jobs. **Simulation only** —
   fenced exactly like `v1Mode`, no real money/token/chain.
7. **Token landing page + docs** — informational Next.js pages explaining the
   economy and the (future) token. Disclaimers; no sale, no wallet.
8. **Investor demo** — a scripted end-to-end run + a `/demo` seed script.

---

## 2. Database schema (migration `0008_agent_economy.sql`)

Postgres / Supabase. Conventions inherited: `uuid` pk `default gen_random_uuid()`,
`tenant_id uuid not null references tenants(id)`, snake_case plural tables, RLS
`using (tenant_id = current_setting('app.tenant_id')::uuid)`, `created_at/
updated_at timestamptz default now()`. Every table gets the standard RLS policy

- a `tenant_id` index.

```sql
-- 0008_agent_economy.sql  (additive; no changes to existing tables)

-- Agents: a registered actor with a model lane and a lifecycle.
create table agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  handle text not null,                       -- unique slug within tenant
  display_name text not null,
  owner_ref text not null,                    -- user:<role> / org ref
  model_lane text not null default 'claude',  -- 'claude' | 'fable'
  status text not null default 'active',      -- active | suspended | retired
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, handle)
);

-- Skills: persisted typed capabilities (mirrors ToolDefinition).
create table skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  slug text not null,                         -- e.g. 'hermes.vision.qc'
  name text not null,
  description text not null,
  risk_level text not null default 'low',     -- none|low|medium|high
  side_effect boolean not null default false,
  input_schema jsonb not null default '{}'::jsonb,   -- JSON Schema (from zod)
  output_schema jsonb not null default '{}'::jsonb,
  source text not null default 'hermes',      -- provenance of the skill def
  version text not null default '1.0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug, version)
);

-- Declared capability: which agent claims which skill.
create table agent_skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  declared_at timestamptz not null default now(),
  unique (tenant_id, agent_id, skill_id)
);

-- Proofs: append-only attestations of skill execution.
-- Reuses the ledger discipline: idempotency_key unique per tenant.
create table proofs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  skill_id uuid not null references skills(id),
  idempotency_key text not null,
  input_hash text not null,                   -- sha256 of canonical input
  output_hash text not null,                  -- sha256 of canonical output
  outcome text not null,                      -- success | failure
  evidence_ref text,                          -- pointer (run id, eval id)
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

-- Verification: a deterministic check that a proof holds (eval/replay/hash).
create table proof_verifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  proof_id uuid not null references proofs(id) on delete cascade,
  method text not null,                       -- hash_match | golden_eval | replay
  verified boolean not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Reputation snapshots (score is also derivable live; snapshot for history).
create table reputation_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  score numeric not null,                     -- 0..1
  proofs_total int not null,
  proofs_verified int not null,
  disputes int not null default 0,
  computed_at timestamptz not null default now()
);

-- Credits accounts (SIMULATION). One per agent (and one per tenant treasury).
create table credits_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_kind text not null,                   -- agent | treasury
  owner_ref text not null,                    -- agent:<id> | treasury
  balance bigint not null default 0,          -- integer credits, never float
  created_at timestamptz not null default now(),
  unique (tenant_id, owner_ref)
);

-- Double-entry credit ledger (SIMULATION). Every transfer is two rows or a
-- typed transfer with from/to; we use a typed transfer + invariant test.
create table credits_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  idempotency_key text not null,
  from_ref text not null,
  to_ref text not null,
  amount bigint not null check (amount > 0),
  kind text not null,                         -- grant | escrow_hold | escrow_release | escrow_refund
  job_ref text,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

-- Escrow holds (SIMULATION): funds reserved for a job until proof+verify.
create table escrow_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_ref text not null,
  payer_ref text not null,
  payee_ref text not null,
  amount bigint not null check (amount > 0),
  status text not null default 'held',        -- held | released | refunded
  proof_id uuid references proofs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, job_ref)
);
```

Passport is **derived, not stored** (like the trust packet); an optional
`passport_snapshots` table can persist signed exports if needed — deferred to v1.

---

## 3. New package + API surface

**Package:** `packages/economy` (`@cognitia/economy`) — registries, proof,
reputation, credits, passport assembly. Depends on `@cognitia/core`,
`@cognitia/db`. Pure/testable; no HTTP. Mirrors how `@cognitia/agents` is
structured.

**API:** extend `apps/api/src/server.ts` (Fastify-style, session-derived tenant,
RBAC via `requireTenant` / `requireMutatingRole` / `requireOwner`).

| Method | Route                    | Auth     | Purpose                           |
| ------ | ------------------------ | -------- | --------------------------------- |
| GET    | `/agents`                | viewer   | list registered agents            |
| POST   | `/agents`                | operator | register an agent                 |
| GET    | `/agents/:id`            | viewer   | agent detail (skills, reputation) |
| POST   | `/agents/:id/skills`     | operator | declare a skill                   |
| GET    | `/agents/:id/passport`   | viewer   | **signed passport** (HMAC)        |
| GET    | `/skills`                | viewer   | list skills                       |
| POST   | `/skills/import`         | owner    | import Hermes manifest(s)         |
| POST   | `/proofs`                | operator | submit a proof (idempotent)       |
| POST   | `/proofs/:id/verify`     | operator | run verification                  |
| GET    | `/agents/:id/reputation` | viewer   | live reputation v0                |
| POST   | `/credits/grant`         | owner    | grant simulated credits           |
| POST   | `/jobs/:ref/escrow`      | operator | open escrow hold for a job        |
| POST   | `/jobs/:ref/settle`      | operator | release/refund on proof+verify    |
| GET    | `/economy/ledger`        | viewer   | credits ledger (audit)            |

Every mutating route emits an immutable event + audit entry (reuse the
`actionLedger` event/audit helpers; factor a shared `auditWrite`).

---

## 4. UI pages (`apps/web/src/app`)

1. `/agents` — agent registry table (handle, lane, status, reputation badge),
   "Register agent" form, row → detail.
2. `/agents/[id]` — passport view: identity, declared skills (typed), proof
   history, reputation score with its derivation, "Export passport" (signed
   JSON download — reuse the trust-packet download pattern).
3. `/economy` — credits + escrow simulation board: balances, open escrows,
   ledger; a **"SIMULATION — no real value" banner** (mirrors the halted
   banner styling).
4. `/token` (+ `/token/docs`) — informational landing page: the economy model,
   credit→proof→reputation loop, future-token framing, **legal disclaimer**.
   Static; no wallet, no sale.

---

## 5. Tickets (exact), branches, acceptance criteria

Branch convention (matches session history): `claude/<ticket>-<slug>`.

### FND-1 — economy package + migration + RLS · `claude/fnd-1-economy-foundation`

- **Build:** `packages/economy` scaffold; `0008_agent_economy.sql`; register all
  tables in `packages/db/src/schema.ts` Database interface + Kysely types;
  extend the repository contract with seed/round-trip coverage for each table on
  **memory + PGlite**.
- **Tests:** contract suite green on both engines; RLS policy present (mirror
  `kysely.rls.pglite.test.ts`).
- **Accept:** `pnpm test` green; new tables CRUD + tenant-scoped on Postgres.
- **Deps:** none. **Lane:** Claude.

### SKL-1 — Skill Registry + Hermes import · `claude/skl-1-skill-registry`

- **Build:** `skills` persistence; `importHermesManifest()` reading
  `hermes/skills/*/skill.yaml` + `.mcp.json` into typed `skills` rows
  (slug, risk, side_effect, schemas); `POST /skills/import`, `GET /skills`.
  Skill type extends `ToolDefinition` so the runtime and the registry share one
  shape.
- **Tests:** import is idempotent (re-import = no dupes, unique on
  `(tenant, slug, version)`); a malformed manifest is skipped with a reason, not
  a crash; risk/side_effect parsed correctly; **honesty test:** imported count
  equals manifest count (no silent drops).
- **Accept:** importing the Hermes manifests yields N skills; `/skills` lists
  them with typed schemas.
- **Deps:** FND-1. **External:** the 253-skill set **[external]** — spec imports
  whatever manifests exist; demo can seed a curated subset if the full set is
  absent.

### REG-1 — Agent Registry · `claude/reg-1-agent-registry`

- **Build:** `agents` + `agent_skills`; `POST /agents`, `GET /agents`,
  `GET /agents/:id`, `POST /agents/:id/skills`; `/agents` + `/agents/[id]` UI.
- **Tests:** unique handle per tenant; declaring a skill not in the registry →
  400; lane enum enforced; tenant-scoped list; register emits event+audit.
- **Accept:** register a `claude`-lane and a `fable`-lane agent; each declares
  skills; both visible with their declared capabilities.
- **Deps:** FND-1, SKL-1. **Lane:** Claude.

### PROOF-1 — Proof Registry · `claude/proof-1-proof-registry`

- **Build:** `proofs` + `proof_verifications`; `POST /proofs` (idempotent on
  `idempotency_key`, canonical input/output hashing), `POST /proofs/:id/verify`
  with three methods: `hash_match` (deterministic), `golden_eval` (reuse
  `runGoldenEval` style for skills with fixtures), `replay`. Emits event+audit.
- **Tests:** duplicate proof collapses (idempotent); verify=false when output
  hash mismatches a re-run; a forged proof (wrong hash) fails verification
  (**falsifiable**, like the EVAL-1/REGR-1 proofs); denial audited.
- **Accept:** submit a proof for an agent+skill, verify it, see it on the
  passport; a tampered proof is provably rejected.
- **Deps:** REG-1. **Lane:** Claude (golden_eval method can be Fable lane).

### REP-1 — Reputation v0 · `claude/rep-1-reputation-v0`

- **Build:** pure `computeReputation(proofs, verifications, disputes)` →
  `score = verifiedRate * successRate * volumeDamping`, deterministic, 0..1;
  `GET /agents/:id/reputation`; reputation badge in UI; `reputation_snapshots`
  writer (cron/manual).
- **Tests:** empty history → null/0 with `proofs_total=0` (no fake score);
  monotonic (more verified successes never lowers score); disputes lower it;
  volume damping caps a 1-proof agent below a 100-proof agent at equal rates.
- **Accept:** an agent's score moves only with real proof/verification rows;
  derivation shown in UI.
- **Deps:** PROOF-1. **Lane:** Fable.

### PASS-1 — Agent Passport · `claude/pass-1-agent-passport`

- **Build:** `buildPassport(repo, agentId, secret)` — identity + declared skills
  - proof summary + reputation + **embedded fresh verification run** + HMAC
    signature over the canonical JSON; `GET /agents/:id/passport`; "Export
    passport" download.
- **Tests:** signature verifies and breaks if any field is mutated
  (tamper-evident); no PII; passport reputation equals the live reputation
  endpoint (consistency); a passport with zero proofs is honest (`unproven:
true`), never inflated.
- **Accept:** export a passport, verify its signature offline, mutate a byte →
  signature fails.
- **Deps:** REP-1. **Lane:** Claude.

### CRED-1 — Credits / escrow simulation · `claude/cred-1-credits-escrow-sim`

- **Build:** `credits_accounts` + `credits_ledger` + `escrow_holds`; pure
  `CreditsLedger` with `grant`, `openEscrow`, `settle(release|refund)`, all
  idempotent + audited; **SIMULATION fence** (`economySimMode = true` constant,
  a `assertSimulation()` guard, mirrored on the `v1Mode` pattern) so no path can
  move real value; `/economy` board.
- **Tests:** **conservation invariant** (sum of balances + held escrow is
  constant across any sequence — the double-entry honesty test); escrow releases
  only with a verified proof, refunds otherwise; negative/overdraft blocked;
  idempotent transfers; SIMULATION fence asserted in a test that fails if a
  "real value" flag is ever introduced.
- **Accept:** human grants credits → opens escrow for a job → agent submits
  proof → verify → escrow releases to the agent; tampered/failed proof → refund;
  ledger balances conserved throughout.
- **Deps:** PROOF-1. **Lane:** Fable.

### WEB-1 — Token landing + docs · `claude/web-1-token-landing`

- **Build:** `/token` + `/token/docs` static pages: the credit→proof→reputation
  loop, the passport as the unit of trust, future-token framing, **prominent
  disclaimer** (informational, not an offer/sale, no wallet). Reuse Cognitia
  site styling **[external]**.
- **Tests:** page renders; disclaimer present (a test asserts the disclaimer
  string exists — honesty gate so it can't be silently removed).
- **Accept:** page is shareable and self-explanatory; legal disclaimer visible.
- **Deps:** none (can run parallel). **Lane:** Fable.

### DEMO-1 — Investor demo + seed · `claude/demo-1-investor-demo`

- **Build:** `scripts/demo-seed.ts` that creates 2 agents (claude + fable lanes),
  imports skills, runs a job through escrow→proof→verify→release→reputation→
  passport; a `/demo` read-only page tying it together; the demo script (§9).
- **Tests:** the seed script runs idempotently and ends in a known state
  (asserted), so the demo is reproducible.
- **Accept:** one command produces the full demo state; the script reads cleanly.
- **Deps:** all above. **Lane:** Claude.

---

## 6. Dependencies (critical path)

```
FND-1 ─┬─ SKL-1 ─┬─ REG-1 ─ PROOF-1 ─┬─ REP-1 ─ PASS-1 ─┐
       │         │                   └─ CRED-1 ──────────┼─ DEMO-1
WEB-1 ─┘ (parallel, no deps) ───────────────────────────┘
```

Two lanes: **Claude lane** drives the critical path (FND→SKL→REG→PROOF→PASS→DEMO);
**Fable lane** takes REP-1, CRED-1, WEB-1 (and the golden_eval verification
method) in parallel after PROOF-1 lands.

---

## 7. What NOT to build (hard fence for 2 weeks)

- ❌ **No real token / blockchain / smart contract / wallet / on-chain settlement.**
  Credits and escrow are an in-Postgres **simulation** behind an explicit fence,
  exactly like `v1Mode`. A test fails if a "real value" flag appears.
- ❌ **No real payments or fiat.** No Stripe, no custody.
- ❌ **No KYC / identity / securities apparatus.** The token page is
  informational with disclaimers; not an offer.
- ❌ **No PKI / DID / on-chain identity.** Passport signing is HMAC (shared
  secret) for v0; real asymmetric signing is a v1 note.
- ❌ **No marketplace discovery / ranking ML.** Reputation v0 is a deterministic
  formula, not a learned model.
- ❌ **No live multi-agent orchestration runtime.** Proofs are submitted, not
  produced by an autonomous swarm.
- ❌ **No rewrite/fork of the CRM-GTM platform.** Additive packages only; the
  existing fence, eval gates, and kill switch stay green.
- ❌ **No importing the full 253 skills as a blocker.** Import whatever Hermes
  manifests exist; curate a demo subset if needed.

---

## 8. Daily plan (14 days)

Cadence matches this session: branch from base → implement → tests → docs →
green CI (`build-test`: format + typecheck + full vitest) → squash-merge →
post-merge verify on base. Each day ends mergeable.

| Day | Claude lane                                                               | Fable lane                                          | Exit state                                   |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------- |
| 1   | FND-1: package scaffold, `0008` migration, schema types                   | (spike Hermes manifest format)                      | migration applies; types compile             |
| 2   | FND-1: repository methods + contract on memory+PGlite                     | —                                                   | contract green both engines; **merge FND-1** |
| 3   | SKL-1: skills persistence + import + `/skills`                            | WEB-1: `/token` + `/token/docs` + disclaimer test   | skills import idempotent                     |
| 4   | SKL-1: tests + honesty (count parity); **merge SKL-1**                    | WEB-1: tests; **merge WEB-1**                       | skill registry live                          |
| 5   | REG-1: agents + agent_skills + routes                                     | —                                                   | register/list works                          |
| 6   | REG-1: `/agents` + `/agents/[id]` UI + tests; **merge REG-1**             | —                                                   | agents visible                               |
| 7   | PROOF-1: proofs + hashing + idempotent submit                             | (prep golden_eval fixtures)                         | proof submit idempotent                      |
| 8   | PROOF-1: verify (hash_match/replay) + falsifiable test; **merge PROOF-1** | —                                                   | tampered proof rejected                      |
| 9   | PASS-1: passport assembly + HMAC + route                                  | REP-1: reputation formula + endpoint + tests        | passport signs                               |
| 10  | PASS-1: UI export + tamper test; **merge PASS-1**                         | REP-1: badge + snapshots; **merge REP-1**           | passport exportable                          |
| 11  | (review/integration buffer)                                               | CRED-1: ledger + escrow + conservation invariant    | balances conserved                           |
| 12  | CRED-1 API + `/economy` board + sim fence test (pair)                     | CRED-1 settle-on-proof path; **merge CRED-1**       | escrow→proof→release works                   |
| 13  | DEMO-1: seed script + `/demo` page                                        | golden_eval verification method (PROOF-1 follow-up) | one-command demo state                       |
| 14  | DEMO-1: demo script rehearsal + docs; **merge DEMO-1**                    | buffer / polish                                     | **investor demo ready**                      |

Buffer is built into days 11 and 14; if a lane slips, WEB-1/REP-1 can move
without blocking the critical path.

---

## 9. Final investor demo script (~6 minutes)

**Frame (15s):** "Cognitia is the trust layer for the agent economy. Every agent
has a verifiable passport, every unit of work is a proof, and reputation and
payment are earned from proofs — not claimed. Here it is running."

1. **Registry (45s)** — `/agents`. "Two agents: one on the Claude lane, one on
   the Fable lane. Each declares typed skills imported from Hermes — name, input/
   output schema, risk, side-effect." Open one → typed skill list.
2. **A job + escrow (60s)** — `/economy`. "A buyer posts a job and funds escrow
   with simulated credits." Show the **SIMULATION banner** ("we are deliberately
   not touching real value yet — this is the mechanism, proven, before the
   token"). Open the escrow hold.
3. **Work → proof (60s)** — agent submits a proof of the skill run. Show it's
   **idempotent** (submit twice, one record) and **provenance-stamped**.
4. **Verification (60s)** — run verify. "This isn't a star rating — it's a
   deterministic check: input/output hashes and a golden re-run." Then the
   money shot: **tamper a byte and re-verify → it fails.** "Reputation here is
   falsifiable."
5. **Settlement (30s)** — verified proof → escrow **releases** to the agent;
   show the ledger and the **conservation invariant** ("balances always sum to
   the same total — double-entry, test-enforced").
6. **Reputation + passport (60s)** — `/agents/[id]`: reputation moved _because a
   proof was verified_, with the derivation shown. Click **Export passport** →
   signed JSON. "Mutate any field and the signature breaks." Show it.
7. **Close (30s)** — "Registry, passport, proof, reputation, escrow — all
   running, all test-enforced, zero real value at risk. This is the same
   substrate that already governs our CRM agents in production. The token is the
   last step, not the first." Show the `/token` page.

**Backup:** `scripts/demo-seed.ts` reproduces the exact state in one command if
anything is fat-fingered live.

---

## 10. Acceptance criteria for the whole wave (definition of done)

- All 9 tickets merged; `build-test` green on base (format + typecheck + full
  vitest) after each merge.
- New honesty gates in CI: skill import count parity; proof falsifiability;
  credits conservation invariant; passport tamper-evidence; SIMULATION fence;
  token-page disclaimer presence.
- Repository contract covers every new table on memory **and** Postgres (PGlite).
- One command (`pnpm demo:seed`) produces a reproducible end-to-end demo state.
- The CRM-GTM fence, golden eval gate, and kill switch remain green (no
  regression in the existing 239-test suite).

---

## 11. Open questions for the human (do not block the spec)

1. **Tenancy model for agents** — are agents tenant-scoped (assumed here) or
   global/cross-tenant marketplace? v0 assumes tenant-scoped; cross-tenant
   discovery is a deliberate v1.
2. **Hermes skill manifest schema** — confirm `skill.yaml` shape so `SKL-1`
   import is exact; spec assumes name/description/schemas/risk fields.
3. **Passport signing key custody** — HMAC shared secret for v0 (assumed);
   asymmetric/DID is v1.
4. **Token page legal copy** — needs counsel sign-off on the disclaimer before
   public exposure (WEB-1 ships behind a flag until then).
5. **Repo placement** — this is a new product line; confirm it lives in this
   monorepo (assumed, additive packages) vs. a separate repo.
