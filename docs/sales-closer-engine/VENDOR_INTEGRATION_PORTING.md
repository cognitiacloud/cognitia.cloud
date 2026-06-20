# Vendor Integration — Porting Memo (Apify + Voice/Closer)

**Status:** Docs-only. No code, no dependency changes, no API calls, no credential
testing. This memo extracts the reusable vendor-readiness thinking from the
prototype work (PR #95, stacked on the greenfield PR #94) and re-homes it onto the
**canonical platform** so it can later be implemented natively. It does **not**
implement anything.

> **Auto Growth OS is out of scope** for this vendor-readiness memo and is not
> touched or analysed here.

---

## 1. Decision record

- **PR #93 is canonical.** It extends the real `main` (the existing Cognitia GTM
  platform: `apps/{api,web,worker}`, `packages/{agents,core,db,evals,integrations,
workflows}`) and adds the closer data layer (migrations `0020`/`0021`,
  `packages/core/src/schemas/closer.ts`, repository/RLS/guard tests). All future
  Sales Closer work targets this architecture.
- **PR #94 is prototype / reference only.** It was cut from a stale commit, assumed
  a greenfield repo, and bootstrapped a **parallel** pnpm/Turborepo monorepo
  (`apps/sales-closer` + `packages/{config,db,core,llm,apify,adapters,vision}`) that
  collides with `main`. It will **not** be merged. Treat it as a design spike.
- **PR #95 stays draft.** Its vendor-readiness memo and the two safety guards it
  added are useful _as ideas_, but they sit on #94's greenfield base and must not be
  merged or marked ready. They are superseded by this porting memo.
- **Real credential testing comes later** — only after a platform-native
  implementation on the #93 architecture is built and approved (see §7).

---

## 2. What is reusable from #95 (concepts, not code)

These are vendor-agnostic and port directly:

- **Apify usage model** — Apify is **sourcing only**; demo-safe vs. legal-review vs.
  never-scrape source tiers; dataset import → normalize flow; cost/max-results cap;
  retention; evidence/source-URL provenance.
- **SalesCloser.ai usage model** — downstream voice/closer handoff; what data may
  and may not flow to the vendor; lead/call/outcome lifecycle; webhook outcomes.
- **Vendor safety doctrine** — mock/simulation-by-default; no real calls without
  explicit opt-in + approval; no mass calling; no auto-send.
- **Mock / simulation-by-default** posture.
- **HMAC webhook signature verification.**
- **Idempotency** on vendor events.
- **DNC / unsubscribe suppression** checked before contact.
- **Append-only audit / compliance logging.**
- **Production launch checklist** (legal, privacy, DPA, keys, scripts, opt-out,
  webhook secret, monitoring, rollback).
- **Adapter-seam concept** — one stable interface; swapping vendors is one new
  implementation, no call-site changes.

---

## 3. What must be discarded or rewritten from #94/#95

- **Greenfield pnpm/Turborepo bootstrap** — duplicates `main`'s monorepo. Discard.
- **Parallel `apps/sales-closer`** (Next.js API routes + admin screens). Discard;
  its responsibilities move into `apps/api` + `apps/web` (see §4).
- **Parallel `packages/config`, `packages/db`, `packages/core`, `packages/apify`,
  `packages/adapters`, `packages/llm`, `packages/vision`** — collide with the real
  packages of the same names. Discard; use the platform's existing packages.
- **Drizzle / parallel DB tables** (`prospect_accounts`, `prospect_contacts`,
  `scrape_runs`, `vendor_sync_events`, …). Discard; reuse `accounts`, `contacts`,
  `agent_actions`, `events`/`audit_events`, plus the #93 `closer_*` tables.
- **Any raw email/phone storage.** The prototype stored raw `phone`/`email` on
  contacts. The platform mandates **hashed PII only** (`contacts.email_hash`,
  `contacts.phone_hash`). Raw PII is a hard no.
- **Global `MOCK_MODE` / `VENDOR_NAME` env switch.** Conflicts with the platform's
  **dependency-injection + simulation** conventions (`createGtmServices` wires
  fake clients by default; `agent_actions.simulation` defaults true for gated
  channels). Replace the global switch with DI + per-tenant settings.
- **Direct vendor-call flow that bypasses approval.** The prototype's
  `createVendorLead` / `scheduleCall` POST handlers act immediately. On the platform,
  every outbound/calling action must be **proposed → guardrail-checked → human
  approved → executed** via `agent_actions`.

---

## 4. Platform-native porting map

