# Sales Closer — Apify Integration Scaffold (Phase 2)

> **Status:** Governed integration scaffold. Fixture-first, no network by default,
> no outreach, no direct PII persisted. Builds on the Phase-1 `closer_*` tables.
> Lives entirely in `packages/integrations/src/apify/`.

## What this is (and is not)

Phase 2 adds a **governed Apify ingestion layer** that — in **fixture mode by
default** — runs an allowlisted data-source actor, fetches dataset items,
normalizes them into **company-level** records, **redacts/hashes** any contact
PII, and stages rows into the Phase-1 `closer_raw_records` table under a
`closer_scrape_run` (a child of an `agent_run`).

It is **not** production scraping, **not** enrichment automation, and **not**
outreach. It contains no email/SMS/WhatsApp/voice/dialer code and never calls
SalesCloser.ai/Vapi/Retell/Twilio. It creates **no** `agent_actions`, **no**
closer briefs, and triggers **no** approval/outreach actions.

## Module layout

```
packages/integrations/src/apify/
  types.ts        # interfaces (ApifyActorConfig, ApifyRunRequest/Result, NormalizedCloserRecord, ApifyClient, ApifyConfig, summaries)
  config.ts       # the ONLY env boundary: loadApifyConfig(env), fixtureApifyConfig(), HARD_MAX_APIFY_ITEMS
  policy.ts       # actor allowlist + source-risk gating + max-items clamp (pure)
  normalizers.ts  # field mapping, dedupe keys, hashing orchestration (pure)
  redaction.ts    # redactContactFields / hashContactValue / ensureNoDirectPiiPersisted (pure)
  fixtures.ts     # two safe demo datasets (pure)
  client.ts       # FakeApifyClient (fixtures; no network)
  httpClient.ts   # HttpApifyClient — the ONLY file that may touch the network (injected fetch)
  adapter.ts      # ApifyAdapter — ingestion orchestrator over the Phase-1 repo
  index.ts        # barrel
```

`policy.ts`, `normalizers.ts`, `redaction.ts`, `fixtures.ts` are **pure** — they
never read `process.env`. Env is read only in `config.ts`; `ApifyAdapter` and
`HttpApifyClient` receive resolved config / token / fetch by injection. Tests
inject fake config and fake fetch.

## Fixture-first behavior

- `ApifyRunRequest.fixtureMode` defaults to **true** → the adapter uses
  `FakeApifyClient` (built-in fixtures), making **zero** network calls.
- A test injects a `fetch` that throws if called and asserts fixture ingestion
  still succeeds — proving the default path never reaches the network.

## Env / live gates

Live mode (`fixtureMode: false`) runs only when **all** hold; otherwise the run
is marked `failed` with a sanitized reason and **no** network call is made:

| Gate                                                              | Source                     |
| ----------------------------------------------------------------- | -------------------------- |
| `APIFY_TOKEN` present                                             | `config.token`             |
| `CLOSER_APIFY_ALLOW_NETWORK=true`                                 | `config.allowNetwork`      |
| a live `ApifyClient` (HttpApifyClient) wired                      | `deps.liveClient`          |
| actor is allowlisted                                              | `policy.getActorConfig`    |
| source exists + `active`                                          | `closer_sources`           |
| source/actor risk not `disallowed`                                | policy                     |
| `legal_review_required`/high-risk has `humanReviewApproved: true` | request                    |
| effective max-items cap applied                                   | `resolveEffectiveMaxItems` |

Env vars (see `.env.example`): `APIFY_TOKEN`, `CLOSER_APIFY_ALLOW_NETWORK`
(default `false`), `CLOSER_APIFY_LIVE_TESTS` (default `false`),
`CLOSER_APIFY_MAX_ITEMS` (default `25`), `CLOSER_APIFY_DEFAULT_TIMEOUT_MS`
(default `30000`).

## Actor allowlist

Only actors in `APIFY_ACTOR_ALLOWLIST` (policy.ts) may run; unknown actorIds are
rejected (`unknown_actor`). Shipped prototypes (none production-ready):

1. **Dealership website / company profile** (`apify/website-content-crawler`) —
   `safe_public_website_crawl`, `prototype`, low PII risk.
