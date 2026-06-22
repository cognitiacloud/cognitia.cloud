# Cognitia Sales Closer Intelligence Engine — Implementation Plan

> Status: **APPROVED blueprint.** The **Phase-1 foundation slice is shipped** (merged
> to `main`): migrations `0020`/`0021`, `packages/core/src/schemas/closer.ts`, and the
> repository layer (Kysely + InMemory) + tests. Remaining commits in section 9
> (ingestion service, worker jobs, API routes, web screens, LLM client) are pending.
> Table names below reflect the **as-shipped** schema (see the note in section 2).

## Context

Cognitia needs a **Sales Closer Intelligence Engine**: a system that ingests
prospect lists via Apify actors, normalizes and dedupes them into accounts,
crawls each account's website, enriches contacts, scores the account for sales
fit/intent, and generates an LLM-written **"closer brief"** a salesperson uses to
close the deal.

This plan **extends the existing Cognitia GTM platform** rather than building
anything standalone. (An earlier draft assumed a greenfield repo; that draft was
based on a stale branch. The branch has been rebased onto real `main`, and this
plan is re-grounded against the actual monorepo.) The platform already provides
nearly everything the engine needs:

- **`packages/db`** — multi-tenant Postgres with RLS, Kysely access layer, numbered
  SQL migrations (`0001`–`0019`), `InMemoryRepository` + pglite for tests. Existing
  GTM tables: **`accounts`** (`fit_score`, `timing_score`, `domain`, `industry`,
  `employee_count`, `region`, `attributes`), **`contacts`** (PII **hashed only**:
  `email_hash`/`phone_hash`, `persona`, `is_suppressed`), `leads`, `opportunities`,
  `meetings`, **`signals`** (`hiring|funding|tech_change|intent`), **`playbooks`**
  (ICP + brand_voice + strategy), `documents`/`document_chunks`/`embeddings`
  (pgvector), `agent_runs`/`agent_actions` (approval + idempotency + evidence),
  `proofs`, `events`.
- **`packages/core`** — zod schemas, `ContextPack`/`EvidenceItem`/`ApprovedAgentAction`,
  approval `policies`, event registry, doctrine **guard tests**.
- **`packages/agents`** — Mira orchestrator, deterministic `scoring.ts`, template
  `messageGenerator.ts`, `contextBuilder.ts` (evidence + vector retrieval), `ledger`,
  `guardrails`, `policyGate`, `createGtmServices` DI wiring. **No LLM calls exist yet.**
- **`packages/integrations`** — `AdapterRegistry` + `IntegrationAdapter` contract;
  HubSpot `client`/`httpClient`/`adapter`/`sync` + `FakeHubspotClient`; email stub.
- **`packages/evals`** — evaluator harness, golden datasets, rejection→regression flywheel.
- **`apps/api`** — **Fastify 5** (`server.ts`/`handlers.ts`), session/HMAC auth, tenant
  from verified principal (never trusts `x-tenant-id` on operator routes).
- **`apps/worker`** — simple `Job` interface; jobs are injected functions (e.g.
  `crmSyncJob`) triggered by **n8n** cron/webhooks. No queue library.
- **`apps/web`** — **Next.js 15 + React 19 + Tailwind**; typed `apiClient.ts`; admin
  pages (`/approvals`, `/agents`, `/trust`, `/proofs`, …).
- **`packages/workflows`** — n8n workflow contracts (cron/webhook triggers).

### Platform doctrine the engine MUST honor

- **PII hashed only** — store `email_hash`/`phone_hash`; never raw contact PII in
  `contacts`/payloads (raw PII lives only in `lead_intakes` encrypted columns). Apify
  ingestion must hash before persisting.
- **Evidence tagging / proofs** — claims carry `evidence_tag ∈ {verified_fact,
likely_inference, unknown}`; `verified_fact` requires `evidence_ref` + `verifier_ref`.
- **Human approval gates** — nothing auto-sends; outbound/handoff goes through
  `agent_actions` (proposed → approved) and the existing `/approvals` UI.
- **Multi-tenant RLS** — every new table is `tenant_id`-scoped with the `0001` policy
  pattern; every repository method takes `tenantId`.
- **Append-only** events/proofs; **idempotency** via unique keys; **simulation-first** sends.

### Decisions confirmed with the user

- Integrate into the existing GTM platform (extend packages/apps; no new app).
- LLM: **Claude** default (`claude-opus-4-8` briefs, `claude-sonnet-4-6` scoring) behind
  a provider abstraction — this is the first real LLM client in the repo.
- Apify: official `apify-client` REST SDK wrapped as an integration (with a `Fake` for tests).

---