| Reusable concept                                         | Platform-native home / pattern                                                                                                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apify client + max-results cap                           | `packages/integrations/src/apify` — `IntegrationAdapter` + a `client` seam with a **Fake** (mirror `packages/integrations/src/hubspot`: `client.ts`/`FakeHubspotClient`, `httpClient.ts`, `tokenProvider.ts`). Cap lives in adapter config.               |
| Voice/closer vendors (SalesCloser, Vapi, Retell, Twilio) | `packages/integrations/src/<vendor>` — `IntegrationAdapter` with `kind: 'voice'`, `client` + `Fake`, `tokenProvider` (AES-GCM, like HubSpot OAuth), `webhook` verify; registered in `AdapterRegistry`.                                                    |
| Closer planning, brief generation, LLM orchestration     | `packages/agents/src/closer` extending `MiraAgent` (propose-only) + `contextBuilder` + scoring; LLM via `packages/agents/src/llm` (Anthropic + Fake).                                                                                                     |
| Schemas, guardrails, scoring, policy types               | `packages/core` — `schemas/closer.ts` (#93), guardrail types, policy/scoring types. Consent/suppression reuse existing types; **no new global consent enum**.                                                                                             |
| Migrations (only when needed)                            | `packages/db/migrations` — numbered SQL (continue after `0021`). Reuse `accounts`/`contacts` (hashed PII), `agent_actions` (`idempotency_key`, `simulation`, `guardrail_results`), append-only `audit_events`, RLS via `SET LOCAL app.current_tenant_id`. |
| Propose / approve / execute / webhook routes             | `apps/api` — Fastify handlers (`runMira`, `approveAction`, `executeAction`) + HMAC webhook route pattern (`verifyHubspotSignatureV3` is the reference).                                                                                                   |
| Ingest / audit / scoring / brief jobs                    | `apps/worker` — `Job` interface (`crmSync.ts` reference), scheduled via n8n.                                                                                                                                                                              |
| Approvals + operator UI                                  | `apps/web` — reuse `/approvals` (token session, guardrail display, approve/reject/execute/rollback).                                                                                                                                                      |

**Mapping the prototype's safety features to existing platform primitives:**

- `assertContactCallable` consent gate → reuse `contacts.is_suppressed` + the
  **BLOCKING** `suppressionCheck` guardrail (`packages/agents/src/guardrails`) +
  `lead_intakes.consent_captured`; add a per-call consent guardrail.
- HMAC `verifySignature` / `parseWebhook` → reuse `verifyHubspotSignatureV3` + the
  `apps/api` webhook route; ingest results as append-only `events`/`audit_events`.
- Idempotent webhook writes → reuse `agent_actions.idempotency_key`
  (`unique(tenant_id, idempotency_key)`) + adapter dedupe convention.
- Append-only compliance log → reuse `audit_events`/`events` (insert-only) + proofs.
- Mock-by-default → DI **Fake** clients + `simulation=true` default, not a global env.

---

## 5. Required vendor safety gates

### Apify (sourcing only)

- Source-legality classification per actor/source (production-safe vs. legal-review
  vs. never-scrape).
- No auth-wall / CAPTCHA / anti-bot bypass; honor robots.txt and Apify AUP.
- Max-results / cost cap on every dataset fetch.
- Preserve source URL / evidence for every record (provenance).
- Retention / purge policy; store **hashed PII only**.
- **Fake/mock adapter by default**; real token used only after approval.

### SalesCloser.ai / voice vendors

- **No real calls by default** (simulation/fake mode).
- Per-tenant **encrypted** credentials (later; via `tokenProvider` / AES-GCM).
- Human approval through `agent_actions` (propose → approve → execute).
- Consent / DNC / suppression checked **before propose and before execute**.
- Webhook **signature verification**.
- **Idempotent** webhook handling.
- No raw / unnecessary PII sent to the vendor.
- Transcript / audit **retention** policy.
- Rollback to simulation/fake mode at any time.

### Vapi / Retell / Twilio

- Keep as **future candidates only** — not implemented, no launch.
- No launch until legal/privacy review.
- Call-recording **disclosure** requirements.
- Consent-proof (recorded consent) requirements (TCPA / CASL / CRTC DNCL).
- Webhook verification.
- Rate limits / volume caps.
- **Simulation-first.** SMS / WhatsApp / AI-voice remain gated off at launch.

---

## 6. Required future implementation tickets

Recorded here as **future platform-native tasks** — not code in this PR:

1. Add the Apify max-results cap inside the real `packages/integrations` Apify
   adapter.
2. Add a consent / DNC / suppression check before any vendor call-scheduling action
   (propose-time **and** execute-time).
3. Add idempotent vendor-webhook ingestion using the platform's `agent_actions` /
   `events` / `audit_events` model.
4. Add a fake vendor adapter + simulation-first tests (mirror `FakeHubspotClient`).
5. Write a production credential-testing runbook — only after the #93
   implementation is approved.

---

## 7. Credential-testing boundary

No real credentials are used until **all** of the following hold:

- The #93 platform-native implementation is approved.
- The stack is green.
- Legal / privacy review is complete.
- A test tenant exists.
- Test credentials exist.
- The webhook secret is configured.
- An **internal-owned** test phone number is used.
- No real prospects are contacted.
- The human approval gate is active.
- Simulation is disabled **only** for one controlled test.

Until then: stubs stay stubs, no real API calls by default, no outbound sending, no
autonomous outreach, and SMS / WhatsApp / AI-voice stay gated off.