2. **Local business directory / maps** (`apify/google-places-scraper`) —
   `legal_review_required`, `prototype`, medium PII risk → requires
   `humanReviewApproved`. Maps/social/platform actors are never production-ready
   by default.

## Source-risk rules (Phase-1 enum aligned)

`closer_sources.source_risk` uses the Phase-1 vocabulary — **there is no
`blocked` value**:

`safe_public_website_crawl | prototype_only | legal_review_required | disallowed`

- `disallowed` → can never run; **no scrape run is created** (the Phase-1
  `closer_scrape_runs.source_risk` deliberately excludes `disallowed`). The
  parent `agent_run` is marked `failed`, reason `blocked_by_policy:disallowed`.
- `legal_review_required` (and high-risk actors classified as such) → require
  `humanReviewApproved: true`, else `human_review_required`.
- A policy refusal maps to a **`failed`** scrape run (the status enum is
  `queued | running | succeeded | failed` — also no `blocked`).

The effective source risk is the **more severe** of the source's and the actor's
risk levels.

## Max-items / cost control

Every run is hard-clamped:

```
effectiveMax = min(request.maxItems, actorConfig.maxItems, config.maxItems, HARD_MAX_APIFY_ITEMS)
```

with `HARD_MAX_APIFY_ITEMS = 500`. The cap is applied by the adapter, sliced by
`FakeApifyClient`, and enforced by `HttpApifyClient` pagination (it stops once
the cap is reached). No request can bypass the caps.

## Redaction / hash behavior — no direct PII persisted

Raw Apify items may carry emails/phones/person names. Before staging:

- `redactContactFields` strips `email/emails/phone/phones/mobile/cell/
contactEmail/contactPhone/fullName/personName/ownerName/managerName` at any
  depth from the persisted `rawRedacted` payload.
- `ensureNoDirectPiiPersisted(record)` runs **before** repo staging and throws
  if any direct-PII key survived (defense in depth).
- Hashes use `piiHash` from `@cognitia/core` only when needed: email is
  trimmed+lowercased, phone reduced to digits, before hashing. Hashes are
  deterministic and non-reversible; raw values are dropped.
- Dedupe keys never use email/phone — they prefer the website **domain**, else a
  `source + name + city + region` slug.
- Raw dataset items are never logged; tokens/raw PII never appear in errors,
  warnings, run metadata, scrape status, test snapshots, or this doc.

## No outreach guarantee

The Apify module only **stages normalized + redacted raw records**. A guard test
(`packages/core/src/closer.guard.test.ts`) enforces, across the closer/apify
production source, that there is:

- no `fetch` outside `apify/httpClient.ts`;
- no `child_process` / `node:net` / `node:dgram` / `node:http` / `node:https` /
  `ssh2` / `new Anthropic`;
- no `createAgentAction(` / `createCloserBrief(` / `email.draft.send` / `sms.`.

## Run lifecycle

`ApifyAdapter.ingest` → create parent `agent_run` → (disallowed/missing source →
fail, no scrape run) → create `closer_scrape_run` → validate policy → (blocked →
mark `failed`, sanitized reason) → pick client by mode (live hard-gated) → run
actor (capped) → on non-success mark `failed` → normalize → redact/hash →
`ensureNoDirectPiiPersisted` → stage (idempotent) → mark `succeeded`. Returns
`{ read, inserted, duplicates, redacted, skipped, warnings }`.

## How to run the tests

```
pnpm exec vitest run packages/integrations/src/apify packages/core/src/closer.guard.test.ts packages/db/src/closer.*
pnpm run check   # format:check + typecheck + full suite
```

All Apify tests are fixtures-only and make no network calls. Live tests are gated
by `CLOSER_APIFY_LIVE_TESTS=true` + `CLOSER_APIFY_ALLOW_NETWORK=true` + a token
and are not part of CI.

## Next phases (out of scope here)

- Phase 3: account scoring + closer brief generation (LLM) in `packages/agents`.
- Phase 4: worker jobs + n8n scheduling that call `ApifyAdapter.ingest`.
- Phase 5+: Fastify routes, web UI, vendor adapters — all gated, all later.