## 1. Module Structure (extend existing packages/apps)

```
packages/integrations/src/apify/
  httpClient.ts        # ApifyHttpClient: runActor, waitForRun, listDatasetItems (injectable fetch)
  client.ts            # ApifyClient interface + FakeApifyClient (canned dataset for tests/mock)
  adapter.ts           # IntegrationAdapter for action_type "closer.apify.run" (registered in AdapterRegistry)
  index.ts

packages/agents/src/llm/
  anthropic.ts         # AnthropicClient (injectable fetch) + FakeLlmClient; structured-JSON helper
  provider.ts          # LlmClient interface + env-driven model selection (default Claude)
  prompts/             # scoring + closer-brief prompt builders (pure functions, unit-tested)

packages/agents/src/closer/
  ingest.ts            # normalize + dedupe orchestration over the repository
  crawl.ts             # website fetch/extract (fetch only; size/timeout caps; redaction) -> signals
  enrich.ts            # contact derivation + PII hashing (email_hash/phone_hash)
  scoring.ts           # deterministic features (from signals/account) + LLM score; evidence-tagged
  briefGenerator.ts    # LLM closer brief grounded in ContextPack evidence; structured output
  closerService.ts     # pipeline runner: drives the 8 steps; writes run/score/brief + proposes action
  __fixtures__/        # canned apify rows, crawl extracts, stub score/brief

packages/core/src/schemas/closer.ts   # zod: source config, normalized row, score dimensions, brief
packages/db/migrations/0020_*.sql, 0021_*.sql   # new tables (sec. 2)
packages/db/src/schema.ts, repository.ts, kysely.ts, memory.ts   # add table types + repo methods
packages/db/fixtures/closer.fixture.sql          # seed sources/run/scores/briefs

apps/worker/src/jobs/closer/*.ts       # ingest/crawl/score/brief jobs (Job pattern, injected deps)
apps/api/src/closer/*.ts + routes in server.ts   # Fastify handlers (sendAuthed)
apps/web/src/app/closer/*              # admin screens (Next.js + Tailwind), apiClient.ts additions
packages/workflows/src/index.ts        # add "closer-ingest-schedule" cron contract
```

**Rationale:** the engine is domain logic in `packages/agents/src/closer` over the
existing repository + `AdapterRegistry`, so worker jobs, API handlers, and tests all
call the same code — exactly how Mira/HubSpot are structured today.

---

## 2. Database Schema (new migrations `0020`+)

Reuse existing tables wherever possible:

- **`accounts`** — the deduped account home (already has `fit_score`/`timing_score`/`attributes`).
- **`contacts`** — enriched contacts (PII hashed only).
- **`signals`** — crawl/enrichment intelligence; reuse `signal_type` (`hiring|funding|tech_change|intent`) and `payload`/`source`/`strength` (add new types only if needed).
- **`agent_runs`/`agent_actions`** — pipeline execution + the "send brief / handoff" action under human approval.

Add (each `tenant_id`-scoped, RLS per `0001`, `created_at`/`updated_at`, types in `schema.ts`):

> **As-shipped note.** A pipeline run is modeled as an existing **`agent_runs`** row
> (agent `closer`); the Apify-specific run metadata lives in a thin child
> **`closer_scrape_runs`** table (its `source_risk` excludes `disallowed`). Account
> scoring is a 1:1 **`closer_account_profiles`** table (latest tier/score), with
> score history emitted to the append-only **`events`** table — there is no separate
> `closer_account_scores` table or `closer_ingestion_runs` table. The table names
> below match the merged migrations.

**`0020_closer_sources_runs.sql`**

- `closer_sources` — `tenant_id`, `label`, `apify_actor_id`, `input` jsonb, `source_risk` (`safe_public_website_crawl|prototype_only|legal_review_required|disallowed`, with a CHECK that a `disallowed` source can't be `active`), `max_results`, `schedule`, `active`.
- `closer_scrape_runs` — `tenant_id`, `agent_run_id` (parent run), `source_id`, `apify_run_id`, `dataset_id`, `source_risk` (excludes `disallowed`), `status` (`queued|running|succeeded|failed`), `stage` (current step), counts (`rows_in`, `accounts_upserted`, `contacts_upserted`), `error`, timestamps.
- `closer_raw_records` — `tenant_id`, `scrape_run_id`, `payload` jsonb, `normalized` jsonb, `dedupe_key`, `account_id` (nullable until linked). Unique `(tenant_id, scrape_run_id, dedupe_key)` for idempotent ingest.

**`0021_closer_profiles_briefs.sql`**

- `closer_account_profiles` — 1:1 per account (`unique (tenant_id, account_id)`): `tier` (`A|B|C|D`), `score`, `dimensions` jsonb (`fit/intent/timing/reachability`), `rationale`, `model`, dealership fields (`crm_vendor`, `monthly_lead_volume`, `rooftops`, `oem_brands`, `funnel_audit`), `scored_at`, timestamps. Score history is emitted to `events` (no separate scores table).
- `closer_briefs` — `tenant_id`, `account_id`, `agent_run_id`, `model`, `content_md`, `structured` jsonb (pains, hooks, objections, talk_track, recommended_offer), `claims` jsonb (each `{text, evidence_tag, evidence_ref?, confidence?}`), `status` (`draft|approved|sent`), timestamps. Brief references contacts by `persona`/`title`/ref — **no raw contact PII**.

Helpers: `updated_at` trigger (reuse existing convention) + RLS per `0001`. Corresponding methods added to the `Repository` interface and **both** `KyselyRepository` and `InMemoryRepository`.

---

## 3. Ingestion Flow (8 idempotent stages in `closerService.ts`)

Each stage advances `closer_scrape_runs.stage`, is restartable, and uses upsert
semantics. Stages run as worker jobs (sec. 6).

1. **Run Apify actor** — `ApifyClient.runActor(actor_id, input)`; record `apify_run_id`. Mock returns a canned run id.
2. **Retrieve dataset** — `waitForRun` then `listDatasetItems` (paged) → `closer_raw_records`.
3. **Normalize rows** — per-actor adapter maps fields → canonical shape; store in `normalized`.
4. **Dedupe accounts** — `normalize_domain()` + name → `dedupe_key`; upsert `accounts`; link `raw_records.account_id` (prefer non-null/most-recent on merge).
5. **Crawl website** — `fetch` homepage + about/pricing/careers (timeouts, size caps, secret redaction); write `signals` (`tech_change`/`hiring`/`intent`); optionally chunk → `documents`/`embeddings` for RAG.
6. **Enrich contacts** — derive titles/seniority/persona/decision-maker; **hash PII** to `email_hash`/`phone_hash`; upsert `contacts`.
7. **Score account** — deterministic features (ICP from `playbooks` + signals) blended with an LLM score (`claude-sonnet-4-6`) → `closer_account_profiles` (latest tier/score/dimensions; history to `events`); also update `accounts.fit_score`/`timing_score`. Reuses/extends `agents/src/mira/scoring.ts`.
8. **Generate closer brief** — `briefGenerator` builds a `ContextPack` (reusing `contextBuilder`) and prompts `claude-opus-4-8` for a grounded brief → `closer_briefs` (`draft`), runs `guardrails` (evidence grounding), then **proposes an `agent_action`** (`closer.brief.handoff`) for human approval via `/approvals`.

---

## 4. API Endpoints (Fastify, `apps/api`)

Registered in `server.ts`, wrapped by `sendAuthed`; tenant from verified principal; zod validation.

- `POST/GET /closer/sources`, `GET/PATCH/DELETE /closer/sources/:id` — manage Apify import configs.
- `POST /closer/sources/:id/run` — start an ingestion run; returns `run_id`.
- `GET /closer/runs`, `GET /closer/runs/:id` — run status/stage/counts/errors.
- `GET /closer/accounts`, `GET /closer/accounts/:id` — account + signals + contacts + latest score + brief (filters: tier/status/score/search).
- `POST /closer/accounts/:id/rescore`, `POST /closer/accounts/:id/brief` — re-run score/brief stages.
- `GET /closer/briefs/:id` — fetch brief. (Approval/mark-sent goes through the existing `/agent-actions/:id/approve|reject` flow.)
- `GET /closer/health` — readiness incl. mock-mode flag.

---

## 5. Admin UI Screens (`apps/web`, Next.js + Tailwind)

Extend `apiClient.ts` and add pages under `app/closer/`:

- **Dashboard** — counts by status/tier, recent runs, run/stage failures, score distribution.
- **Sources** — list/create/edit Apify configs; "Run now"; per-source run history.
- **Runs** — list + drill-down (stage progress, counts, errors).
- **Accounts** — filterable table (tier/score/status/domain); bulk rescore.
- **Account Detail** — overview, crawl signals, contacts (hashed PII indicators), score breakdown (dimension bars + rationale + evidence), **Closer Brief** panel (rendered markdown + structured fields).
- Brief **approval reuses the existing `/approvals` queue** (the `closer.brief.handoff` action).

---

## 6. Background Job Design (existing `apps/worker` + n8n)

- Implement the pipeline as `Job`s injected with `{ repo, apifyClient, llmClient, tenantId }` — the same DI shape as `crmSyncJob`. No new queue library.
- Jobs: `closerIngestRunJob` (steps 1–4), `closerEnrichJob` (5–6), `closerScoreJob` (7), `closerBriefJob` (8) — or a single `closerPipelineJob` that advances `stage`. Each stage is idempotent and resumable from `closer_scrape_runs.stage`.
- **Scheduling/triggers** via **n8n**: add a `closer-ingest-schedule` cron contract in `packages/workflows` and a `POST /closer/sources/:id/run` webhook trigger (mirrors `crm-sync-schedule`).
- **Retries/observability**: stage status + `error` on `closer_scrape_runs`; pipeline emits `events`; failures surface in the Runs UI. Concurrency via `WORKER_CONCURRENCY`.

---

## 7. Local Mock Mode + Seed Data

- **DI-based mock** (consistent with `createGtmServices`/`v1Mode`): inject `FakeApifyClient` and `FakeLlmClient` (canned outputs) plus `InMemoryRepository`. A `CLOSER_MOCK=1` env flag selects fakes in `apps/api`/`apps/worker`.
- **Fixtures**: `__fixtures__/` in `packages/agents/src/closer` (apify rows, crawl extracts, stub score/brief) + `packages/db/fixtures/closer.fixture.sql` (sources, one finished run, accounts/contacts/signals, sample scores + briefs) extending the existing `acme`/`globex` tenants.
- **Local bring-up**: `scripts/dev/provision-dev-postgres.sh` → `node packages/db/scripts/apply-migrations.mjs` → load fixtures → run `apps/api`/`apps/web` with `CLOSER_MOCK=1` (zero external keys).

---

## 8. Testing Strategy (vitest + pglite + InMemory)

- **Unit**: normalizers/adapters, `normalize_domain`/dedupe, scoring feature extraction, prompt builders, `ApifyClient` (via fake), brief evidence-grounding (reuse `guardrails`), PII-hashing.
- **Integration**: full pipeline over **pglite** (or `InMemoryRepository`) in mock mode — assert state transitions (`raw → accounts → signals → contacts → score → brief → proposed action`) and idempotency on re-run; assert tenant isolation (RLS) per existing `kysely.rls.pglite.test.ts`.
- **API**: Fastify handler tests with `InMemoryRepository` + fake clients (matching existing `apps/api/src/*.test.ts`).
- **Evals**: add `packages/evals` golden scenarios for brief quality (evidence coverage, spamminess, brand voice) and wire into the regression flywheel.
- **Guard test**: assert closer code persists only hashed PII and uses no banned doctrine terms.
- CI: `pnpm check` (`format:check` + `typecheck` + `test`) — the existing `.github/workflows/ci.yml` gate.

---

## 9. Recommended Commit Sequence

1. `feat(db): closer migrations 0020/0021 + schema.ts types + repository (Kysely + InMemory) + RLS + fixtures`
2. `feat(core): closer zod schemas (source, normalized row, score dimensions, brief) with evidence tags`
3. `feat(integrations): Apify httpClient + ApifyClient/FakeApifyClient + adapter registered in AdapterRegistry`
4. `feat(agents): LLM client (Anthropic + FakeLlmClient) + provider/model selection + prompt builders`
5. `feat(agents): closer ingest + dedupe + crawler + contact enrichment (PII-hashed) (+ fixtures)`
6. `feat(agents): closer scoring (deterministic + LLM) + brief generator + closerService pipeline + guardrails`
7. `feat(worker): closer pipeline jobs (DI) + n8n closer-ingest-schedule workflow contract`
8. `feat(api): Fastify closer routes/handlers (sources, runs, accounts, briefs, health)`
9. `feat(web): closer admin screens (dashboard/sources/runs/accounts/detail) + apiClient; brief approval via /approvals`
10. `feat(evals): closer brief golden scenarios + regression wiring`
11. `test: pipeline integration (pglite/mock) + tenant-isolation + guard test; docs/README`

---

## Verification

- **Offline (no keys):** provision local Postgres → apply migrations → load fixtures → run `apps/api` + `apps/web` with `CLOSER_MOCK=1`; from **Sources → Run now**, watch all 8 stages complete in **Runs**, ending in a `draft` brief on **Account Detail** and a `closer.brief.handoff` action in **/approvals**.
- **Automated:** `pnpm check` green (format + typecheck + vitest incl. pipeline integration, tenant isolation, evals, guard test).
- **Live smoke (later):** set real `APIFY_TOKEN` + `ANTHROPIC_API_KEY` + `DATABASE_URL`, unset `CLOSER_MOCK`; run one small source and confirm a real account is scored and briefed with grounded evidence.
